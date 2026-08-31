/**
 * Autenticação real via Firebase Authentication (e-mail/palavra-passe).
 *
 * Login social fica preparado mas não ativado nesta etapa (ver
 * docs/firebase-setup.md, "Autenticação").
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/app.js';
import { clearAllSobredotData } from './storageService.js';

const logLoginEventFn = httpsCallable(functions, 'logLoginEvent');

let currentUser = null;
let authReadyResolve;
const authReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});
const listeners = new Set();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authReadyResolve();
  listeners.forEach((listener) => listener(user));
});

/**
 * Resolve assim que o Firebase Auth determinar, pela primeira vez, se há
 * ou não uma sessão persistida. O router espera por isto antes de decidir
 * a rota inicial — sem isto, um recarregamento de página redirecionaria
 * sempre para o login por breves instantes, mesmo com sessão válida.
 */
export function waitForAuthReady() {
  return authReady;
}

/**
 * Regista um ouvinte de mudança de sessão. Devolve uma função para
 * cancelar a subscrição. Chama o ouvinte imediatamente com o estado
 * atual, mesmo que ainda não tenha sido determinado pelo Firebase.
 */
export function onAuthChange(listener) {
  listeners.add(listener);
  listener(currentUser);
  return () => listeners.delete(listener);
}

export function getCurrentUser() {
  return currentUser;
}

export function isAuthenticated() {
  return currentUser !== null;
}

export function isEmailVerified() {
  return Boolean(currentUser?.emailVerified);
}

/**
 * Só para decidir o que MOSTRAR (esconder o painel administrativo de
 * quem não é administrador) — nunca a fronteira de segurança real, que
 * é sempre `context.auth.token.admin` do lado do servidor
 * (`functions/src/util.js`, `requireAdmin`) e `isAdmin()` nas regras do
 * Firestore. Um utilizador que force a rota sem ser administrador só
 * veria um painel vazio: todos os pedidos ao servidor seriam recusados.
 */
export async function isAdmin() {
  if (!currentUser) return false;
  const result = await currentUser.getIdTokenResult();
  return result.claims.admin === true;
}

export async function signUp({ email, password, displayName }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  await setDoc(
    doc(db, `users/${credential.user.uid}`),
    {
      uid: credential.user.uid,
      displayName: displayName || null,
      email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await sendEmailVerification(credential.user);
  return credential.user;
}

export async function signIn({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  // Telemetria "melhor esforço" para o histórico de atividade (Etapa 5)
  // — nunca bloqueia o login se falhar (ex.: sem rede num instante).
  logLoginEventFn().catch(() => {});
  return credential.user;
}

export async function signOutUser() {
  await signOut(auth);
  // Não há service worker nem cache de disco do Firestore nesta aplicação
  // (ver docs/security-hardening.md, "Cache seguro"), mas o localStorage
  // (família/criança selecionada, perguntas para a próxima consulta) fica
  // no dispositivo entre sessões do browser — num dispositivo partilhado
  // isso podia expor qual família/criança usou a aplicação, ou conteúdo
  // escrito pela família, a quem iniciasse sessão a seguir. Apaga-se tudo
  // no logout; volta a ser escrito normalmente na sessão seguinte.
  clearAllSobredotData();
}

export async function resendVerificationEmail() {
  if (!currentUser) return;
  await sendEmailVerification(currentUser);
}

export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}
