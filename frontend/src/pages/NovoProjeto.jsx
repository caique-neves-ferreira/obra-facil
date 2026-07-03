import { useEffect, useState } from 'react';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const ETAPAS_PADRAO = [
  'Serviços preliminares', 'Fundação', 'Estrutura', 'Alvenaria', 'Cobertura',
  'Instalações elétricas', 'Instalações hidráulicas', 'Esquadrias',
  'Revestimentos', 'Pintura', 'Acabamento', 'Paisagismo',
];
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function NovoProjeto() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    endereco: '',
    uf: '',
    cidade: '',
    terrenoRegistrado: 'nao',
    tipoArquitetura: '',
    orcamento: '',
    areaM2: '',
    dataInicio: '',
    previsaoTermino: '',
  });
  const [etapasSel, setEtapasSel] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);

  // Busca as cidades da UF na API pública do IBGE
  useEffect(() => {
    if (!form.uf) { setCidades([]); return; }
    setCarregandoCidades(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${form.uf}/municipios?orderBy=nome`)
      .then((r) => r.json())
      .then((lista) => setCidades(lista.map((c) => c.nome)))
      .catch(() => setCidades([]))
      .finally(() => setCarregandoCidades(false));
  }, [form.uf]);

  const todasMarcadas = etapasSel.length === ETAPAS_PADRAO.length;

  function alternarEtapa(nome) {
    setEtapasSel((sel) =>
      sel.includes(nome) ? sel.filter((e) => e !== nome) : [...sel, nome]
    );
  }

  function alternarTodas() {
    setEtapasSel(todasMarcadas ? [] : [...ETAPAS_PADRAO]);
  }
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
      const criado = await api.criarProjeto({
        nome: form.nome,
        descricao: form.descricao || null,
        endereco: form.endereco || null,
        regiao: form.cidade && form.uf ? `${form.cidade}/${form.uf}` : null,
        terrenoRegistrado: form.terrenoRegistrado === 'sim',
        tipoArquitetura: form.tipoArquitetura || null,
        orcamento: form.orcamento ? Number(form.orcamento) : null,
        areaM2: form.areaM2 ? Number(form.areaM2) : null,
        dataInicio: form.dataInicio || null,
        previsaoTermino: form.previsaoTermino || null,
        etapas: etapasSel.length > 0 ? etapasSel : null,
      });
      navigate(`/projetos/${criado.id}`);
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
            <label htmlFor="uf">Estado (UF) *</label>
            <select id="uf" value={form.uf} onChange={(e) => { atualizar('uf', e.target.value); atualizar('cidade', ''); }}>
              <option value="">Selecione…</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="cidade">Cidade *</label>
            <select
              id="cidade"
              value={form.cidade}
              onChange={(e) => atualizar('cidade', e.target.value)}
              disabled={!form.uf || carregandoCidades}
            >
              <option value="">{carregandoCidades ? 'Carregando…' : 'Selecione…'}</option>
              {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="campo">
            <label htmlFor="registrado">Terreno registrado em cartório?</label>
            <select
              id="registrado"
              value={form.terrenoRegistrado}
              onChange={(e) => atualizar('terrenoRegistrado', e.target.value)}
            >
              <option value="nao">Não / não sei</option>
              <option value="sim">Sim, já registrado</option>
            </select>
        </div>

        <div className="campo">
          <label htmlFor="arquitetura">Tipo de arquitetura</label>
          <select
            id="arquitetura"
            value={form.tipoArquitetura}
            onChange={(e) => atualizar('tipoArquitetura', e.target.value)}
          >
            <option value="">Selecione…</option>
            <option value="Casa térrea">Casa térrea</option>
            <option value="Sobrado">Sobrado</option>
            <option value="Kitnet / Studio">Kitnet / Studio</option>
            <option value="Edícula / Anexo">Edícula / Anexo</option>
            <option value="Comercial">Comercial</option>
            <option value="Misto (residencial + comercial)">Misto (residencial + comercial)</option>
          </select>
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

        <fieldset className="campo" style={{ border: '1px solid var(--line)', padding: '14px' }}>
          <legend style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-soft)', padding: '0 6px' }}>
            Etapas do planejamento
          </legend>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, textTransform: 'none', fontSize: '0.9rem', fontFamily: 'var(--font-body)', letterSpacing: 0, color: 'var(--ink)', marginBottom: 8 }}>
            <input type="checkbox" checked={todasMarcadas} onChange={alternarTodas} />
            Todas as etapas
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
            {ETAPAS_PADRAO.map((nome) => (
              <label key={nome} style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', fontSize: '0.9rem', fontFamily: 'var(--font-body)', letterSpacing: 0, color: 'var(--ink)' }}>
                <input
                  type="checkbox"
                  checked={etapasSel.includes(nome)}
                  onChange={() => alternarEtapa(nome)}
                />
                {nome}
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" onClick={salvar} disabled={carregando || !form.nome.trim() || !form.uf || !form.cidade}>
            {carregando ? 'Salvando…' : 'Salvar projeto'}
          </button>
          <Link to="/projetos" className="btn secundario">Cancelar</Link>
        </div>
      </div>
    </main>
  );
}
