using System.Text;
using System.Text.Json;
using ObraFacil.Api.Models;

namespace ObraFacil.Api.Services;

/// <summary>
/// Assistente conversacional sobre a obra do usuário.
/// Monta um system prompt com o contexto do projeto (dados, etapas, análise de IA)
/// e mantém o histórico da conversa enviado pelo cliente.
/// </summary>
public class AssistenteObraService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _model;

    public AssistenteObraService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _apiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY")
            ?? config["Anthropic:ApiKey"]
            ?? "";
        _model = Environment.GetEnvironmentVariable("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

        _http.BaseAddress = new Uri("https://api.anthropic.com/");
        if (!string.IsNullOrEmpty(_apiKey))
            _http.DefaultRequestHeaders.Add("x-api-key", _apiKey);
        _http.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
        _http.Timeout = TimeSpan.FromSeconds(60);
    }

    public bool Configurado => !string.IsNullOrEmpty(_apiKey);

    public record Mensagem(string Role, string Content);

    public async Task<string> ResponderAsync(Projeto projeto, IEnumerable<Mensagem> historico)
    {
        if (!Configurado)
            throw new InvalidOperationException("ANTHROPIC_API_KEY não configurada no servidor.");

        var system = MontarContexto(projeto);

        // Mantém apenas as últimas 12 mensagens para controlar custo/latência
        var mensagens = historico
            .Where(m => m.Role is "user" or "assistant" && !string.IsNullOrWhiteSpace(m.Content))
            .TakeLast(12)
            .Select(m => new { role = m.Role, content = m.Content })
            .ToList();

        if (mensagens.Count == 0)
            throw new InvalidOperationException("Envie ao menos uma mensagem.");

        var body = new
        {
            model = _model,
            max_tokens = 1200,
            system,
            messages = mensagens
        };

        var resp = await _http.PostAsync("v1/messages",
            new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"));

        var raw = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Falha na API de IA ({(int)resp.StatusCode}): {raw[..Math.Min(raw.Length, 300)]}");

        using var doc = JsonDocument.Parse(raw);
        return doc.RootElement.GetProperty("content")
            .EnumerateArray()
            .Where(c => c.GetProperty("type").GetString() == "text")
            .Select(c => c.GetProperty("text").GetString())
            .FirstOrDefault() ?? "";
    }

    private static string MontarContexto(Projeto p)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Você é o assistente de obras do app Obra Fácil. Você conversa com o dono desta obra específica, de forma prática, objetiva e em português do Brasil.");
        sb.AppendLine("Use o contexto abaixo para responder. Se a pergunta fugir totalmente do universo da construção/reforma/legalização, redirecione gentilmente. Não invente dados que não estão no contexto; se algo não foi informado, diga que não consta no projeto.");
        sb.AppendLine();
        sb.AppendLine("=== CONTEXTO DA OBRA ===");
        sb.AppendLine($"Nome: {p.Nome}");
        if (!string.IsNullOrEmpty(p.Descricao)) sb.AppendLine($"Descrição: {p.Descricao}");
        sb.AppendLine($"Região: {p.Regiao ?? "não informada"}");
        sb.AppendLine($"Endereço: {p.Endereco ?? "não informado"}");
        sb.AppendLine($"Terreno registrado em cartório: {(p.TerrenoRegistrado ? "sim" : "não")}");
        sb.AppendLine($"Tipo de arquitetura: {p.TipoArquitetura ?? "não informado"}");
        sb.AppendLine($"Área construída: {(p.AreaM2?.ToString() ?? "não informada")} m²");
        sb.AppendLine($"Orçamento: {(p.Orcamento?.ToString("F2") ?? "não informado")} BRL");
        sb.AppendLine($"Status: {p.Status}");
        if (p.DataInicio is not null) sb.AppendLine($"Início: {p.DataInicio}");
        if (p.PrevisaoTermino is not null) sb.AppendLine($"Previsão de término: {p.PrevisaoTermino}");

        if (p.Etapas.Count > 0)
        {
            var concluidas = p.Etapas.Count(e => e.Concluida);
            sb.AppendLine();
            sb.AppendLine($"ETAPAS ({concluidas}/{p.Etapas.Count} concluídas):");
            foreach (var e in p.Etapas.OrderBy(e => e.Ordem))
            {
                var custo = e.CustoReal.HasValue ? $" — gasto real R$ {e.CustoReal.Value:F2}" : "";
                sb.AppendLine($"- [{(e.Concluida ? "x" : " ")}] {e.Nome}{custo}");
            }
        }

        if (p.Analise is not null)
        {
            sb.AppendLine();
            sb.AppendLine("ANÁLISE DE IA JÁ GERADA (JSON):");
            sb.AppendLine($"Legalização: {p.Analise.LegalizacaoJson}");
            sb.AppendLine($"Custos por etapa: {p.Analise.CustosJson}");
        }

        sb.AppendLine("=== FIM DO CONTEXTO ===");
        return sb.ToString();
    }
}
