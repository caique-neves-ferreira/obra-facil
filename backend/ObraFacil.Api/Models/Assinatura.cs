namespace ObraFacil.Api.Models;

public enum StatusAssinatura
{
    Pendente = 0,     // checkout criado, aguardando autorização no Mercado Pago
    Ativa = 1,        // preapproval "authorized"
    Pausada = 2,      // preapproval "paused" (falha de cobrança)
    Cancelada = 3     // cancelada pelo usuário ou pelo MP
}

/// <summary>
/// Assinatura recorrente do plano Pro via Mercado Pago (Preapproval).
/// Uma assinatura por usuário; histórico preservado ao cancelar/recriar.
/// </summary>
public class Assinatura
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    /// <summary>Id do preapproval no Mercado Pago (usado no webhook e consultas).</summary>
    public string MercadoPagoId { get; set; } = string.Empty;

    public StatusAssinatura Status { get; set; } = StatusAssinatura.Pendente;
    public decimal ValorMensal { get; set; }

    /// <summary>Data até a qual o plano Pro está garantido (próxima cobrança do MP).
    /// Cancelamento ou falha de cartão não removem o Pro antes desta data.</summary>
    public DateTime? ProAte { get; set; }

    public DateTime CriadaEm { get; set; } = DateTime.UtcNow;
    public DateTime? AtivadaEm { get; set; }
    public DateTime? CanceladaEm { get; set; }
    public DateTime AtualizadaEm { get; set; } = DateTime.UtcNow;
}
