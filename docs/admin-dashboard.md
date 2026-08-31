# Painel administrativo operacional — Etapa 5

## Objetivo e limites deliberados

Este painel existe para um administrador técnico acompanhar a **saúde
operacional** da aplicação — nunca para ver conteúdo de família ou de
criança. Isto é uma escolha de âmbito, não uma limitação técnica: mesmo
sendo tecnicamente possível mostrar mais, decidiu-se que o papel de
"administrador técnico" nunca dá acesso a registos, documentos,
perguntas de IA, insights ou nomes — só números agregados (ver
`docs/threat-model.md`, risco 1: "administrador com acesso amplo
demais").

Não existe, e não foi pedido, nenhum mecanismo de acesso de emergência a
conteúdo de família a partir deste painel — ver `docs/pilot-plan.md`,
"Acesso administrativo de emergência", para o registo dessa decisão.

## O que mostra

Calculado por uma única Cloud Function (`getOperationalSummary`,
`functions/src/adminDashboard.js`), usando consultas de agregação
(`count()`) do Firestore — nunca lendo os documentos em si, só contando:

| Secção | Conteúdo |
|---|---|
| Famílias | total de famílias; pedidos de eliminação pendentes |
| Crianças | crianças ativas (não eliminadas); com IA restringida |
| Documentos por estado | contagem por `status` (`pending_review`, `approved`, `rejected`, `error`, `quarantine`) |
| IA — Perguntar aos documentos | perguntas, bloqueadas e com deteção de emergência, só das últimas 24h |
| Anti-abuso | pedidos recusados por limite de utilização (`abuse.rate_limited`), últimas 24h |
| Versões | versão do frontend (`package.json` da raiz) e das Cloud Functions (`functions/package.json`) |
| Incidentes | lista simples (título/gravidade/estado), gerida manualmente pelo administrador |

## Acesso

- **Fronteira real**: `context.auth.token.admin === true`, verificado no
  servidor (`functions/src/util.js`, `requireAdmin`) e nas regras do
  Firestore (`isAdmin()`, coleção `incidents`). Um administrador é
  promovido só por outro administrador já existente através de
  `setAdminClaim`, e o **primeiro** administrador só é criado
  manualmente com `scripts/bootstrap-admin.js` — nunca por um pedido
  HTTP (ver `functions/src/adminClaims.js`).
- **No cliente** (`src/services/authService.js`, `isAdmin()`): só decide
  o que a interface MOSTRA — esconder o painel de quem não é
  administrador. Um utilizador que force a rota `#/admin` sem ser
  administrador via um ecrã "Sem acesso"; qualquer tentativa de chamar
  a função ou ler `incidents` diretamente seria recusada pelo servidor
  de qualquer forma.
- **Rota** (`src/router/router.js`, `admin`): exige sessão iniciada, não
  família — um administrador técnico pode nunca ter família própria.
  Não está na navegação principal (`src/components/appNav.js`) — só
  acessível por link direto, tal como a vista "colaborador".

## Índices necessários

As contagens de perguntas de IA e de pedidos recusados por limite
cruzam uma igualdade com um intervalo de tempo (`createdAt >= há 24h`),
o que exige índices compostos — adicionados a
`firestore.indexes.json`: `aiQueries` (`blocked`+`createdAt`,
`emergency`+`createdAt`, ambos `COLLECTION_GROUP`) e `auditLog`
(`action`+`createdAt`, `COLLECTION`). As restantes contagens usam um só
campo de igualdade, coberto pela indexação automática do Firestore, sem
precisar de nenhuma entrada nova.

## Testado

- `tests/rules/adminDashboard.integration.test.js` — 5 testes de
  integração contra o emulador, incluindo uma verificação explícita de
  que a resposta nunca contém nomes de família/criança.
- `tests/rules/firestore.rules.test.js` (secção "Painel administrativo —
  incidentes") — confirma que só um administrador lê/escreve
  `incidents`.
- Teste de fumo manual (Playwright) contra os emuladores: uma conta sem
  a claim `admin` vê o ecrã "Sem acesso"; a conta de demonstração
  promovida a administrador vê os números reais, sem erros de consola;
  criar e resolver um incidente funciona de ponta a ponta.

## O que fica fora desta etapa

- Custos reais de faturação da Google Cloud — a consola do Google Cloud
  (Billing → Budgets & alerts) é a fonte de verdade; este painel não
  tenta replicar isso, só o que o próprio Firestore já sabe contar (ver
  `docs/deploy-netlify.md`, "Monitorização e alertas").
- Gráficos/séries temporais — só o instantâneo atual (últimas 24h para
  as métricas que fazem sentido numa janela). Uma série histórica exigiria
  agregações pré-calculadas e persistidas (ex.: um documento por dia),
  não implementado por ser uma funcionalidade nova, não um requisito de
  saúde operacional imediata.
