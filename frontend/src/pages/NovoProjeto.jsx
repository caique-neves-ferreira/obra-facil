import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function NovoProjeto() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    endereco: '',
    orcamento: '',
    areaM2: '',
    dataInicio: '',
    previsaoTermino: '',
    etapas: '',
  });
  const [erro, setErro] = useState('');
  const [limiteFree, setLimiteFree] = useState(false);
  const [carregando, setCarregando] = useState(false);

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar() {
    setErro('');
    setLimiteFree(false);
    setCarregando(true);
    try {
      await api.criarProjeto({
        nome: form.nome,
        descricao: form.descricao || null,
        endereco: form.endereco || null,
        orcamento: form.orcamento ? Number(form.orcamento) : null,
        areaM2: form.areaM2 ? Number(form.areaM2) : null,
        dataInicio: form.dataInicio || null,
        previsaoTermino: form.previsaoTermino || null,
        etapas: form.etapas
          ? form.etapas.split(',').map((e) => e.trim()).filter(Boolean)
          : null,
      });
      navigate('/projetos');
    } catch (e) {
      if (e.codigo === 'LIMITE_PLANO_FREE') setLimiteFree(true);
      else setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="container">
      <span className="cota">Novo projeto</span>
      <h1 className="titulo">Cadastrar obra</h1>
      <p className="subtitulo">
        Preencha os dados principais. Só o nome é obrigatório — o resto você completa depois.
      </p>

      <div className="form" style={{ marginTop: 24 }}>
        {erro && <div className="erro" role="alert">{erro}</div>}
        {limiteFree && (
          <div className="aviso-upgrade" role="alert">
            Você atingiu o limite de projetos do plano Free.{' '}
            <Link to="/planos">Conheça o plano Pro</Link> para criar projetos ilimitados.
          </div>
        )}

        <div className="campo">
          <label htmlFor="nome">Nome do projeto *</label>
          <input
            id="nome"
            value={form.nome}
            onChange={(e) => atualizar('nome', e.target.value)}
            placeholder="Ex.: Casa Candeias — Fase 2"
          />
        </div>

        <div className="campo">
          <label htmlFor="descricao">Descrição</label>
          <textarea
            id="descricao"
            rows={3}
            value={form.descricao}
            onChange={(e) => atualizar('descricao', e.target.value)}
            placeholder="Escopo geral da obra"
          />
        </div>

        <div className="campo">
          <label htmlFor="endereco">Endereço</label>
          <input
            id="endereco"
            value={form.endereco}
            onChange={(e) => atualizar('endereco', e.target.value)}
            placeholder="Rua, número, bairro, cidade"
          />
        </div>

        <div className="linha-dupla">
          <div className="campo">
            <label htmlFor="orcamento">Orçamento (R$)</label>
            <input
              id="orcamento"
              type="number"
              min="0"
              step="0.01"
              value={form.orcamento}
              onChange={(e) => atualizar('orcamento', e.target.value)}
              placeholder="150000"
            />
          </div>
          <div className="campo">
            <label htmlFor="area">Área (m²)</label>
            <input
              id="area"
              type="number"
              min="0"
              step="0.1"
              value={form.areaM2}
              onChange={(e) => atualizar('areaM2', e.target.value)}
              placeholder="149"
            />
          </div>
        </div>

        <div className="linha-dupla">
          <div className="campo">
            <label htmlFor="inicio">Data de início</label>
            <input
              id="inicio"
              type="date"
              value={form.dataInicio}
              onChange={(e) => atualizar('dataInicio', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="previsao">Previsão de término</label>
            <input
              id="previsao"
              type="date"
              value={form.previsaoTermino}
              onChange={(e) => atualizar('previsaoTermino', e.target.value)}
            />
          </div>
        </div>

        <div className="campo">
          <label htmlFor="etapas">Etapas (separadas por vírgula)</label>
          <input
            id="etapas"
            value={form.etapas}
            onChange={(e) => atualizar('etapas', e.target.value)}
            placeholder="Fundação, Alvenaria, Elétrica, Hidráulica, Acabamento"
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" onClick={salvar} disabled={carregando || !form.nome.trim()}>
            {carregando ? 'Salvando…' : 'Salvar projeto'}
          </button>
          <Link to="/projetos" className="btn secundario">Cancelar</Link>
        </div>
      </div>
    </main>
  );
}
