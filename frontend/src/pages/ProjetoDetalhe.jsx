import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { api, auth } from '../api';

const CORES = ['#f2600c', '#23508f', '#2e7d4f', '#c94e07', '#4a4d50', '#8a5a2b', '#1b6f8f', '#7a3fa0'];

const fmtBRL = (v) =>
  (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/* ---------- Planta esquemática (mock) em SVG ---------- */
function PlantaMock({ planta }) {
  const ambientes = planta?.ambientes || [];
  if (ambientes.length === 0) return null;

  // Layout simples em linhas: distribui os ambientes numa "laje" retangular
  const ESCALA = 34; // px por metro
  const larguraLote = Math.ceil(
    Math.sqrt(ambientes.reduce((s, a) => s + a.largura * a.comprimento, 0) * 1.5)
  );

  const linhas = [];
  let linhaAtual = { itens: [], largura: 0, altura: 0 };
  for (const amb of ambientes) {
    if (linhaAtual.largura + amb.largura > larguraLote && linhaAtual.itens.length > 0) {
      linhas.push(linhaAtual);
      linhaAtual = { itens: [], largura: 0, altura: 0 };
    }
    linhaAtual.itens.push({ ...amb, x: linhaAtual.largura });
    linhaAtual.largura += amb.largura;
    linhaAtual.altura = Math.max(linhaAtual.altura, amb.comprimento);
  }
  if (linhaAtual.itens.length > 0) linhas.push(linhaAtual);

  let y = 0;
  const retangulos = [];
  const larguraMax = Math.max(...linhas.map((l) => l.largura));
  for (const linha of linhas) {
    for (const amb of linha.itens) {
      retangulos.push({ ...amb, y, alturaLinha: linha.altura });
    }
    y += linha.altura;
  }

  const W = larguraMax * ESCALA + 2;
  const H = y * ESCALA + 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', maxWidth: 640, background: '#fff', border: '1px solid var(--line)' }}
      role="img"
      aria-label="Planta esquemática do projeto"
    >
      {retangulos.map((r, i) => (
        <g key={i}>
          <rect
            x={r.x * ESCALA + 1}
            y={r.y * ESCALA + 1}
            width={r.largura * ESCALA - 2}
            height={r.alturaLinha * ESCALA - 2}
            fill="#f7f7f4"
            stroke="#1b1d1f"
            strokeWidth="1.5"
          />
          <text
            x={r.x * ESCALA + (r.largura * ESCALA) / 2}
            y={r.y * ESCALA + (r.alturaLinha * ESCALA) / 2 - 4}
            textAnchor="middle"
            fontSize="11"
            fontFamily="'Saira', sans-serif"
            fontWeight="600"
            fill="#1b1d1f"
          >
            {r.nome}
          </text>
          <text
            x={r.x * ESCALA + (r.largura * ESCALA) / 2}
            y={r.y * ESCALA + (r.alturaLinha * ESCALA) / 2 + 10}
            textAnchor="middle"
            fontSize="9"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#4a4d50"
          >
            {r.largura.toFixed(1)} × {r.comprimento.toFixed(1)} m
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const [projeto, setProjeto] = useState(null);
  const [analise, setAnalise] = useState(null);
  const [gerando, setGerando] = useState(false);
  const planoFree = (auth.usuario()?.plano || 'Free') === 'Free';
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.buscarProjeto(id).then(setProjeto).catch((e) => setErro(e.message));
    api.buscarAnalise(id).then(setAnalise).catch(() => {}); // 404 = ainda não gerada
  }, [id]);

  async function gerar() {
    setErro('');
    setGerando(true);
    try {
      const resultado = await api.gerarAnalise(id);
      setAnalise(resultado);
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  }

  const custos = useMemo(() => analise?.custosPorEtapa || [], [analise]);
  const legalizacao = useMemo(() => analise?.legalizacao || [], [analise]);
  const totalCustos = custos.reduce((s, c) => s + (c.custoEstimado || 0), 0);
  const totalLegalizacao = legalizacao.reduce((s, l) => s + (l.custoEstimado || 0), 0);

  function baixarPlanilha() {
    const wb = XLSX.utils.book_new();

    const abaCustos = XLSX.utils.json_to_sheet(
      custos.map((c) => ({
        Etapa: c.etapa,
        'Percentual (%)': c.percentual,
        'Custo estimado (R$)': c.custoEstimado,
      }))
    );
    XLSX.utils.sheet_add_aoa(abaCustos, [['TOTAL', '', totalCustos]], { origin: -1 });
    XLSX.utils.book_append_sheet(wb, abaCustos, 'Custos por etapa');

    const abaLegal = XLSX.utils.json_to_sheet(
      legalizacao.map((l) => ({
        Ordem: l.ordem,
        Etapa: l.titulo,
        'Órgão': l.orgao,
        'Descrição': l.descricao,
        Documentos: (l.documentos || []).join('; '),
        'Prazo estimado': l.prazoEstimado,
        'Custo estimado (R$)': l.custoEstimado,
      }))
    );
    XLSX.utils.book_append_sheet(wb, abaLegal, 'Legalização');

    const ambientes = analise?.planta?.ambientes || [];
    if (ambientes.length > 0) {
      const abaPlanta = XLSX.utils.json_to_sheet(
        ambientes.map((a) => ({
          Ambiente: a.nome,
          'Largura (m)': a.largura,
          'Comprimento (m)': a.comprimento,
          'Área (m²)': +(a.largura * a.comprimento).toFixed(2),
        }))
      );
      XLSX.utils.book_append_sheet(wb, abaPlanta, 'Ambientes');
    }

    XLSX.writeFile(wb, `obra-facil-${(projeto?.nome || 'projeto').toLowerCase().replace(/\s+/g, '-')}.xlsx`);
  }

  function baixarDocumento() {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margem = 18;
    const larguraUtil = 210 - margem * 2;
    let y = 22;

    const quebra = (altura = 6) => {
      if (y + altura > 280) { doc.addPage(); y = 22; }
    };
    const texto = (str, tamanho = 10, estilo = 'normal', cor = [27, 29, 31]) => {
      doc.setFont('helvetica', estilo);
      doc.setFontSize(tamanho);
      doc.setTextColor(...cor);
      const linhas = doc.splitTextToSize(str, larguraUtil);
      for (const linha of linhas) {
        quebra();
        doc.text(linha, margem, y);
        y += tamanho * 0.5;
      }
    };

    // Cabeçalho
    doc.setFillColor(27, 29, 31);
    doc.rect(0, 0, 210, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('OBRA FÁCIL — ROTEIRO DE LEGALIZAÇÃO', margem, 9);

    texto(projeto?.nome || 'Projeto', 16, 'bold');
    y += 2;
    texto(`Região: ${projeto?.regiao || '—'}  |  Terreno registrado: ${projeto?.terrenoRegistrado ? 'Sim' : 'Não'}  |  Gerado em: ${new Date(analise.geradoEm).toLocaleDateString('pt-BR')}`, 9, 'normal', [74, 77, 80]);
    y += 3;
    texto('Estimativas geradas por IA com base em práticas comuns. Prazos, taxas e exigências variam por município — confirme na prefeitura e no cartório de imóveis da sua região.', 8.5, 'italic', [120, 120, 120]);
    y += 4;

    for (const l of legalizacao) {
      quebra(14);
      doc.setDrawColor(242, 96, 12);
      doc.setLineWidth(0.8);
      doc.line(margem, y - 1, margem + 8, y - 1);
      texto(`${l.ordem}. ${l.titulo}  (${l.orgao})`, 12, 'bold');
      texto(l.descricao, 9.5);
      if (l.documentos?.length) {
        texto(`Documentos: ${l.documentos.join(' · ')}`, 8.5, 'normal', [74, 77, 80]);
      }
      texto(`Prazo estimado: ${l.prazoEstimado}   |   Custo estimado: ${fmtBRL(l.custoEstimado)}`, 9, 'bold');
      y += 4;
    }

    quebra(10);
    texto(`CUSTO TOTAL ESTIMADO DE LEGALIZAÇÃO: ${fmtBRL(totalLegalizacao)}`, 11, 'bold', [242, 96, 12]);

    doc.save(`legalizacao-${(projeto?.nome || 'projeto').toLowerCase().replace(/\s+/g, '-')}.pdf`);
  }

  if (!projeto && !erro) {
    return <main className="container"><p style={{ color: 'var(--ink-soft)' }}>Carregando…</p></main>;
  }

  return (
    <main className="container">
      <Link to="/projetos" style={{ color: 'var(--azul)', fontSize: '0.9rem' }}>← Voltar aos projetos</Link>

      {projeto && (
        <>
          <span className="cota" style={{ marginTop: 12 }}>
            {projeto.regiao || 'Região não informada'} · {projeto.tipoArquitetura || 'Arquitetura não definida'}
          </span>
          <h1 className="titulo">{projeto.nome}</h1>
          <p className="subtitulo">
            {projeto.terrenoRegistrado
              ? 'Terreno registrado em cartório.'
              : 'Terreno ainda não registrado — o roteiro abaixo inclui as etapas de regularização.'}
          </p>
        </>
      )}

      {erro && <div className="erro" style={{ marginTop: 16 }} role="alert">{erro}</div>}

      {!analise && (
        <div className="card" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="cota">Análise inteligente</span>
          <p>
            Gere com IA o roteiro de legalização (prefeitura + cartório), a estimativa de custos
            por etapa e uma planta esquemática do projeto.
          </p>
          <button className="btn" onClick={gerar} disabled={gerando} style={{ width: 'fit-content' }}>
            {gerando ? 'Gerando análise… (até 1 min)' : 'Gerar análise com IA'}
          </button>
        </div>
      )}

      {analise && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 24 }}>
            <button className="btn" onClick={baixarPlanilha}>⬇ Baixar planilha (.xlsx)</button>
            <button className="btn secundario" onClick={baixarDocumento}>⬇ Documento de legalização (.pdf)</button>
            {planoFree ? (
              <Link to="/planos" className="btn secundario" title="Regeneração disponível no plano Pro">
                ↻ Regenerar (Pro)
              </Link>
            ) : (
              <button className="btn secundario" onClick={gerar} disabled={gerando}>
                {gerando ? 'Regenerando…' : '↻ Regenerar análise'}
              </button>
            )}
          </div>

          {/* ---------- Etapas da obra (checklist) ---------- */}
          {projeto?.etapas?.length > 0 && (
            <section style={{ marginTop: 36 }}>
              <span className="cota">Andamento da obra</span>
              <h2 className="titulo" style={{ fontSize: '1.6rem' }}>Etapas do planejamento</h2>
              <div className="card" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {projeto.etapas.map((e) => (
                  <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.95rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={e.concluida}
                      onChange={async (ev) => {
                        const concluida = ev.target.checked;
                        setProjeto((pr) => ({
                          ...pr,
                          etapas: pr.etapas.map((x) => x.id === e.id ? { ...x, concluida } : x),
                        }));
                        try { await api.atualizarEtapa(projeto.id, e.id, concluida); }
                        catch { /* reverte em caso de falha */
                          setProjeto((pr) => ({
                            ...pr,
                            etapas: pr.etapas.map((x) => x.id === e.id ? { ...x, concluida: !concluida } : x),
                          }));
                        }
                      }}
                    />
                    <span style={{ textDecoration: e.concluida ? 'line-through' : 'none', color: e.concluida ? 'var(--ink-soft)' : 'var(--ink)' }}>
                      {e.nome}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* ---------- Custos ---------- */}
          <section style={{ marginTop: 36 }}>
            <span className="cota">Custos estimados por etapa</span>
            <h2 className="titulo" style={{ fontSize: '1.6rem' }}>
              Total: {fmtBRL(totalCustos)}
            </h2>
            <div className="card" style={{ marginTop: 14, height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={custos} layout="vertical" margin={{ left: 30, right: 30, top: 8, bottom: 8 }}>
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} fontSize={11} />
                  <YAxis type="category" dataKey="etapa" width={130} fontSize={11} />
                  <Tooltip formatter={(v, nome) => [fmtBRL(v), 'Custo estimado']} />
                  <Bar dataKey="custoEstimado" radius={[0, 2, 2, 0]}>
                    {custos.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ---------- Legalização ---------- */}
          <section style={{ marginTop: 36 }}>
            <span className="cota">Prefeitura · Cartório</span>
            <h2 className="titulo" style={{ fontSize: '1.6rem' }}>Roteiro de legalização</h2>
            <p className="subtitulo" style={{ fontSize: '0.85rem' }}>
              Estimativas geradas por IA — prazos, taxas e exigências variam por município.
              Confirme na prefeitura e no cartório de imóveis da sua região.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              {legalizacao.map((l) => (
                <article className="card" key={l.ordem} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="badge planejamento">{l.orgao}</span>
                  <h3 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '1.1rem' }}>
                    {l.ordem}. {l.titulo}
                  </h3>
                  <p style={{ fontSize: '0.92rem' }}>{l.descricao}</p>
                  {l.documentos?.length > 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                      <strong>Documentos:</strong> {l.documentos.join(' · ')}
                    </div>
                  )}
                  <div className="meta" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                    PRAZO: {l.prazoEstimado} — CUSTO: {fmtBRL(l.custoEstimado)}
                  </div>
                </article>
              ))}
            </div>
            <p style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
              CUSTO TOTAL DE LEGALIZAÇÃO: {fmtBRL(totalLegalizacao)}
            </p>
          </section>

          {/* ---------- Planta ---------- */}
          <section style={{ marginTop: 36 }}>
            <span className="cota">Planta esquemática</span>
            <h2 className="titulo" style={{ fontSize: '1.6rem' }}>Distribuição dos ambientes</h2>
            <p className="subtitulo" style={{ fontSize: '0.85rem' }}>
              Representação esquemática (mock) para visualizar proporções — não substitui projeto
              de arquiteto/engenheiro com RRT/ART.
            </p>
            {analise.planta?.observacao && (
              <p style={{ fontSize: '0.88rem', margin: '8px 0' }}>{analise.planta.observacao}</p>
            )}
            <div style={{ marginTop: 14 }}>
              <PlantaMock planta={analise.planta} />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
