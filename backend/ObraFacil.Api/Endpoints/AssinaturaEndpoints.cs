using System.Security.Claims;
using System.Text.Json;
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
    DateTime? CanceladaEm,
    DateTime? ProAte
)
{
    public static AssinaturaResponse From(Assinatura a) => new(
        a.Id, a.Status.ToString(), a.ValorMensal, a.CriadaEm, a.AtivadaEm, a.CanceladaEm, a.ProAte);
}

public record CheckoutResponse(string UrlCheckout, string MercadoPagoId);

public static class AssinaturaEndpoints
{
    /// <summary>Regra comercial: o Pro vale enquanto a assinatura está Ativa
    /// OU até o fim do período já pago (ProAte), mesmo após cancelamento/pausa.</summary>
    private static bool PlanoEfetivoPro(Assinatura? a) =>
        a is not null &&
        (a.Status == StatusAssinatura.Ativa ||
         (a.ProAte.HasValue && a.ProAte.Value > DateTime.UtcNow));

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

            // Confirmação pós-checkout: assinatura recém-criada ainda Pendente é
            // confirmada direto no MP (o webhook cuida do ciclo de vida a partir daqui).
            if (assinatura is not null && assinatura.Status == StatusAssinatura.Pendente
                && !string.IsNullOrEmpty(assinatura.MercadoPagoId) && mp.Configurado)
            {
                try { await SincronizarComMp(db, mp, assinatura); }
                catch (InvalidOperationException) { /* MP indisponível: próxima consulta tenta de novo */ }
            }

            // Expiração da carência (aplicada por data, sem consultar o MP)
            var usuario = await db.Usuarios.FirstAsync(u => u.Id == usuarioId);
            var efetivoPro = PlanoEfetivoPro(assinatura);
            if (usuario.Plano == Plano.Pro && !efetivoPro)
            {
                usuario.Plano = Plano.Free;
                await db.SaveChangesAsync();
            }

            return assinatura is null
                ? Results.Ok(new { plano = "Free", assinatura = (AssinaturaResponse?)null })
                : Results.Ok(new
                {
                    plano = efetivoPro ? "Pro" : "Free",
                    assinatura = AssinaturaResponse.From(assinatura)
                });
        });

        // ---------- Iniciar checkout (assinar ou reassinar) ----------
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

            // Bloqueia apenas se há assinatura ATIVA; cancelada/pausada (mesmo em carência) pode reassinar
            var temAtiva = await db.Assinaturas
                .AnyAsync(a => a.UsuarioId == usuarioId && a.Status == StatusAssinatura.Ativa);
            if (temAtiva)
                return Results.BadRequest(new { erro = "Você já tem uma assinatura ativa.", codigo = "JA_E_PRO" });

            // Reaproveita assinatura pendente recente, se existir
            var pendente = await db.Assinaturas
                .Where(a => a.UsuarioId == usuarioId && a.Status == StatusAssinatura.Pendente)
                .OrderByDescending(a => a.CriadaEm)
                .FirstOrDefaultAsync();

            string mpId, initPoint;
            try
            {
                (mpId, initPoint) = await mp.CriarAssinaturaAsync(usuario.Id, usuario.Email);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new
                {
                    erro = "Não foi possível iniciar o pagamento no Mercado Pago.",
                    codigo = "MP_ERRO",
                    detalhe = ex.Message // TODO: remover detalhe antes do lançamento público
                }, statusCode: 502);
            }

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

        // ---------- Histórico de assinaturas (períodos Pro) ----------
        group.MapGet("/historico", async (ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var historico = await db.Assinaturas
                .AsNoTracking()
                .Where(a => a.UsuarioId == usuarioId && a.Status != StatusAssinatura.Pendente)
                .OrderByDescending(a => a.CriadaEm)
                .Select(a => new
                {
                    a.Id,
                    Status = a.Status.ToString(),
                    a.ValorMensal,
                    a.AtivadaEm,
                    a.CanceladaEm,
                    a.ProAte
                })
                .ToListAsync();

            return Results.Ok(new { historico });
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

            try
            {
                await mp.CancelarAsync(assinatura.MercadoPagoId);
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new
                {
                    erro = "Não foi possível cancelar no Mercado Pago. Tente novamente.",
                    codigo = "MP_ERRO",
                    detalhe = ex.Message
                }, statusCode: 502);
            }

            assinatura.Status = StatusAssinatura.Cancelada;
            assinatura.CanceladaEm = DateTime.UtcNow;
            assinatura.AtualizadaEm = DateTime.UtcNow;

            // Carência: mantém o Pro até o fim do período já pago
            var usuario = await db.Usuarios.FirstAsync(u => u.Id == usuarioId);
            var emCarencia = PlanoEfetivoPro(assinatura);
            usuario.Plano = emCarencia ? Plano.Pro : Plano.Free;

            await db.SaveChangesAsync();

            var mensagem = emCarencia && assinatura.ProAte.HasValue
                ? $"Assinatura cancelada. Você mantém o Pro até {assinatura.ProAte.Value:dd/MM/yyyy}."
                : "Assinatura cancelada. Você voltou ao plano Free.";
            return Results.Ok(new { mensagem });
        });

        // ---------- Webhook do Mercado Pago (público) ----------
        // Configurar no painel MP: {API_URL}/api/webhooks/mercadopago
        // Eventos: Planos e assinaturas (subscription_preapproval + subscription_authorized_payment)
        app.MapPost("/api/webhooks/mercadopago", async (HttpRequest request, AppDbContext db, MercadoPagoService mp) =>
        {
            var dataId = request.Query["data.id"].FirstOrDefault();
            var tipo = request.Query["type"].FirstOrDefault()
                    ?? request.Query["topic"].FirstOrDefault();

            if ((string.IsNullOrEmpty(dataId) || string.IsNullOrEmpty(tipo)) && request.ContentLength > 0)
            {
                try
                {
                    using var doc = await JsonDocument.ParseAsync(request.Body);
                    if (string.IsNullOrEmpty(tipo) && doc.RootElement.TryGetProperty("type", out var t))
                        tipo = t.GetString();
                    if (string.IsNullOrEmpty(dataId) &&
                        doc.RootElement.TryGetProperty("data", out var data) &&
                        data.TryGetProperty("id", out var idProp))
                        dataId = idProp.ValueKind == JsonValueKind.String
                            ? idProp.GetString()
                            : idProp.GetRawText();
                }
                catch (JsonException) { /* corpo não-JSON: segue com o que tem */ }
            }

            if (string.IsNullOrEmpty(dataId))
                return Results.Ok(); // evento não relacionado; 200 para o MP não reenviar

            var xSignature = request.Headers["x-signature"].FirstOrDefault();
            var xRequestId = request.Headers["x-request-id"].FirstOrDefault();
            if (!mp.ValidarWebhook(xSignature, xRequestId, dataId))
                return Results.Unauthorized();

            // Renovação mensal: a notificação traz o id da FATURA; resolve para o preapproval
            var preapprovalId = dataId;
            if (tipo == "subscription_authorized_payment")
            {
                try
                {
                    preapprovalId = await mp.ObterPreapprovalDaFaturaAsync(dataId) ?? "";
                }
                catch (InvalidOperationException) { return Results.Ok(); }
                if (string.IsNullOrEmpty(preapprovalId)) return Results.Ok();
            }

            var assinatura = await db.Assinaturas
                .FirstOrDefaultAsync(a => a.MercadoPagoId == preapprovalId);
            if (assinatura is null)
                return Results.Ok(); // preapproval desconhecido; ignora

            try
            {
                // Fonte da verdade: consulta status + próxima cobrança direto no MP
                await SincronizarComMp(db, mp, assinatura);
            }
            catch (InvalidOperationException)
            {
                // MP indisponível no momento; a próxima notificação/retentativa sincroniza
            }

            return Results.Ok();
        }).WithTags("Assinaturas").AllowAnonymous();
    }

    /// <summary>Sincroniza a assinatura local com o preapproval no MP,
    /// aplicando a regra de carência (Pro até ProAte).</summary>
    private static async Task SincronizarComMp(AppDbContext db, MercadoPagoService mp, Assinatura assinatura)
    {
        var (status, proximaCobranca) = await mp.ConsultarAssinaturaAsync(assinatura.MercadoPagoId);
        var usuario = await db.Usuarios.FirstAsync(u => u.Id == assinatura.UsuarioId);
        var agora = DateTime.UtcNow;

        switch (status)
        {
            case "authorized":
                assinatura.Status = StatusAssinatura.Ativa;
                assinatura.AtivadaEm ??= agora;
                // Pagamento em dia: Pro garantido até a próxima cobrança
                assinatura.ProAte = proximaCobranca ?? agora.AddMonths(1);
                usuario.Plano = Plano.Pro;
                break;

            case "paused":
                // Falha na cobrança: NÃO derruba o Pro antes do fim do período pago
                assinatura.Status = StatusAssinatura.Pausada;
                usuario.Plano = PlanoEfetivoPro(assinatura) ? Plano.Pro : Plano.Free;
                break;

            case "cancelled":
                assinatura.Status = StatusAssinatura.Cancelada;
                assinatura.CanceladaEm ??= agora;
                usuario.Plano = PlanoEfetivoPro(assinatura) ? Plano.Pro : Plano.Free;
                break;

            // "pending": mantém como está
        }

        assinatura.AtualizadaEm = agora;
        await db.SaveChangesAsync();
    }

    private static Guid? GetUsuarioId(ClaimsPrincipal user)
    {
        var claim = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
