using Microsoft.EntityFrameworkCore;
using ObraFacil.Api.Data;
using ObraFacil.Api.Dtos;
using ObraFacil.Api.Models;
using ObraFacil.Api.Services;

namespace ObraFacil.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/registrar", async (RegistrarRequest req, AppDbContext db, TokenService tokens) =>
        {
            if (string.IsNullOrWhiteSpace(req.Nome) || req.Nome.Trim().Length < 2)
                return Results.BadRequest(new { erro = "Informe um nome válido." });

            var email = req.Email?.Trim().ToLowerInvariant() ?? "";
            if (!email.Contains('@') || email.Length < 5)
                return Results.BadRequest(new { erro = "Informe um e-mail válido." });

            if (string.IsNullOrEmpty(req.Senha) || req.Senha.Length < 6)
                return Results.BadRequest(new { erro = "A senha precisa ter pelo menos 6 caracteres." });

            var jaExiste = await db.Usuarios.AnyAsync(u => u.Email == email);
            if (jaExiste)
                return Results.Conflict(new { erro = "Já existe uma conta com esse e-mail." });

            var usuario = new Usuario
            {
                Nome = req.Nome.Trim(),
                Email = email,
                SenhaHash = PasswordHasher.Hash(req.Senha)
            };

            db.Usuarios.Add(usuario);
            await db.SaveChangesAsync();

            var token = tokens.GerarToken(usuario);
            var resp = new AuthResponse(token,
                new UsuarioResponse(usuario.Id, usuario.Nome, usuario.Email, usuario.Plano.ToString()));

            return Results.Created($"/api/usuarios/{usuario.Id}", resp);
        });

        group.MapPost("/login", async (LoginRequest req, AppDbContext db, TokenService tokens) =>
        {
            var email = req.Email?.Trim().ToLowerInvariant() ?? "";
            var usuario = await db.Usuarios.FirstOrDefaultAsync(u => u.Email == email);

            if (usuario is null || !PasswordHasher.Verify(req.Senha ?? "", usuario.SenhaHash))
                return Results.Json(new { erro = "E-mail ou senha incorretos." }, statusCode: 401);

            var token = tokens.GerarToken(usuario);
            var resp = new AuthResponse(token,
                new UsuarioResponse(usuario.Id, usuario.Nome, usuario.Email, usuario.Plano.ToString()));

            return Results.Ok(resp);
        });
    }
}
