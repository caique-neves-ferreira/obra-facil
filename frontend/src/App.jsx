import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { auth } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NovoProjeto from './pages/NovoProjeto';
import ProjetoDetalhe from './pages/ProjetoDetalhe';
import Planos from './pages/Planos';

function Topbar() {
  const navigate = useNavigate();
  const logado = auth.logado();

  function sair() {
    auth.sair();
    navigate('/login');
  }

  return (
    <>
      <header className="topbar">
        <Link to={logado ? '/projetos' : '/login'} className="logo">
          Obra<span>Fácil</span>
        </Link>
        <nav>
          {logado && <Link to="/projetos">Projetos</Link>}
          <Link to="/planos">Planos</Link>
          {logado && (
            <button className="sair" onClick={sair}>Sair</button>
          )}
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
        <Route path="/login" element={<Login />} />
        <Route path="/planos" element={<Planos />} />
        <Route path="/projetos" element={<Protegida><Dashboard /></Protegida>} />
        <Route path="/projetos/novo" element={<Protegida><NovoProjeto /></Protegida>} />
        <Route path="/projetos/:id" element={<Protegida><ProjetoDetalhe /></Protegida>} />
        <Route path="*" element={<Navigate to={auth.logado() ? '/projetos' : '/login'} replace />} />
      </Routes>
    </>
  );
}
