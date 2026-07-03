# Obra Fácil

Plataforma de gestão de obras: cadastre projetos, acompanhe etapas, orçamento e prazos.

## Stack

| Camada | Tecnologia |
|---|---|
| API | .NET 8 Minimal API, EF Core, JWT |
| Banco | PostgreSQL (produção) / SQLite (dev local) |
| Frontend | React 18 + Vite + React Router |
| Deploy | Render (API) + Neon (Postgres) + Vercel (frontend) — tudo free |

## Estrutura

```
backend/ObraFacil.Api/   API .NET 8 (auth + projetos + etapas)
frontend/                SPA React
```

## Modelo de dados (relacional)

```
usuarios (id PK, nome, email UNIQUE, senha_hash, plano, criado_em)
   └── projetos (id PK, usuario_id FK→usuarios, nome, descricao, endereco,
                 orcamento, area_m2, status, data_inicio, previsao_termino, criado_em)
          └── etapas (id PK, projeto_id FK→projetos, nome, ordem, concluida, criado_em)
```

FKs com `ON DELETE CASCADE`, índice único em `usuarios.email`, índices em `projetos.usuario_id` e `etapas(projeto_id, ordem)`.

## Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/registrar` | — | Cria usuário e retorna JWT |
| POST | `/api/auth/login` | — | Autentica e retorna JWT |
| GET | `/api/projetos` | JWT | Lista projetos do usuário |
| GET | `/api/projetos/{id}` | JWT | Detalhe do projeto |
| POST | `/api/projetos` | JWT | Cria projeto (plano Free: máx. 2) |
| GET | `/health` | — | Health check |

Swagger disponível em `/swagger`.

## Rodando local

**API** (requer .NET 8 SDK):
```bash
cd backend/ObraFacil.Api
dotnet run
# API em http://localhost:5000 (SQLite criado automaticamente)
```

**Frontend:**
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:5000" > .env.local
npm run dev
```

## Deploy gratuito (passo a passo)

### 1. Banco — Neon (Postgres free)
1. Crie conta em https://neon.tech
2. Crie um projeto → copie a **connection string** (formato `postgres://...`)

### 2. API — Render (free)
1. Crie conta em https://render.com → **New → Web Service**
2. Conecte este repositório, Root Directory: `backend/ObraFacil.Api`, Runtime: **Docker**
3. Variáveis de ambiente:
   - `DATABASE_URL` = connection string do Neon
   - `JWT_SECRET` = uma string aleatória longa (ex.: `openssl rand -hex 32`)
   - `FRONTEND_URL` = URL do Vercel (adicione depois do passo 3)
4. Deploy → anote a URL (ex.: `https://obra-facil-api.onrender.com`)

> O plano free do Render hiberna após inatividade; a primeira requisição pode levar ~30s.

### 3. Frontend — Vercel (free)
1. Crie conta em https://vercel.com → **Add New → Project**
2. Conecte este repositório, Root Directory: `frontend` (framework: Vite)
3. Variável de ambiente: `VITE_API_URL` = URL da API no Render
4. Deploy → volte no Render e preencha `FRONTEND_URL` com a URL do Vercel

## Próximos passos sugeridos

- Migrar de `EnsureCreated()` para `dotnet ef migrations`
- Refresh token + armazenamento mais seguro que localStorage
- Edição/exclusão de projetos e conclusão de etapas
- Checkout do plano Pro (Stripe/Mercado Pago)
- Integração com Claude API (assistente de planejamento de obra)
