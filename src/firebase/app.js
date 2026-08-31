/**
 * Inicialização do Firebase no cliente.
 *
 * Liga-se aos emuladores locais sempre que `VITE_USE_EMULATORS=true` (o
 * valor por omissão em desenvolvimento — ver .env.example). Isto garante
 * que nunca se corre acidentalmente contra um projeto de produção durante
 * o desenvolvimento local.
 *
 * As chaves aqui presentes (getFirebaseConfig) são a configuração PÚBLICA
 * do Firebase Web — não são segredos (ver docs/threat-model.md). Nenhuma
 * chave de administração, de IA ou de qualquer serviço de terceiros pode
 * alguma vez aparecer neste ficheiro nem em qualquer outro código do
 * browser.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getFirebaseConfig } from '../config/firebase.config.js';
import { initAppCheck } from './appCheck.js';

function useEmulators() {
  return (import.meta.env.VITE_USE_EMULATORS ?? 'true') === 'true';
}

const app = initializeApp(getFirebaseConfig());

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// europe-west1 (Bélgica) — mesma região do Firestore, escolhida por
// residência de dados na UE. Ver docs/firebase-setup.md, "Região".
export const functions = getFunctions(app, 'europe-west1');

if (useEmulators()) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
} else {
  // App Check só é ativado fora dos emuladores: nos emuladores usamos
  // sempre o modo de depuração descrito em docs/firebase-setup.md.
  initAppCheck(app);
}

export default app;
