# Política de logs

## Princípio

Nenhum registo de log, evento de auditoria, analytics ou notificação
push pode conter conteúdo sensível — nem o texto de um registo
quotidiano, nem o texto de um documento, nem a pergunta ou resposta de
"Perguntar aos documentos". Logs guardam **metadados técnicos**
suficientes para depuração e auditoria operacional, nunca o conteúdo em
si.

## O que É registado

| Onde | O quê |
|---|---|
| `auditLog` (Firestore, ver `functions/src/audit.js`, `access.js`) | ação (ex.: `record.created`), autor, tipo/ID do alvo, `familyId`/`childId`, e metadados técnicos limitados (ex.: `categoryId` e `source` de um registo — nunca `notes`) |
| `children/*/aiQueries` (ver `functions/src/ai.js`) | quem perguntou, quando, se foi bloqueada, quantas fontes foram usadas, IDs dos documentos citados, duração — **nunca** o texto da pergunta nem da resposta |
| `children/*/documents/*/versions` | checksum, tamanho, tipo real detetado, número de páginas — nunca o texto extraído |
| Logs de execução das Cloud Functions (Cloud Logging / consola do emulador) | mensagens de erro técnicas (ex.: `"Invalid PDF structure"`), stack traces de exceções não tratadas | 

## O que NUNCA é registado

- Texto de registos quotidianos (`notes`, `outcome`, `behavior`, etc.).
- Texto extraído de documentos (páginas, trechos completos).
- A pergunta ou a resposta de "Perguntar aos documentos" — só metadados
  (ver `logAiQuery` em `functions/src/ai.js`).
- Palavras-passe (nunca tocadas pelo nosso código — geridas inteiramente
  pelo Firebase Auth).
- Tokens de convite ou de concessão de acesso em texto simples fora da
  resposta única da função que os cria.

## Regras práticas ao escrever código novo

1. **Nunca passar um objeto de registo/documento inteiro para
   `console.log`/`logger`.** Se for preciso depurar, extrair só os
   campos técnicos necessários (ex.: `record.categoryId`, não `record`).
2. **Mensagens de erro lançadas ao cliente** (`HttpsError`) devem ser
   genéricas e nunca ecoar conteúdo fornecido pelo utilizador além do
   estritamente necessário para o utilizador corrigir o problema (ex.:
   "E-mail inválido", nunca "E-mail inválido: <valor completo>").
3. **Excertos de documentos usados internamente pelo gateway de IA**
   (`sanitizeUntrustedText`) são truncados e nunca persistidos em log —
   só usados em memória durante o pedido.
4. **Notificações push/e-mail** (quando existirem) nunca incluem
   conteúdo de registos ou documentos — só uma referência genérica (ex.:
   "Um novo registo foi adicionado", nunca o texto do registo).
5. **Analytics** (Firebase Analytics/Measurement ID) não está ativo
   nesta etapa; se vier a ser ativado, aplica-se a mesma regra — eventos
   de produto (ex.: "categoria X usada"), nunca conteúdo.

## Revisão

Sempre que uma nova Cloud Function ou serviço de cliente for adicionado e
escrever nalgum destino observável (Firestore, Cloud Logging,
notificações), esta política deve ser revista como parte da revisão de
código — ver `docs/threat-model.md` para o risco correspondente.
