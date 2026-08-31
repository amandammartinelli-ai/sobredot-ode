# Runbook — deploy e rollback

Ver `docs/deploy-netlify.md`, "Rollback documentado", para a explicação
completa de cada mecanismo. Este runbook é a versão-checklist para usar
no momento.

## Deploy normal (frontend)

1. PR aberto contra `main` → CI corre automaticamente
   (`.github/workflows/ci.yml`) → deploy preview do Netlify gerado.
2. Rever o deploy preview visualmente antes de aprovar.
3. Fundir o PR → Netlify publica automaticamente em produção a partir
   de `main`.
4. Confirmar visualmente a produção (não só confiar no build verde).

## Deploy de regras/índices/Cloud Functions

**Nunca automático** (fora do CI) — ver `docs/ci-cd.md`, "O que fica
fora deste CI".

1. Confirmar `npm run test:rules` verde localmente com as alterações.
2. `firebase deploy --only firestore:rules,firestore:indexes` e/ou
   `firebase deploy --only functions`, conforme o que mudou.
3. Confirmar manualmente (ex.: uma ação real na aplicação de staging)
   que o comportamento esperado ocorre.
4. Um índice novo pode demorar a ficar "pronto" (build assíncrono do
   lado do Firestore) — consultas que dependam dele podem falhar
   temporariamente até lá; nunca fazer deploy de uma função que já
   depende de um índice novo antes de esse índice estar `READY` na
   consola.

## Rollback — frontend (Netlify)

1. Netlify → Deploys → encontrar o último deploy bom conhecido →
   "Publish deploy". Imediato, sem reconstrução.
2. Em paralelo: `git revert` do commit problemático em `main`, para que
   o próximo deploy automático não reintroduza o problema.

## Rollback — regras do Firestore/Storage

1. Firebase Console → Firestore/Storage → Regras → Histórico → escolher
   a versão anterior boa → publicar.
2. Sincronizar `firestore.rules`/`storage.rules` no repositório com o
   que ficou publicado.

## Rollback — Cloud Functions

1. `git revert` do commit que introduziu o problema.
2. `firebase deploy --only functions` com o código revertido.
3. Sem downtime esperado — o Cloud Functions mantém a versão anterior a
   servir pedidos em curso durante a substituição.

## Rollback — índices do Firestore

Remover a entrada de `firestore.indexes.json` e fazer deploy de novo
apaga o índice — sempre seguro. **Nunca remover um índice que uma
consulta em produção ainda dependa** sem confirmar primeiro (ver
`docs/admin-dashboard.md` e `docs/data-model.md` para o que depende de
cada índice existente).

## Depois de qualquer rollback

Seguir `docs/runbooks/incident-response.md`, secção 6 ("Depois do
incidente") se o rollback foi motivado por um problema de segurança ou
de dados — um rollback por si só não fecha o ciclo.
