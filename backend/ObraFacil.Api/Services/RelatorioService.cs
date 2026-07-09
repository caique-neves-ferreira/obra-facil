using System.Text.Json;
using ClosedXML.Excel;
using ObraFacil.Api.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace ObraFacil.Api.Services;

/// <summary>
/// Gera os relatórios para download: planilha de custos (.xlsx),
/// progresso da obra por etapa (.xlsx) e documento de legalização (.pdf).
/// </summary>
public class RelatorioService
{
    static RelatorioService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private record CustoEtapa(string Etapa, decimal Percentual, decimal CustoEstimado);
    private record ItemLegalizacao(int Ordem, string Titulo, string Orgao, string Descricao,
        List<string> Documentos, string PrazoEstimado, decimal CustoEstimado);

    // ---------------- Planilha de custos (estimativa da IA) ----------------
    public byte[] GerarPlanilhaCustos(Projeto projeto)
    {
        var custos = LerCustos(projeto);

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Custos");

        ws.Cell(1, 1).Value = $"Planilha de custos — {projeto.Nome}";
        var tituloC = ws.Range(1, 1, 1, 3).Merge();
        tituloC.Style.Font.Bold = true;
        tituloC.Style.Font.FontSize = 14;

        ws.Cell(3, 1).Value = "Etapa";
        ws.Cell(3, 2).Value = "% do total";
        ws.Cell(3, 3).Value = "Custo estimado (R$)";
        var head = ws.Range(3, 1, 3, 3);
        head.Style.Fill.SetBackgroundColor(XLColor.FromHtml("#1F4E79"));
        head.Style.Font.FontColor = XLColor.White;
        head.Style.Font.Bold = true;

        var linha = 4;
        foreach (var c in custos)
        {
            ws.Cell(linha, 1).Value = c.Etapa;
            ws.Cell(linha, 2).Value = (double)(c.Percentual / 100m);
            ws.Cell(linha, 2).Style.NumberFormat.Format = "0.0%";
            ws.Cell(linha, 3).Value = c.CustoEstimado;
            ws.Cell(linha, 3).Style.NumberFormat.Format = "#,##0.00";
            linha++;
        }

        ws.Cell(linha, 1).Value = "TOTAL";
        ws.Cell(linha, 1).Style.Font.Bold = true;
        ws.Cell(linha, 3).FormulaA1 = $"SUM(C4:C{linha - 1})";
        ws.Cell(linha, 3).Style.Font.Bold = true;
        ws.Cell(linha, 3).Style.NumberFormat.Format = "#,##0.00";

        if (projeto.Orcamento is not null)
        {
            ws.Cell(linha + 2, 1).Value = "Orçamento informado";
            ws.Cell(linha + 2, 3).Value = projeto.Orcamento.Value;
            ws.Cell(linha + 2, 3).Style.NumberFormat.Format = "#,##0.00";
        }

        ws.Columns().AdjustToContents();
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ---------------- Progresso por etapa (custo real ou estimativa) ----------------
    public byte[] GerarPlanilhaProgresso(Projeto projeto)
    {
        var custos = LerCustos(projeto);

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Progresso");

        var concluidas = projeto.Etapas.Count(e => e.Concluida);
        var total = projeto.Etapas.Count;
        var pct = total > 0 ? (double)concluidas / total : 0;

        ws.Cell(1, 1).Value = $"Progresso da obra — {projeto.Nome}";
        var tituloP = ws.Range(1, 1, 1, 4).Merge();
        tituloP.Style.Font.Bold = true;
        tituloP.Style.Font.FontSize = 14;
        ws.Cell(2, 1).Value = $"Etapas concluídas: {concluidas}/{total} ({pct:P0})";
        ws.Range(2, 1, 2, 4).Merge();

        ws.Cell(4, 1).Value = "Etapa";
        ws.Cell(4, 2).Value = "Concluída";
        ws.Cell(4, 3).Value = "Gasto (R$)";
        ws.Cell(4, 4).Value = "Origem do valor";
        var head = ws.Range(4, 1, 4, 4);
        head.Style.Fill.SetBackgroundColor(XLColor.FromHtml("#1F4E79"));
        head.Style.Font.FontColor = XLColor.White;
        head.Style.Font.Bold = true;

        // Mapa nome-da-etapa -> estimativa (para casar com as etapas cadastradas)
        var estimativaPorNome = custos.ToDictionary(
            c => c.Etapa.Trim().ToLowerInvariant(), c => c.CustoEstimado);

        var linha = 5;
        decimal totalGasto = 0;
        foreach (var e in projeto.Etapas.OrderBy(e => e.Ordem))
        {
            decimal? valor = e.CustoReal;
            var origem = "real (informado)";
            if (valor is null)
            {
                estimativaPorNome.TryGetValue(e.Nome.Trim().ToLowerInvariant(), out var est);
                valor = est;
                origem = est > 0 ? "estimativa da IA" : "—";
            }

            ws.Cell(linha, 1).Value = e.Nome;
            ws.Cell(linha, 2).Value = e.Concluida ? "Sim" : "Não";
            ws.Cell(linha, 3).Value = valor ?? 0m;
            ws.Cell(linha, 3).Style.NumberFormat.Format = "#,##0.00";
            ws.Cell(linha, 4).Value = origem;

            if (e.Concluida) totalGasto += valor ?? 0;
            linha++;
        }

        ws.Cell(linha, 1).Value = "TOTAL GASTO (etapas concluídas)";
        ws.Cell(linha, 1).Style.Font.Bold = true;
        ws.Cell(linha, 3).Value = totalGasto;
        ws.Cell(linha, 3).Style.Font.Bold = true;
        ws.Cell(linha, 3).Style.NumberFormat.Format = "#,##0.00";

        ws.Columns().AdjustToContents();
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    // ---------------- Documento de legalização (PDF) ----------------
    public byte[] GerarPdfLegalizacao(Projeto projeto)
    {
        var itens = LerLegalizacao(projeto);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(40);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Text("Documento de Legalização").FontSize(18).Bold();
                    col.Item().Text(projeto.Nome).FontSize(12).FontColor(Colors.Grey.Darken1);
                    if (!string.IsNullOrEmpty(projeto.Regiao))
                        col.Item().Text($"Região: {projeto.Regiao}").FontColor(Colors.Grey.Darken1);
                    col.Item().PaddingTop(4).Text($"Terreno registrado: {(projeto.TerrenoRegistrado ? "sim" : "não")}")
                        .FontColor(Colors.Grey.Darken1);
                });

                page.Content().PaddingVertical(10).Column(col =>
                {
                    col.Spacing(12);

                    if (itens.Count == 0)
                        col.Item().Text("Nenhuma etapa de legalização gerada ainda. Gere a análise de IA do projeto primeiro.");

                    foreach (var it in itens.OrderBy(i => i.Ordem))
                    {
                        col.Item().Border(1).BorderColor(Colors.Grey.Lighten1).Padding(10).Column(c =>
                        {
                            c.Item().Text($"{it.Ordem}. {it.Titulo}").Bold().FontSize(12);
                            c.Item().Text($"Órgão: {it.Orgao}").FontColor(Colors.Blue.Darken2);
                            if (!string.IsNullOrEmpty(it.Descricao))
                                c.Item().PaddingTop(4).Text(it.Descricao);
                            if (it.Documentos.Count > 0)
                            {
                                c.Item().PaddingTop(4).Text("Documentos:").Bold();
                                foreach (var d in it.Documentos)
                                    c.Item().Text($"• {d}");
                            }
                            c.Item().PaddingTop(4).Row(r =>
                            {
                                r.RelativeItem().Text($"Prazo: {it.PrazoEstimado}");
                                r.RelativeItem().AlignRight().Text($"Custo estimado: R$ {it.CustoEstimado:N2}");
                            });
                        });
                    }
                });

                page.Footer().AlignCenter().Text(x =>
                {
                    x.Span("Obra Fácil · gerado em ").FontColor(Colors.Grey.Darken1);
                    x.Span(DateTime.Now.ToString("dd/MM/yyyy")).FontColor(Colors.Grey.Darken1);
                });
            });
        }).GeneratePdf();
    }

    // ---------------- Helpers de leitura do JSON da análise ----------------
    private static List<CustoEtapa> LerCustos(Projeto projeto)
    {
        var lista = new List<CustoEtapa>();
        if (projeto.Analise is null) return lista;

        try
        {
            using var doc = JsonDocument.Parse(projeto.Analise.CustosJson);
            foreach (var item in doc.RootElement.EnumerateArray())
            {
                var etapa = item.TryGetProperty("etapa", out var e) ? e.GetString() ?? "" : "";
                decimal pct = item.TryGetProperty("percentual", out var p) && p.ValueKind == JsonValueKind.Number ? p.GetDecimal() : 0;
                decimal custo = item.TryGetProperty("custoEstimado", out var c) && c.ValueKind == JsonValueKind.Number ? c.GetDecimal() : 0;
                lista.Add(new CustoEtapa(etapa, pct, custo));
            }
        }
        catch (JsonException) { /* JSON inválido: retorna o que tiver */ }

        return lista;
    }

    private static List<ItemLegalizacao> LerLegalizacao(Projeto projeto)
    {
        var lista = new List<ItemLegalizacao>();
        if (projeto.Analise is null) return lista;

        try
        {
            using var doc = JsonDocument.Parse(projeto.Analise.LegalizacaoJson);
            foreach (var item in doc.RootElement.EnumerateArray())
            {
                var docs = new List<string>();
                if (item.TryGetProperty("documentos", out var d) && d.ValueKind == JsonValueKind.Array)
                    docs = d.EnumerateArray().Select(x => x.GetString() ?? "").Where(s => s.Length > 0).ToList();

                lista.Add(new ItemLegalizacao(
                    item.TryGetProperty("ordem", out var o) && o.ValueKind == JsonValueKind.Number ? o.GetInt32() : 0,
                    item.TryGetProperty("titulo", out var t) ? t.GetString() ?? "" : "",
                    item.TryGetProperty("orgao", out var org) ? org.GetString() ?? "" : "",
                    item.TryGetProperty("descricao", out var desc) ? desc.GetString() ?? "" : "",
                    docs,
                    item.TryGetProperty("prazoEstimado", out var pz) ? pz.GetString() ?? "" : "",
                    item.TryGetProperty("custoEstimado", out var cu) && cu.ValueKind == JsonValueKind.Number ? cu.GetDecimal() : 0
                ));
            }
        }
        catch (JsonException) { /* JSON inválido */ }

        return lista;
    }
}
