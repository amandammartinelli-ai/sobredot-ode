# Netlify e ambientes Firebase — Etapa 5

Este documento cobre a ligação Netlify ↔ GitHub, a separação de
ambientes Firebase, e os requisitos operacionais (domínio, HTTPS,
páginas de erro, monitorização, rollback) antes de qualquer piloto. É
configuração de infraestrutura partilhada — nada aqui foi executado por
esta sessão; fica documentado para quem tiver acesso às consolas do
Netlify/Firebase o aplicar.

## 1. Ligação Netlify ↔ GitHub

- O site Netlify deve estar ligado diretamente ao repositório GitHub
  (não a um deploy manual/CLI) para que `netlify.toml` (`[build]`,
  cabeçalhos de segurança, redirects) seja sempre respeitado.
- **Produção** publica-se **só** a partir do branch principal protegido
  (`main`) — configurar em *Site settings → Build & deploy → Production
  branch*.
- **Deploy previews**: um preview automático por PR (contexto
  `deploy-preview` em `netlify.toml`) — permite rever visualmente uma
  alteração antes de aprovar o PR, sem nunca tocar em produção.
- **Branch deploys** (contexto `branch-deploy`): opcional, para um
  branch de trabalho de longa duração partilhado por mais do que uma
  pessoa; não usado no fluxo normal de PR único.

## 2. Separação de projetos Firebase (dev / staging / produção)

**Requisito de bloqueio**: um deploy preview do Netlify nunca pode
apontar para o projeto Firebase de produção. Isto exige três projetos
Firebase distintos (nomes reais a decidir; usa-se aqui `sobredot-dev`,
`sobredot-staging`, `sobredot-prod` como referência):

| Projeto Firebase | Usado por | Dados |
|---|---|---|
| `sobredot-dev` | Desenvolvimento local (`npm run emulators` continua a ser o modo normal do dia a dia — este projeto só é necessário para testar contra serviços não emulados, ex.: envio real de e-mail de verificação) | Sintéticos |
| `sobredot-staging` | Deploy previews do Netlify (todos os PRs) e branch deploys | Sintéticos — nunca dados de família reais, mesmo depois do piloto começar (ver `docs/pilot-plan.md`) |
| `sobredot-prod` | Produção (Netlify, contexto `production`, publicado só a partir de `main`) | Só depois de todos os portões do piloto estarem cumpridos |

Cada projeto tem a sua própria configuração Web (`apiKey`,
`authDomain`, etc.), as suas próprias regras (`firestore.rules`/
`storage.rules` — o mesmo ficheiro, publicado separadamente em cada
projeto) e as suas próprias Cloud Functions.

### Variáveis de ambiente por contexto no Netlify

Em *Site settings → Environment variables*, cada variável
`VITE_FIREBASE_*` (ver `.env.example`) deve ter **valores diferentes por
contexto de deploy** (Netlify suporta isto por variável — "Different
value for each deploy context"):

- **Production** → valores do projeto `sobredot-prod`.
- **Deploy previews** e **Branch deploys** → valores do projeto
  `sobredot-staging`.

Nunca configurar um único valor "global" para estas variáveis — seria
fácil um deploy preview acabar a apontar para produção por omissão.

`VITE_USE_EMULATORS` deve ser `false` em todos os contextos Netlify
(só é `true` em desenvolvimento local, por omissão do próprio código —
ver `src/firebase/app.js`). `VITE_APP_DEMO_MODE` mantém-se `true`
enquanto só houver dados sintéticos em qualquer ambiente, incluindo
produção — muda para `false` só depois de o piloto passar ao portão 3
com dados reais (ver `docs/pilot-plan.md`).

## 3. Domínio, HTTPS, DNS

- Domínio próprio configurado em *Domain settings*; o Netlify emite e
  renova automaticamente o certificado HTTPS (Let's Encrypt) assim que o
  DNS aponta para o Netlify — nenhuma ação manual de renovação
  necessária.
- `Strict-Transport-Security` já está configurado em `netlify.toml`
  (`max-age=63072000; includeSubDomains; preload`) — uma vez emitido o
  certificado, o browser deixa de tentar sequer HTTP.
- Recomendação: submeter o domínio à lista de pré-carregamento HSTS
  (hstspreload.org) só depois de confirmar que HTTPS está estável — é
  praticamente irreversível.

## 4. Páginas de erro / 404

Como a navegação interna usa um router baseado em hash (`#/rota`), o
fragmento nunca chega ao servidor — a aplicação nunca pede um caminho
profundo ao Netlify durante o uso normal. Ainda assim, um link antigo,
um erro de digitação ou um motor de busca podem pedir um caminho que não
existe como ficheiro (ex.: `/dashboard` sem fragmento). Sem tratamento,
isso mostrava a página de erro genérica do Netlify em vez da aplicação.

Corrigido nesta etapa: `netlify.toml` tem agora um redirect
`/* → /index.html` com estado `404` — a aplicação carrega normalmente
(o utilizador chega ao ecrã de boas-vindas/login, ou ao painel se tiver
sessão) e o estado HTTP fica corretamente `404` para motores de busca,
em vez de `200`.

## 5. Monitorização e alertas de deploy

- Ativar notificações de deploy do Netlify (*Site settings → Build &
  deploy → Deploy notifications*) para e-mail/Slack em **falha de
  build** e em **deploy de produção concluído** — para saber
  imediatamente se um `main` protegido, já com CI verde, ainda assim
  falhar a publicar.
- Monitorização de erros em execução (ex.: Sentry ou equivalente) não
  está integrada nesta etapa — ver `docs/pilot-plan.md`, portão 2, como
  pendência a decidir antes de alargar o piloto a mais famílias.
- Custos e alertas do lado do Firebase (orçamento, quotas) — ver
  `docs/security-hardening.md` (quotas aplicativas) e
  `docs/pilot-plan.md` (alertas de custo a configurar na consola da
  Google Cloud antes do portão 3).

## 6. Rollback documentado

- **Frontend (Netlify)**: cada deploy fica no histórico de *Deploys* com
  um botão "Publish deploy" — reverter para o deploy anterior é
  imediato, sem precisar de reverter o commit primeiro (o Netlify
  publica o `dist/` já construído, não reconstrói na hora). Reverter o
  commit em `main` continua a ser o passo seguinte, para o próximo
  deploy automático não reintroduzir o problema.
- **Regras do Firestore/Storage**: `firebase deploy --only firestore:rules`
  e `--only storage` guardam histórico de versões na consola do Firebase
  (*Firestore → Regras → Histórico*); reverter é publicar novamente a
  versão anterior a partir desse histórico. Nunca fazer deploy de regras
  sem antes correr `npm run test:rules` (ver `.github/workflows/ci.yml`)
  — uma regra permissiva por engano é, por definição desta etapa, um
  bloqueador de lançamento.
- **Índices do Firestore** (`firestore.indexes.json`): a criação de um
  índice novo é sempre segura e reversível (remover a entrada e fazer
  deploy de novo apaga o índice); nunca remover um índice que uma
  consulta em produção ainda precise sem confirmar primeiro que nenhuma
  vista o usa.
- **Cloud Functions**: `firebase deploy --only functions` substitui a
  função; reverter é fazer deploy da versão anterior do código
  (`git revert` do commit + deploy). Não há downtime — o Cloud Functions
  mantém a versão anterior a servir pedidos em curso durante a
  substituição.
