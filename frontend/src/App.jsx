import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { auth } from './api';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NovoProjeto from './pages/NovoProjeto';
import EditarProjeto from './pages/EditarProjeto';
import ProjetoDetalhe from './pages/ProjetoDetalhe';
import Planos from './pages/Planos';
import Conta from './pages/Conta';
import Assistente from './pages/Assistente';
import Relatorios from './pages/Relatorios';

function Topbar() {
  const navigate = useNavigate();
  const logado = auth.logado();
  const usuario = auth.usuario();
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function fecharFora(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(false);
    }
    document.addEventListener('mousedown', fecharFora);
    return () => document.removeEventListener('mousedown', fecharFora);
  }, []);

  function sair() {
    auth.sair();
    setMenuAberto(false);
    navigate('/login');
  }

  const inicial = (usuario?.nome || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      <header className="topbar">
        <Link to="/" className="logo">
          Obra<span>Fácil</span>
        </Link>
        <nav>
          {logado && <Link to="/projetos">Projetos</Link>}
          {logado && <Link to="/assistente">Assistente IA</Link>}
          {logado && <Link to="/relatorios">Relatórios</Link>}
          {logado && (
            <div className="avatar-menu" ref={menuRef}>
              <button
                className="avatar"
                onClick={() => setMenuAberto((v) => !v)}
                aria-label="Menu da conta"
                aria-expanded={menuAberto}
              >
                {inicial}
              </button>
              {menuAberto && (
                <div className="avatar-dropdown">
                  <div className="avatar-info">
                    <strong>{usuario?.nome}</strong>
                    <small>{usuario?.email}</small>
                  </div>
                  <Link to="/conta" onClick={() => setMenuAberto(false)}>Minha conta</Link>
                  <Link to="/conta?aba=senha" onClick={() => setMenuAberto(false)}>Alterar senha</Link>
                  <Link to="/planos" onClick={() => setMenuAberto(false)}>Planos</Link>
                  <button onClick={sair}>Sair</button>
                </div>
              )}
            </div>
          )}
          {!logado && <Link to="/planos">Planos</Link>}
          {!logado && <Link to="/login">Entrar</Link>}
        </nav>
      </header>
      <div className="hatch" />
    </>
  );
}

function Protegida({ children }) {
  return auth.logado() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/planos" element={<Planos />} />
        <Route path="/conta" element={<Protegida><Conta /></Protegida>} />
        <Route path="/assistente" element={<Protegida><Assistente /></Protegida>} />
        <Route path="/relatorios" element={<Protegida><Relatorios /></Protegida>} />
        <Route path="/projetos" element={<Protegida><Dashboard /></Protegida>} />
        <Route path="/projetos/novo" element={<Protegida><NovoProjeto /></Protegida>} />
        <Route path="/projetos/:id/editar" element={<Protegida><EditarProjeto /></Protegida>} />
        <Route path="/projetos/:id" element={<Protegida><ProjetoDetalhe /></Protegida>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
