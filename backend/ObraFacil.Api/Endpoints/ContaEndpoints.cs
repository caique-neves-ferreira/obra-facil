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

        // ---------- Alterar senha ----------
        group.MapPost("/senha", async (AlterarSenhaRequest req, ClaimsPrincipal user, AppDbContext db) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            var u = await db.Usuarios.FirstOrDefaultAsync(x => x.Id == usuarioId);
            if (u is null) return Results.Unauthorized();

            if (!PasswordHasher.Verify(req.SenhaAtual ?? "", u.SenhaHash))
                return Results.BadRequest(new { erro = "Senha atual incorreta.", codigo = "SENHA_ATUAL_INCORRETA" });

            if (string.IsNullOrEmpty(req.NovaSenha) || req.NovaSenha.Length < 6)
                return Results.BadRequest(new { erro = "A nova senha precisa ter pelo menos 6 caracteres.", codigo = "SENHA_CURTA" });

            u.SenhaHash = PasswordHasher.Hash(req.NovaSenha);
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
