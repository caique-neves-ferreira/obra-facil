using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ObraFacil.Api.Data;
using ObraFacil.Api.Dtos;
using ObraFacil.Api.Models;

namespace ObraFacil.Api.Endpoints;

public static class ProjetoEndpoints
{
    private const int LimiteProjetosFree = 2;

    public static void MapProjetoEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projetos")
            .WithTags("Projetos")
            .RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var projetos = await db.Projetos
                .AsNoTracking()
                .Where(p => p.UsuarioId == usuarioId)
                .Include(p => p.Etapas)
                .OrderByDescending(p => p.CriadoEm)
                .ToListAsync();

            return Results.Ok(projetos.Select(ProjetoResponse.From));
        });

        group.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var projeto = await db.Projetos
                .AsNoTracking()
                .Include(p => p.Etapas)
                .FirstOrDefaultAsync(p => p.Id == id && p.UsuarioId == usuarioId);

            return projeto is null
                ? Results.NotFound(new { erro = "Projeto não encontrado." })
                : Results.Ok(ProjetoResponse.From(projeto));
        });

        group.MapPost("/", async (CriarProjetoRequest req, ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Nome) || req.Nome.Trim().Length < 2)
                return Results.BadRequest(new { erro = "Informe um nome para o projeto." });

            var usuario = await db.Usuarios.FirstAsync(u => u.Id == usuarioId);

            if (usuario.Plano == Plano.Free)
            {
                var total = await db.Projetos.CountAsync(p => p.UsuarioId == usuarioId);
                if (total >= LimiteProjetosFree)
                    return Results.Json(new
                    {
                        erro = $"O plano Free permite até {LimiteProjetosFree} projetos. Faça upgrade para o plano Pro para projetos ilimitados.",
                        codigo = "LIMITE_PLANO_FREE"
                    }, statusCode: 403);
            }

            var projeto = new Projeto
            {
                UsuarioId = usuario.Id,
                Nome = req.Nome.Trim(),
                Descricao = req.Descricao?.Trim(),
                Endereco = req.Endereco?.Trim(),
                Regiao = req.Regiao?.Trim(),
                TerrenoRegistrado = req.TerrenoRegistrado,
                TipoArquitetura = req.TipoArquitetura?.Trim(),
                Orcamento = req.Orcamento,
                AreaM2 = req.AreaM2,
                DataInicio = req.DataInicio,
                PrevisaoTermino = req.PrevisaoTermino
            };

            if (req.Etapas is { Count: > 0 })
            {
                projeto.Etapas = req.Etapas
                    .Where(e => !string.IsNullOrWhiteSpace(e))
                    .Select((nome, i) => new Etapa { Nome = nome.Trim(), Ordem = i + 1 })
                    .ToList();
            }

            db.Projetos.Add(projeto);
            await db.SaveChangesAsync();

            return Results.Created($"/api/projetos/{projeto.Id}", ProjetoResponse.From(projeto));
        });
    }

    private static Guid? GetUsuarioId(ClaimsPrincipal user)
    {
        var sub = user.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? user.FindFirstValue("sub");
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
