# Nublue API

API Node.js em JavaScript e PostgreSQL para autenticação, curso, tentativas, XP e progresso. O frontend React/Vite continua no pacote raiz.

## Desenvolvimento local

Requer Node.js 22.9 ou superior e pnpm. Na raiz do repositório:

1. Instale as dependências com `pnpm install`.
2. Copie `backend/.env.example` para `backend/.env` e substitua os valores de conexão pelos dados da sua branch de desenvolvimento PlanetScale Postgres.
3. Copie `.env.example` para `.env` na raiz.
4. Execute `pnpm db:migrate` e depois `pnpm db:seed`.
5. Em terminais separados, execute `pnpm api:dev` e `pnpm dev`.

A API fica em `http://localhost:4000`; o Vite usa `VITE_API_URL` (padrão `http://localhost:4000` em desenvolvimento). `/api/health` verifica a conexão com o PostgreSQL e se todas as migrações do código foram aplicadas (`503 schema_outdated` caso contrário).

Para um PostgreSQL local sem TLS (Docker, por exemplo), defina `DATABASE_SSL=disable` no `backend/.env`; essa opção é recusada com `NODE_ENV=production`. Publicação (GitHub Pages + API + banco) está em [`DEPLOY.md`](../DEPLOY.md).

## Testes

```sh
cd backend
npm ci
npm run validate:catalog   # confere estrutura, gabaritos e aritmética de cada nível
npm test                   # testes de contrato da API
```

Os testes sobem o servidor real (`createApiServer`) contra um PostgreSQL em WASM ([PGlite](https://pglite.dev)), aplicam as migrações e o seed pelas mesmas funções dos scripts, e fazem requisições HTTP. Não precisam de Docker nem de banco remoto. O adaptador em `test/helpers.js` imita a parte usada da interface do `pg`.

Com `TEST_DATABASE_URL` definido, a mesma suíte roda num PostgreSQL de verdade pelo driver `pg`, criando um schema isolado por contexto de teste e removendo-o no fim:

```sh
docker run --rm -d --name nublue-test -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:17
TEST_DATABASE_URL=postgres://postgres:test@localhost:5433/postgres npm test
```

A CI (`.github/workflows/ci.yml`) roda, em todo push, checagem de sintaxe, validação do catálogo e os testes no PGlite (job `Backend`) e, no job `Backend (PostgreSQL 17)`, os testes num container `postgres:17`, as migrações duas vezes (a segunda deve ser no-op), o seed e um smoke test da API em execução. TLS e PgBouncer do PlanetScale continuam sem teste automatizado.

## Progresso e disponibilidade

`GET /api/progress/availability` exige a sessão autenticada e retorna o estado de cada lição obrigatória (`locked`, `available` ou `completed`) e `bonusAvailable`. O primeiro nível de cada capítulo fica disponível; os seguintes são liberados após a conclusão do nível anterior do capítulo. O bônus fica disponível após as 39 lições obrigatórias, desde que o catálogo tenha um bônus; hoje ele está desativado e `bonusAvailable` é sempre `false`. A resposta contém apenas IDs e estados, sem gabaritos; `POST /api/attempts` continua validando cada tentativa no servidor.

```json
{
  "levels": [
    { "id": 1, "status": "available" },
    { "id": 2, "status": "locked" }
  ],
  "bonusAvailable": false
}
```

## PlanetScale Postgres

- `DATABASE_URL`: conexão da aplicação pelo PgBouncer/transaction pooling, normalmente na porta `6432`.
- `DATABASE_DIRECT_URL`: conexão direta usada somente por migrações e seed/DDL, normalmente na porta `5432`.
- TLS é obrigatório e a validação do certificado fica ligada (`DATABASE_SSL=verify-full`, padrão).
- `DATABASE_POOL_MAX` (padrão 10) limita as conexões de cada instância; instâncias × esse valor deve caber no limite do pooler.
- `FRONTEND_ORIGIN` aceita uma lista separada por vírgulas de origens (sem caminho), por exemplo `https://brenoferreira01.github.io,http://localhost:5173`. Cookies usam `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Para hospedagem em sites diferentes (GitHub Pages + API), `COOKIE_SAME_SITE=None` exige HTTPS e adiciona `Partitioned`; o Safari ainda bloqueia esse cookie — ver `DEPLOY.md`.
- `TRUST_PROXY_HOPS`: quantos proxies reversos ficam na frente da API (normalmente `1` em hosts gerenciados). Com `0`, o rate limit de login usa o endereço do socket, que atrás de um proxy é o mesmo para todos os alunos.

### Rate limit e manutenção

`RATE_LIMIT_STORE=postgres` (padrão em produção) guarda as contagens na tabela `rate_limit_buckets` (migração `002`), em janelas fixas calculadas pelo relógio do banco, então todas as instâncias compartilham os limites. A chave é um SHA-256 do nome do limitador + IP/apelido ou conta, sem guardar esses dados em claro. `RATE_LIMIT_STORE=memory` (padrão fora de produção) mantém o limitador por processo.

A API apaga sessões expiradas e janelas encerradas na inicialização e a cada hora; `npm run maintenance` faz o mesmo sob demanda.

As migrações usam `schema_migrations` e um advisory lock PostgreSQL; o seed valida o catálogo, recusa conteúdo inconsistente antes de escrever e atualiza os 39 níveis (e o bônus, quando houver). Os arquivos de migração são locais e nenhum banco remoto foi alterado nesta implementação.

## Conteúdo do curso

`src/data/course-catalog.json` é o seed versionado. Para regenerá-lo a partir do planejamento em Markdown:

```sh
python3 backend/scripts/import_course_plan.py \
  /caminho/para/planejamento_curso_cruzadinhas_matematicas.md \
  backend/src/data/course-catalog.json
```

As equações de cada lição são preservadas e ligadas por equações adicionais entre as lacunas. Depois de regenerar, rode `npm run validate:catalog`.

**Bônus desativado (catálogo v2).** O bônus `very_hard` gerado por `make_bonus()` tinha células sobrepostas: a equação vertical `11 + s = w` sobrescrevia resultados de três equações horizontais, deixando 4 contas erradas e a lacuna `i` fora da grade, então ele não tinha solução. O catálogo usa `"bonus": null` até a grade correta da imagem de referência ser fornecida; a API responde `bonus_unavailable` e recusa tentativas no nível 40. Para reativar, corrija `make_bonus()`, gere o catálogo e confirme com `npm run validate:catalog`.

## Conta e privacidade

As contas guardam apelido e hash de senha; não há e-mail, recuperação de senha ou coleta de nome real. Sessões são tokens aleatórios em cookie HTTP-only e somente o hash do token é salvo no banco. Apelidos não aparecem no ranking por padrão; o estudante pode ativar essa visibilidade em Configurações. Progresso legado de `localStorage` não é importado para a conta.

## Limites antes de produção

- Não há recuperação de senha; perder a senha exige suporte manual ou exclusão da conta.
- Rate limits: login/cadastro (8 por IP+apelido a cada 15 min), tentativas de nível e desafio diário (30 por conta por minuto, compartilhado) e rascunho do desafio (120 por conta por minuto). Em produção são compartilhados via PostgreSQL; a janela fixa permite até o dobro do limite na virada da janela.
- O fluxo de diagnóstico continua local e sua dificuldade ainda não é persistida.
- Desafio da landing page continua uma demonstração anônima no navegador; o desafio diário autenticado usa o backend e o calendário UTC.
- Backup e restauração estão descritos em `docs/operations/backup-restore.md`, mas ainda não foram exercitados contra um banco real.
- Revisão de privacidade para público infantil, monitoramento e escolha do host da API continuam obrigatórios antes do lançamento. Os arquivos de publicação (GitHub Pages, `Dockerfile`, health check) já existem; ver `DEPLOY.md`.
