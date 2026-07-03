using System.Text;
using System.Text.Json;
using ObraFacil.Api.Models;

namespace ObraFacil.Api.Services;

public class AnaliseIaService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _model;

    public AnaliseIaService(HttpClient http, IConfiguration config)
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
        _http.Timeout = TimeSpan.FromSeconds(90);
    }

    public async Task<(string legalizacao, string custos, string planta)> GerarAnaliseAsync(Projeto projeto)
    {
        if (string.IsNullOrEmpty(_apiKey))
            throw new InvalidOperationException("ANTHROPIC_API_KEY não configurada no servidor. Adicione a variável de ambiente no Render.");

        var prompt = MontarPrompt(projeto);

        var body = new
        {
            model = _model,
            max_tokens = 4000,
            messages = new[] { new { role = "user", content = prompt } }
        };

        var resp = await _http.PostAsync("v1/messages",
            new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"));

        var raw = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"Falha na API de IA ({(int)resp.StatusCode}): {raw[..Math.Min(raw.Length, 300)]}");

        using var doc = JsonDocument.Parse(raw);
        var texto = doc.RootElement.GetProperty("content")
            .EnumerateArray()
            .Where(c => c.GetProperty("type").GetString() == "text")
            .Select(c => c.GetProperty("text").GetString())
            .FirstOrDefault() ?? "";

        // Remove cercas de markdown, se vierem
        texto = texto.Trim();
        if (texto.StartsWith("```"))
        {
            var inicio = texto.IndexOf('\n') + 1;
            var fim = texto.LastIndexOf("```", StringComparison.Ordinal);
            texto = texto[inicio..(fim > inicio ? fim : texto.Length)].Trim();
        }

        // Valida e reparte o JSON nos três blocos
        using var json = JsonDocument.Parse(texto);
        var root = json.RootElement;

        var legalizacao = root.GetProperty("legalizacao").GetRawText();
        var custos = root.GetProperty("custosPorEtapa").GetRawText();
        var planta = root.GetProperty("planta").GetRawText();

        return (legalizacao, custos, planta);
    }

    private static string MontarPrompt(Projeto p)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Você é um consultor especializado em legalização de obras residenciais no Brasil e orçamento de construção.");
        sb.AppendLine("Gere uma análise para o projeto abaixo. Responda APENAS com JSON válido, sem markdown, sem texto antes ou depois.");
        sb.AppendLine();
        sb.AppendLine("DADOS DO PROJETO:");
        sb.AppendLine($"- Nome: {p.Nome}");
        sb.AppendLine($"- Região (cidade/UF): {p.Regiao ?? "não informada"}");
        sb.AppendLine($"- Terreno registrado em cartório: {(p.TerrenoRegistrado ? "SIM" : "NÃO")}");
        sb.AppendLine($"- Tipo de arquitetura: {p.TipoArquitetura ?? "não informado"}");
        sb.AppendLine($"- Área construída estimada: {(p.AreaM2?.ToString() ?? "não informada")} m²");
        sb.AppendLine($"- Orçamento disponível: {(p.Orcamento?.ToString("F2") ?? "não informado")} BRL");
        sb.AppendLine();
        sb.AppendLine("REGRAS:");
        sb.AppendLine("1. legalizacao: lista ordenada de etapas junto à prefeitura e ao cartório para legalizar o terreno e a obra na região informada. Se o terreno NÃO for registrado, inclua as etapas de regularização/registro no cartório de imóveis ANTES das etapas de prefeitura. Se JÁ for registrado, pule direto para alvará/aprovação de projeto. Considere práticas comuns da região informada, mas deixe claro na descrição quando um item varia por município.");
        sb.AppendLine("2. custosPorEtapa: divisão do custo da OBRA por macroetapa (fundação, estrutura, alvenaria, cobertura, instalações elétricas, hidráulica, esquadrias, acabamento etc.) com percentual do total (somando 100) e custo estimado em BRL coerente com a área e padrão. Inclua também uma etapa 'Legalização e taxas'.");
        sb.AppendLine("3. planta: lista de ambientes coerente com o tipo de arquitetura e a área, com dimensões em metros (largura x comprimento) que somem aproximadamente a área informada.");
        sb.AppendLine("4. Valores são ESTIMATIVAS de mercado — seja realista para a região.");
        sb.AppendLine();
        sb.AppendLine("FORMATO EXATO DA RESPOSTA:");
        sb.AppendLine("""
{
  "legalizacao": [
    {
      "ordem": 1,
      "titulo": "string",
      "orgao": "Cartório de Imóveis | Prefeitura | CREA/CAU | Outro",
      "descricao": "string",
      "documentos": ["string"],
      "prazoEstimado": "string",
      "custoEstimado": 0
    }
  ],
  "custosPorEtapa": [
    { "etapa": "string", "percentual": 0, "custoEstimado": 0 }
  ],
  "planta": {
    "observacao": "string",
    "ambientes": [
      { "nome": "string", "largura": 0.0, "comprimento": 0.0 }
    ]
  }
}
""");
        return sb.ToString();
    }
}
