using ObraFacil.Api.Models;

namespace ObraFacil.Api.Dtos;

public record RegistrarRequest(string Nome, string Email, string Senha);
public record LoginRequest(string Email, string Senha);
public record AuthResponse(string Token, UsuarioResponse Usuario);

public record UsuarioResponse(Guid Id, string Nome, string Email, string Plano);

public record CriarProjetoRequest(
    string Nome,
    string? Descricao,
    string? Endereco,
    string? Regiao,
    bool TerrenoRegistrado,
    string? TipoArquitetura,
    decimal? Orcamento,
    double? AreaM2,
    DateOnly? DataInicio,
    DateOnly? PrevisaoTermino,
    List<string>? Etapas
);

public record EtapaResponse(Guid Id, string Nome, int Ordem, bool Concluida);

public record ProjetoResponse(
    Guid Id,
    string Nome,
    string? Descricao,
    string? Endereco,
    string? Regiao,
    bool TerrenoRegistrado,
    string? TipoArquitetura,
    decimal? Orcamento,
    double? AreaM2,
    string Status,
    DateOnly? DataInicio,
    DateOnly? PrevisaoTermino,
    DateTime CriadoEm,
    List<EtapaResponse> Etapas
)
{
    public static ProjetoResponse From(Projeto p) => new(
        p.Id, p.Nome, p.Descricao, p.Endereco, p.Regiao, p.TerrenoRegistrado, p.TipoArquitetura, p.Orcamento, p.AreaM2,
        p.Status.ToString(), p.DataInicio, p.PrevisaoTermino, p.CriadoEm,
        p.Etapas.OrderBy(e => e.Ordem)
            .Select(e => new EtapaResponse(e.Id, e.Nome, e.Ordem, e.Concluida))
            .ToList()
    );
}
