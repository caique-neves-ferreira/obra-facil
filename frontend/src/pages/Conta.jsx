import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, auth } from '../api';

const STATUS_FATURA = {
  scheduled: 'Agendada',
  processed: 'Paga',
  recycling: 'Reprocessando',
  cancelled: 'Cancelada',
};

export default function Conta() {
  const [conta, setConta] = useState(null);
  const [assinatura, setAssinatura] = useState(null);
  const [faturas, setFaturas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [receberEmails, setReceberEmails] = useState(true);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  const [msg, setMsg] = useState(null); // { tipo: 'ok'|'erro', texto }
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        const c = await api.minhaConta();
        setConta(c);
        setNome(c.nome);
        setEmail(c.email);
        setReceberEmails(c.receberEmails);

        const a = await api.minhaAssinatura();
        setAssinatura(a.assinatura);
        if (a.plano === 'Pro') {
          const f = await api.listarFaturas().catch(() => ({ faturas: [] }));
          setFaturas(f.faturas || []);
        }
      } catch (e) {
        setMsg({ tipo: 'erro', texto: e.message });
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  function avisar(tipo, texto) {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 5000);
  }

  async function salvarDados(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const atualizada = await api.atualizarConta({ nome, email, receberEmails });
      setConta(atualizada);
      const u = auth.usuario();
      if (u) auth.salvar(localStorage.getItem('obrafacil_token'), { ...u, nome: atualizada.nome, email: atualizada.email });
      avisar('ok', 'Dados atualizados com sucesso.');
    } catch (err) {
      avisar('erro', err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.alterarSenha(senhaAtual, novaSenha);
      setSenhaAtual('');
      setNovaSenha('');
      avisar('ok', 'Senha alterada com sucesso.');
    } catch (err) {
      avisar('erro', err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarAssinatura() {
    if (!window.confirm('Cancelar sua assinatura Pro? Você voltará ao plano Free.')) return;
    setSalvando(true);
    try {
      await api.cancelarAssinatura();
      const c = await api.minhaConta();
      setConta(c);
      const a = await api.minhaAssinatura();
      setAssinatura(a.assinatura);
      avisar('ok', 'Assinatura cancelada. Você voltou ao plano Free.');
    } catch (err) {
      avisar('erro', err.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="container">
        <span className="cota">Minha conta</span>
        <p className="subtitulo">Carregando…</p>
      </main>
    );
  }

  const ehPro = conta?.plano === 'Pro';

  return (
    <main className="container">
      <span className="cota">Minha conta</span>
      <h1 className="titulo">Olá, {conta?.nome?.split(' ')[0]}</h1>

      {msg && (
        <div className="card" style={{ marginBottom: 20, padding: 14, borderColor: msg.tipo === 'erro' ? '#c00000' : '#2e7d32' }}>
          {msg.texto}
        </div>
      )}

      <div className="grid-conta">
        {/* ---------- Dados da conta ---------- */}
        <section className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Dados da conta</h3>
          <form onSubmit={salvarDados}>
            <label className="campo">
              Nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
            </label>
            <label className="campo">
              E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={receberEmails}
                onChange={(e) => setReceberEmails(e.target.checked)}
                style={{ width: 'auto' }}
              />
              Quero receber e-mails com novidades e avisos da minha obra
            </label>
            <button className="btn" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </form>
        </section>

        {/* ---------- Segurança ---------- */}
        <section className="card" style={{ padding: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Alterar senha</h3>
          <form onSubmit={trocarSenha}>
            <label className="campo">
              Senha atual
              <input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required />
            </label>
            <label className="campo">
              Nova senha
              <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required minLength={6} />
            </label>
            <button className="btn secundario" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Alterar senha'}
            </button>
          </form>
        </section>
      </div>

      {/* ---------- Assinatura ---------- */}
      <section className="card" style={{ padding: 20, marginTop: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Assinatura</h3>
        <p style={{ fontSize: '0.95rem' }}>
          Plano atual: <strong>{conta?.plano}</strong>
          {ehPro && assinatura?.ativadaEm && (
            <> · ativo desde {new Date(assinatura.ativadaEm).toLocaleDateString('pt-BR')}
              {' '}· R$ {Number(assinatura.valorMensal).toFixed(2).replace('.', ',')}/mês</>
          )}
        </p>

        {!ehPro && (
          <p style={{ marginTop: 10 }}>
            <Link to="/planos" className="btn">Conhecer o plano Pro</Link>
          </p>
        )}

        {ehPro && (
          <>
            <h4 style={{ margin: '18px 0 8px' }}>Faturas</h4>
            {faturas.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                Nenhuma fatura registrada ainda — a primeira aparece após a cobrança inicial.
              </p>
            ) : (
              <table className="tabela-faturas">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((f) => (
                    <tr key={f.id}>
                      <td>{f.data ? new Date(f.data).toLocaleDateString('pt-BR') : '—'}</td>
                      <td>R$ {Number(f.valor).toFixed(2).replace('.', ',')}</td>
                      <td>{STATUS_FATURA[f.status] || f.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <button
              className="btn secundario"
              style={{ marginTop: 16 }}
              onClick={cancelarAssinatura}
              disabled={salvando}
            >
              {salvando ? 'Processando…' : 'Cancelar assinatura'}
            </button>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ink-soft)', marginTop: 8 }}>
              AO CANCELAR, VOCÊ VOLTA AO PLANO FREE IMEDIATAMENTE. SEM MULTA, SEM FIDELIDADE.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
