# Direitos do titular dos dados — como estão implementados

Documento técnico (não um rascunho de texto legal como os outros desta
pasta) descrevendo como cada direito RGPD relevante está de facto
implementado, para o jurista confirmar que a implementação cumpre o que
a lei exige — e para a família saber o que esperar de cada botão da
aplicação.

## Acesso e retificação

Desde a Etapa 2: a família lê e edita diretamente os seus próprios dados
nos ecrãs normais da aplicação (`firestore.rules` garante que só vê os
seus). Não há um formulário separado de "pedido de acesso" — o acesso é
imediato e nativo à própria aplicação.

## Portabilidade — exportação estruturada

`exportFamilyDataHandler` (`functions/src/dataRights.js`) devolve uma
cópia JSON completa e legível de tudo o que a família tem guardado:
perfil da família, membros, convites, etiquetas, consentimentos, e por
cada criança — perfil, registos, medicamentos, consentimentos,
concessões de acesso, metadados de documentos (com a extração já
revista, mas **não** o ficheiro binário original — esse descarrega-se
individualmente no ecrã de Documentos, por já ter o seu próprio
mecanismo de download seguro), metas e insights.

- Todos os `Timestamp` do Firestore são convertidos para string ISO
  8601 antes de sair — nunca um formato interno do Firestore.
- Limitado a 5 exportações por utilizador por dia
  (`LIMITS.EXPORT_PER_USER`, `functions/src/rateLimit.js`) — falha
  segura contra automatização abusiva, generoso para uso normal.
- Cada exportação fica registada em `auditLog` (`data.exported`), com o
  número de crianças incluídas — nunca o conteúdo.
- Interface: `src/services/dataRightsService.js` (chama a função e
  desencadeia a transferência do ficheiro) e o botão "Exportar os meus
  dados" em `src/views/profile/profileView.js`.

## Restrição do processamento por IA

`setChildProcessingRestrictionHandler` marca uma criança como
`processingRestricted: true` — a partir daí, `askDocuments`
(`functions/src/ai.js`) e `generateInsights`
(`functions/src/insights.js`) recusam-se a processá-la
(`failed-precondition`) até a família reverter. Os registos e
documentos continuam a poder ser lidos/editados normalmente — só o
processamento por IA para essa criança específica é suspenso.
Interface: caixa de verificação na página de perfil da criança
(`src/views/children/childProfileView.js`).

## Apagamento — eliminação reforçada com prazo de reflexão

Fluxo desenhado deliberadamente para não ser um botão de um clique,
dado o caráter irreversível:

1. **Pedido** (`requestFamilyDeletionHandler`, só o proprietário da
   família): exige escrever exatamente o nome da família como
   confirmação — não um simples "sim". Fica agendado para
   **14 dias depois** (`DELETION_GRACE_DAYS`), nunca imediato.
2. **Período de reflexão**: a família pode usar a aplicação
   normalmente; o pedido fica visível com a data agendada.
3. **Cancelamento** (`cancelFamilyDeletionHandler`): a qualquer momento
   durante o período, o proprietário cancela sem perda de dados.
4. **Execução** (`processScheduledDeletions`, agendada diariamente):
   depois do prazo, `deleteFamilyDataCompletely` apaga fisicamente —
   todas as crianças e as suas subcoleções (registos, medicamentos,
   documentos incluindo ficheiros no Storage, insights, metas,
   concessões), a própria família, e desassocia `familyId` dos
   utilizadores membros. Cada etapa fica registada em `auditLog`
   (`family.deletion_requested`, `_cancelled`, e finalmente
   `family.deleted`, com contagem de crianças — nunca conteúdo).
5. Verificado por teste de integração real (não simulado): o teste em
   `tests/rules/dataRights.integration.test.js` confirma que um
   ficheiro efetivamente deixa de existir no Storage Emulator depois da
   execução.

### Limitação conhecida — não bloqueadora, mas a documentar

`deleteFamilyDataCompletely` **não apaga a conta do Firebase
Authentication** de cada membro (só o campo `familyId` no seu perfil
`users/{uid}`). Um membro que volte a iniciar sessão fica sem família
(vai parar ao ecrã de onboarding), mas a conta de autenticação em si
(e-mail, uid) continua a existir até ser apagada manualmente
(`auth.deleteUser`, fora deste fluxo automático nesta etapa). Isto é
suficiente para o "apagamento dos dados sobre a criança", mas não para
um pedido de eliminação da própria conta de utilizador adulto — a
confirmar com o jurista se isso exige um fluxo complementar antes do
piloto alargar a mais famílias.

## Retenção automática dos dados técnicos derivados

`purgeOldTechnicalLogs` (diária): apaga metadados de "Perguntar aos
documentos" com mais de 180 dias e contadores de anti-abuso com mais de
7 dias — nunca conteúdo, só os subprodutos técnicos que não têm motivo
para sobreviver indefinidamente (ver `docs/data-map.md`).
