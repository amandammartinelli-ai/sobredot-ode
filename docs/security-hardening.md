# Reforço de segurança e desempenho — Etapa 5

Este documento consolida o trabalho de robustecimento feito na Etapa 5
para tornar a Sobredot uma candidata segura a um **piloto controlado**
(ver `docs/pilot-plan.md`) — nunca, por si só, uma autorização para dados
reais. Essa decisão depende também de `docs/threat-model.md`,
`docs/logging-policy.md` e da revisão legal referida em
`docs/governance/` (ver `docs/pilot-plan.md`, portão 2).

## 1. Auditoria de segurança (regras, functions, segredos)

Revisão linha a linha de `firestore.rules`, `storage.rules`, de todas as
Cloud Functions (`functions/src/*.js`) e da configuração de CORS/CSP, à
procura de padrões permissivos (`allow read, write: if true`), decisões
de autorização feitas no cliente em vez de nas regras, e segredos
acidentalmente expostos ao código do browser.

Nenhum segredo (chave de IA, credencial de serviço) existe em código do
lado do cliente — confirmado por inspeção de `src/` e de `dist/` após
`npm run build`. A única configuração pública é a config Web do Firebase
(`src/config/firebase.config.js`), que não é secreta por natureza (ver
`docs/threat-model.md`).

Duas falhas reais foram encontradas e corrigidas nesta auditoria (não
são hipotéticas — estavam em produção lógica desde etapas anteriores):

| Falha | Impacto | Correção |
|---|---|---|
| `auditLog`: `allow list` só permitia a administradores, faltando a cláusula de dono de família que `allow get` já tinha | `listFamilyAuditEvents` falhava silenciosamente para toda a família (mascarado por um `.catch(() => [])` no código de chamada) — o ecrã de auditoria da família nunca mostrava nada | `firestore.rules`: unificado em `allow get, list: if isAdmin() || (resource.data.familyId != null && isFamilyOwner(resource.data.familyId));`, com 2 testes de regressão novos |
| Mensagens de erro de login distintas para `auth/user-not-found` vs. `auth/wrong-password`/`auth/invalid-credential` | Permitia enumerar que e-mails têm conta (um atacante testava e-mails e via qual mensagem voltava) | `src/i18n/pt.js`: as três mensagens passaram a ser o mesmo texto genérico "E-mail ou palavra-passe incorretos." |

## 2. Quotas e limites (anti-abuso da IA)

Implementado em `functions/src/rateLimit.js` — janela fixa por
transação Firestore (coleção `rateLimits`, ilegível/inescrevível pelo
cliente, ver `firestore.rules`). Sempre **falha segura**: exceder o
limite recusa o pedido com `resource-exhausted` e uma mensagem clara,
nunca processa parcialmente.

| Ação | Limite por utilizador | Limite por criança |
|---|---|---|
| `ai_ask` (Perguntar aos documentos) | 30 / hora | 15 / hora |
| `insights_generate` | 10 / hora | 5 / hora |
| `report_generate` | 20 / hora | — |
| `share_link_create` | 10 / dia | — |
| `export_family_data` | 5 / dia | — |

Os limiares foram escolhidos para serem confortáveis para uso familiar
normal (nenhum fluxo real da aplicação se aproxima destes números numa
sessão típica) e suficientemente apertados para tornar caro um abuso
automatizado do gateway de IA. Ficam documentados aqui para serem
revistos com dados reais de utilização no portão 2/3 do piloto (ver
`docs/pilot-plan.md`) — não são definitivos.

A auditoria de contadores expirados é limpa por
`purgeOldTechnicalLogs` (`functions/src/dataRights.js`, retenção de 7
dias — ver secção de retenção nesse ficheiro).

## 3. Auditoria imutável — extensões da Etapa 5

`docs/logging-policy.md` continua a ser a referência de conteúdo (o que
pode e não pode ir para um log). Nesta etapa, os eventos cobertos por
`auditLog` foram estendidos para incluir:

- `auth.login` (melhor esforço, iniciado pelo cliente — ver nota de
  limitação honesta em `functions/src/adminClaims.js`; a fronteira de
  segurança real continua a ser sempre `firestore.rules`, nunca este
  registo).
- `document.viewed` (a cada pedido de URL de download, com o motivo do
  acesso — `functions/src/documents.js`).
- `document.created` / `document.status_changed` / `document.deleted`
  (`functions/src/audit.js`, gatilho `onDocumentMetaWrite` — só o
  estado, nunca o emissor/especialidade do documento).
- As ações de direitos da família — `family.data_exported`,
  `child.processing_restricted`/`unrestricted`,
  `family.deletion_requested`/`cancelled`, `family.deleted` — ver
  `functions/src/dataRights.js`.

Um mecanismo de deteção de login ao nível do próprio fornecedor de
identidade (Cloud Identity Platform "blocking functions") ficaria mais
robusto do que a telemetria iniciada pelo cliente, mas foi
deliberadamente deixado para uma etapa de produção futura — não bloqueia
o piloto porque a autorização real nunca depende deste registo.

## 4. Direitos da família e retenção

Ver `functions/src/dataRights.js` e `src/services/dataRightsService.js`
para a implementação completa (exportação estruturada, restrição de
processamento por IA, pedido de eliminação com confirmação reforçada e
período de graça de 14 dias, cancelamento, e eliminação real em cascata
de Firestore + ficheiros no Storage). Detalhado em
`docs/governance/data-rights.md`.

## 5. Desempenho

### 5.1 Divisão de código (code-splitting)

`src/router/router.js` deixou de importar todas as vistas de forma
estática no arranque — cada rota carrega o seu módulo só quando é
visitada (`load: () => import('../views/.../xView.js').then(...)`). O
estado de carregamento (`createLoadingState`) é mostrado antes de
resolver a família e antes do módulo da vista chegar, para nunca haver
um ecrã em branco percetível.

Resultado (`npm run build`): o ficheiro único de ~847 KB passou a um
núcleo de ~766 KB (dominado pelo SDK do Firebase, carregado sempre — é
necessário em todas as rotas autenticadas) mais um chunk por rota de
1–16 KB, transferido só quando necessário. Validado com um teste de fumo
end-to-end (Playwright, login como utilizador de demonstração e
navegação pelas 8 rotas autenticadas) sem erros de consola.

Não foi tentada divisão adicional do próprio SDK do Firebase (ex.:
carregar Firestore/Storage/Functions em separado) por ser praticamente
todo necessário logo no primeiro ecrã autenticado — o ganho seria
marginal e o risco de regressão not justificaria nesta etapa.

### 5.2 Cache seguro

**Não existe service worker nem cache de disco do Firestore** (sem
`enableIndexedDbPersistence`/`persistentLocalCache`) — confirmado por
inspeção de `src/firebase/app.js` e por não haver nenhum registo de
`serviceWorker` em `src/`. Isto significa que não há conteúdo sensível
em cache de rede nem em IndexedDB: o único armazenamento do lado do
cliente que sobrevive a um recarregamento de página é o `localStorage`,
através de `src/services/storageService.js`.

Duas falhas reais de "cache seguro" foram encontradas e corrigidas:

| Falha | Onde | Correção |
|---|---|---|
| O logout (`signOutUser`) nunca apagava o `localStorage` — o ID da família e da criança selecionada ficavam no dispositivo indefinidamente. Num dispositivo partilhado, isto revela a quem iniciasse sessão a seguir qual família/criança tinha usado a aplicação antes. | `src/services/authService.js` | `signOutUser()` agora chama `clearAllSobredotData()` (`storageService.js`) depois de `signOut(auth)` — apaga tudo o que a aplicação guardou localmente; volta a ser escrito normalmente na sessão seguinte. |
| As "Perguntas para a próxima consulta" (Visão Integrada) eram escritas diretamente em `localStorage` com um prefixo próprio (`sobredot.nextVisitQuestions.`), fora do espaço de nomes de `storageService` (`sobredot:`) — texto escrito pela família sobre a criança, que por isto **não era apagado** pela limpeza acima. | `src/views/insights/insightsView.js` | Migrado para `readJSON`/`writeJSON` de `storageService.js`, ficando dentro do mesmo espaço de nomes apagado no logout. |

Fora isto, o `localStorage` só guarda identificadores opacos (IDs de
família/criança) e uma preferência de acessibilidade (redução de
movimento) — nunca conteúdo clínico, texto de documentos ou respostas de
IA (essas nunca saem do Firestore/Storage para nenhum armazenamento
local persistente).

### 5.3 Leituras do Firestore

Revisão das vistas que mais leem dados (`dashboardView`,
`timelineView`, `insightsView`, `childContext.js`):

- `loadChildContext()` (usado por praticamente todas as vistas
  autenticadas) faz uma única consulta (`listChildrenForFamily`) por
  navegação — nunca em ciclo, nunca repetida dentro do mesmo render.
- `dashboardView` faz 4 consultas pequenas e limitadas (`limit(1)` cada,
  uma por categoria dos cartões de resumo: sono, emoções, alimentação,
  medicação) mais 1 consulta dos últimos 7 dias — 5 consultas no total
  por visita ao painel. Foi avaliado fundir as 4 consultas de "último
  registo por categoria" na consulta de 7 dias já feita, mas isso
  mudaria o comportamento (uma categoria sem registos nos últimos 7 dias
  passaria a mostrar "—" mesmo havendo um registo mais antigo) — decidido
  **não fundir**, por ser uma alteração de comportamento visível para
  ganhar um número pequeno de leituras, o que contraria a instrução desta
  etapa de não introduzir risco por otimizações vistosas. Fica anotado
  para reavaliação com dados reais de volume (`docs/pilot-plan.md`).
- Históricos por registo/insight (`listRecordHistory`,
  `listInsightStatusHistory`) só são pedidos ao expandir esse item em
  concreto (carregamento sob pedido), nunca antecipadamente para toda a
  lista.

Nenhum padrão N+1 descontrolado (leituras que crescem com o número de
crianças ou de membros da família) foi encontrado.

## 6. Cabeçalhos de segurança (Netlify) e riscos aceites conscientemente

`netlify.toml` define `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy` e `Permissions-Policy` para todas as respostas — ver
`docs/deploy-netlify.md` para o resto da configuração do Netlify
(ambientes, domínio, rollback).

A CSP é construída para o SDK modular do Firebase (Auth, Firestore,
Storage, Functions, App Check) e reCAPTCHA v3 (App Check):
`*.googleapis.com`/`*.cloudfunctions.net`/`*.run.app` para os pedidos ao
backend, `www.gstatic.com`/`www.google.com`/`www.recaptcha.net` para o
reCAPTCHA. Confirmado por inspeção do código que o Firebase Analytics
**não é usado** (só o `measurementId` é lido para a configuração, nunca
chamado `getAnalytics()`), pelo que nenhum domínio de analytics precisa
de estar na lista.

**Risco aceite conscientemente**: `style-src` inclui `'unsafe-inline'`
porque os componentes da interface usam o atributo `style="..."`
diretamente (ver `src/utils/dom.js`) em vez de classes CSS — isto reduz
a proteção da CSP contra injeção de CSS (não contra execução de script,
que continua estrita, sem `'unsafe-inline'` nem `'unsafe-eval'` em
`script-src`). Um refactor para mover todos os estilos inline para
classes eliminaria a necessidade desta exceção, mas é uma alteração
extensa e de baixo risco de segurança isolado (CSS, não JavaScript) —
fica registado como pendência não bloqueadora para uma etapa futura, não
como algo a resolver às pressas nesta.

## O que fica fora desta etapa

- Divisão adicional do bundle do SDK do Firebase.
- Cache de leitura (ex.: `staleTime`) para reduzir ainda mais leituras —
  não introduzido por acrescentar uma fonte nova de dados desatualizados
  sem necessidade demonstrada com utilização real.
- Auditoria de acessibilidade automatizada como passo de CI — ver
  `docs/accessibility.md`.
