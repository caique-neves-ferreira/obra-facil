const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getToken() {
  return localStorage.getItem('obrafacil_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && path !== '/api/auth/login') {
    localStorage.removeItem('obrafacil_token');
    localStorage.removeItem('obrafacil_usuario');
    window.location.href = '/login';
    throw new Error('Sessão expirada. Entre novamente.');
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.erro || 'Algo deu errado. Tente novamente.';
    const err = new Error(msg);
    err.codigo = data?.codigo;
    throw err;
  }
  return data;
}

export const api = {
  registrar: (nome, email, senha) =>
    request('/api/auth/registrar', { method: 'POST', body: JSON.stringify({ nome, email, senha }) }),
  login: (email, senha) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
  listarProjetos: () => request('/api/projetos'),
  criarProjeto: (projeto) =>
    request('/api/projetos', { method: 'POST', body: JSON.stringify(projeto) }),
  atualizarProjeto: (id, projeto) =>
    request(`/api/projetos/${id}`, { method: 'PUT', body: JSON.stringify(projeto) }),
  buscarProjeto: (id) => request(`/api/projetos/${id}`),
  buscarAnalise: (projetoId) => request(`/api/projetos/${projetoId}/analise`),
  gerarAnalise: (projetoId) =>
    request(`/api/projetos/${projetoId}/analise`, { method: 'POST' }),
  excluirProjeto: (id) =>
    request(`/api/projetos/${id}`, { method: 'DELETE' }),
  atualizarEtapa: (projetoId, etapaId, dados) =>
    request(`/api/projetos/${projetoId}/etapas/${etapaId}`, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    }),
  perguntarAssistente: (projetoId, mensagens) =>
    request(`/api/projetos/${projetoId}/assistente`, {
      method: 'POST',
      body: JSON.stringify({ mensagens }),
    }),
  baixarRelatorio: async (projetoId, tipo) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/projetos/${projetoId}/relatorios/${tipo}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = 'Não foi possível gerar o relatório.';
      try { const j = await res.json(); msg = j.erro || msg; } catch { /* corpo não-JSON */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const dispo = res.headers.get('Content-Disposition') || '';
    const m = dispo.match(/filename="?([^"]+)"?/);
    const nome = m ? m[1] : tipo;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  minhaAssinatura: () => request('/api/assinaturas/minha'),
  iniciarCheckout: () =>
    request('/api/assinaturas/checkout', { method: 'POST' }),
  cancelarAssinatura: () =>
    request('/api/assinaturas/cancelar', { method: 'POST' }),
  listarFaturas: () => request('/api/assinaturas/faturas'),
  historicoAssinaturas: () => request('/api/assinaturas/historico'),
  minhaConta: () => request('/api/conta'),
  atualizarConta: (dados) =>
    request('/api/conta', { method: 'PATCH', body: JSON.stringify(dados) }),
  solicitarCodigoSenha: () =>
    request('/api/conta/senha/codigo', { method: 'POST' }),
  alterarSenha: (codigo, novaSenha) =>
    request('/api/conta/senha', { method: 'POST', body: JSON.stringify({ codigo, novaSenha }) }),
};

export const auth = {
  salvar(token, usuario) {
    localStorage.setItem('obrafacil_token', token);
    localStorage.setItem('obrafacil_usuario', JSON.stringify(usuario));
  },
  usuario() {
    try { return JSON.parse(localStorage.getItem('obrafacil_usuario')); }
    catch { return null; }
  },
  sincronizarPlano(plano) {
    const u = this.usuario();
    if (u && u.plano !== plano) {
      localStorage.setItem('obrafacil_usuario', JSON.stringify({ ...u, plano }));
    }
  },
  logado() { return Boolean(getToken()); },
  sair() {
    localStorage.removeItem('obrafacil_token');
    localStorage.removeItem('obrafacil_usuario');
  },
};
