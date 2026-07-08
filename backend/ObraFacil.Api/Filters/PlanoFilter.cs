using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ObraFacil.Api.Data;
using ObraFacil.Api.Models;

namespace ObraFacil.Api.Filters;

/// <summary>
/// Feature-gating por plano para Minimal API.
/// Uso:
///   group.MapPost("/relatorio-pdf", ...).RequirePlano(Plano.Pro);
///   ou no group inteiro: app.MapGroup("/api/relatorios").RequirePlano(Plano.Pro);
/// Consulta o plano no banco (não no token JWT) para refletir upgrade/downgrade imediato via webhook.
/// </summary>
public static class PlanoFilter
{
    public static TBuilder RequirePlano<TBuilder>(this TBuilder builder, Plano planoMinimo)
        where TBuilder : IEndpointConventionBuilder
    {
        builder.AddEndpointFilter(async (context, next) =>
        {
            var user = context.HttpContext.User;
            var claim = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
            if (!Guid.TryParse(claim, out var usuarioId))
                return Results.Unauthorized();

            var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            var usuario = await db.Usuarios.FindAsync(usuarioId);
            if (usuario is null)
                return Results.Unauthorized();

            if (usuario.Plano >= planoMinimo && planoMinimo >= Plano.Pro)
            {
                // Expiração da carência: Pro sem assinatura ativa vale só até ProAte
                var assinatura = await db.Assinaturas
                    .AsNoTracking()
                    .Where(a => a.UsuarioId == usuarioId)
                    .OrderByDescending(a => a.CriadaEm)
                    .FirstOrDefaultAsync();

                var vigente = assinatura is not null &&
                    (assinatura.Status == StatusAssinatura.Ativa ||
                     (assinatura.ProAte.HasValue && assinatura.ProAte.Value > DateTime.UtcNow));

                // assinatura == null: plano concedido manualmente (ex.: cortesia) — permite
                if (assinatura is not null && !vigente)
                {
                    usuario.Plano = Plano.Free;
                    await db.SaveChangesAsync();
                }
            }

            if (usuario.Plano < planoMinimo)
            {
                return Results.Json(new
                {
                    erro = "Este recurso está disponível apenas no plano Pro. Faça upgrade para desbloquear.",
                    codigo = "RECURSO_PLANO_PRO",
                    planoAtual = usuario.Plano.ToString(),
                    planoNecessario = planoMinimo.ToString()
                }, statusCode: 403);
            }

            return await next(context);
        });

        return builder;
    }
}
