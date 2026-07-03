import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, auth } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [modo, setModo] = useState('login'); // 'login' | 'registrar'
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function enviar() {
    setErro('');
    setCarregando(true);
    try {
      const resp = modo === 'login'
        ? await api.login(email, senha)
        : await api.registrar(nome, email, senha);
      auth.salvar(resp.token, resp.usuario);
      navigate('/projetos');
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="tela-login">
      <section className="login-lado">
        <span className="cota" style={{ color: '#9a9c98' }}>Gestão de obras</span>
        <h2>Sua obra no <em>controle</em>, do alicerce ao acabamento.</h2>
        <ul>
          <li>Cadastre projetos e acompanhe cada etapa</li>
          <li>Orçamento, prazos e status em um só lugar</li>
          <li>Comece grátis, sem cartão de crédito</li>
        </ul>
      </section>

      <section className="login-form-area">
        <div className="form">
          <span className="cota">{modo === 'login' ? 'Entrar' : 'Criar conta'}</span>
          <h1 className="titulo" style={{ fontSize: '1.8rem' }}>
            {modo === 'login' ? 'Bem-vindo de volta' : 'Comece grátis'}
          </h1>

          {erro && <div className="erro" role="alert">{erro}</div>}

          {modo === 'registrar' && (
            <div className="campo">
              <label htmlFor="nome">Nome</label>
              <input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                autoComplete="name"
              />
            </div>
          )}

          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              autoComplete="email"
            />
          </div>

          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              onKeyDown={(e) => e.key === 'Enter' && enviar()}
            />
          </div>

          <button className="btn" onClick={enviar} disabled={carregando}>
            {carregando ? 'Aguarde…' : modo === 'login' ? 'Entrar' : 'Criar conta grátis'}
          </button>

          <button
            className="trocar-modo"
            onClick={() => { setModo(modo === 'login' ? 'registrar' : 'login'); setErro(''); }}
          >
            {modo === 'login'
              ? 'Ainda não tem conta? Crie uma grátis'
              : 'Já tem conta? Entre aqui'}
          </button>
        </div>
      </section>
    </main>
  );
}
