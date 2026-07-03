import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { auth } from '../api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const CORES = ['#f2600c', '#23508f', '#2e7d4f', '#c94e07', '#4a4d50'];

// Dados de exemplo para a prévia (não vêm da API)
const CUSTOS_DEMO = [
  { etapa: 'Fundação', custo: 45000 },
  { etapa: 'Estrutura', custo: 68000 },
  { etapa: 'Alvenaria', custo: 37000 },
  { etapa: 'Instalações', custo: 52000 },
  { etapa: 'Acabamento', custo: 44000 },
];

const AMBIENTES_DEMO = [
  { nome: 'Sala', l: 5, c: 4, x: 0, y: 0 },
  { nome: 'Cozinha', l: 3.5, c: 4, x: 5, y: 0 },
  { nome: 'Quarto 1', l: 4, c: 3.5, x: 0, y: 4 },
  { nome: 'Quarto 2', l: 3, c: 3.5, x: 4, y: 4 },
  { nome: 'Banheiro', l: 1.5, c: 3.5, x: 7, y: 4 },
];

function ToastsSociais({ stats }) {
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [indice, setIndice] = useState(0);
  const [dispensado, setDispensado] = useState(false);

  const mensagens = [
    stats?.projetos > 0 && `🏗️ ${stats.projetos.toLocaleString('pt-BR')} obra${stats.projetos > 1 ? 's' : ''} já cadastrada${stats.projetos > 1 ? 's' : ''} na plataforma`,
    stats?.analises > 0 && `📊 ${stats.analises.toLocaleString('pt-BR')} análise${stats.analises > 1 ? 's' : ''} de legalização gerada${stats.analises > 1 ? 's' : ''} com IA`,
    stats?.usuarios > 0 && `👷 ${stats.usuarios.toLocaleString('pt-BR')} pessoa${stats.usuarios > 1 ? 's' : ''} organizando a obra por aqui`,
    '✅ Comece grátis: 2 projetos, sem cartão de crédito',
    '📄 Roteiro de legalização em PDF em menos de 1 minuto',
  ].filter(Boolean);

  useEffect(() => {
    if (dispensado || mensagens.length === 0) return;
    const mostrar = setTimeout(() => setVisivel(true), 3500);
    return () => clearTimeout(mostrar);
  }, [dispensado, mensagens.length]);

  useEffect(() => {
    if (!visivel || dispensado) return;
    const trocar = setInterval(() => {
      setSaindo(true);
      setTimeout(() => {
        setIndice((i) => (i + 1) % mensagens.length);
        setSaindo(false);
      }, 300);
    }, 7000);
    return () => clearInterval(trocar);
  }, [visivel, dispensado, mensagens.length]);

  if (!visivel || dispensado || mensagens.length === 0) return null;

  return (
    <div className={`toast-social ${saindo ? 'saindo' : ''}`} role="status" aria-live="polite">
      {mensagens[indice]}
      <button className="fechar" onClick={() => setDispensado(true)} aria-label="Fechar aviso">✕</button>
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState(null);
  const logado = auth.logado();

  useEffect(() => {
    fetch(`${API_URL}/api/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const ESC = 30;

  return (
    <main>
      {/* ---------- Hero ---------- */}
      <section style={{ background: 'var(--ink)', color: '#e6e7e3', padding: '56px 20px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <span className="cota" style={{ color: '#9a9c98' }}>Gestão de obras com IA</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)', textTransform: 'uppercase',
              fontSize: 'clamp(2.2rem, 6vw, 3.6rem)', lineHeight: 1.05, color: '#fff',
              margin: '10px 0 14px', maxWidth: 720,
            }}
          >
            Da papelada do cartório ao <span style={{ color: 'var(--laranja)' }}>último acabamento</span>
          </h1>
          <p style={{ maxWidth: 560, fontSize: '1.05rem' }}>
            Cadastre sua obra e receba em um minuto: o roteiro de legalização junto à
            prefeitura e ao cartório, os custos estimados por etapa e uma planta
            esquemática — tudo gerado por IA para a sua região.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <Link to={logado ? '/projetos' : '/login'} className="btn">
              {logado ? 'Ir para meus projetos' : 'Começar grátis'}
            </Link>
            <Link to="/planos" className="btn secundario" style={{ borderColor: '#4a4d50', color: '#e6e7e3' }}>
              Ver planos
            </Link>
          </div>

          {/* Contador de uso */}
          {stats && (
            <div style={{ display: 'flex', gap: 36, marginTop: 40, flexWrap: 'wrap' }}>
              {[
                { valor: stats.usuarios, rotulo: 'pessoas usando' },
                { valor: stats.projetos, rotulo: 'obras cadastradas' },
                { valor: stats.analises, rotulo: 'análises geradas' },
              ].map((s) => (
                <div key={s.rotulo}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', color: 'var(--laranja)' }}>
                    {s.valor.toLocaleString('pt-BR')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9a9c98' }}>
                    {s.rotulo}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <div className="hatch" />

      {/* ---------- Prévia: gráfico de custos ---------- */}
      <section className="container" style={{ paddingTop: 48 }}>
        <span className="cota">Prévia · Custos por etapa</span>
        <h2 className="titulo" style={{ fontSize: '1.8rem' }}>Veja para onde vai cada real</h2>
        <p className="subtitulo">
          A IA distribui o orçamento da obra por macroetapa, com percentuais e valores
          estimados para a sua região — exportável em planilha Excel.
        </p>
        <div className="card" style={{ marginTop: 16, height: 260, maxWidth: 720 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CUSTOS_DEMO} layout="vertical" margin={{ left: 20, right: 20, top: 8, bottom: 8 }}>
              <XAxis type="number" tickFormatter={(v) => `${v / 1000}k`} fontSize={11} />
              <YAxis type="category" dataKey="etapa" width={90} fontSize={11} />
              <Bar dataKey="custo" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                {CUSTOS_DEMO.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: 6 }}>
          * DADOS DE EXEMPLO
        </p>
      </section>

      {/* ---------- Prévia: documento ---------- */}
      <section className="container" style={{ paddingTop: 8 }}>
        <span className="cota">Prévia · Roteiro de legalização</span>
        <h2 className="titulo" style={{ fontSize: '1.8rem' }}>Prefeitura e cartório sem mistério</h2>
        <p className="subtitulo">
          Passo a passo ordenado com órgão responsável, documentos necessários, prazos e
          taxas estimadas — pronto para baixar em PDF.
        </p>
        <div className="card" style={{ marginTop: 16, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="badge planejamento">Cartório de Imóveis</span>
          <h3 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '1.05rem' }}>
            1. Regularização da posse do terreno
          </h3>
          <p style={{ fontSize: '0.9rem' }}>
            Levantamento da origem dominial, documentos de posse e definição do caminho:
            usucapião extrajudicial, Reurb ou adjudicação…
          </p>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
            PRAZO: 30–90 DIAS — CUSTO ESTIMADO: R$ 3.000 — * EXEMPLO
          </div>
        </div>
      </section>

      {/* ---------- Prévia: planta ---------- */}
      <section className="container" style={{ paddingTop: 8, paddingBottom: 72 }}>
        <span className="cota">Prévia · Planta esquemática</span>
        <h2 className="titulo" style={{ fontSize: '1.8rem' }}>Visualize a distribuição dos ambientes</h2>
        <p className="subtitulo">
          Uma planta esquemática com dimensões coerentes com a área e o tipo de
          arquitetura do seu projeto.
        </p>
        <svg
          viewBox={`0 0 ${8.5 * ESC + 2} ${7.5 * ESC + 2}`}
          style={{ width: '100%', maxWidth: 460, background: '#fff', border: '1px solid var(--line)', marginTop: 16 }}
          role="img" aria-label="Exemplo de planta esquemática"
        >
          {AMBIENTES_DEMO.map((a, i) => (
            <g key={i}>
              <rect x={a.x * ESC + 1} y={a.y * ESC + 1} width={a.l * ESC - 2} height={a.c * ESC - 2}
                fill="#f7f7f4" stroke="#1b1d1f" strokeWidth="1.5" />
              <text x={a.x * ESC + (a.l * ESC) / 2} y={a.y * ESC + (a.c * ESC) / 2}
                textAnchor="middle" fontSize="10" fontFamily="'Saira', sans-serif" fontWeight="600" fill="#1b1d1f">
                {a.nome}
              </text>
            </g>
          ))}
        </svg>
        <div style={{ marginTop: 28 }}>
          <Link to={logado ? '/projetos' : '/login'} className="btn">
            {logado ? 'Criar novo projeto' : 'Criar minha conta grátis'}
          </Link>
        </div>
      </section>

      {/* ---------- Teaser Pro ---------- */}
      <section style={{ background: 'var(--ink)', padding: '40px 20px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span className="cota" style={{ color: '#9a9c98' }}>Plano Pro</span>
            <h2 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', color: '#fff', fontSize: '1.5rem', marginTop: 4 }}>
              🔒 Projetos ilimitados, regeneração de análise e mais
            </h2>
          </div>
          <Link to="/planos" className="btn">Conhecer o Pro</Link>
        </div>
      </section>

      <ToastsSociais stats={stats} />
    </main>
  );
}
