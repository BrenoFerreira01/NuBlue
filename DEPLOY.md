# Publicação da Nublue

O frontend (React/Vite) é publicado no **GitHub Pages**. A API (Node.js) e o banco (**PostgreSQL**) ficam em outro serviço, porque o GitHub Pages só serve arquivos estáticos.

```text
https://brenoferreira01.github.io/NuBlue/  ──fetch + cookie──▶  https://<sua-api>/api/*  ──▶  PostgreSQL
        (GitHub Pages)                                        (host de containers)          (PlanetScale Postgres)
```

## 1. Banco de dados (PostgreSQL)

1. Crie o banco (PlanetScale Postgres ou outro PostgreSQL 15+ com TLS).
2. Anote duas URLs:
   - `DATABASE_URL`: tráfego da API pelo pooler (PgBouncer, porta `6432` no PlanetScale);
   - `DATABASE_DIRECT_URL`: conexão direta (porta `5432`), usada só por migrações e seed.
3. A partir de `backend/`, com as variáveis exportadas, aplique o schema e o catálogo:

   ```sh
   node src/db/migrate.js       # idempotente: pode rodar a cada deploy
   node src/db/seed-course.js   # recusa catálogo inválido antes de escrever
   ```

4. Ative os backups do provedor e siga o procedimento de backup/restauração da equipe.

## 2. API

Qualquer host de containers ou Node.js serve (Render, Railway, Fly.io, Cloud Run...). O `backend/Dockerfile` gera a imagem; sem Docker, use `npm ci --omit=dev && node src/server.js` em `backend/`.

Variáveis de produção:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | a porta que o host fornece (padrão `4000`) |
| `DATABASE_URL` / `DATABASE_DIRECT_URL` | do passo 1 |
| `FRONTEND_ORIGIN` | `https://brenoferreira01.github.io` (só a origem, **sem** `/NuBlue/`) |
| `COOKIE_SAME_SITE` | `None` com Pages + API em sites diferentes; `Lax` com domínio próprio (seção 4) |
| `TRUST_PROXY_HOPS` | `1` na maioria dos hosts (um proxy na frente); confira a documentação do host |
| `RATE_LIMIT_STORE` | `postgres` (padrão em produção; compartilhado entre instâncias) |
| `DATABASE_POOL_MAX` | opcional; instâncias × este valor deve caber no limite do pooler |

Em cada deploy: `node src/db/migrate.js` como etapa de release, depois a nova versão. Configure o health check do host em `GET /api/health`: ele responde `503` se o banco estiver fora ou se faltar alguma migração do código (`schema_outdated`).

A API remove sessões expiradas e janelas antigas de rate limit a cada hora. Se o host tiver cron, `node src/db/maintenance-cli.js` faz o mesmo sob demanda.

**Rollback:** reimplante a imagem anterior. As migrações só adicionam objetos, então a versão antiga continua funcionando com o schema mais novo, e o `/api/health` aceita schema igual ou mais novo que o esperado pela imagem. Escreva migrações futuras mantendo essa regra (adicionar antes, remover só numa versão seguinte).

## 3. Frontend no GitHub Pages

1. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   `VITE_API_URL` = URL HTTPS da API, sem barra final (ex.: `https://nublue-api.onrender.com`).
   Não é segredo: ela fica visível no JavaScript publicado.
3. Um push na `main` (ou **Actions → Deploy frontend to GitHub Pages → Run workflow**) roda testes, build e publica em `https://brenoferreira01.github.io/NuBlue/`.

Sem `VITE_API_URL`, o workflow publica mesmo assim, com um aviso: o site funciona só no modo visitante (sem login, progresso na conta ou ranking).

O workflow `.github/workflows/deploy-pages.yml` usa o `base_path` do próprio Pages, então o mesmo arquivo serve para domínio próprio sem alterações.

## 4. Cookies entre sites e Safari

Com o frontend em `github.io` e a API em outro domínio, o cookie de sessão é um cookie de terceiros. A API o envia com `SameSite=None; Secure; Partitioned`, o que funciona no Chrome, Edge e Firefox. **O Safari (inclusive iPhone e iPad) bloqueia cookies de terceiros**: o login parece funcionar, mas a sessão não persiste.

Para que todos os navegadores funcionem, use um domínio próprio para os dois lados, por exemplo:

- `nublue.com.br` → GitHub Pages (Settings → Pages → Custom domain);
- `api.nublue.com.br` → host da API.

Aí os dois ficam no mesmo site, o cookie volta a ser primário e a API pode usar `COOKIE_SAME_SITE=Lax` com `FRONTEND_ORIGIN=https://nublue.com.br`. Recomendado antes de liberar para escolas, onde iPads são comuns.

## 5. Verificação pós-deploy

- `GET https://<api>/api/health` → `{"status":"ok","database":"connected","schemaVersion":"002_rate_limit_buckets"}`.
- Abrir o site do Pages, criar uma conta de teste, resolver o nível 1 e recarregar a página: o progresso deve continuar lá.
- No DevTools → Network, as chamadas para a API não podem ter erro de CORS; a resposta do login deve trazer `set-cookie` com `Secure`.

## Pendências antes de abrir para alunos

Continuam valendo os itens de `backend/README.md` → "Limites antes de produção": revisão de privacidade para público infantil, recuperação de conta, monitoramento e o primeiro ensaio de restauração de backup.
