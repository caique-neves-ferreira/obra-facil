import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../api';

const ETAPAS = [
  { nome: 'Fundação', pct: 20, cor: 'var(--of-blue)' },
  { nome: 'Alvenaria', pct: 30, cor: 'var(--of-orange)' },
  { nome: 'Cobertura', pct: 15, cor: 'var(--of-green)' },
  { nome: 'Acabamento', pct: 35, cor: 'var(--of-gray)' },
];

const PLANOS = [
  {
    nome: 'Grátis',
    preco: 'R$ 0',
    sufixo: '',
    itens: ['2 projetos ativos', 'Roteiro de legalização', 'Orçamento por etapa'],
    cta: 'Começar grátis',
    destaque: false,
  },
  {
    nome: 'Pro',
    preco: 'R$ 79',
    sufixo: '/mês',
    itens: ['Projetos ilimitados', 'Planta esquemática por IA', 'Exportação em Excel'],
    cta: 'Assinar Pro',
    destaque: true,
  },
  {
    nome: 'Empresas',
    preco: 'Sob consulta',
    sufixo: '',
    itens: ['Multiusuário', 'Relatórios avançados', 'Suporte dedicado para construtoras'],
    cta: 'Falar com vendas',
    destaque: false,
  },
];

function LogoMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 34 34" aria-hidden="true">
      <defs>
        <clipPath id="lp-logo"><rect width="34" height="34" rx="9" /></clipPath>
      </defs>
      <g clipPath="url(#lp-logo)">
        <rect width="34" height="34" fill="var(--of-navy)" />
        <path d="M34 7 L34 34 L7 34 Z" fill="var(--of-orange)" />
      </g>
    </svg>
  );
}

function IconeRoteiro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--of-blue)" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function IconeOrcamento() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--of-orange)" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h16" />
      <rect x="6" y="11" width="3.2" height="7" rx="1" />
      <rect x="11.4" y="7" width="3.2" height="11" rx="1" />
      <rect x="16.8" y="13" width="3.2" height="5" rx="1" />
    </svg>
  );
}

function IconePlanta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--of-green)" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 10h7V3M14 21v-7h7" />
    </svg>
  );
}

export default function Home() {
  const [menu, setMenu] = useState(false);
  const logado = auth.logado();
  const inicio = logado ? '/projetos' : '/login';

  return (
    <div className="lp">
      {/* ---------- Navbar ---------- */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-brand" onClick={() => setMenu(false)}>
            <LogoMark />
            <span>Obra<b>Fácil</b></span>
          </Link>

          <nav className={`lp-nav-links ${menu ? 'aberto' : ''}`}>
            <a href="#como-funciona" onClick={() => setMenu(false)}>Como funciona</a>
            <Link to="/planos" onClick={() => setMenu(false)}>Planos</Link>
            <Link to="/login" onClick={() => setMenu(false)}>Entrar</Link>
            <Link to={inicio} className="lp-btn lp-btn-primary lp-nav-cta" onClick={() => setMenu(false)}>
              Começar grátis
            </Link>
          </nav>

          <button
            className="lp-burger"
            aria-label="Abrir menu"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <span className="lp-badge">Gestão de obras com IA</span>
            <h1 className="lp-h1">
              Da burocracia do cartório ao <span className="lp-accent">último acabamento.</span>
            </h1>
            <p className="lp-lead">
              Cadastre sua obra e receba, em minutos, o roteiro de legalização, o orçamento
              estimado por etapa e uma planta esquemática — tudo gerado por IA para a sua região.
            </p>
            <div className="lp-hero-acoes">
              <Link to={inicio} className="lp-btn lp-btn-primary">Começar grátis</Link>
              <Link to="/planos" className="lp-btn lp-btn-ghost">Ver planos</Link>
            </div>
            <p className="lp-hero-nota">2 projetos grátis · sem cartão de crédito</p>
          </div>

          <aside className="lp-preview" aria-label="Prévia de custos por etapa">
            <span className="lp-preview-eyebrow">Prévia · Custos por etapa</span>
            <h3 className="lp-preview-titulo">Para onde vai cada real</h3>
            <div className="lp-preview-lista">
              {ETAPAS.map((e) => (
                <div className="lp-prev-row" key={e.nome}>
                  <div className="lp-prev-top">
                    <span>{e.nome}</span>
                    <span className="lp-prev-pct">{e.pct}%</span>
                  </div>
                  <div className="lp-prev-track">
                    <div className="lp-prev-fill" style={{ width: e.pct + '%', background: e.cor }} />
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {/* ---------- Como funciona ---------- */}
      <section id="como-funciona" className="lp-how">
        <div className="lp-section-inner">
          <span className="lp-eyebrow">Como funciona</span>
          <h2 className="lp-h2">Da papelada ao orçamento, em minutos</h2>
          <p className="lp-sub">
            Três etapas automatizadas por IA que substituem semanas de pesquisa e planilhas soltas.
          </p>

          <div className="lp-cards">
            <article className="lp-card">
              <div className="lp-card-icon lp-ico-azul"><IconeRoteiro /></div>
              <h3>Roteiro de legalização</h3>
              <p>
                Receba o passo a passo de aprovação junto à prefeitura e ao cartório,
                específico para sua região.
              </p>
            </article>

            <article className="lp-card">
              <div className="lp-card-icon lp-ico-laranja"><IconeOrcamento /></div>
              <h3>Orçamento por etapa</h3>
              <p>
                A IA estima o custo de cada macroetapa da obra na sua região, exportável em planilha.
              </p>
            </article>

            <article className="lp-card">
              <div className="lp-card-icon lp-ico-verde"><IconePlanta /></div>
              <h3>Planta esquemática</h3>
              <p>
                Gere uma planta preliminar personalizada para as dimensões do seu terreno.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ---------- Planos ---------- */}
      <section id="planos" className="lp-plans">
        <div className="lp-section-inner">
          <span className="lp-eyebrow">Planos</span>
          <h2 className="lp-h2">Comece grátis, cresça quando precisar</h2>

          <div className="lp-plans-grid">
            {PLANOS.map((p) => (
              <article key={p.nome} className={`lp-plan ${p.destaque ? 'destaque' : ''}`}>
                {p.destaque && <span className="lp-plan-tag">Mais popular</span>}
                <span className="lp-plan-nome">{p.nome}</span>
                <div className="lp-plan-preco">
                  {p.preco}{p.sufixo && <small>{p.sufixo}</small>}
                </div>
                <ul className="lp-plan-itens">
                  {p.itens.map((i) => <li key={i}>{i}</li>)}
                </ul>
                <Link
                  to={p.nome === 'Grátis' ? inicio : '/planos'}
                  className={`lp-btn ${p.destaque ? 'lp-btn-primary' : 'lp-btn-outline'} lp-plan-cta`}
                >
                  {p.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA final ---------- */}
      <section className="lp-final">
        <h2 className="lp-final-titulo">Pronto para organizar sua próxima obra?</h2>
        <Link to={inicio} className="lp-btn lp-btn-primary lp-final-cta">
          Criar minha conta grátis
        </Link>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span>© 2026 Obra Fácil</span>
          <nav>
            <a href="#como-funciona">Como funciona</a>
            <Link to="/planos">Planos</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
