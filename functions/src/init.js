/**
 * Inicialização do Admin SDK — sempre via API modular
 * (`firebase-admin/app`, `/firestore`, `/auth`, `/storage`), nunca pelo
 * pacote "namespace" `require('firebase-admin')`.
 *
 * Descoberto durante a Etapa 5: a partir da v14, `require('firebase-admin')`
 * deixou de reexportar `.firestore`/`.auth`/`.storage`/`.apps` — só os
 * métodos de `firebase-admin/app` (`initializeApp`, `getApps`, ...). Isto
 * já tinha obrigado o script de seed a usar imports modulares (ver
 * docs/decisions.md, decisão 15); esta etapa estende a mesma correção a
 * este ficheiro, partilhado por todas as Cloud Functions.
 */
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

// Timestamp/FieldValue são reexportados daqui (em vez de cada ficheiro
// importar 'firebase-admin/firestore' diretamente) para garantir que
// testes fora de functions/ (ex.: tests/rules/*.js, que resolvem
// módulos Node a partir da raiz do repositório) usam exatamente a MESMA
// cópia da classe Timestamp que `db` — caso contrário
// `db.doc(...).set({...})` recusa o valor com "Detected an object of
// type Timestamp that doesn't match the expected instance", porque
// functions/ tem o seu próprio node_modules/firebase-admin, distinto do
// da raiz do projeto.
module.exports = { db, auth, storage, Timestamp, FieldValue };
