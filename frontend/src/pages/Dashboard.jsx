import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, auth } from '../api';

const STATUS_LABEL = {
  Planejamento: 'Planejamento',
  EmAndamento: 'Em andamento',
  Pausado: 'Pausado',
  Concluido: 'Concluído',
};

function formatarMoeda(valor) {
  if (valor == null) return null;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(iso) {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function Dashboard() {
  const [projetos, setProjetos] = useState(null);
  const [erro, setErro] = useState('');
  const usuario = auth.usuario();
  const planoFree = (usuario?.plano || 'Free') === 'Free';

  async function excluir(ev, p) {
    ev.preventDefault(); // não navega para o detalhe
    ev.stopPropagation();
    const aviso = planoFree
      ? `Excluir "${p.nome}"?\n\nAtenção: no plano Free, excluir NÃO devolve a cota de criação (limite de 2 projetos criados no total).`
      : `Excluir "${p.nome}"? Essa ação não pode ser desfeita.`;
    if (!window.confirm(aviso)) return;
    try {
      await api.excluirProjeto(p.id);
      setProjetos((lista) => lista.filter((x) => x.id !== p.id));
    } catch (e) {
      setErro(e.message);
    }
  }

  useEffect(() => {
    api.listarProjetos()
      .then(setProjetos)
      .catch((e) => setErro(e.message));
  }, []);

  return (
    <main className="container">
      <span className="cota">Painel · {usuario?.nome || 'Usuário'}</span>
      <span className={`badge ${planoFree ? 'pausado' : 'emandamento'}`} style={{ marginTop: 8 }}>
        Plano {planoFree ? 'Free' : 'Pro'}
      </span>
      <h1 className="titulo">Meus projetos</h1>
      <p className="subtitulo">
        Acompanhe o andamento de cada obra: etapas, orçamento e prazos.
      </p>

      <div style={{ marginTop: 20 }}>
        <Link to="/projetos/novo" className="btn">+ Novo projeto</Link>
      </div>

      {erro && <div className="erro" style={{ marginTop: 20 }} role="alert">{erro}</div>}

      {projetos === null && !erro && (
        <p style={{ marginTop: 24, color: 'var(--ink-soft)' }}>Carregando projetos…</p>
      )}

      {projetos?.length === 0 && (
        <div className="vazio">
          <p><strong>Nenhum projeto por aqui ainda.</strong></p>
          <p>Crie seu primeiro projeto para começar a acompanhar a obra.</p>
        </div>
      )}

      {projetos?.length > 0 && (
        <div className="grid-projetos">
          {projetos.map((p) => {
            const concluidas = p.etapas.filter((e) => e.concluida).length;
            return (
              <Link to={`/projetos/${p.id}`} key={p.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className="card card-projeto" style={{ height: '100%' }}>
                <span className={`badge ${p.status.toLowerCase()}`}>
                  {STATUS_LABEL[p.status] || p.status}
                </span>
                <h3>{p.nome}</h3>
                {p.descricao && <p style={{ fontSize: '0.9rem' }}>{p.descricao}</p>}
                <div className="meta">
                  {p.endereco && <span>LOCAL: {p.endereco}</span>}
                  {p.areaM2 != null && <span>ÁREA: {p.areaM2} m²</span>}
                  {p.orcamento != null && <span>ORÇAMENTO: {formatarMoeda(p.orcamento)}</span>}
                  {p.dataInicio && <span>INÍCIO: {formatarData(p.dataInicio)}</span>}
                  {p.previsaoTermino && <span>PREVISÃO: {formatarData(p.previsaoTermino)}</span>}
                </div>
                {p.etapas.length > 0 && (
                  <div className="etapas-resumo">
                    Etapas: {concluidas}/{p.etapas.length} concluídas
                  </div>
                )}
                <button
                  onClick={(ev) => excluir(ev, p)}
                  aria-label={`Excluir projeto ${p.nome}`}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: '1rem', padding: 4 }}
                  title="Excluir projeto"
                >
                  ✕
                </button>
              </article>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
