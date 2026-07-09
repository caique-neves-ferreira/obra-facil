import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function EditarProjeto() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [uf, setUf] = useState('');
  const [cidade, setCidade] = useState('');
  const [cidades, setCidades] = useState([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Carrega o projeto e pré-preenche o formulário
  useEffect(() => {
    api.buscarProjeto(id)
      .then((p) => {
        setForm({
          nome: p.nome || '',
          descricao: p.descricao || '',
          endereco: p.endereco || '',
          terrenoRegistrado: p.terrenoRegistrado ? 'sim' : 'nao',
          tipoArquitetura: p.tipoArquitetura || '',
          orcamento: p.orcamento ?? '',
          areaM2: p.areaM2 ?? '',
          dataInicio: p.dataInicio || '',
          previsaoTermino: p.previsaoTermino || '',
        });
        // Região vem como "Cidade/UF"
        if (p.regiao && p.regiao.includes('/')) {
          const [c, u] = p.regiao.split('/');
          setUf(u.trim());
          setCidade(c.trim());
        }
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [id]);

  // Cidades do IBGE conforme a UF
  useEffect(() => {
    if (!uf) { setCidades([]); return; }
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      .then((r) => r.json())
      .then((lista) => setCidades(lista.map((c) => c.nome)))
      .catch(() => setCidades([]));
  }, [uf]);

  function atualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvarERegenerar() {
    setErro('');
    setSalvando(true);
    try {
      await api.atualizarProjeto(id, {
        nome: form.nome,
        descricao: form.descricao || null,
        endereco: form.endereco || null,
        regiao: cidade && uf ? `${cidade}/${uf}` : null,
        terrenoRegistrado: form.terrenoRegistrado === 'sim',
        tipoArquitetura: form.tipoArquitetura || null,
        orcamento: form.orcamento ? Number(form.orcamento) : null,
        areaM2: form.areaM2 ? Number(form.areaM2) : null,
        dataInicio: form.dataInicio || null,
        previsaoTermino: form.previsaoTermino || null,
      });
      // Regenera a análise com os dados atualizados
      await api.gerarAnalise(id);
      navigate(`/projetos/${id}`);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="container">
        <span className="cota">Editar projeto</span>
        <p className="subtitulo">Carregando…</p>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="container">
        <span className="cota">Editar projeto</span>
        <p className="subtitulo">{erro || 'Projeto não encontrado.'}</p>
        <Link to="/projetos" className="btn secundario">Voltar</Link>
      </main>
    );
  }

  return (
    <main className="container">
      <span className="cota">Editar e regenerar</span>
      <h1 className="titulo">Atualizar dados da obra</h1>
      <p className="subtitulo">
        Ajuste os dados abaixo e a análise de IA (legalização, custos e planta) será gerada
        novamente com as novas informações.
      </p>

      <div className="form" style={{ marginTop: 24 }}>
        {erro && <div className="erro" role="alert">{erro}</div>}

        <div className="campo">
          <label htmlFor="nome">Nome do projeto *</label>
          <input id="nome" value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="descricao">Descrição</label>
          <textarea id="descricao" rows={3} value={form.descricao}
            onChange={(e) => atualizar('descricao', e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="endereco">Endereço</label>
          <input id="endereco" value={form.endereco} onChange={(e) => atualizar('endereco', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="campo" style={{ flex: '1 1 120px' }}>
            <label htmlFor="uf">UF</label>
            <select id="uf" value={uf} onChange={(e) => { setUf(e.target.value); setCidade(''); }}>
              <option value="">—</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="campo" style={{ flex: '1 1 220px' }}>
            <label htmlFor="cidade">Cidade</label>
            <select id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={!uf}>
              <option value="">{uf ? '—' : 'selecione a UF'}</option>
              {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="campo">
          <label htmlFor="terreno">Terreno registrado em cartório?</label>
          <select id="terreno" value={form.terrenoRegistrado}
            onChange={(e) => atualizar('terrenoRegistrado', e.target.value)}>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </div>

        <div className="campo">
          <label htmlFor="tipo">Tipo de arquitetura</label>
          <input id="tipo" value={form.tipoArquitetura}
            onChange={(e) => atualizar('tipoArquitetura', e.target.value)}
            placeholder="Ex.: Térrea, Sobrado, Comercial" />
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="campo" style={{ flex: '1 1 160px' }}>
            <label htmlFor="area">Área construída (m²)</label>
            <input id="area" type="number" min="0" step="0.01" value={form.areaM2}
              onChange={(e) => atualizar('areaM2', e.target.value)} />
          </div>
          <div className="campo" style={{ flex: '1 1 160px' }}>
            <label htmlFor="orcamento">Orçamento (R$)</label>
            <input id="orcamento" type="number" min="0" step="0.01" value={form.orcamento}
              onChange={(e) => atualizar('orcamento', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="campo" style={{ flex: '1 1 160px' }}>
            <label htmlFor="inicio">Início</label>
            <input id="inicio" type="date" value={form.dataInicio}
              onChange={(e) => atualizar('dataInicio', e.target.value)} />
          </div>
          <div className="campo" style={{ flex: '1 1 160px' }}>
            <label htmlFor="termino">Previsão de término</label>
            <input id="termino" type="date" value={form.previsaoTermino}
              onChange={(e) => atualizar('previsaoTermino', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn" onClick={salvarERegenerar} disabled={salvando || !form.nome.trim()}>
            {salvando ? 'Salvando e regenerando… (até 1 min)' : 'Salvar e regenerar análise'}
          </button>
          <Link to={`/projetos/${id}`} className="btn secundario">Cancelar</Link>
        </div>
      </div>
    </main>
  );
}
