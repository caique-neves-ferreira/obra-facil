using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ObraFacil.Api.Services;

/// <summary>
/// Integração com Mercado Pago — assinatura recorrente (Preapproval).
/// Variáveis de ambiente necessárias (Render):
///   MP_ACCESS_TOKEN     -> Access Token de produção/teste do Mercado Pago
///   MP_WEBHOOK_SECRET   -> Secret do webhook (painel MP > Webhooks > assinatura secreta)
///   MP_VALOR_PRO        -> Valor mensal do plano Pro (ex.: "39.90"); default 39.90
///   FRONTEND_URL        -> já existente; usada como back_url pós-checkout
/// </summary>
public class MercadoPagoService
{
    private readonly HttpClient _http;
    private readonly string _webhookSecret;
    public decimal ValorPro { get; }

    public MercadoPagoService(HttpClient http)
    {
        _http = http;

        var accessToken = Environment.GetEnvironmentVariable("MP_ACCESS_TOKEN") ?? "";
        _webhookSecret = Environment.GetEnvironmentVariable("MP_WEBHOOK_SECRET") ?? "";

        var valorRaw = Environment.GetEnvironmentVariable("MP_VALOR_PRO") ?? "39.90";
        ValorPro = decimal.TryParse(valorRaw, System.Globalization.NumberStyles.Number,
            System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 39.90m;

        _http.BaseAddress = new Uri("https://api.mercadopago.com/");
        if (!string.IsNullOrEmpty(accessToken))
            _http.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        _http.Timeout = TimeSpan.FromSeconds(30);
    }

    public bool Configurado => _http.DefaultRequestHeaders.Authorization is not null;

    /// <summary>
    /// Cria um preapproval (assinatura pendente) e retorna (id, initPoint).
    /// O usuário conclui o pagamento no init_point (checkout do MP, aceita cartão).
    /// </summary>
    public async Task<(string id, string initPoint)> CriarAssinaturaAsync(Guid usuarioId, string emailUsuario)
    {
        var backUrl = Environment.GetEnvironmentVariable("FRONTEND_URL")?.Split(',')[0].Trim()
            ?? "http://localhost:5173";

        var body = new
        {
            reason = "Obra Fácil — Plano Pro",
            external_reference = usuarioId.ToString(),
            payer_email = emailUsuario,
            back_url = $"{backUrl}/planos?retorno=mp",
            auto_recurring = new
            {
                frequency = 1,
                frequency_type = "months",
                transaction_amount = ValorPro,
                currency_id = "BRL"
            }
        };

        HttpResponseMessage resp;
        string raw;
        try
        {
            resp = await _http.PostAsync("preapproval",
                new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"));
            raw = await resp.Content.ReadAsStringAsync();
        }
        catch (TaskCanceledException)
        {
            throw new InvalidOperationException(
                "Timeout ao comunicar com o Mercado Pago (30s). Tente novamente.");
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException(
                $"Falha de rede ao comunicar com o Mercado Pago: {ex.Message}");
        }

        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Falha ao criar assinatura no Mercado Pago ({(int)resp.StatusCode}): {raw[..Math.Min(raw.Length, 300)]}");

        using var doc = JsonDocument.Parse(raw);
        var id = doc.RootElement.GetProperty("id").GetString() ?? "";
        var initPoint = doc.RootElement.GetProperty("init_point").GetString() ?? "";
        return (id, initPoint);
    }

    /// <summary>Consulta o status atual do preapproval: authorized | paused | cancelled | pending.</summary>
    public async Task<string> ConsultarStatusAsync(string preapprovalId)
    {
        HttpResponseMessage resp;
        string raw;
        try
        {
            resp = await _http.GetAsync($"preapproval/{preapprovalId}");
            raw = await resp.Content.ReadAsStringAsync();
        }
        catch (TaskCanceledException)
        {
            throw new InvalidOperationException(
                "Timeout ao consultar assinatura no Mercado Pago (30s).");
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException(
                $"Falha de rede ao consultar assinatura no Mercado Pago: {ex.Message}");
        }

        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Falha ao consultar assinatura ({(int)resp.StatusCode}): {raw[..Math.Min(raw.Length, 300)]}");

        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement.GetProperty("status").GetString() ?? "pending";
    }

    /// <summary>Cancela o preapproval no Mercado Pago.</summary>
    public async Task CancelarAsync(string preapprovalId)
    {
        var body = new StringContent("""{"status":"cancelled"}""", Encoding.UTF8, "application/json");
        HttpResponseMessage resp;
        try
        {
            resp = await _http.PutAsync($"preapproval/{preapprovalId}", body);
        }
        catch (TaskCanceledException)
        {
            throw new InvalidOperationException(
                "Timeout ao cancelar assinatura no Mercado Pago (30s). Tente novamente.");
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException(
                $"Falha de rede ao cancelar assinatura no Mercado Pago: {ex.Message}");
        }

        if (!resp.IsSuccessStatusCode)
        {
            var raw = await resp.Content.ReadAsStringAsync();
            throw new InvalidOperationException(
                $"Falha ao cancelar assinatura ({(int)resp.StatusCode}): {raw[..Math.Min(raw.Length, 300)]}");
        }
    }

    /// <summary>Fatura (cobrança recorrente) de uma assinatura.</summary>
    public record FaturaMp(string Id, string Status, decimal Valor, DateTime? Data);

    /// <summary>Lista as faturas (authorized_payments) de um preapproval, mais recentes primeiro.</summary>
    public async Task<List<FaturaMp>> ListarFaturasAsync(string preapprovalId)
    {
        HttpResponseMessage resp;
        string raw;
        try
        {
            resp = await _http.GetAsync($"authorized_payments/search?preapproval_id={preapprovalId}");
            raw = await resp.Content.ReadAsStringAsync();
        }
        catch (TaskCanceledException)
        {
            throw new InvalidOperationException("Timeout ao buscar faturas no Mercado Pago (30s).");
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException($"Falha de rede ao buscar faturas no Mercado Pago: {ex.Message}");
        }

        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Falha ao buscar faturas ({(int)resp.StatusCode}): {raw[..Math.Min(raw.Length, 300)]}");

        var faturas = new List<FaturaMp>();
        using var doc = JsonDocument.Parse(raw);
        if (doc.RootElement.TryGetProperty("results", out var results) &&
            results.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in results.EnumerateArray())
            {
                var id = item.TryGetProperty("id", out var idProp)
                    ? (idProp.ValueKind == JsonValueKind.String ? idProp.GetString() ?? "" : idProp.GetRawText())
                    : "";
                var status = item.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
                decimal valor = 0;
                if (item.TryGetProperty("transaction_amount", out var ta) && ta.ValueKind == JsonValueKind.Number)
                    valor = ta.GetDecimal();
                DateTime? data = null;
                if (item.TryGetProperty("debit_date", out var dd) && dd.ValueKind == JsonValueKind.String &&
                    DateTime.TryParse(dd.GetString(), out var d1))
                    data = d1;
                else if (item.TryGetProperty("date_created", out var dc) && dc.ValueKind == JsonValueKind.String &&
                    DateTime.TryParse(dc.GetString(), out var d2))
                    data = d2;

                faturas.Add(new FaturaMp(id, status, valor, data));
            }
        }

        return faturas.OrderByDescending(f => f.Data ?? DateTime.MinValue).ToList();
    }

    /// <summary>
    /// Valida a assinatura HMAC do webhook (header x-signature: "ts=...,v1=...").
    /// Manifest oficial MP: "id:{dataId};request-id:{xRequestId};ts:{ts};"
    /// Se MP_WEBHOOK_SECRET não estiver configurado, aceita (modo MVP/dev) — configure em produção.
    /// </summary>
    public bool ValidarWebhook(string? xSignature, string? xRequestId, string? dataId)
    {
        if (string.IsNullOrEmpty(_webhookSecret)) return true; // MVP: sem secret configurado
        if (string.IsNullOrEmpty(xSignature) || string.IsNullOrEmpty(dataId)) return false;

        string? ts = null, v1 = null;
        foreach (var parte in xSignature.Split(','))
        {
            var kv = parte.Split('=', 2, StringSplitOptions.TrimEntries);
            if (kv.Length != 2) continue;
            if (kv[0] == "ts") ts = kv[1];
            if (kv[0] == "v1") v1 = kv[1];
        }
        if (ts is null || v1 is null) return false;

        var manifest = $"id:{dataId!.ToLowerInvariant()};request-id:{xRequestId};ts:{ts};";
        var hash = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(_webhookSecret),
            Encoding.UTF8.GetBytes(manifest));
        var esperado = Convert.ToHexString(hash).ToLowerInvariant();

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(esperado), Encoding.UTF8.GetBytes(v1.ToLowerInvariant()));
    }
}
