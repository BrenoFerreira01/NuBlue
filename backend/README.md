# Nublue API

API Node.js em JavaScript e PostgreSQL para autenticação, curso, tentativas, XP e progresso. O frontend React/Vite continua no pacote raiz.

## Desenvolvimento local

Requer Node.js 20.6 ou superior e pnpm. Na raiz do repositório:

1. Instale as dependências com `pnpm install`.
2. Copie `backend/.env.example` para `backend/.env` e substitua os valores de conexão pelos dados da sua branch de desenvolvimento PlanetScale Postgres.
3. Copie `.env.example` para `.env` na raiz.
4. Execute `pnpm db:migrate` e depois `pnpm db:seed`.
5. Em terminais separados, execute `pnpm api:dev` e `pnpm dev`.

A API fica em `http://localhost:4000`; o Vite usa `VITE_API_URL` (padrão `http://localhost:4000`). `/api/health` verifica a conexão com o PostgreSQL.

## PlanetScale Postgres

- `DATABASE_URL`: conexão da aplicação pelo PgBouncer/transaction pooling, normalmente na porta `6432`.
- `DATABASE_DIRECT_URL`: conexão direta usada somente por migrações e seed/DDL, normalmente na porta `5432`.
- TLS é obrigatório e a validação do certificado fica ligada.
- `FRONTEND_ORIGIN` deve corresponder exatamente à origem do frontend. Cookies usam `HttpOnly`, `SameSite=Lax` e `Secure` em produção. Para hospedagem em sites diferentes, `COOKIE_SAME_SITE=None` exige HTTPS.

As migrações usam `schema_migrations` e um advisory lock PostgreSQL; o seed atualiza os 39 níveis e o bônus `very_hard`. Os arquivos de migração são locais e nenhum banco remoto foi alterado nesta implementação.

## Conteúdo do curso

`src/data/course-catalog.json` é o seed versionado. Para regenerá-lo a partir do planejamento em Markdown:

```sh
python3 backend/scripts/import_course_plan.py \
  /caminho/para/planejamento_curso_cruzadinhas_matematicas.md \
  backend/src/data/course-catalog.json
```

As equações de cada lição são preservadas e ligadas por equações adicionais entre as lacunas. O bônus é separado das 39 lições: ele reproduz a referência enviada, com 18 equações, 22 lacunas, quatro operadores e números até 29. Ele só é servido depois que as 39 lições do curso forem concluídas.

## Conta e privacidade

As contas guardam apelido e hash de senha; não há e-mail, recuperação de senha ou coleta de nome real. Sessões são tokens aleatórios em cookie HTTP-only e somente o hash do token é salvo no banco. Apelidos não aparecem no ranking por padrão; o estudante pode ativar essa visibilidade em Configurações. Progresso legado de `localStorage` não é importado para a conta.

## Limites antes de produção

- Não há recuperação de senha; perder a senha exige suporte manual ou exclusão da conta.
- O limite de tentativas de autenticação é em memória por processo; produção com múltiplas instâncias precisa de rate limit compartilhado.
- O fluxo de diagnóstico continua local e sua dificuldade ainda não é persistida.
- Desafio da landing page continua uma demonstração anônima no navegador; o desafio diário autenticado usa o backend e o calendário UTC.
- Revisão de privacidade para público infantil, monitoramento, backup/restauração e configuração de produção continuam obrigatórios antes do lançamento.
