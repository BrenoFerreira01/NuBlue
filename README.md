# Nublue

Plataforma web gamificada para o ensino de matemática básica a estudantes do ensino fundamental. O aluno resolve cruzadinhas numéricas organizadas em capítulos (adição, subtração, multiplicação e divisão), ganha XP, mantém sequências de dias e enfrenta um desafio diário.

**Stack:** Next.js · React · PostgreSQL · Tailwind CSS · Jest · Vercel

## Sumário

- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Tecnologias](#tecnologias)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Como rodar localmente](#como-rodar-localmente)
- [Scripts](#scripts)
- [API](#api)
- [Testes](#testes)
- [Deploy](#deploy)
- [Equipe](#equipe)

## Funcionalidades

- **Trilha de aprendizado:** 39 níveis em 5 capítulos. Os níveis destravam em sequência dentro de cada capítulo.
- **Teste de nivelamento:** no primeiro acesso, define a dificuldade inicial.
- **Desafio diário:** um puzzle por dia, igual para todos, com três corações e sequência de dias.
- **Ranking:** semanal e geral. Só aparece quem escolhe participar.
- **Modo visitante:** dá para jogar sem conta; o progresso fica salvo no navegador.
- **Contas:** cadastro com confirmação de e-mail, login por apelido, exclusão da conta e de todos os dados.
- **Correção no servidor:** respostas, XP e desbloqueios são calculados pela API. O cliente não consegue informar pontuação.
- **Tema claro e escuro.** Interface responsiva.

## Arquitetura

Um único projeto Next.js (Pages Router) serve as telas e a API. Como os dois ficam no mesmo endereço, não há CORS nem cookie de terceiros.

```
Navegador ──► pages/*            telas (React)
          └─► pages/api/v1/*     rotas HTTP ──► models/*  regras de negócio e SQL
                                               └─► infra/*  banco, erros, e-mail, rate limit
                                                         └─► PostgreSQL
```

- **Rotas** (`pages/api/v1`) apenas validam a entrada e chamam os models, por meio de `createHandler` (`infra/controller.js`). Ele roteia por método HTTP, protege contra CSRF e padroniza os erros no formato `{ "error": "<código>", "message": "<texto>" }`.
- **Sessão** em cookie `HttpOnly` e `SameSite=Lax` (com `Secure` e prefixo `__Host-` em produção). O banco guarda apenas o hash do token.
- **Senhas** com scrypt. **Rate limit** em janelas guardadas no Postgres, compartilhadas entre as instâncias serverless.
- **Migrações** versionadas com `node-pg-migrate` em `infra/migrations`. A primeira reconhece o esquema do backend anterior, para que bancos já em produção não executem o DDL de novo.

## Tecnologias

| Camada         | Tecnologia                                                           |
| -------------- | -------------------------------------------------------------------- |
| Aplicação      | Next.js 16 (Pages Router), React 19, JavaScript                      |
| Interface      | Tailwind CSS 4, Radix UI, Motion, Lucide                             |
| Banco de dados | PostgreSQL 17 (`pg`), migrações com `node-pg-migrate`                |
| Validação      | Zod                                                                  |
| E-mail         | Nodemailer (SMTP); Mailpit em desenvolvimento, Resend em produção    |
| Testes         | Jest: testes unitários e de integração contra servidor e banco reais |
| Infraestrutura | Docker Compose (desenvolvimento), Vercel + Neon (produção)           |
| Qualidade      | Prettier, GitHub Actions                                             |

## Estrutura de pastas

```
├── pages/                 telas (uma por URL)
│   └── api/v1/            API REST
├── components/            componentes React (ui, landing, game, navigation...)
├── lib/                   código do navegador: cliente da API e lógica do jogo
├── models/                regras de negócio e SQL (aluno, sessão, progresso, desafio...)
├── infra/
│   ├── migrations/        migrações do banco
│   ├── scripts/           migrar, semear o catálogo, aguardar o Postgres, manutenção
│   ├── data/              catálogo do curso (níveis e respostas)
│   └── compose.yaml       Postgres + Mailpit para desenvolvimento
├── styles/                CSS global e tema
└── tests/
    ├── unit/
    └── integration/api/v1/
```

## Como rodar localmente

**Pré-requisitos:** Node.js 24 ou mais novo e Docker Desktop em execução.

```bash
git clone <url-do-repositório>
cd NuBlue
npm install
npm run dev
```

O `npm run dev` sobe o Postgres e o Mailpit no Docker, aplica as migrações e inicia o servidor. Na primeira execução, grave os níveis do curso em outro terminal:

```bash
npm run dev:seed
```

| Serviço                                       | Endereço                |
| --------------------------------------------- | ----------------------- |
| Aplicação                                     | <http://localhost:3000> |
| Caixa de e-mails de desenvolvimento (Mailpit) | <http://localhost:8025> |

As variáveis de desenvolvimento estão em `.env.development` e só funcionam localmente. As de produção estão descritas em `.env.production.example`.

## Scripts

| Comando                   | O que faz                                                              |
| ------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`             | Sobe os serviços, migra o banco e inicia o servidor de desenvolvimento |
| `npm run dev:seed`        | Grava o catálogo do curso no banco local                               |
| `npm run build`           | Gera o build de produção                                               |
| `npm test`                | Prepara o banco e roda todos os testes (requer `npm run dev` ativo)    |
| `npm run migrations:up`   | Aplica as migrações pendentes                                          |
| `npm run migrations:down` | Desfaz a última migração                                               |
| `npm run services:stop`   | Para os containers do Postgres e do Mailpit                            |
| `npm run lint:check`      | Verifica a formatação com o Prettier                                   |
| `npm run lint:fix`        | Corrige a formatação                                                   |

## API

Todas as rotas ficam sob `/api/v1` e respondem em JSON. Rotas marcadas com 🔒 exigem sessão.

| Método    | Rota                              | Descrição                                                 |
| --------- | --------------------------------- | --------------------------------------------------------- |
| GET       | `/status`                         | Saúde da aplicação e do banco                             |
| GET       | `/catalog`                        | Capítulos e níveis (sem respostas)                        |
| GET 🔒    | `/catalog/bonus`                  | Nível bônus, após concluir o curso                        |
| POST      | `/auth/register`                  | Cadastro; envia o link de confirmação                     |
| POST      | `/auth/login`                     | Login por apelido e senha                                 |
| POST      | `/auth/logout`                    | Encerra a sessão                                          |
| POST      | `/auth/email-verification`        | Reenvia o link (pode corrigir o e-mail)                   |
| PATCH     | `/auth/email-verification`        | Confirma o e-mail com o token do link                     |
| GET 🔒    | `/users/me`                       | Dados do aluno e progresso                                |
| PATCH 🔒  | `/users/me`                       | Participação no ranking                                   |
| DELETE 🔒 | `/users/me`                       | Exclui a conta e todos os dados                           |
| GET 🔒    | `/users/me/availability`          | Situação de cada nível (bloqueado, disponível, concluído) |
| POST 🔒   | `/attempts`                       | Envia a resposta de um nível                              |
| GET 🔒    | `/daily-challenge`                | Desafio do dia                                            |
| PUT 🔒    | `/daily-challenge/draft`          | Salva o rascunho do desafio                               |
| POST 🔒   | `/daily-challenge/attempts`       | Envia a resposta do desafio                               |
| GET       | `/leaderboard?period=weekly\|all` | Ranking                                                   |
| GET       | `/cron/maintenance`               | Limpeza diária (exige `CRON_SECRET`)                      |

## Testes

Os testes de integração fazem requisições HTTP reais ao servidor e conferem o resultado no banco, sem mocks.

```bash
npm run dev    # terminal 1
npm test       # terminal 2
```

O CI (GitHub Actions) verifica a formatação, aplica as migrações duas vezes (a segunda execução não pode alterar nada), gera o build e roda a suíte completa contra Postgres e Mailpit.

## Deploy

Produção na **Vercel** com banco **Neon**: o build aplica as migrações e atualiza o catálogo antes de publicar. O passo a passo, incluindo a migração dos dados do PlanetScale, as variáveis de ambiente, o domínio e o envio de e-mails, está em [`DEPLOY.md`](DEPLOY.md). Também há um `Dockerfile` como alternativa.

## Equipe

| Integrante      | Papel                 |
| --------------- | --------------------- |
| Breno Ferreira  | Arquiteto de Software |
| Caique Costa    | Product Owner         |
| Iago Zorrilla   | Desenvolvedor         |
| Thalison Mendes | Tester QA             |

Protótipo de interface no [Figma](https://www.figma.com/design/MmbJtiGGPAitCHVnflifcj/Plataforma-de-aprendizado-Nublue).
