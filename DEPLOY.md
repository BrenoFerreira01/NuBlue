# Deploy em produção

O Nublue é uma aplicação **Next.js com banco PostgreSQL**: o site e a API (`/api/v1`) ficam no mesmo endereço.

A hospedagem escolhida é a **Vercel** com banco **Neon**. A alternativa com Docker está no fim deste guia.

---

## Vercel + Neon

O projeto já está configurado para a Vercel (`vercel.json`):

- **Build:** `npm run vercel-build` aplica as migrações do banco, atualiza o catálogo do curso e gera o build de produção. Se a migração falhar, o deploy é cancelado e a versão anterior continua no ar.
- **Região:** funções em **São Paulo (`gru1`)**.
- **Limpeza diária:** Vercel Cron chama `/api/v1/cron/maintenance` às 06:00 UTC, protegido por `CRON_SECRET`. Ela remove sessões e links vencidos e contas não confirmadas há 7 dias.

### 1. Importar o projeto

1. Envie o código para o GitHub.
2. Em <https://vercel.com/new>, importe o repositório. A Vercel detecta o Next.js e usa o `vercel.json`. Não altere o _Build Command_.

### 2. Criar o banco (Neon)

1. No projeto da Vercel: **Storage → Create Database → Neon (Serverless Postgres)**.
2. Escolha a região **AWS São Paulo (`sa-east-1`)**.
3. Conecte o banco aos ambientes **Production** e **Preview**. A integração cria as variáveis `DATABASE_URL` (com pooler, usada pela aplicação) e `DATABASE_URL_UNPOOLED` (conexão direta, usada pelas migrações).
4. **Obrigatório:** ative a criação de um branch do banco para cada Preview (_Create database branch for deployment → Preview_). Todo build roda as migrações e o seed: sem um branch próprio, o deploy de uma branch de teste aplicaria migrações no banco de produção.

Banco criado direto em neon.tech, sem a integração: em _Connect_, copie as duas strings e cadastre-as você mesmo na Vercel (`DATABASE_URL` com _Connection pooling_, host terminando em `-pooler`; `DATABASE_URL_UNPOOLED` sem pooling). Pode colar como o Neon mostra (`?sslmode=require&channel_binding=require`): a aplicação trata esses parâmetros e sempre verifica o certificado SSL.

### 3. Copiar os dados do PlanetScale para o Neon

Faça isto **antes** de apontar o domínio para a Vercel.

**Congele o sistema antigo antes de copiar.** Tudo o que for gravado no PlanetScale depois do `pg_dump` (cadastros, progresso, confirmações de e-mail) se perde na virada. Antes de começar:

1. Desligue o host antigo da API (ou ao menos tire do ar). Assim ninguém grava no banco antigo.
2. Desative o GitHub Pages do repositório (**Settings → Pages → Unpublish site**). Apagar o workflow `deploy-pages.yml` **não** tira o site antigo do ar.

Você precisa do `pg_dump`/`pg_restore` (PostgreSQL 17 ou mais novo) no seu computador.

```bash
# 1. Exportar do PlanetScale (conexão direta, porta 5432)
pg_dump "$DATABASE_DIRECT_URL" -Fc --no-owner --no-privileges -f nublue.dump

# 2. Importar no Neon (conexão SEM pooler)
pg_restore --no-owner --no-privileges -d "$DATABASE_URL_UNPOOLED" nublue.dump

# 3. Registrar o esquema no controle de migrações novo (não roda nenhum DDL)
DATABASE_URL_UNPOOLED="..." node infra/scripts/migrate.mjs up
```

O passo 3 deve imprimir `Migrações (up): 1764100000000_legacy-schema.js`. Ele só reconhece o esquema copiado (as versões 001–003 já constam em `schema_migrations`).

Confira se os números batem nos dois bancos:

```sql
SELECT count(*) FROM students;
SELECT count(*) FROM xp_events;
SELECT count(*) FROM level_completions;
```

Só depois disso aponte o domínio para a Vercel (passo 5). Mantenha o PlanetScale como cópia de segurança até o site novo estar funcionando; depois, desligue-o.

### 4. Variáveis de ambiente

Em **Settings → Environment Variables** (modelo em `.env.production.example`):

| Variável                                                             | Ambientes           | Valor                                                                          |
| -------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED`                              | Production, Preview | criadas pela integração do Neon                                                |
| `CRON_SECRET`                                                        | Production          | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`     |
| `APP_URL`                                                            | **só Production**   | `https://seudominio.com.br` (os previews usam a URL da Vercel automaticamente) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | **só Production**   | dados do provedor de e-mail (passo 6)                                          |

Marque os segredos como **Sensitive**. Depois de cadastrar, faça um novo deploy (**Deployments → ⋯ → Redeploy**).

### 5. Domínio próprio

1. **Settings → Domains → Add** → `seudominio.com.br`.
2. No painel do domínio (ex.: Registro.br), crie os registros DNS que a Vercel mostrar.
3. Confirme que `APP_URL` usa exatamente esse domínio e teste `https://seudominio.com.br/api/v1/status` (deve responder `"status":"ok"`).

`APP_URL` é usada nos links dos e-mails: se estiver errada, o link de confirmação aponta para o endereço errado.

### 6. E-mails de confirmação

| Onde roda                | O que acontece com os e-mails                                          |
| ------------------------ | ---------------------------------------------------------------------- |
| `npm run dev` (seu PC)   | ficam no Mailpit, em <http://localhost:8025>; nada sai para a internet |
| Preview da Vercel        | **nunca são enviados**; o link aparece em _Logs_                       |
| Production (seu domínio) | enviados pelo SMTP configurado                                         |

O backend anterior já usava o **Resend**. Ele continua servindo, agora por SMTP, com a mesma chave:

```
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=<a API key do Resend, começa com re_>
EMAIL_FROM=Nublue <nao-responda@seudominio.com.br>
```

O domínio do remetente precisa estar verificado no Resend. Se o e-mail não chegar, procure em **Vercel → Logs** a linha `[email] falha no envio: ...` e confira a pasta de spam.

**Links de confirmação enviados antes da migração.** Eles apontam para o endereço antigo (`APP_URL` do backend anterior, ex.: `https://brenoferreira01.github.io/NuBlue/?verify=...`) e, com o GitHub Pages fora do ar, deixam de funcionar. Como valem só 24 horas, o impacto é pequeno: quem não confirmou a tempo pede um novo link na tela de login ("Reenviar e-mail de confirmação"), informando apelido e senha. Se o site antigo estava num domínio próprio na raiz e esse domínio passar para a Vercel, o formato antigo `/?verify=<token>` continua funcionando: o site redireciona para `/verificar-email`.

### Observações

- **Backups:** o Neon permite restauração para um ponto no tempo (o período depende do plano). Para uma cópia própria: `pg_dump "$DATABASE_URL_UNPOOLED" -Fc -f backup.dump`.
- **Plano gratuito do Neon:** o banco "dorme" após alguns minutos sem uso; o primeiro acesso depois disso demora cerca de 1 segundo a mais.
- **Não** rode `npm run dev:seed` apontando para produção: o build da Vercel já atualiza o catálogo.

---

## Alternativa: Docker

O `Dockerfile` gera uma imagem com o site e a API. Ao iniciar, ela aplica as migrações, atualiza o catálogo e sobe o servidor na porta 3000.

```bash
docker build -t nublue .
docker run -p 3000:3000 \
  -e DATABASE_URL=... -e DATABASE_URL_UNPOOLED=... \
  -e APP_URL=https://seudominio.com.br -e CRON_SECRET=... \
  -e SMTP_HOST=... -e SMTP_PORT=465 -e SMTP_USER=... -e SMTP_PASSWORD=... -e EMAIL_FROM=... \
  nublue
```

Coloque um proxy com HTTPS (Caddy, Nginx) na frente e agende a limpeza diária, por exemplo com cron:
`APP_URL=https://seudominio.com.br CRON_SECRET=... npm run maintenance`.

**Rate limit atrás de proxy.** Fora da Vercel, o limite de tentativas usa o endereço da conexão. Atrás do Caddy/Nginx, todos os usuários pareceriam um só cliente. Informe quantos proxies seus ficam na frente da aplicação com `-e TRUST_PROXY_HOPS=1` (um proxy). Nunca use um valor maior que o número real de proxies: o cliente poderia forjar o próprio endereço.
