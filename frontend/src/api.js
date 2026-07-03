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
  buscarProjeto: (id) => request(`/api/projetos/${id}`),
  buscarAnalise: (projetoId) => request(`/api/projetos/${projetoId}/analise`),
  gerarAnalise: (projetoId) =>
    request(`/api/projetos/${projetoId}/analise`, { method: 'POST' }),
  excluirProjeto: (id) =>
    request(`/api/projetos/${id}`, { method: 'DELETE' }),
  atualizarEtapa: (projetoId, etapaId, concluida) =>
    request(`/api/projetos/${projetoId}/etapas/${etapaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ concluida }),
    }),
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
  logado() { return Boolean(getToken()); },
  sair() {
    localStorage.removeItem('obrafacil_token');
    localStorage.removeItem('obrafacil_usuario');
  },
};
