using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ObraFacil.Api.Data;
using ObraFacil.Api.Models;
using ObraFacil.Api.Services;

namespace ObraFacil.Api.Endpoints;

public record AssinaturaResponse(
    Guid Id,
    string Status,
    decimal ValorMensal,
    DateTime CriadaEm,
    DateTime? AtivadaEm,
    DateTime? CanceladaEm
)
{
    public static AssinaturaResponse From(Assinatura a) => new(
        a.Id, a.Status.ToString(), a.ValorMensal, a.CriadaEm, a.AtivadaEm, a.CanceladaEm);
}

public record CheckoutResponse(string UrlCheckout, string MercadoPagoId);

public static class AssinaturaEndpoints
{
    public static void MapAssinaturaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/assinaturas")
            .WithTags("Assinaturas")
            .RequireAuthorization();

        // ---------- Minha assinatura ----------
        group.MapGet("/minha", async (ClaimsPrincipal user, AppDbContext db, MercadoPagoService mp) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var assinatura = await db.Assinaturas
                .Where(a => a.UsuarioId == usuarioId)
                .OrderByDescending(a => a.CriadaEm)
                .FirstOrDefaultAsync();

            // Fallback sem webhook: se ainda está Pendente, consulta o status direto no MP.
            // Garante ativação mesmo se a notificação não chegar (ou chegar atrasada).
            if (assinatura is not null && assinatura.Status == StatusAssinatura.Pendente
                && !string.IsNullOrEmpty(assinatura.MercadoPagoId) && mp.Configurado)
            {
                try
                {
                    var statusMp = await mp.ConsultarStatusAsync(assinatura.MercadoPagoId);
                    if (statusMp == "authorized")
                    {
                        assinatura.Status = StatusAssinatura.Ativa;
                        assinatura.AtivadaEm ??= DateTime.UtcNow;
                        assinatura.AtualizadaEm = DateTime.UtcNow;

                        var usuario = await db.Usuarios.FirstAsync(u => u.Id == usuarioId);
                        usuario.Plano = Plano.Pro;
                        await db.SaveChangesAsync();
                    }
                    else if (statusMp == "cancelled")
                    {
                        assinatura.Status = StatusAssinatura.Cancelada;
                        assinatura.CanceladaEm ??= DateTime.UtcNow;
                        assinatura.AtualizadaEm = DateTime.UtcNow;
                        await db.SaveChangesAsync();
                    }
                }
                catch (InvalidOperationException)
                {
                    // MP indisponível: segue com o status local; próxima consulta tenta de novo
                }
            }

            return assinatura is null
                ? Results.Ok(new { plano = "Free", assinatura = (AssinaturaResponse?)null })
                : Results.Ok(new
                {
                    plano = assinatura.Status == StatusAssinatura.Ativa ? "Pro" : "Free",
                    assinatura = AssinaturaResponse.From(assinatura)
                });
        });

        // ---------- Iniciar checkout (upgrade para Pro) ----------
        group.MapPost("/checkout", async (ClaimsPrincipal user, AppDbContext db, MercadoPagoService mp) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            if (!mp.Configurado)
                return Results.Json(new
                {
                    erro = "Pagamentos ainda não configurados no servidor (MP_ACCESS_TOKEN ausente).",
                    codigo = "PAGAMENTO_NAO_CONFIGURADO"
                }, statusCode: 503);

            var usuario = await db.Usuarios.FirstAsync(u => u.Id == usuarioId);

            if (usuario.Plano == Plano.Pro)
                return Results.BadRequest(new { erro = "Você já está no plano Pro.", codigo = "JA_E_PRO" });

            // Reaproveita assinatura pendente recente, se existir
            var pendente = await db.Assinaturas
                .Where(a => a.UsuarioId == usuarioId && a.Status == StatusAssinatura.Pendente)
                .OrderByDescending(a => a.CriadaEm)
                .FirstOrDefaultAsync();

            var (mpId, initPoint) = await mp.CriarAssinaturaAsync(usuario.Id, usuario.Email);

            if (pendente is not null)
            {
                pendente.MercadoPagoId = mpId;
                pendente.ValorMensal = mp.ValorPro;
                pendente.AtualizadaEm = DateTime.UtcNow;
            }
            else
            {
                db.Assinaturas.Add(new Assinatura
                {
                    UsuarioId = usuario.Id,
                    MercadoPagoId = mpId,
                    ValorMensal = mp.ValorPro,
                    Status = StatusAssinatura.Pendente
                });
            }

            await db.SaveChangesAsync();
            return Results.Ok(new CheckoutResponse(initPoint, mpId));
        });

        // ---------- Faturas da assinatura ----------
        group.MapGet("/faturas", async (ClaimsPrincipal user, AppDbContext db, MercadoPagoService mp) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var assinatura = await db.Assinaturas
                .AsNoTracking()
                .Where(a => a.UsuarioId == usuarioId && a.Status != StatusAssinatura.Pendente)
                .OrderByDescending(a => a.CriadaEm)
                .FirstOrDefaultAsync();

            if (assinatura is null)
                return Results.Ok(new { faturas = new List<Dtos.FaturaResponse>() });

            try
            {
                var faturas = await mp.ListarFaturasAsync(assinatura.MercadoPagoId);
                return Results.Ok(new
                {
                    faturas = faturas.Select(f => new Dtos.FaturaResponse(f.Id, f.Status, f.Valor, f.Data)).ToList()
                });
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new
                {
                    erro = "Não foi possível buscar as faturas no Mercado Pago.",
                    codigo = "MP_ERRO",
                    detalhe = ex.Message
                }, statusCode: 502);
            }
        });

        // ---------- Cancelar assinatura ----------
        group.MapPost("/cancelar", async (ClaimsPrincipal user, AppDbContext db, MercadoPagoService mp) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var assinatura = await db.Assinaturas
                .Where(a => a.UsuarioId == usuarioId && a.Status == StatusAssinatura.Ativa)
                .FirstOrDefaultAsync();

            if (assinatura is null)
                return Results.NotFound(new { erro = "Nenhuma assinatura ativa encontrada.", codigo = "SEM_ASSINATURA_ATIVA" });

            await mp.CancelarAsync(assinatura.MercadoPagoId);

            assinatura.Status = StatusAssinatura.Cancelada;
            assinatura.CanceladaEm = DateTime.UtcNow;
            assinatura.AtualizadaEm = DateTime.UtcNow;

            var usuario = await db.Usuarios.FirstAsync(u => u.Id == usuarioId);
            usuario.Plano = Plano.Free;

            await db.SaveChangesAsync();
            return Results.Ok(new { mensagem = "Assinatura cancelada. Você voltou ao plano Free." });
        });

        // ---------- Webhook do Mercado Pago (público) ----------
        // Configurar no painel MP: {API_URL}/api/webhooks/mercadopago | evento: subscription_preapproval
        app.MapPost("/api/webhooks/mercadopago", async (HttpRequest request, AppDbContext db, MercadoPagoService mp) =>
        {
            // MP envia data.id na query (?data.id=...) e/ou no corpo JSON
            var dataId = request.Query["data.id"].FirstOrDefault();

            if (string.IsNullOrEmpty(dataId) && request.ContentLength > 0)
            {
                using var doc = await System.Text.Json.JsonDocument.ParseAsync(request.Body);
                if (doc.RootElement.TryGetProperty("data", out var data) &&
                    data.TryGetProperty("id", out var idProp))
                    dataId = idProp.ValueKind == System.Text.Json.JsonValueKind.String
                        ? idProp.GetString()
                        : idProp.GetRawText();
            }

            if (string.IsNullOrEmpty(dataId))
                return Results.Ok(); // evento não relacionado; responde 200 para o MP não reenviar

            var xSignature = request.Headers["x-signature"].FirstOrDefault();
            var xRequestId = request.Headers["x-request-id"].FirstOrDefault();
            if (!mp.ValidarWebhook(xSignature, xRequestId, dataId))
                return Results.Unauthorized();

            var assinatura = await db.Assinaturas
                .FirstOrDefaultAsync(a => a.MercadoPagoId == dataId);
            if (assinatura is null)
                return Results.Ok(); // preapproval desconhecido; ignora

            // Fonte da verdade: consulta o status direto na API do MP (não confia no payload)
            var status = await mp.ConsultarStatusAsync(dataId);

            var usuario = await db.Usuarios.FirstAsync(u => u.Id == assinatura.UsuarioId);

            switch (status)
            {
                case "authorized":
                    assinatura.Status = StatusAssinatura.Ativa;
                    assinatura.AtivadaEm ??= DateTime.UtcNow;
                    usuario.Plano = Plano.Pro;
                    break;
                case "paused":
                    assinatura.Status = StatusAssinatura.Pausada;
                    usuario.Plano = Plano.Free;
                    break;
                case "cancelled":
                    assinatura.Status = StatusAssinatura.Cancelada;
                    assinatura.CanceladaEm ??= DateTime.UtcNow;
                    usuario.Plano = Plano.Free;
                    break;
                // "pending": mantém como está
            }

            assinatura.AtualizadaEm = DateTime.UtcNow;
            await db.SaveChangesAsync();

            return Results.Ok();
        }).WithTags("Assinaturas").AllowAnonymous();
    }

    private static Guid? GetUsuarioId(ClaimsPrincipal user)
    {
        var claim = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
