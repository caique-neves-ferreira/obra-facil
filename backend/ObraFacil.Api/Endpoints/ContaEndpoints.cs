using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ObraFacil.Api.Data;
using ObraFacil.Api.Dtos;
using ObraFacil.Api.Services;

namespace ObraFacil.Api.Endpoints;

public static class ContaEndpoints
{
    public static void MapContaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/conta")
            .WithTags("Conta")
            .RequireAuthorization();

        // ---------- Perfil ----------
        group.MapGet("/", async (ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var u = await db.Usuarios.AsNoTracking().FirstOrDefaultAsync(x => x.Id == usuarioId);
            if (u is null) return Results.Unauthorized();

            return Results.Ok(new ContaResponse(u.Id, u.Nome, u.Email, u.Plano.ToString(), u.ReceberEmails, u.CriadoEm));
        });

        // ---------- Atualizar nome / e-mail / preferência de e-mails ----------
        group.MapPatch("/", async (AtualizarContaRequest req, ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var u = await db.Usuarios.FirstOrDefaultAsync(x => x.Id == usuarioId);
            if (u is null) return Results.Unauthorized();

            if (req.Nome is not null)
            {
                if (req.Nome.Trim().Length < 2)
                    return Results.BadRequest(new { erro = "Informe um nome válido.", codigo = "NOME_INVALIDO" });
                u.Nome = req.Nome.Trim();
            }

            if (req.Email is not null)
            {
                var email = req.Email.Trim().ToLowerInvariant();
                if (!email.Contains('@') || email.Length < 5)
                    return Results.BadRequest(new { erro = "Informe um e-mail válido.", codigo = "EMAIL_INVALIDO" });

                var emJaUsado = await db.Usuarios.AnyAsync(x => x.Email == email && x.Id != usuarioId);
                if (emJaUsado)
                    return Results.Conflict(new { erro = "Já existe uma conta com esse e-mail.", codigo = "EMAIL_EM_USO" });

                u.Email = email;
            }

            if (req.ReceberEmails is not null)
                u.ReceberEmails = req.ReceberEmails.Value;

            await db.SaveChangesAsync();
            return Results.Ok(new ContaResponse(u.Id, u.Nome, u.Email, u.Plano.ToString(), u.ReceberEmails, u.CriadoEm));
        });

        // ---------- Alterar senha: passo 1 — solicitar código por e-mail ----------
        group.MapPost("/senha/codigo", async (ClaimsPrincipal user, AppDbContext db, EmailService email) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var u = await db.Usuarios.FirstOrDefaultAsync(x => x.Id == usuarioId);
            if (u is null) return Results.Unauthorized();

            var codigo = Random.Shared.Next(100000, 999999).ToString();
            u.CodigoSenhaHash = PasswordHasher.Hash(codigo);
            u.CodigoSenhaExpiraEm = DateTime.UtcNow.AddMinutes(10);
            await db.SaveChangesAsync();

            try
            {
                await email.EnviarAsync(
                    u.Email,
                    "Obra Fácil — Código para alteração de senha",
                    $"Olá, {u.Nome.Split(' ')[0]}!\n\n" +
                    $"Seu código para alterar a senha é: {codigo}\n\n" +
                    "Ele vale por 10 minutos. Se você não pediu essa alteração, ignore este e-mail.");
            }
            catch (Exception ex)
            {
                return Results.Json(new
                {
                    erro = "Não foi possível enviar o e-mail com o código. Verifique a configuração de e-mail e tente novamente.",
                    codigo = "EMAIL_ERRO",
                    detalhe = ex.Message // TODO: remover detalhe antes do lançamento público
                }, statusCode: 502);
            }

            var arroba = u.Email.IndexOf('@');
            var mascarado = arroba > 1
                ? $"{u.Email[0]}***{u.Email[(arroba - 1)..]}"
                : u.Email;

            return Results.Ok(new
            {
                mensagem = $"Enviamos um código de 6 dígitos para {mascarado}. Ele vale por 10 minutos.",
                emailConfigurado = email.Configurado
            });
        });

        // ---------- Alterar senha: passo 2 — confirmar código + nova senha ----------
        group.MapPost("/senha", async (AlterarSenhaRequest req, ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var u = await db.Usuarios.FirstOrDefaultAsync(x => x.Id == usuarioId);
            if (u is null) return Results.Unauthorized();

            if (string.IsNullOrEmpty(u.CodigoSenhaHash) || u.CodigoSenhaExpiraEm is null)
                return Results.BadRequest(new { erro = "Solicite o código de verificação primeiro.", codigo = "CODIGO_NAO_SOLICITADO" });

            if (u.CodigoSenhaExpiraEm < DateTime.UtcNow)
                return Results.BadRequest(new { erro = "Código expirado. Solicite um novo.", codigo = "CODIGO_EXPIRADO" });

            if (!PasswordHasher.Verify(req.Codigo ?? "", u.CodigoSenhaHash))
                return Results.BadRequest(new { erro = "Código incorreto. Confira o e-mail e tente de novo.", codigo = "CODIGO_INCORRETO" });

            if (string.IsNullOrEmpty(req.NovaSenha) || req.NovaSenha.Length < 6)
                return Results.BadRequest(new { erro = "A nova senha precisa ter pelo menos 6 caracteres.", codigo = "SENHA_CURTA" });

            u.SenhaHash = PasswordHasher.Hash(req.NovaSenha);
            u.CodigoSenhaHash = null;
            u.CodigoSenhaExpiraEm = null;
            await db.SaveChangesAsync();

            return Results.Ok(new { mensagem = "Senha alterada com sucesso." });
        });
    }

    private static Guid? GetUsuarioId(ClaimsPrincipal user)
    {
        var claim = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
