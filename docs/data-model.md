# Modelo de dados — Etapas 2 e 3

Este documento descreve a forma de cada coleção do Firestore, quem a
escreve e por que caminho. É a referência de verdade para
`firestore.rules`, para os serviços em `src/services/` e para as Cloud
Functions em `functions/src/`.

Convenções gerais:

- **IDs opacos.** Todos os identificadores de documento são gerados pelo
  Firestore (`.doc()` sem argumento) ou por Cloud Functions — nunca
  derivados de dados pessoais (nome, e-mail, NIF, etc.).
- **Timestamps do servidor.** Qualquer campo `createdAt`/`updatedAt` é
  sempre `serverTimestamp()`/`FieldValue.serverTimestamp()`, nunca a hora
  do relógio do cliente. `occurredAt` (quando algo aconteceu, não quando
  foi registado) é a exceção deliberada — vem do utilizador.
- **`createdBy` / `updatedBy`.** Sempre o `uid` do Firebase Auth de quem
  fez a escrita — nunca um nome livre.
- **Exclusão lógica.** `deletedAt: null | Timestamp`. Nada é apagado
  fisicamente por ação direta do cliente; ver política de retenção em
  "Cofre de documentos" abaixo.
- **Versionamento.** Registos e documentos têm um campo `version`
  incremental; o histórico de alterações vive numa subcoleção `history`
  (registos) ou `versions` (documentos), sempre imutável após criada.

## Visão geral das coleções

```
users/{uid}
families/{familyId}
  members/{uid}
  invites/{inviteId}
  tags/{tagId}
  consents/{consentId}
children/{childId}
  records/{recordId}
    history/{historyId}
  medications/{medicationId}
  consents/{consentId}
  accessGrants/{grantId}
  accessIndex/{granteeUid}
  documents/{documentId}
    versions/{versionId}
    extractionItems/{itemId}
  aiQueries/{queryId}
auditLog/{eventId}
```

## `users/{uid}`

Perfil próprio do utilizador. `uid` corresponde sempre ao UID do Firebase
Auth (mesmo valor do ID do documento).

| Campo | Tipo | Escrito por |
|---|---|---|
| `uid` | string | cliente (create), imutável depois |
| `displayName` | string ≤120 | cliente |
| `email` | string | cliente/`onUserCreate` |
| `familyId` | string \| null | **só servidor** (createFamily/acceptFamilyInvite) |
| `createdAt`, `updatedAt` | Timestamp | cliente/servidor |

`familyId` é um ponteiro de conveniência (evita que o cliente tenha de
"adivinhar" a família ao iniciar sessão num dispositivo novo) — nunca é a
fonte de verdade para permissões, que dependem sempre da existência real
de `families/{familyId}/members/{uid}`. Por isso o cliente pode alterar
livremente o resto do seu perfil mas nunca este campo nem `admin`
(custom-claim-adjacent) — ver `firestore.rules`.

## `families/{familyId}`

| Campo | Tipo |
|---|---|
| `name` | string ≤120 |
| `createdBy` | uid |
| `createdAt`, `updatedAt` | Timestamp |

Criado exclusivamente pela Cloud Function `createFamily`. O cliente nunca
escreve neste documento nem no seguinte.

### `families/{familyId}/members/{uid}`

| Campo | Tipo |
|---|---|
| `uid` | string |
| `role` | `'owner' \| 'caregiver'` |
| `status` | `'active'` (reservado para suspensão futura) |
| `invitedBy` | uid \| null |
| `joinedAt` | Timestamp |

Único e exclusivo mecanismo de que as regras do Firestore dependem para
decidir "este utilizador pertence a esta família". Gerido por
`createFamily`, `acceptFamilyInvite`, `removeFamilyMember`.

### `families/{familyId}/invites/{inviteId}`

Convite para um cuidador familiar (papel sempre `'caregiver'` nesta
etapa). Ver `docs/permissions.md` para o ciclo de vida.

| Campo | Tipo |
|---|---|
| `familyId`, `email`, `role` | — |
| `token` | string opaco (só devolvido uma vez, na criação) |
| `status` | `'pending' \| 'accepted' \| 'expired'` |
| `invitedBy` | uid |
| `createdAt`, `expiresAt` | Timestamp |
| `acceptedByUid`, `acceptedAt` | uid \| null, Timestamp \| null |

### `families/{familyId}/tags/{tagId}`

Etiquetas livres da família (ex.: para categorizar registos no futuro).
Simples, escrito por qualquer membro da família.

### `families/{familyId}/consents/{consentId}`

Consentimentos ao nível da família (ex.: aceitação dos termos de
utilização). Só o proprietário regista/atualiza.

## `children/{childId}`

| Campo | Tipo |
|---|---|
| `familyId` | string |
| `name` | string ≤120 |
| `birthDate` | string (ISO `YYYY-MM-DD`) \| null |
| `relationshipOrigin` | `'ode' \| 'partner' \| 'direct'` |
| `createdBy`, `updatedBy` | uid |
| `createdAt`, `updatedAt` | Timestamp |
| `deletedAt` | Timestamp \| null |

`relationshipOrigin` é um **metadado de proveniência**, nunca uma
permissão — ver `docs/threat-model.md`, risco 1. Criado/editado por
qualquer membro da família; exclusão sempre lógica.

### `children/{childId}/records/{recordId}`

O registo quotidiano estruturado (Etapa 2). Campos comuns a todas as
categorias, mais um mapa `details` específico da categoria.

| Campo | Tipo | Nota |
|---|---|---|
| `childId`, `familyId`, `categoryId` | string | `categoryId` ∈ {emotions, behaviors, sleep, food, medication, school, communication, sensory, achievements, observations} |
| `where`, `withWhom` | string ≤200 \| null | onde estava, com quem |
| `antecedent` | string ≤500 \| null | o que aconteceu antes |
| `emotion` | string ≤100 \| null | |
| `intensity` | `'low' \| 'medium' \| 'high'` \| null | |
| `duration` | number (minutos) \| null | |
| `behavior`, `regulation` | string ≤500 \| null | comportamento observado, como se regulou |
| `helper` | string ≤200 \| null | quem ajudou |
| `outcome` | string ≤500 \| null | resultado |
| `notes` | string ≤4000 \| null | |
| `details` | map | campos específicos da categoria — ver `src/views/register/registerView.js` |
| `occurredAt` | Timestamp | data/hora do acontecimento (não da escrita) |
| `source` | `'family' \| 'school' \| 'professional' \| 'other'` | fonte do registo |
| `createdBy`, `updatedBy` | uid | |
| `version` | number, começa em 1 | |
| `deletedAt` | Timestamp \| null | |

Criado/editado por membros da família ou por um colaborador com
concessão ativa cuja `scopeCategories` cubra a `categoryId` e cuja
`capabilities` incluam `register`. Leitura sujeita à mesma regra por
categoria — ver `docs/permissions.md`.

#### `.../records/{recordId}/history/{historyId}`

Instantâneo do documento **antes** de cada edição, mais `editedBy` e
`editedAt`. Só criação é permitida — nunca atualização ou remoção
(histórico imutável).

### `children/{childId}/medications/{medicationId}`

Medicamentos cadastrados. Só a família tem acesso de escrita; leitura por
terceiros exige `scopeCategories` incluir `'medication'`.

| Campo | Tipo |
|---|---|
| `childId`, `name`, `dose`, `schedule`, `prescribedBy` | string |
| `active` | boolean |
| `createdBy`, `updatedBy` | uid |

### `children/{childId}/consents/{consentId}`

Consentimentos específicos da criança (ex.: partilha com a escola). Só o
proprietário da família regista/revoga.

### `children/{childId}/accessGrants/{grantId}`

Fonte de verdade de uma concessão de acesso a escola/profissional. Gerido
exclusivamente por Cloud Functions — ver `docs/permissions.md` para o
ciclo de vida completo e `functions/src/access.js`.

| Campo | Tipo |
|---|---|
| `childId`, `familyId` | string |
| `granteeEmail` | string (minúsculas) |
| `granteeUid` | uid \| null (preenchido ao aceitar) |
| `role` | `'school_collaborator' \| 'professional_reviewer'` |
| `capabilities` | array de `'view' \| 'register' \| 'comment' \| 'validate'` |
| `scopeCategories` | array das 10 categorias + `'documents'`, ou `['all']` |
| `startAt`, `expiresAt` | Timestamp |
| `revokedAt`, `revokedBy` | Timestamp \| null, uid \| null |
| `grantedBy` | uid |
| `status` | `'pending' \| 'active' \| 'revoked' \| 'expired'` — **só para UI**, nunca usado pelas regras |
| `createdAt`, `updatedAt` | Timestamp |

### `children/{childId}/accessIndex/{granteeUid}`

Documento "achatado", mantido só pela Cloud Function `onAccessGrantWrite`
a partir de `accessGrants`. É o que `firestore.rules` e a lógica partilhada
`resolveChildAccess` (em `functions/src/util.js`) consultam para decidir
acesso em tempo real — nunca o `accessGrants` original, que exigiria mais
leituras.

| Campo | Tipo |
|---|---|
| `granteeUid`, `childId`, `familyId`, `grantId` | string |
| `capabilities`, `scopeCategories` | (copiados da concessão ativa) |
| `expiresAt` | Timestamp — **sempre comparado com a hora do pedido**, nunca com um campo "status" armazenado |

Apagado automaticamente quando a concessão é revogada ou expira (faxina
diária `cleanupExpiredGrants`) — mas a segurança nunca depende dessa
faxina, só da comparação de `expiresAt`.

### `children/{childId}/documents/{documentId}` (Etapa 3 — Cofre de Documentos)

Metadados do documento. O ficheiro em si vive no Cloud Storage (ver
`storage.rules` e `docs/architecture.md`), nunca no Firestore.

| Campo | Tipo |
|---|---|
| `childId`, `familyId` | string |
| `docType` | string ≤60 (ex.: "avaliação", "relatório escolar") |
| `issuer` | string ≤200 \| null — profissional/entidade emissora |
| `specialty` | string ≤200 \| null |
| `docDate` | string ISO \| null — data do documento (não do upload) |
| `origin` | `'family' \| 'school' \| 'professional'` |
| `status` | ver tabela de estados abaixo |
| `currentVersion` | number, 0 até ao primeiro upload bem-sucedido |
| `pendingUpload` | `{mimeType, byteSize}` \| null — só existe durante "uploading" |
| `pages`, `extractionItemCount` | number \| null — preenchidos após extração |
| `errorReason`, `errorDetail` | string \| null, map \| null |
| `processingAttempts` | number — limite de 3 (ver pipeline) |
| `approvedBy`/`approvedAt`, `rejectedBy`/`rejectedReason` | preenchidos pelas funções `approveDocument`/`rejectDocument` |
| `createdBy` | uid |
| `createdAt`, `updatedAt` | Timestamp |
| `deletedAt` | Timestamp \| null |
| `purgedAt` | Timestamp \| null — quando o ficheiro físico foi removido pela retenção |

**Estados do pipeline** (`status`), exatamente os pedidos:

| Estado | Definido por | Significado |
|---|---|---|
| `selected` | cliente | registo de metadados criado, nenhum ficheiro ainda |
| `uploading` | Cloud Function (`getDocumentUploadUrl`) | URL de envio emitida, à espera do ficheiro |
| `quarantine` | Cloud Function (`onDocumentUpload`) | a aguardar/bloqueado por antivírus |
| `verifying` | Cloud Function | a confirmar que o conteúdo real corresponde ao tipo declarado |
| `extracting` | Cloud Function | a extrair texto e a classificar secções |
| `pending_review` | Cloud Function | extração feita, à espera de revisão humana |
| `approved` | `approveDocument` (cliente, só depois de reverem tudo) | entra na visão integrada |
| `rejected` | `rejectDocument` ou pipeline | não avança |
| `error` | Cloud Function | falha técnica (ver `errorReason`) |
| **eliminado** | `deletedAt != null` | eixo ortogonal — sobrepõe-se a qualquer estado acima; a interface mostra "Eliminado" sempre que `deletedAt` está definido, independentemente do `status` armazenado |

O cliente só escreve diretamente neste documento em dois casos: **criar**
(estado inicial `selected`) e **marcar `deletedAt`**. Todas as restantes
transições de estado são exclusivas de Cloud Functions (Admin SDK, que
ignora `firestore.rules`) — ver `docs/decisions.md`.

#### `.../documents/{documentId}/versions/{versionId}`

Um documento por versão efetivamente processada (o `versionId` é o número
da versão como string). Só escrito pela Cloud Function.

| Campo | Tipo |
|---|---|
| `version` | number |
| `storagePath` | string (caminho no bucket) |
| `declaredMimeType`, `realMimeType` | string — o real vem da assinatura de bytes, não da extensão |
| `byteSize` | number |
| `checksum` | string (SHA-256 em hex) |
| `pages` | number |
| `uploadedBy` | uid |
| `createdAt` | Timestamp |

#### `.../documents/{documentId}/extractionItems/{itemId}`

Um item por trecho estruturado encontrado (ver `docs/vendors.md` e
`functions/src/extraction.js` para o método). Categorias possíveis:
`strengths, needs, observations, assessmentResults, recommendations,
strategies, goals, schoolAdaptations, sensory, communication, sleep,
food, medicationInfo, dates, responsibleProfessional, limitations`.

| Campo | Tipo |
|---|---|
| `category` | uma das categorias acima |
| `value` | string ≤1500 — texto normalizado do trecho |
| `page` | number |
| `excerpt` | string ≤300 — trecho curto para citação |
| `confidence` | number 0–1 (heurística, não probabilística) |
| `sourceVersionId` | string |
| `reviewStatus` | `'pending' \| 'confirmed' \| 'edited' \| 'rejected'` |
| `reviewedBy`, `reviewedAt` | uid \| null, Timestamp \| null |
| `createdAt` | Timestamp |

Criado **só** pela Cloud Function de extração. O cliente só pode alterar
`reviewStatus`, `value`, `reviewedBy`, `reviewedAt` — nunca `category`,
`page`, `excerpt`, `confidence` ou `sourceVersionId` (ver
`firestore.rules`). Um documento só pode ser aprovado
(`approveDocument`) quando **nenhum** item continua `pending`.

### `children/{childId}/aiQueries/{queryId}`

Registo mínimo de uma pergunta feita em "Perguntar aos documentos" — só
metadados técnicos, nunca o texto da pergunta/resposta/documento (ver
`docs/logging-policy.md`).

| Campo | Tipo |
|---|---|
| `askedBy`, `childId`, `familyId` | — |
| `blocked` | boolean |
| `sourceCount` | number |
| `sourceDocumentIds` | array de IDs |
| `durationMs` | number |
| `createdAt` | Timestamp |

## `auditLog/{eventId}`

Nunca escrito nem editável pelo cliente (`allow write: if false`).
Escrito exclusivamente por gatilhos e funções em `functions/src/audit.js`,
`access.js` e outros. Ver `docs/permissions.md` para quem pode ler.

| Campo | Tipo |
|---|---|
| `action` | string (ex.: `child.created`, `access_grant.revoked`) |
| `actorUid` | uid \| null |
| `actorRole` | `'user' \| 'system'` |
| `targetType`, `targetId` | string |
| `familyId`, `childId` | string \| null |
| `metadata` | map — só metadados técnicos, nunca conteúdo sensível |
| `createdAt` | Timestamp |

## Limites configuráveis do cofre de documentos

| Limite | Valor nesta etapa | Onde |
|---|---|---|
| Tamanho máximo de ficheiro | 20 MB | `storage.rules`, `functions/src/documents.js` (`MAX_BYTES`) |
| Tipos MIME aceites | PDF, JPEG, PNG, DOCX | `storage.rules`, `functions/src/documents.js` |
| Número máximo de páginas | 200 | `functions/src/documents.js` (`MAX_PAGES`) |
| Tentativas de processamento | 3 | `functions/src/documents.js` (`MAX_ATTEMPTS`) |
| Retenção após eliminação lógica | 30 dias | `functions/src/documents.js` (`RETENTION_DAYS_AFTER_DELETE`) |
| Validade máxima de uma concessão | 365 dias | `functions/src/access.js` (`MAX_GRANT_DAYS`) |
| Duração da URL assinada | 5 minutos | `functions/src/documents.js` (`SIGNED_URL_TTL_MS`) |
