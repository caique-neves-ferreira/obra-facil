import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, auth } from '../api';

const RECURSOS_PRO = [
  {
    titulo: 'Regenerar análise',
    texto:
      'Mudou a área, o orçamento ou o tipo de arquitetura? Gere uma nova análise de legalização e custos quantas vezes precisar.',
    mono: '↻ ANÁLISE V2 — GERADA HÁ 2 MIN',
  },
  {
    titulo: 'Relatório de progresso',
    texto:
      'PDF executivo com % concluído, custo previsto × realizado e próximos passos — pronto pra mandar pro engenheiro ou pro banco.',
    mono: '📈 OBRA 62% CONCLUÍDA — DENTRO DO ORÇAMENTO',
  },
  {
    titulo: 'Assistente IA da obra',
    texto:
      'Tire dúvidas sobre a sua obra com contexto do seu projeto: "qual o próximo documento?", "esse custo está alto pra minha região?"',
    mono: '💬 "SEU ALVARÁ VENCE EM 40 DIAS…"',
  },
  {
    titulo: 'Projetos ilimitados',
    texto:
      'Sem limite de 2 projetos: cadastre reformas, ampliações e obras de clientes no mesmo painel.',
    mono: '🏗️ 14 PROJETOS ATIVOS',
  },
];

function Cadeado() {
  return (
    <div className="cadeado" aria-label="Recurso exclusivo do plano Pro">
      <svg viewBox="0 0 24 24" fill="none" stroke="#1b1d1f" strokeWidth="2">
        <rect x="4" y="10" width="16" height="11" rx="1" fill="#fff" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
      <span>Pro</span>
    </div>
  );
}

function CardRecurso({ recurso, desbloqueado }) {
  const conteudo = (
    <>
      <h3 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '1rem' }}>
        {recurso.titulo}
      </h3>
      <p style={{ fontSize: '0.85rem', marginTop: 6 }}>{recurso.texto}</p>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginTop: 8, color: 'var(--ink-soft)' }}>
        {recurso.mono}
      </div>
    </>
  );

  if (desbloqueado) {
    return (
      <article className="card recurso-pro" style={{ minHeight: 190 }}>
        <div style={{ paddingRight: 8 }}>{conteudo}</div>
        <span className="tag-incluido">✓ INCLUÍDO</span>
      </article>
    );
  }

  return (
    <article className="card recurso-pro" style={{ minHeight: 190 }}>
      <div className="preview-borrada">{conteudo}</div>
      <Cadeado />
    </article>
  );
}

export default function Planos() {
  const logado = auth.logado();
  const [searchParams, setSearchParams] = useSearchParams();
  const retornoMp = searchParams.get('retorno') === 'mp';

  const [plano, setPlano] = useState(auth.usuario()?.plano || 'Free');
  const [assinatura, setAssinatura] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [aguardandoAtivacao, setAguardandoAtivacao] = useState(retornoMp);
  const [erro, setErro] = useState('');
  const tentativas = useRef(0);

  async function carregarAssinatura() {
    const data = await api.minhaAssinatura();
    setPlano(data.plano);
    setAssinatura(data.assinatura);
    return data;
  }

  useEffect(() => {
    if (!logado) return;
    carregarAssinatura().catch(() => {});
  }, [logado]);

  // Retorno do checkout do Mercado Pago: aguarda a ativação do plano
  useEffect(() => {
    if (!retornoMp || !logado) return;
    const timer = setInterval(async () => {
      tentativas.current += 1;
      try {
        const data = await carregarAssinatura();
        if (data.plano === 'Pro' || tentativas.current >= 10) {
          clearInterval(timer);
          setAguardandoAtivacao(false);
          setSearchParams({}, { replace: true });
        }
      } catch {
        /* tenta de novo no próximo tick */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [retornoMp, logado]);

  async function assinar() {
    setErro('');
    setProcessando(true);
    try {
      const { urlCheckout } = await api.iniciarCheckout();
      window.location.href = urlCheckout; // checkout seguro do Mercado Pago
    } catch (e) {
      setErro(e.message);
      setProcessando(false);
    }
  }

  const ehPro = plano === 'Pro';

  /* ===================== Visão do assinante PRO ===================== */
  if (ehPro && !aguardandoAtivacao) {
    return (
      <main className="container">
        <span className="cota">Seu plano</span>
        <h1 className="titulo">Você é Pro 🏗️</h1>
        <p className="subtitulo">
          Todos os recursos estão liberados na sua conta. Bom proveito na obra!
        </p>

        <div className="card" style={{ marginBottom: 24, padding: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, justifyContent: 'space-between' }}>
          <div>
            <strong>Plano Pro ativo ✓</strong>
            <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
              {assinatura?.valorMensal != null && (
                <>R$ {Number(assinatura.valorMensal).toFixed(2).replace('.', ',')}/mês</>
              )}
              {assinatura?.ativadaEm && (
                <> · ativo desde {new Date(assinatura.ativadaEm).toLocaleDateString('pt-BR')}</>
              )}
            </p>
          </div>
          <Link to="/conta" className="btn secundario">Gerenciar assinatura</Link>
        </div>

        <section>
          <span className="cota">Incluído no seu plano</span>
          <h2 className="titulo" style={{ fontSize: '1.7rem' }}>Tudo que você tem direito</h2>
          <div className="grid-planos" style={{ maxWidth: '100%', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {RECURSOS_PRO.map((r) => (
              <CardRecurso key={r.titulo} recurso={r} desbloqueado />
            ))}
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: 10 }}>
            FATURAS E CANCELAMENTO EM <Link to="/conta">MINHA CONTA</Link>
          </p>
        </section>
      </main>
    );
  }

  /* ===================== Visão Free / deslogado ===================== */
  return (
    <main className="container">
      <span className="cota">Planos</span>
      <h1 className="titulo">Escolha o plano da sua obra</h1>
      <p className="subtitulo">
        Comece grátis e faça upgrade quando precisar de mais projetos e recursos avançados.
      </p>

      {aguardandoAtivacao && (
        <div className="card" style={{ marginBottom: 20, padding: 16 }}>
          <strong>Confirmando seu pagamento…</strong>
          <p style={{ fontSize: '0.85rem', marginTop: 4 }}>
            Assim que o Mercado Pago confirmar, seu plano Pro é ativado automaticamente
            — pode levar alguns segundos.
          </p>
        </div>
      )}
      {erro && (
        <div className="card" style={{ marginBottom: 20, padding: 16, borderColor: '#c00000' }}>
          <strong>Ops:</strong> <span style={{ fontSize: '0.9rem' }}>{erro}</span>
        </div>
      )}

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
          {logado ? (
            <span className="badge planejamento">Seu plano atual</span>
          ) : (
            <Link to="/login" className="btn secundario">Começar grátis</Link>
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
          {logado ? (
            <button className="btn" onClick={assinar} disabled={processando || aguardandoAtivacao}>
              {processando ? 'Redirecionando…' : 'Assinar Pro'}
            </button>
          ) : (
            <Link to="/login" className="btn">Entrar para assinar</Link>
          )}
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-soft)', marginTop: 10 }}>
            PAGAMENTO SEGURO VIA MERCADO PAGO · CANCELE QUANDO QUISER
          </p>
        </article>
      </div>

      {/* ---------- Vitrine de recursos Pro (bloqueados) ---------- */}
      <section style={{ marginTop: 48 }}>
        <span className="cota">Exclusivo do Pro</span>
        <h2 className="titulo" style={{ fontSize: '1.7rem' }}>O que você destrava no upgrade</h2>
        <div className="grid-planos" style={{ maxWidth: '100%', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {RECURSOS_PRO.map((r) => (
            <CardRecurso key={r.titulo} recurso={r} desbloqueado={false} />
          ))}
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-soft)', marginTop: 10 }}>
          * PRÉVIAS ILUSTRATIVAS — RELATÓRIO E ASSISTENTE EM DESENVOLVIMENTO
        </p>
      </section>
    </main>
  );
}
