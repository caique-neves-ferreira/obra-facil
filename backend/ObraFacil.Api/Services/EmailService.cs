using System.Net;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Text;
using System.Text.Json;

namespace ObraFacil.Api.Services;

/// <summary>
/// Envio de e-mails transacionais.
/// Ordem de preferência:
///   1) Resend (HTTP, porta 443) — funciona no Render free. Env: RESEND_API_KEY, SMTP_FROM
///   2) SMTP (portas 25/465/587) — bloqueado no Render free; útil só em host pago.
///        Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
/// Sem nenhum configurado, loga o conteúdo (DEV).
/// </summary>
public class EmailService
{
    private readonly HttpClient _http;
    private readonly ILogger<EmailService> _logger;

    private readonly string? _resendKey;
    private readonly string? _smtpHost;
    private readonly int _smtpPort;
    private readonly string? _smtpUser;
    private readonly string? _smtpPass;
    private readonly string _from;

    public EmailService(HttpClient http, ILogger<EmailService> logger)
    {
        _http = http;
        _logger = logger;

        _resendKey = Environment.GetEnvironmentVariable("RESEND_API_KEY");
        _smtpHost = Environment.GetEnvironmentVariable("SMTP_HOST");
        _smtpPort = int.TryParse(Environment.GetEnvironmentVariable("SMTP_PORT"), out var p) ? p : 587;
        _smtpUser = Environment.GetEnvironmentVariable("SMTP_USER");
        _smtpPass = Environment.GetEnvironmentVariable("SMTP_PASS");
        _from = Environment.GetEnvironmentVariable("SMTP_FROM") ?? "Obra Fácil <onboarding@resend.dev>";
    }

    public bool Configurado => !string.IsNullOrEmpty(_resendKey) || !string.IsNullOrEmpty(_smtpHost);

    public async Task EnviarAsync(string para, string assunto, string corpo)
    {
        if (!string.IsNullOrEmpty(_resendKey))
        {
            await EnviarViaResendAsync(para, assunto, corpo);
            return;
        }

        if (!string.IsNullOrEmpty(_smtpHost))
        {
            await EnviarViaSmtpAsync(para, assunto, corpo);
            return;
        }

        // DEV ONLY: sem provedor configurado, loga o conteúdo.
        // TODO: remover este fallback antes do lançamento público.
        _logger.LogWarning("E-mail nao configurado. Para {Para} | {Assunto} | {Corpo}", para, assunto, corpo);
    }

    // ---------------- Resend (HTTP) ----------------
    private async Task EnviarViaResendAsync(string para, string assunto, string corpo)
    {
        var payload = new
        {
            from = _from,
            to = new[] { para },
            subject = assunto,
            text = corpo,
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _resendKey);
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        HttpResponseMessage resp;
        string raw;
        try
        {
            resp = await _http.SendAsync(req);
            raw = await resp.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha de rede ao enviar via Resend para {Para}", para);
            throw new InvalidOperationException($"Falha de rede ao enviar e-mail (Resend): {ex.Message}");
        }

        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogError("Resend retornou {Status}: {Corpo}", (int)resp.StatusCode, raw);
            throw new InvalidOperationException(
                $"Erro no envio de e-mail (Resend {(int)resp.StatusCode}): {raw[..Math.Min(raw.Length, 300)]}");
        }
    }

    // ---------------- SMTP (fallback host pago) ----------------
    private async Task EnviarViaSmtpAsync(string para, string assunto, string corpo)
    {
        using var client = new SmtpClient(_smtpHost, _smtpPort)
        {
            EnableSsl = true,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(_smtpUser, _smtpPass),
        };
        using var msg = new MailMessage
        {
            From = new MailAddress(ExtrairEmail(_from), ExtrairNome(_from)),
            Subject = assunto,
            Body = corpo,
        };
        msg.To.Add(para);

        try
        {
            await client.SendMailAsync(msg);
        }
        catch (SmtpException ex)
        {
            _logger.LogError(ex, "Falha SMTP ao enviar para {Para}: {Status}", para, ex.StatusCode);
            throw new InvalidOperationException(
                $"Erro SMTP ({ex.StatusCode}): {ex.Message}. Em hospedagem gratuita as portas SMTP costumam ser bloqueadas — use Resend (RESEND_API_KEY).");
        }
    }

    private static string ExtrairEmail(string from)
    {
        var i = from.IndexOf('<');
        var j = from.IndexOf('>');
        return (i >= 0 && j > i) ? from[(i + 1)..j].Trim() : from.Trim();
    }

    private static string ExtrairNome(string from)
    {
        var i = from.IndexOf('<');
        return i > 0 ? from[..i].Trim() : "Obra Facil";
    }
}
