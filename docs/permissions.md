# Catálogo de permissões — Etapas 2, 3 e 4

## Princípios não negociáveis

1. **Recusa por omissão.** `firestore.rules` e `storage.rules` terminam
   sempre com uma regra universal que nega tudo o que não foi
   explicitamente permitido acima.
2. **Nunca confiar em dados do cliente para decidir permissões.** Nenhuma
   regra lê um campo `role` dentro do próprio documento que está a ser
   escrito. As únicas fontes de verdade são:
   - **Custom claims do Firebase Auth** (`request.auth.token.admin`) —
     só para o papel de administrador técnico, definidas exclusivamente
     por uma Cloud Function (`setAdminClaim`) chamada por um admin já
     existente, nunca pelo próprio utilizador.
   - **Documentos geridos pelo servidor**
     (`families/*/members`, `children/*/accessIndex`) — nunca escritos
     diretamente pelo cliente.
3. **As concessões de acesso nunca são avaliadas por um campo `status`
   armazenado.** A validade é sempre `expiresAt > hora do pedido`,
   recalculada em cada leitura.

## Papéis

| Papel | Como se obtém | Âmbito |
|---|---|---|
| **Responsável proprietário** (`owner`) | Cria a família (`createFamily`) | Controlo total da família: membros, convites, crianças, concessões de acesso, consentimentos |
| **Cuidador familiar** (`caregiver`) | Aceita um convite (`acceptFamilyInvite`) | Acede e regista para todas as crianças da família; não gere membros nem concessões de acesso a terceiros |
| **Colaborador da escola** (`school_collaborator`) | Recebe uma concessão de acesso, aceita-a | Só a(s) criança(s) e capacidades/categorias explicitamente concedidas, com validade limitada |
| **Profissional revisor** (`professional_reviewer`) | Idem, com capacidade tipicamente incluindo `validate` | Idem |
| **Administrador técnico** | Custom claim `admin: true`, atribuída manualmente (bootstrap) ou por outro admin | **Nunca** conteúdo sensível de crianças por padrão — ver abaixo |

A família pode usar a aplicação sem nunca convidar ninguém: convites de
cuidador e concessões de acesso são sempre opcionais, iniciados pelo
proprietário, nunca obrigatórios para o uso básico.

### Administrador técnico — o que vê e o que NUNCA vê

| Pode ler | Não pode ler |
|---|---|
| `users/*` (qualquer perfil, para suporte) | `children/*/records/*` |
| `families/*`, `families/*/members/*`, `families/*/invites/*` (metadados operacionais) | `children/*/medications/*` |
| `children/*/accessGrants/*` (metadados de quem tem acesso a quê) | `children/*/documents/*` e subcoleções (conteúdo do cofre) |
| `auditLog/*` (toda a auditoria — metadados de ações, nunca conteúdo) | `children/*/consents/*` |
| — | `children/*` propriamente dito (perfil da criança) |

Esta assimetria é deliberada (ver `docs/threat-model.md`, risco 1): o
admin pode operar a plataforma (suporte, investigação de abuso,
moderação) sem conseguir abrir o conteúdo clínico/pessoal de uma criança
específica.

## Capacidades de uma concessão de acesso

Cada concessão (`accessGrants`) combina:

- **`capabilities`** (uma ou mais): `view` (ver), `register` (registar),
  `comment` (comentar — reservado para uso futuro na revisão de
  documentos), `validate` (validar — reservado para o papel de
  profissional revisor confirmar itens extraídos).
- **`scopeCategories`**: qualquer subconjunto das 10 categorias de
  registo, mais os pseudo-âmbitos `'documents'` (cofre de documentos),
  `'insights'` (Visão Integrada, Etapa 4) e `'goals'` (metas, Etapa 4),
  ou `['all']` para todas.
- **`startAt` / `expiresAt`**: janela de validade obrigatória, no máximo
  365 dias a partir da criação.
- **`grantedBy`**: sempre o proprietário da família dona da criança —
  só ele pode criar ou revogar concessões (`requireChildFamilyOwner`).

### Ciclo de vida

```
createAccessGrant (owner)
        │  status: 'pending', granteeUid: null
        ▼
acceptAccessGrant (convidado, e-mail tem de corresponder)
        │  status: 'active', granteeUid: <uid>
        ▼
   onAccessGrantWrite (gatilho) ──► accessIndex/{granteeUid}
        │
        ├── revokeAccessGrant (owner) ──► revokedAt definido ──► accessIndex apagado
        │
        └── expiresAt < agora ──► accessIndex deixa de conceder acesso
                                    (sem esperar por nenhuma função de limpeza)
```

`cleanupExpiredGrants` (agendada, diária) só limpa `accessIndex` e marca
`status: 'expired'` na concessão para efeitos de interface — nunca é a
fronteira de segurança real.

## Validação profissional (Etapa 4)

Não existe um segundo mecanismo de convite: um "profissional revisor"
convidado através de "Acessos de escola e profissionais" (com
`capabilities` incluindo `'validate'` e `scopeCategories` incluindo
`'insights'`) pode, a partir de `#/colaborador/{childId}`, comentar,
confirmar (`professional_validated`) ou contestar (`contested`) um
insight — nunca editar `evidence`/`factualObservation`/o registo
original. A família só pode marcar como `family_reviewed` ou voltar a
`not_reviewed`. Só a família (nunca um profissional) pode gerar novos
insights (`generateInsights`) — ver `docs/insights.md`. Como qualquer
concessão de acesso, é sempre opcional, temporária e revogável, e nunca
exige "cadastro profissional" prévio — só uma conta autenticada normal.

## Matriz de acesso por coleção

| Coleção | Família (membro) | Colaborador com concessão | Admin | Ninguém mais |
|---|---|---|---|---|
| `users/{uid}` (próprio) | leitura/escrita própria (exceto `admin`, `familyId`) | — | leitura | — |
| `families/{id}` | leitura | — | leitura | — |
| `.../members` | leitura | — | leitura | — |
| `.../invites` | leitura (owner ou o próprio convidado por e-mail) | — | leitura | — |
| `.../tags`, `.../consents` | leitura/escrita (consents: só owner escreve) | — | leitura | — |
| `children/{id}` | leitura/escrita (exclusão só lógica) | leitura, se `view` no âmbito | — (nunca) | — |
| `.../records` | leitura/escrita | conforme `capabilities`/`scopeCategories` **por categoria** | — (nunca) | — |
| `.../medications` | leitura/escrita | só leitura, e só com `'medication'` no âmbito | — (nunca) | — |
| `.../consents` (da criança) | leitura; escrita só owner | — | leitura | — |
| `.../accessGrants` | leitura | leitura da própria concessão | leitura | — |
| `.../accessIndex` | leitura (owner) | leitura da própria entrada | leitura | — |
| `.../documents` e subcoleções | leitura/escrita (criação e eliminação lógica) | conforme âmbito `'documents'` | — (nunca) | — |
| `.../aiQueries` | leitura | — | leitura | — |
| `.../insights` e `.../statusHistory` | leitura; escrita só via Cloud Functions | leitura, se `view` no âmbito `'insights'`; `setInsightStatus` se `validate` no âmbito `'insights'` | — (nunca) | — |
| `.../goals` | leitura/escrita (criação e eliminação lógica) | leitura, se `view` no âmbito `'goals'` | — (nunca) | — |
| `.../reportShares` | leitura (só família); escrita só via Cloud Functions | — (nunca, mesmo com concessão) | — (nunca) | — |
| `auditLog` | leitura (só da própria família) | — | leitura (tudo) | — |

"Escrita" na tabela refere-se sempre às operações permitidas ao **cliente
diretamente**; qualquer coisa marcada como "geridas por Cloud Functions"
no `docs/data-model.md` só é escrita por essa função (Admin SDK), nunca
pelo cliente, independentemente do papel.

## Onde cada regra é aplicada

| Camada | Ficheiro | Papel |
|---|---|---|
| Firestore | `firestore.rules` | fronteira real de segurança para leitura/escrita de dados |
| Storage | `storage.rules` | nega sempre o acesso direto do cliente ao bucket (ver `docs/decisions.md`) |
| Cloud Functions | `functions/src/util.js` (`resolveChildAccess`) | reavalia a mesma lógica no servidor para chamadas (`askDocuments`, `getDocumentUploadUrl`, `getDocumentDownloadUrl`) — defesa em profundidade, nunca confia só nas regras |
| Cliente | `src/services/*.js` | só compõe consultas coerentes com o que as regras exigem (ex.: filtrar por categoria); nunca é a fronteira de segurança |

## Testado por

Ver `tests/rules/` (executado com `npm run test:rules`, 49 testes):
família A vs. família B; concessão expirada; colaborador escolar sem
âmbito de medicação; isolamento de registos entre crianças da mesma
família; impossibilidade de autopromoção a admin; imutabilidade da
auditoria; regras do Storage negando sempre o acesso direto; lógica de
`resolveChildAccess` (incluindo o caso de concessão expirada); o teste
canário de isolamento entre crianças na recuperação de contexto de IA; e,
desde a Etapa 4 (`tests/rules/insightsAndReports.integration.test.js`):
geração de insights com amostra pequena/registo eliminado/fontes
contraditórias/dois documentos comparados; família vs. profissional a
mudar o estado de um insight; profissional com concessão expirada ou sem
capacidade `validate` perdendo a permissão; relatório com escopo
parcial; link de partilha com token errado, revogado ou expirado.
