using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ObraFacil.Api.Data;
using ObraFacil.Api.Models;
using ObraFacil.Api.Services;

namespace ObraFacil.Api.Endpoints;

public static class AnaliseEndpoints
{
    public static void MapAnaliseEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projetos/{projetoId:guid}/analise")
            .WithTags("Análise IA")
            .RequireAuthorization();

        // Retorna a análise já gerada (ou 404 se ainda não existe)
        group.MapGet("/", async (Guid projetoId, ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var analise = await db.Analises
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.ProjetoId == projetoId && a.Projeto!.UsuarioId == usuarioId);

            return analise is null
                ? Results.NotFound(new { erro = "Análise ainda não gerada para este projeto." })
                : Results.Ok(MontarResposta(analise));
        });

        // Gera (ou regenera) a análise com IA
        group.MapPost("/", async (Guid projetoId, ClaimsPrincipal user, AppDbContext db, AnaliseIaService ia) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var projeto = await db.Projetos
                .FirstOrDefaultAsync(p => p.Id == projetoId && p.UsuarioId == usuarioId);

            if (projeto is null)
                return Results.NotFound(new { erro = "Projeto não encontrado." });

            if (string.IsNullOrWhiteSpace(projeto.Regiao))
                return Results.BadRequest(new { erro = "Informe a região do projeto para gerar a análise." });

            try
            {
                var (legalizacao, custos, planta) = await ia.GerarAnaliseAsync(projeto);

                var analise = await db.Analises.FirstOrDefaultAsync(a => a.ProjetoId == projetoId);
                if (analise is null)
                {
                    analise = new AnaliseProjeto { ProjetoId = projetoId };
                    db.Analises.Add(analise);
                }

                analise.LegalizacaoJson = legalizacao;
                analise.CustosJson = custos;
                analise.PlantaJson = planta;
                analise.GeradoEm = DateTime.UtcNow;

                await db.SaveChangesAsync();
                return Results.Ok(MontarResposta(analise));
            }
            catch (JsonException)
            {
                return Results.Json(new { erro = "A IA retornou um formato inesperado. Tente gerar novamente." }, statusCode: 502);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { erro = ex.Message }, statusCode: 502);
            }
        });
    }

    private static object MontarResposta(AnaliseProjeto a) => new
    {
        projetoId = a.ProjetoId,
        geradoEm = a.GeradoEm,
        legalizacao = JsonSerializer.Deserialize<JsonElement>(a.LegalizacaoJson),
        custosPorEtapa = JsonSerializer.Deserialize<JsonElement>(a.CustosJson),
        planta = JsonSerializer.Deserialize<JsonElement>(a.PlantaJson),
    };

    private static Guid? GetUsuarioId(ClaimsPrincipal user)
    {
        var sub = user.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? user.FindFirstValue("sub");
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
