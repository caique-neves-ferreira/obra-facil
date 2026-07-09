import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const RELATORIOS = [
  {
    tipo: 'progresso.xlsx',
    titulo: 'Progresso da obra',
    formato: 'XLSX',
    texto: 'Etapas concluídas e o total gasto até o momento (custo informado por você ou a estimativa da IA).',
  },
  {
    tipo: 'custos.xlsx',
    titulo: 'Planilha de custos',
    formato: 'XLSX',
    texto: 'Divisão do custo da obra por macroetapa, com percentual e valor estimado.',
  },
  {
    tipo: 'legalizacao.pdf',
    titulo: 'Documento de legalização',
    formato: 'PDF',
    texto: 'Roteiro de legalização junto à prefeitura e ao cartório, com documentos, prazos e custos.',
  },
];

export default function Relatorios() {
  const [projetos, setProjetos] = useState([]);
  const [projetoId, setProjetoId] = useState('');
  const [baixando, setBaixando] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.listarProjetos()
      .then((ps) => {
        setProjetos(ps);
        if (ps.length > 0) setProjetoId(ps[0].id);
      })
      .catch(() => {});
  }, []);

  const projeto = projetos.find((p) => p.id === projetoId);
  const temAnalise = projeto; // relatórios de custo/legalização dependem da análise gerada

  async function baixar(tipo) {
    setErro('');
    setBaixando(tipo);
    try {
      await api.baixarRelatorio(projetoId, tipo);
    } catch (err) {
      setErro(err.message);
    } finally {
      setBaixando('');
    }
  }

  return (
    <main className="container">
      <span className="cota">Relatórios</span>
      <h1 className="titulo">Relatórios da obra 📊</h1>
      <p className="subtitulo">
        Baixe planilhas e documentos da sua obra para acompanhar, apresentar ou arquivar.
      </p>

      {projetos.length === 0 ? (
        <p className="subtitulo">
          Você ainda não tem projetos. <Link to="/projetos/novo">Crie sua primeira obra</Link> para
          gerar relatórios.
        </p>
      ) : (
        <>
          <label className="campo" style={{ maxWidth: 420 }}>
            Obra
            <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>

          {erro && (
            <div className="card" style={{ margin: '12px 0', padding: 12, borderColor: '#c00000' }}>
              <span style={{ fontSize: '0.9rem' }}>{erro}</span>
            </div>
          )}

          <div className="grid-planos" style={{ maxWidth: '100%', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
            {RELATORIOS.map((r) => (
              <article key={r.tipo} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '1rem' }}>
                    {r.titulo}
                  </h3>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', background: 'var(--ink)', color: '#fff', padding: '2px 7px' }}>
                    {r.formato}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', flexGrow: 1 }}>{r.texto}</p>
                <button
                  className="btn"
                  onClick={() => baixar(r.tipo)}
                  disabled={baixando === r.tipo}
                >
                  {baixando === r.tipo ? 'Gerando…' : 'Baixar'}
                </button>
              </article>
            ))}
          </div>

          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--ink-soft)', marginTop: 12 }}>
            O PROGRESSO USA AS ETAPAS CONCLUÍDAS. CUSTOS E LEGALIZAÇÃO USAM A ANÁLISE DE IA DO PROJETO —
            GERE A ANÁLISE NA TELA DA OBRA SE OS VALORES VIEREM VAZIOS.
          </p>
        </>
      )}
    </main>
  );
}
