/**
 * Builder de Cloud Functions fixado na região europe-west1 (Bélgica) — a
 * mesma região do Firestore, escolhida por residência de dados na UE (ver
 * docs/firebase-setup.md, "Região"). Todas as funções da Sobredot devem
 * usar `regionalFunctions` (nunca `require('firebase-functions/v1')`
 * diretamente) para que nenhuma acabe, por esquecimento, na região
 * por omissão (us-central1).
 *
 * `HttpsError` é exportado à parte porque `regionalFunctions.https` cria
 * um objeto novo a cada acesso (não é seguro guardar uma referência
 * mutável a partir dele).
 */
const functionsV1 = require('firebase-functions/v1');

const REGION = 'europe-west1';

const regionalFunctions = functionsV1.region(REGION);
const { HttpsError } = functionsV1.https;

module.exports = { regionalFunctions, HttpsError, REGION };
