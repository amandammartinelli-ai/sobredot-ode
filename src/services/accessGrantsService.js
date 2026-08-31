/**
 * Concessões de acesso (escola/profissional). Toda a mutação passa por
 * Cloud Functions (ver functions/src/access.js); este módulo só lê do
 * Firestore e invoca essas funções.
 */
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db, functions } from '../firebase/app.js';

const createAccessGrantFn = httpsCallable(functions, 'createAccessGrant');
const acceptAccessGrantFn = httpsCallable(functions, 'acceptAccessGrant');
const revokeAccessGrantFn = httpsCallable(functions, 'revokeAccessGrant');

export async function listAccessGrants(childId) {
  const snap = await getDocs(query(collection(db, `children/${childId}/accessGrants`), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createAccessGrant(childId, { granteeEmail, role, capabilities, scopeCategories, expiresAtMillis }) {
  const result = await createAccessGrantFn({
    childId,
    granteeEmail,
    role,
    capabilities,
    scopeCategories,
    expiresAtMillis,
  });
  return result.data.grantId;
}

export async function acceptAccessGrant(childId, grantId) {
  await acceptAccessGrantFn({ childId, grantId });
}

export async function revokeAccessGrant(childId, grantId) {
  await revokeAccessGrantFn({ childId, grantId });
}

/**
 * Lê a própria entrada no índice de acesso "achatado" de uma criança —
 * usado pela vista do colaborador (escola/profissional) para saber que
 * capacidades/âmbito realmente tem, sem confiar em nada guardado
 * localmente (ver firestore.rules: só o próprio uid pode ler a sua
 * entrada, ou o proprietário da família).
 */
export async function getOwnAccessIndex(childId, uid) {
  const snap = await getDoc(doc(db, `children/${childId}/accessIndex/${uid}`));
  return snap.exists() ? snap.data() : null;
}

export function isGrantActive(grant) {
  if (!grant || grant.revokedAt) return false;
  const expiresAtMillis = grant.expiresAt?.toMillis ? grant.expiresAt.toMillis() : grant.expiresAt;
  return typeof expiresAtMillis === 'number' && expiresAtMillis > Date.now();
}
