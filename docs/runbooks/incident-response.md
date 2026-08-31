# Runbook técnico — resposta a incidentes

Este é o procedimento técnico (deteção, contenção, correção). As
obrigações legais em paralelo (prazos, notificação à CNPD/famílias,
papéis de decisão) estão em
`docs/governance/incident-response-policy.md` — os dois correm ao
mesmo tempo, não em sequência.

## 1. Deteção

Sinais possíveis, e onde aparecem:

- Um teste de isolamento a falhar em CI (`.github/workflows/ci.yml`,
  job `rules`) — nunca deve chegar a produção, mas se acontecer é o
  sinal mais grave possível.
- Um pico de `abuse.rate_limited` ou de perguntas de IA bloqueadas no
  painel administrativo (`docs/admin-dashboard.md`).
- Um alerta de custo/quota inesperado na consola do Google Cloud.
- Um relato direto de uma família ("estou a ver dados que não são do
  meu filho").
- Um aviso de segurança de dependências (ver
  `docs/runbooks/vulnerability-response.md`).

## 2. Contenção imediata

A prioridade é sempre parar a exposição a continuar a acontecer, antes
de perceber a causa completa:

1. **Falha de isolamento confirmada** (o pior caso): considerar
   suspender a funcionalidade afetada imediatamente — ver
   `docs/pilot-plan.md`, "Suspender a IA sem derrubar a base" para o
   procedimento equivalente aplicado à IA; para uma falha de regras
   mais ampla, pode ser necessário reverter o último deploy de regras
   (ver abaixo) mesmo sem ainda saber a causa exata.
2. **Segredo exposto**: rodar imediatamente — ver
   `docs/runbooks/secret-rotation.md`.
3. **Conta especifica comprometida**: revogar sessões (Firebase Auth
   Console → Users → revoke refresh tokens do utilizador) e, se
   necessário, desativar a conta temporariamente.
4. **Abuso do gateway de IA**: os limites (`docs/security-hardening.md`)
   já contêm automaticamente; se insuficiente, reduzir temporariamente
   os valores em `functions/src/rateLimit.js` e fazer deploy urgente.

## 3. Reverter um deploy de regras (Firestore/Storage)

1. Firebase Console → Firestore/Storage → Regras → Histórico.
2. Identificar a última versão conhecida como segura (antes da
   alteração suspeita).
3. Publicar essa versão anterior diretamente a partir do histórico —
   não é preciso reconstruir a partir do git para uma reversão urgente.
4. Depois da urgência resolvida: sincronizar o repositório com o que
   ficou publicado (nunca deixar `firestore.rules` no git divergente do
   que está realmente em produção).

## 4. Investigação

1. `auditLog` é a fonte de verdade de "quem fez o quê, quando" — nunca
   o conteúdo em si (ver `docs/logging-policy.md`), mas suficiente para
   reconstruir uma sequência de ações.
2. Logs de execução das Cloud Functions (Cloud Logging) para erros
   técnicos não capturados pela auditoria.
3. Confirmar o âmbito exato: quantas famílias/crianças, que janela
   temporal, que dados especificamente.

## 5. Correção

1. Escrever um teste que reproduza a falha **antes** de a corrigir
   (mesmo padrão já seguido ao longo de todo o projeto — ver
   `docs/decisions.md`).
2. Corrigir, confirmar o teste novo a passar, correr a suíte completa
   (`npm test`, `npm run test:functions`, `npm run test:rules`).
3. Deploy da correção seguindo `docs/deploy-netlify.md`.

## 6. Depois do incidente

1. Atualizar `docs/threat-model.md` com o risco, se for uma categoria
   nova.
2. Registar o incidente formalmente (ver
   `docs/governance/incident-response-policy.md`, "Conteúdo mínimo do
   registo interno").
3. Se aplicável, avisar as famílias afetadas (ver a mesma política,
   "Comunicação às famílias afetadas").
4. Rever se o sinal que permitiu a deteção poderia ter sido mais
   rápido — acrescentar ao painel administrativo ou a um alerta, se
   fizer sentido.
