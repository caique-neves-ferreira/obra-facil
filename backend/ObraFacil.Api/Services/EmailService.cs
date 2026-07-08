using System.Net;
using System.Net.Mail;

namespace ObraFacil.Api.Services;

/// <summary>
/// Envio de e-mails transacionais via SMTP.
/// Variáveis de ambiente (Render):
///   SMTP_HOST  -> ex.: smtp.gmail.com | smtp.resend.com
///   SMTP_PORT  -> ex.: 587 (default)
///   SMTP_USER  -> usuário/login SMTP
///   SMTP_PASS  -> senha (Gmail: senha de app)
///   SMTP_FROM  -> remetente, ex.: "Obra Fácil <no-reply@seudominio.com>"
/// Sem SMTP configurado, o conteúdo é logado no console (apenas para DEV).
/// </summary>
public class EmailService
{
    private readonly string? _host;
    private readonly int _port;
    private readonly string? _user;
    private readonly string? _pass;
    private readonly string _from;
    private readonly ILogger<EmailService> _logger;

    public EmailService(ILogger<EmailService> logger)
    {
        _logger = logger;
        _host = Environment.GetEnvironmentVariable("SMTP_HOST");
        _port = int.TryParse(Environment.GetEnvironmentVariable("SMTP_PORT"), out var p) ? p : 587;
        _user = Environment.GetEnvironmentVariable("SMTP_USER");
        _pass = Environment.GetEnvironmentVariable("SMTP_PASS");
        _from = Environment.GetEnvironmentVariable("SMTP_FROM") ?? "Obra Fácil <no-reply@obrafacil.app>";
    }

    public bool Configurado => !string.IsNullOrEmpty(_host);

    public async Task EnviarAsync(string para, string assunto, string corpo)
    {
        if (!Configurado)
        {
            // DEV ONLY: sem SMTP, loga o conteúdo para permitir testes.
            // TODO: remover este fallback antes do lançamento público.
            _logger.LogWarning("SMTP não configurado. E-mail para {Para} | Assunto: {Assunto} | Corpo: {Corpo}",
                para, assunto, corpo);
            return;
        }

        using var client = new SmtpClient(_host, _port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(_user, _pass),
        };
        using var msg = new MailMessage(_from, para, assunto, corpo);
        await client.SendMailAsync(msg);
    }
}
