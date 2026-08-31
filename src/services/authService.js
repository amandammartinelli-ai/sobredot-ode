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
import { auth, db } from '../firebase/app.js';

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
  return credential.user;
}

export async function signOutUser() {
  await signOut(auth);
}

export async function resendVerificationEmail() {
  if (!currentUser) return;
  await sendEmailVerification(currentUser);
}

export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}
