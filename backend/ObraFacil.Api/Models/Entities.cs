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
    public decimal? Orcamento { get; set; }
    public double? AreaM2 { get; set; }
    public StatusProjeto Status { get; set; } = StatusProjeto.Planejamento;
    public DateOnly? DataInicio { get; set; }
    public DateOnly? PrevisaoTermino { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    public List<Etapa> Etapas { get; set; } = new();
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
