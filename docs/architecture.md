# Arquitetura — estado após Etapa 3

## Visão geral

```
┌──────────────────────────────────────────────────────────────────┐
│                        Navegador (cliente)                        │
│                                                                    │
│  index.html → src/main.js (bootstrap)                             │
│    ├── firebase/app.js        (init SDK, liga a emuladores em dev)│
│    ├── firebase/appCheck.js   (App Check, só fora dos emuladores) │
│    ├── router/router.js       (rotas em hash, guarda auth+família)│
│    ├── state/appState.js      (familyId em memória, não persistido)│
│    ├── views/*                (um ficheiro por ecrã)               │
│    ├── components/*           (reutilizáveis entre vistas)         │
│    ├── services/*             (uma função por operação de negócio) │
│    │     ├── authService, familyService, childrenService           │
│    │     ├── recordsService, medicationsService, consentService    │
│    │     ├── accessGrantsService, auditService (só leitura)        │
│    │     └── documentsService, aiService (Etapa 3)                 │
│    ├── i18n/*, styles/*       (inalterados desde a Etapa 1)         │
│    └── config/firebase.config.js (só leitura de env, sem SDK)       │
└──────────────────────────────┬─────────────────────────────────────┘
                                │ SDKs do Firebase (Auth, Firestore,
                                │ Storage, Functions) — nunca REST cru
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                              Firebase                                │
│                                                                        │
│  Authentication ── e-mail/palavra-passe, custom claim "admin"         │
│                                                                        │
│  Firestore (europe-west1) ── ver docs/data-model.md                   │
│    firestore.rules: deny-by-default, nunca confia em campos do cliente│
│                                                                        │
│  Cloud Storage ── bucket privado, storage.rules nega SEMPRE acesso    │
│    direto do cliente (ver "Cofre de Documentos" abaixo)               │
│                                                                        │
│  Cloud Functions (europe-west1) ── functions/src/*                    │
│    ├── family.js    → createFamily, inviteFamilyMember, ...           │
│    ├── access.js    → createAccessGrant, onAccessGrantWrite, ...      │
│    ├── adminClaims.js → onUserCreate, setAdminClaim                   │
│    ├── audit.js     → gatilhos que escrevem auditLog (nunca o cliente)│
│    ├── documents.js → pipeline do cofre de documentos                 │
│    └── ai.js        → gateway de IA privado ("Perguntar aos documentos")│
└────────────────────────────────────────────────────────────────────┘
```

## Camadas

| Camada | Pasta | Responsabilidade |
|---|---|---|
| Apresentação | `src/views/`, `src/components/` | Construir DOM, sem regras de negócio |
| Aplicação (cliente) | `src/services/` | Uma função por operação; nunca decide permissões, só as invoca |
| Estado de sessão | `src/state/appState.js` | `familyId` resolvido em memória; nunca persistido nem usado para decidir acesso |
| Servidor | `functions/src/` | Estrutura de família/acessos, auditoria, pipeline de documentos, gateway de IA |
| Segurança declarativa | `firestore.rules`, `storage.rules` | Fronteira real de leitura/escrita — ver `docs/permissions.md` |
| Texto | `src/i18n/` | Único local de strings de interface |
| Navegação | `src/router/` | Mapeamento hash → vista, guardas de acesso, foco |

## Router e guardas de acesso

O router (`src/router/router.js`) mantém o desenho em hash da Etapa 1
(ver `docs/decisions.md`), agora com três níveis de acesso por rota:

- `public` — qualquer pessoa (boas-vindas, login, registo, recuperação de
  palavra-passe, aceitar convite).
- `auth` — exige sessão Firebase Auth válida, mas não exige família
  (onboarding).
- `family` — exige sessão **e** uma família associada
  (`users/{uid}.familyId`, resolvido por `findMyFamilyId`); sem isso,
  redireciona para o onboarding.

O router espera por `waitForAuthReady()` (`authService.js`) antes da
primeira renderização, para não mostrar um redirecionamento momentâneo
para o login em cada recarregamento de página enquanto o Firebase Auth
ainda está a determinar a sessão persistida.

## Modelo de dados e permissões

Ver os documentos dedicados:
- `docs/data-model.md` — forma de cada coleção do Firestore.
- `docs/permissions.md` — papéis, capacidades das concessões de acesso,
  e a matriz completa de quem lê/escreve o quê.

Princípio de desenho central: **famílias/membros e concessões de acesso
nunca são escritos diretamente pelo cliente** — só por Cloud Functions,
usando o Admin SDK (que ignora `firestore.rules` por definição). Isto
elimina, por construção, a possibilidade de um utilizador se
autoatribuir um papel ou entrar numa família alheia através de uma
escrita direta ao Firestore.

## Cofre de Documentos (Etapa 3)

### Decisão de arquitetura: sem acesso direto ao bucket

`storage.rules` nega **sempre** leitura e escrita diretas do cliente ao
Cloud Storage. Todo o acesso — upload e download — passa por uma Cloud
Function que verifica a permissão no Firestore através do Admin SDK e
devolve uma URL assinada de curta duração (5 minutos):

```
Cliente                    Cloud Function              Storage
  │  getDocumentUploadUrl()      │                        │
  │ ─────────────────────────►   │                        │
  │                               │  resolveChildAccess()  │
  │                               │  (Firestore, Admin SDK)│
  │                               │                        │
  │  { url, storagePath }        │  file.getSignedUrl()    │
  │ ◄─────────────────────────   │ ──────────────────────► │
  │                               │                        │
  │  PUT <url>  (bytes do ficheiro)                        │
  │ ───────────────────────────────────────────────────────►│
  │                               │                        │
  │                               │   onFinalize (gatilho)  │
  │                               │ ◄──────────────────────│
```

Esta decisão foi tomada depois de se confirmar, durante o
desenvolvimento, que a alternativa documentada pela Firebase (regras de
Storage que chamam `firestore.get()`/`firestore.exists()` diretamente)
não funcionava de forma fiável no Firebase Emulator Suite local usado
neste ambiente — ver `docs/decisions.md` para o registo completo da
investigação. O resultado é, de qualquer forma, **mais restritivo**
(bucket totalmente inacessível ao cliente) e mais fácil de auditar (todo
o acesso passa por uma função com o seu próprio registo de execução).

### Pipeline servidor de validação e extração

Todo o processamento acontece em `functions/src/documents.js`, nunca no
browser, disparado pelo gatilho `onFinalize` do Storage:

```
uploading
   │ (transação: só avança se ainda estiver "uploading" — idempotente)
   ▼
quarantine ──► getAntivirusAdapter().scanBuffer()
   │             ├─ sem serviço real configurado → fica aqui para sempre
   │             │  (nunca simula segurança — ver antivirus.js)
   │             └─ limpo → continua
   ▼
verifying ──► detectRealMimeType() (assinatura de bytes, não extensão)
   │             └─ não corresponde ao tipo declarado → rejected
   ▼
extracting ──► extractPagesFromBuffer() (pdf-parse / mammoth reais)
   │             └─ imagem/PDF sem texto → getOcrAdapter()
   │                  └─ sem motor de OCR real configurado → error
   │             extractStructuredItemsFromPages() (heurística de secções,
   │             nunca inventa uma categoria sem correspondência no texto)
   ▼
pending_review ──► revisão humana obrigatória (ver interface)
   │
   ├─ approveDocument() — só quando NENHUM item continua "pending"
   └─ rejectDocument()
```

Limite de 3 tentativas de processamento (`MAX_ATTEMPTS`) e reivindicação
transacional do estado evitam reprocessamento infinito ou duplicado
quando o `onFinalize` é entregue mais do que uma vez (comportamento "at
least once" documentado do Cloud Functions).

### Antivírus e OCR — interfaces reais, adaptadores honestos

`functions/src/antivirus.js` e `functions/src/ocr.js` definem a
interface que um serviço real teria de implementar. Nesta etapa, **nenhum
dos dois está ligado a um serviço real**:

- Antivírus: o adaptador por omissão recusa sempre (`clean: false`),
  bloqueando o documento em quarentena. Só avança com
  `SOBREDOT_AV_DEV_PASSTHROUGH=true`, e só quando
  `FUNCTIONS_EMULATOR=true` — nunca em produção.
- OCR: o adaptador por omissão devolve `available: false`; o documento
  fica em `error` com `errorReason: 'ocr_unavailable'`, visível na
  interface.

Isto cumpre literalmente a instrução de não simular segurança/capacidade
que não existe — ver `docs/roadmap.md` para quando um fornecedor real
for contratado.

## Camada de IA privada

### Princípio central

> A IA nunca é treinada com os laudos. Cada pedido é isolado, filtrado
> por criança e por família **no servidor**, nunca só no prompt.

`functions/src/ai.js` implementa o gateway único de IA
(`askDocuments`, callable). Fluxo de um pedido:

1. **Autorização no servidor.** `resolveChildAccess(childId, uid, {capability:'view', category:'documents'})` —
   a mesma função usada pelo cofre de documentos. Nunca confia em nada
   vindo do cliente além do `childId` pedido.
2. **Bloqueio de intenção antes de gastar qualquer recuperação.**
   `containsBlockedIntent(question)` recusa perguntas que peçam
   diagnóstico, prescrição, alteração de medicação, tratamento ou
   classificação da criança — ver lista de padrões em `ai.js`.
3. **Recuperação filtrada por criança.** `retrieveChildContext` só lê
   `children/{childId}/documents` com `status == 'approved'` e
   `deletedAt == null`, e dentro deles só `extractionItems` com
   `reviewStatus` em `['confirmed', 'edited']` — nunca um item ainda
   pendente de revisão humana, nunca o texto bruto do documento.
4. **Defesa contra prompt injection.** `sanitizeUntrustedText` trata todo
   o texto recuperado como dados, nunca como instruções — trunca,
   remove marcadores de bloco de código, e o adaptador de resposta só
   **organiza** o que foi recuperado, nunca gera texto livre a partir de
   instruções encontradas dentro dos documentos.
5. **Segunda barreira de saída.** Mesmo que a pergunta pareça inofensiva,
   a resposta candidata é também verificada contra os mesmos padrões
   bloqueados antes de ser devolvida.
6. **Resposta sempre com citação.** `buildGroundedAnswer` só pode
   devolver factos que vieram da recuperação — cada facto transporta
   `documentId`, `page`, `excerpt`. Sem itens recuperados, a resposta é
   "sem informação suficiente", nunca uma invenção.
7. **Registo mínimo.** `logAiQuery` grava só metadados técnicos (quem,
   quando, quantas fontes, se foi bloqueada) — nunca a pergunta, a
   resposta ou conteúdo de documentos (ver `docs/logging-policy.md`).

### Por que isto garante isolamento entre crianças

A recuperação (`retrieveChildContext`) só consulta a subcoleção
`children/{childId}/documents` — nunca uma coleção partilhada entre
crianças. Não há nenhum caminho de código pelo qual um item de
`childId=B` possa ser incluído numa resposta sobre `childId=A`: seria
preciso um bug na própria query do Firestore, não numa lógica de
filtragem posterior (que poderia ser esquecida ou contornada). Isto é
verificado por um teste dedicado — ver
`tests/rules/aiRetrieval.canary.test.js` — que falha se, alguma vez,
uma resposta sobre a criança A citar um documento da criança B.

### Fornecedor de IA

Nenhum fornecedor de IA real está contratado nesta etapa — ver
`docs/vendors.md` para os requisitos que têm de ser satisfeitos antes de
qualquer contratação, e para a justificação de usar sempre um adaptador
mock/heurístico determinístico durante o desenvolvimento.

## Componentes vs. Vistas

Inalterado desde a Etapa 1: vistas (`src/views/**/xxxView.js`) montam um
ecrã completo orquestrando serviços e componentes; componentes
(`src/components/`) são unidades reutilizáveis sem estado próprio
persistente. `src/utils/dom.js` continua a ser o único "motor" de UI —
sem framework, sem virtual DOM.

## Autenticação (real, desde a Etapa 2)

`src/services/authService.js` usa o Firebase Authentication real:
`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`,
`sendPasswordResetEmail`, `sendEmailVerification`, `signOut`,
`onAuthStateChanged`. Login social está preparado na arquitetura mas não
ativado — ver `docs/firebase-setup.md`.

## Internacionalização

Inalterado desde a Etapa 1 — `src/i18n/pt.js` centraliza todos os
textos, agora com secções para autenticação, onboarding, família,
registo estruturado e cofre de documentos.

## Origem da relação (ODE / parceiro / direta)

`relationshipOrigin` em `children/{childId}` continua a ser um metadado
de proveniência, nunca uma permissão — reforçado agora por
`firestore.rules`: o campo é validado na criação mas nunca usado em
nenhuma condição de acesso. Ver `docs/threat-model.md`, risco 1.

## O que é mock e o que é real — resumo

| Peça | Estado |
|---|---|
| Autenticação (e-mail/palavra-passe) | **Real** (Firebase Auth) |
| Firestore (famílias, crianças, registos, documentos, auditoria) | **Real** (regras testadas, 31 testes automatizados) |
| Storage (bucket privado) | **Real**, mas acesso do cliente sempre mediado por Cloud Functions |
| Custom claims de administrador | **Real**, atribuição inicial manual (bootstrap), depois via função |
| Extração de texto de PDF/DOCX | **Real** (`pdf-parse`, `mammoth`) |
| Extração estruturada por secções | **Real**, mas heurística (não é um modelo de linguagem) |
| Antivírus | **Interface real, sem serviço ligado** — bloqueia por omissão |
| OCR | **Interface real, sem serviço ligado** — erro explícito por omissão |
| Gateway de IA / "Perguntar aos documentos" | **Real** o mecanismo de isolamento/grounding; **mock** o "modelo" (heurística determinística, sem chamada de rede) |
| URLs assinadas de upload/download | **Código real**, não totalmente verificável neste sandbox de desenvolvimento por falta de credenciais de assinatura — ver `docs/firebase-setup.md` |
| Envio de e-mail de convite | **Não implementado** — link copiado manualmente pelo proprietário |
