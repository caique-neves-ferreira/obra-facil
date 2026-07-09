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

            if (usuario.Plano == Plano.Free && usuario.ProjetosCriadosTotal >= LimiteProjetosFree)
            {
                // Contador vitalício: excluir projetos não devolve cota no plano Free
                return Results.Json(new
                {
                    erro = $"O plano Free permite criar até {LimiteProjetosFree} projetos (mesmo que alguns tenham sido excluídos). Faça upgrade para o plano Pro para projetos ilimitados.",
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

            usuario.ProjetosCriadosTotal++;
            db.Projetos.Add(projeto);
            await db.SaveChangesAsync();

            return Results.Created($"/api/projetos/{projeto.Id}", ProjetoResponse.From(projeto));
        });

        group.MapPut("/{id:guid}", async (Guid id, CriarProjetoRequest req, ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(req.Nome) || req.Nome.Trim().Length < 2)
                return Results.BadRequest(new { erro = "Informe um nome para o projeto." });

            var projeto = await db.Projetos
                .FirstOrDefaultAsync(p => p.Id == id && p.UsuarioId == usuarioId);

            if (projeto is null)
                return Results.NotFound(new { erro = "Projeto não encontrado." });

            projeto.Nome = req.Nome.Trim();
            projeto.Descricao = req.Descricao?.Trim();
            projeto.Endereco = req.Endereco?.Trim();
            projeto.Regiao = req.Regiao?.Trim();
            projeto.TerrenoRegistrado = req.TerrenoRegistrado;
            projeto.TipoArquitetura = req.TipoArquitetura?.Trim();
            projeto.Orcamento = req.Orcamento;
            projeto.AreaM2 = req.AreaM2;
            projeto.DataInicio = req.DataInicio;
            projeto.PrevisaoTermino = req.PrevisaoTermino;

            await db.SaveChangesAsync();

            var completo = await db.Projetos
                .AsNoTracking()
                .Include(p => p.Etapas)
                .FirstAsync(p => p.Id == id);
            return Results.Ok(ProjetoResponse.From(completo));
        });

        group.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var projeto = await db.Projetos
                .FirstOrDefaultAsync(p => p.Id == id && p.UsuarioId == usuarioId);

            if (projeto is null)
                return Results.NotFound(new { erro = "Projeto não encontrado." });

            db.Projetos.Remove(projeto); // cascade apaga etapas e análise
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        group.MapPatch("/{id:guid}/etapas/{etapaId:guid}", async (
            Guid id, Guid etapaId, AtualizarEtapaRequest req, ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var etapa = await db.Etapas
                .FirstOrDefaultAsync(e => e.Id == etapaId
                    && e.ProjetoId == id
                    && e.Projeto!.UsuarioId == usuarioId);

            if (etapa is null)
                return Results.NotFound(new { erro = "Etapa não encontrada." });

            if (req.Concluida is not null)
                etapa.Concluida = req.Concluida.Value;
            if (req.CustoReal is not null)
                etapa.CustoReal = req.CustoReal.Value >= 0 ? req.CustoReal.Value : null;
            await db.SaveChangesAsync();
            return Results.Ok(new EtapaResponse(etapa.Id, etapa.Nome, etapa.Ordem, etapa.Concluida, etapa.CustoReal));
        });
    }

    private static Guid? GetUsuarioId(ClaimsPrincipal user)
    {
        var sub = user.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? user.FindFirstValue("sub");
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
