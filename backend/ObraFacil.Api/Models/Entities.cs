namespace ObraFacil.Api.Models;

public enum Plano
{
    Free = 0,
    Pro = 1
}

public enum StatusProjeto
{
    Planejamento = 0,
    EmAndamento = 1,
    Pausado = 2,
    Concluido = 3
}

public class Usuario
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Nome { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string SenhaHash { get; set; } = string.Empty;
    public Plano Plano { get; set; } = Plano.Free;
    public int ProjetosCriadosTotal { get; set; }   // contador vitalício — não diminui ao excluir (anti-burla do limite Free)
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public List<Projeto> Projetos { get; set; } = new();
}

public class Projeto
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    public string Nome { get; set; } = string.Empty;
    public string? Descricao { get; set; }
    public string? Endereco { get; set; }
    public string? Regiao { get; set; }              // Cidade/UF — usada na análise de legalização
    public bool TerrenoRegistrado { get; set; }      // Terreno já registrado em cartório?
    public string? TipoArquitetura { get; set; }     // Térrea, Sobrado, Kitnet, Comercial...
    public decimal? Orcamento { get; set; }
    public double? AreaM2 { get; set; }
    public StatusProjeto Status { get; set; } = StatusProjeto.Planejamento;
    public DateOnly? DataInicio { get; set; }
    public DateOnly? PrevisaoTermino { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public List<Etapa> Etapas { get; set; } = new();
    public AnaliseProjeto? Analise { get; set; }
}

/// <summary>
/// Análise gerada por IA: etapas de legalização, custos por etapa e ambientes da planta.
/// Os payloads são armazenados como JSON bruto retornado/validado do modelo.
/// </summary>
public class AnaliseProjeto
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjetoId { get; set; }
    public Projeto? Projeto { get; set; }

    public string LegalizacaoJson { get; set; } = "[]";
    public string CustosJson { get; set; } = "[]";
    public string PlantaJson { get; set; } = "{}";
    public DateTime GeradoEm { get; set; } = DateTime.UtcNow;
}

public class Etapa
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjetoId { get; set; }
    public Projeto? Projeto { get; set; }

    public string Nome { get; set; } = string.Empty;
    public int Ordem { get; set; }
    public bool Concluida { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
