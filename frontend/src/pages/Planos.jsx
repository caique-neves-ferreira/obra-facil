import { Link } from 'react-router-dom';
import { auth } from '../api';

export default function Planos() {
  const logado = auth.logado();
  const plano = auth.usuario()?.plano;

  return (
    <main className="container">
      <span className="cota">Planos</span>
      <h1 className="titulo">Escolha o plano da sua obra</h1>
      <p className="subtitulo">
        Comece grátis e faça upgrade quando precisar de mais projetos e recursos avançados.
      </p>

      <div className="grid-planos">
        <article className="card plano">
          <h3>Free</h3>
          <div className="preco">R$ 0 <small>/ mês</small></div>
          <ul>
            <li>Até 2 projetos ativos</li>
            <li>Cadastro de etapas da obra</li>
            <li>Controle de orçamento e prazos</li>
            <li className="nao">Projetos ilimitados</li>
            <li className="nao">Relatórios de progresso</li>
            <li className="nao">Assistente IA para planejamento</li>
          </ul>
          {plano === 'Free' ? (
            <span className="badge planejamento">Seu plano atual</span>
          ) : (
            <Link to={logado ? '/projetos' : '/login'} className="btn secundario">
              Começar grátis
            </Link>
          )}
        </article>

        <article className="card plano destaque">
          <span className="tag-destaque">Recomendado</span>
          <h3>Pro</h3>
          <div className="preco">R$ 29,90 <small>/ mês</small></div>
          <ul>
            <li>Projetos ilimitados</li>
            <li>Cadastro de etapas da obra</li>
            <li>Controle de orçamento e prazos</li>
            <li>Relatórios de progresso</li>
            <li>Assistente IA para planejamento</li>
            <li>Suporte prioritário</li>
          </ul>
          <button className="btn" disabled title="Em breve">
            Em breve
          </button>
        </article>
      </div>
    </main>
  );
}
