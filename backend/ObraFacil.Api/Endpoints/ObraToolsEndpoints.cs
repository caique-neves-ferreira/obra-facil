using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ObraFacil.Api.Data;
using ObraFacil.Api.Dtos;
using ObraFacil.Api.Filters;
using ObraFacil.Api.Models;
using ObraFacil.Api.Services;

namespace ObraFacil.Api.Endpoints;

public static class ObraToolsEndpoints
{
    public static void MapObraToolsEndpoints(this IEndpointRouteBuilder app)
    {
        // ==================== Assistente IA (exclusivo Pro) ====================
        var ia = app.MapGroup("/api/projetos/{id:guid}/assistente")
            .WithTags("Assistente IA")
            .RequireAuthorization()
            .RequirePlano(Plano.Pro);

        ia.MapPost("/", async (Guid id, ChatRequest req, ClaimsPrincipal user,
            AppDbContext db, AssistenteObraService assistente) =>
        {
            var usuarioId = GetUsuarioId(user);
            if (usuarioId is null) return Results.Unauthorized();

            if (!assistente.Configurado)
                return Results.Json(new { erro = "Assistente indisponível: IA não configurada no servidor.", codigo = "IA_NAO_CONFIGURADA" }, statusCode: 503);

            var projeto = await CarregarProjetoCompleto(db, id, usuarioId.Value);
            if (projeto is null) return Results.NotFound(new { erro = "Projeto não encontrado.", codigo = "PROJETO_NAO_ENCONTRADO" });

            var historico = (req.Mensagens ?? new List<ChatMensagemDto>())
                .Select(m => new AssistenteObraService.Mensagem(m.Role, m.Content));

            try
            {
                var resposta = await assistente.ResponderAsync(projeto, historico);
                return Results.Ok(new ChatResponse(resposta));
            }
            catch (InvalidOperationException ex)
            {
                return Results.Json(new { erro = "Não foi possível falar com o assistente agora.", codigo = "IA_ERRO", detalhe = ex.Message }, statusCode: 502);
            }
        });

        // ==================== Relatórios ====================
        var rel = app.MapGroup("/api/projetos/{id:guid}/relatorios")
            .WithTags("Relatórios")
            .RequireAuthorization();

        rel.MapGet("/custos.xlsx", async (Guid id, ClaimsPrincipal user, AppDbContext db, RelatorioService svc) =>
        {
            var (projeto, erro) = await Resolver(db, user, id);
            if (erro is not null) return erro;
            var bytes = svc.GerarPlanilhaCustos(projeto!);
            return Results.File(bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"custos-{Slug(projeto!.Nome)}.xlsx");
        });

        rel.MapGet("/progresso.xlsx", async (Guid id, ClaimsPrincipal user, AppDbContext db, RelatorioService svc) =>
        {
            var (projeto, erro) = await Resolver(db, user, id);
            if (erro is not null) return erro;
            var bytes = svc.GerarPlanilhaProgresso(projeto!);
            return Results.File(bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"progresso-{Slug(projeto!.Nome)}.xlsx");
        });

        rel.MapGet("/legalizacao.pdf", async (Guid id, ClaimsPrincipal user, AppDbContext db, RelatorioService svc) =>
        {
            var (projeto, erro) = await Resolver(db, user, id);
            if (erro is not null) return erro;
            var bytes = svc.GerarPdfLegalizacao(projeto!);
            return Results.File(bytes, "application/pdf", $"legalizacao-{Slug(projeto!.Nome)}.pdf");
        });
    }

    private static async Task<(Projeto? projeto, IResult? erro)> Resolver(AppDbContext db, ClaimsPrincipal user, Guid id)
    {
        var usuarioId = GetUsuarioId(user);
        if (usuarioId is null) return (null, Results.Unauthorized());
        var projeto = await CarregarProjetoCompleto(db, id, usuarioId.Value);
        return projeto is null
            ? (null, Results.NotFound(new { erro = "Projeto não encontrado.", codigo = "PROJETO_NAO_ENCONTRADO" }))
            : (projeto, null);
    }

    private static Task<Projeto?> CarregarProjetoCompleto(AppDbContext db, Guid id, Guid usuarioId) =>
        db.Projetos
            .AsNoTracking()
            .Include(p => p.Etapas)
            .Include(p => p.Analise)
            .FirstOrDefaultAsync(p => p.Id == id && p.UsuarioId == usuarioId);

    private static string Slug(string s)
    {
        var limpo = new string(s.ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray());
        while (limpo.Contains("--")) limpo = limpo.Replace("--", "-");
        return limpo.Trim('-');
    }

    private static Guid? GetUsuarioId(ClaimsPrincipal user)
    {
        var claim = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(claim, out var id) ? id : null;
    }
}
