import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, auth } from '../api';

export default function Assistente() {
  const ehPro = auth.usuario()?.plano === 'Pro';

  const [projetos, setProjetos] = useState([]);
  const [projetoId, setProjetoId] = useState('');
  const [mensagens, setMensagens] = useState([]); // { role, content }
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fimRef = useRef(null);

  useEffect(() => {
    if (!ehPro) return;
    api.listarProjetos()
      .then((ps) => {
        setProjetos(ps);
        if (ps.length > 0) setProjetoId(ps[0].id);
      })
      .catch(() => {});
  }, [ehPro]);

  useEffect(() => {
    // troca de projeto reinicia a conversa
    setMensagens([]);
    setErro('');
  }, [projetoId]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, enviando]);

  async function enviar(e) {
    e.preventDefault();
    const pergunta = texto.trim();
    if (!pergunta || !projetoId) return;

    const novoHistorico = [...mensagens, { role: 'user', content: pergunta }];
    setMensagens(novoHistorico);
    setTexto('');
    setErro('');
    setEnviando(true);
    try {
      const { resposta } = await api.perguntarAssistente(projetoId, novoHistorico);
      setMensagens((m) => [...m, { role: 'assistant', content: resposta }]);
    } catch (err) {
      setErro(err.message);
      setMensagens((m) => m.slice(0, -1)); // remove a pergunta que falhou
      setTexto(pergunta);
    } finally {
      setEnviando(false);
    }
  }

  if (!ehPro) {
    return (
      <main className="container">
        <span className="cota">Assistente IA</span>
        <h1 className="titulo">Converse com o assistente da sua obra 🤖</h1>
        <p className="subtitulo">
          Tire dúvidas sobre legalização, custos, prazos e próximos passos — com o assistente
          que conhece o contexto do seu projeto. Recurso exclusivo do plano Pro.
        </p>
        <Link to="/planos" className="btn">Conhecer o Pro</Link>
      </main>
    );
  }

  const sugestoes = [
    'Qual o próximo passo da minha obra?',
    'Quais documentos preciso providenciar agora?',
    'Meu orçamento está compatível com a área?',
    'Quanto já gastei até aqui?',
  ];

  return (
    <main className="container">
      <span className="cota">Assistente IA</span>
      <h1 className="titulo">Assistente da obra 🤖</h1>

      {projetos.length === 0 ? (
        <p className="subtitulo">
          Você ainda não tem projetos. <Link to="/projetos/novo">Crie sua primeira obra</Link> para
          conversar com o assistente.
        </p>
      ) : (
        <>
          <label className="campo" style={{ maxWidth: 420 }}>
            Sobre qual obra você quer falar?
            <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
              {projetos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>

          <div className="chat-janela">
            {mensagens.length === 0 && (
              <div className="chat-vazio">
                <p>Pergunte o que quiser sobre esta obra. Algumas ideias:</p>
                <div className="chat-sugestoes">
                  {sugestoes.map((s) => (
                    <button key={s} className="chip" onClick={() => setTexto(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {mensagens.map((m, i) => (
              <div key={i} className={`chat-bolha ${m.role}`}>
                {m.content}
              </div>
            ))}
            {enviando && <div className="chat-bolha assistant digitando">Digitando…</div>}
            <div ref={fimRef} />
          </div>

          {erro && (
            <div className="card" style={{ margin: '12px 0', padding: 12, borderColor: '#c00000' }}>
              <span style={{ fontSize: '0.9rem' }}>{erro}</span>
            </div>
          )}

          <form onSubmit={enviar} className="chat-entrada">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva sua pergunta…"
              disabled={enviando}
            />
            <button className="btn" disabled={enviando || !texto.trim()}>Enviar</button>
          </form>
        </>
      )}
    </main>
  );
}
