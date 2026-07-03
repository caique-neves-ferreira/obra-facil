import { Link } from 'react-router-dom';
import { auth } from '../api';

export default function Planos() {
  const logado = auth.logado();
  const plano = auth.usuario()?.plano;

  return (
    <main className="container">
      <span className="cota">Planos</span>
      <h1 className="titulo">Escolha o plano da sua obra</h1>
      <p className="subtitulo">
        Comece grátis e faça upgrade quando precisar de mais projetos e recursos avançados.
      </p>

      <div className="grid-planos">
        <article className="card plano">
          <h3>Free</h3>
          <div className="preco">R$ 0 <small>/ mês</small></div>
          <ul>
            <li>Até 2 projetos ativos</li>
            <li>Cadastro de etapas da obra</li>
            <li>Controle de orçamento e prazos</li>
            <li className="nao">Projetos ilimitados</li>
            <li className="nao">Relatórios de progresso</li>
            <li className="nao">Assistente IA para planejamento</li>
          </ul>
          {plano === 'Free' ? (
            <span className="badge planejamento">Seu plano atual</span>
          ) : (
            <Link to={logado ? '/projetos' : '/login'} className="btn secundario">
              Começar grátis
            </Link>
          )}
        </article>

        <article className="card plano destaque">
          <span className="tag-destaque">Recomendado</span>
          <h3>Pro</h3>
          <div className="preco">R$ 29,90 <small>/ mês</small></div>
          <ul>
            <li>Projetos ilimitados</li>
            <li>Cadastro de etapas da obra</li>
            <li>Controle de orçamento e prazos</li>
            <li>Relatórios de progresso</li>
            <li>Assistente IA para planejamento</li>
            <li>Suporte prioritário</li>
          </ul>
          <button className="btn" disabled title="Em breve">
            Em breve
          </button>
        </article>
      </div>

      {/* ---------- Vitrine de recursos Pro (bloqueados) ---------- */}
      <section style={{ marginTop: 48 }}>
        <span className="cota">Exclusivo do Pro</span>
        <h2 className="titulo" style={{ fontSize: '1.7rem' }}>O que você destrava no upgrade</h2>
        <div className="grid-planos" style={{ maxWidth: '100%', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>

          <article className="card recurso-pro" style={{ minHeight: 190 }}>
            <div className="preview-borrada">
              <h3 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '1rem' }}>Regenerar análise</h3>
              <p style={{ fontSize: '0.85rem', marginTop: 6 }}>
                Mudou a área, o orçamento ou o tipo de arquitetura? Gere uma nova análise
                de legalização e custos quantas vezes precisar.
              </p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginTop: 8, color: 'var(--ink-soft)' }}>
                ↻ ANÁLISE V2 — GERADA HÁ 2 MIN
              </div>
            </div>
            <div className="cadeado" aria-label="Recurso exclusivo do plano Pro">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1b1d1f" strokeWidth="2">
                <rect x="4" y="10" width="16" height="11" rx="1" fill="#fff" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <span>Pro</span>
            </div>
          </article>

          <article className="card recurso-pro" style={{ minHeight: 190 }}>
            <div className="preview-borrada">
              <h3 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '1rem' }}>Relatório de progresso</h3>
              <p style={{ fontSize: '0.85rem', marginTop: 6 }}>
                PDF executivo com % concluído, custo previsto × realizado e próximos passos
                — pronto pra mandar pro engenheiro ou pro banco.
              </p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginTop: 8, color: 'var(--ink-soft)' }}>
                📈 OBRA 62% CONCLUÍDA — DENTRO DO ORÇAMENTO
              </div>
            </div>
            <div className="cadeado" aria-label="Recurso exclusivo do plano Pro">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1b1d1f" strokeWidth="2">
                <rect x="4" y="10" width="16" height="11" rx="1" fill="#fff" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <span>Pro</span>
            </div>
          </article>

          <article className="card recurso-pro" style={{ minHeight: 190 }}>
            <div className="preview-borrada">
              <h3 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '1rem' }}>Assistente IA da obra</h3>
              <p style={{ fontSize: '0.85rem', marginTop: 6 }}>
                Tire dúvidas sobre a sua obra com contexto do seu projeto: "qual o próximo
                documento?", "esse custo está alto pra minha região?"
              </p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginTop: 8, color: 'var(--ink-soft)' }}>
                💬 "SEU ALVARÁ VENCE EM 40 DIAS…"
              </div>
            </div>
            <div className="cadeado" aria-label="Recurso exclusivo do plano Pro">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1b1d1f" strokeWidth="2">
                <rect x="4" y="10" width="16" height="11" rx="1" fill="#fff" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <span>Pro</span>
            </div>
          </article>

          <article className="card recurso-pro" style={{ minHeight: 190 }}>
            <div className="preview-borrada">
              <h3 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '1rem' }}>Projetos ilimitados</h3>
              <p style={{ fontSize: '0.85rem', marginTop: 6 }}>
                Sem limite de 2 projetos: cadastre reformas, ampliações e obras de clientes
                no mesmo painel.
              </p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginTop: 8, color: 'var(--ink-soft)' }}>
                🏗️ 14 PROJETOS ATIVOS
              </div>
            </div>
            <div className="cadeado" aria-label="Recurso exclusivo do plano Pro">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1b1d1f" strokeWidth="2">
                <rect x="4" y="10" width="16" height="11" rx="1" fill="#fff" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <span>Pro</span>
            </div>
          </article>

        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: 10 }}>
          * PRÉVIAS ILUSTRATIVAS — RELATÓRIO E ASSISTENTE EM DESENVOLVIMENTO
        </p>
      </section>
    </main>
  );
}
