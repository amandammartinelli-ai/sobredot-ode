/**
 * Família — criação, membros e convites. As mutações estruturais passam
 * sempre por Cloud Functions (ver functions/src/family.js); este módulo
 * só lê diretamente do Firestore e invoca essas funções.
 */
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore';
import { db, functions } from '../firebase/app.js';
import { getCurrentUser } from './authService.js';
import { readJSON, writeJSON } from './storageService.js';

const FAMILY_ID_KEY = 'familyId';

const createFamilyFn = httpsCallable(functions, 'createFamily');
const inviteFamilyMemberFn = httpsCallable(functions, 'inviteFamilyMember');
const acceptFamilyInviteFn = httpsCallable(functions, 'acceptFamilyInvite');
const removeFamilyMemberFn = httpsCallable(functions, 'removeFamilyMember');

export function getKnownFamilyId() {
  return readJSON(FAMILY_ID_KEY, null);
}

function rememberFamilyId(familyId) {
  writeJSON(FAMILY_ID_KEY, familyId);
}

/**
 * Descobre a família do utilizador autenticado. Guarda o resultado
 * localmente (só como cache de conveniência para a navegação — nunca
 * usado para decidir permissões, que dependem sempre das regras do
 * servidor).
 */
/**
 * Não existe, por desenho, uma forma de "listar as minhas famílias" a
 * partir do cliente (ver firestore.rules: `families` não permite list
 * sem filtro que as regras possam validar). Em vez disso, o próprio
 * perfil do utilizador (users/{uid}.familyId) guarda esse ponteiro — só
 * escrito pelo servidor (createFamily/acceptFamilyInvite), nunca pelo
 * cliente (ver firestore.rules). A cache local é só uma otimização para
 * evitar uma leitura extra em navegações dentro da mesma sessão.
 */
export async function findMyFamilyId() {
  const cached = getKnownFamilyId();
  if (cached) {
    const memberSnap = await getDoc(doc(db, `families/${cached}/members/${getCurrentUser().uid}`));
    if (memberSnap.exists()) return cached;
  }

  const userSnap = await getDoc(doc(db, `users/${getCurrentUser().uid}`));
  const familyId = userSnap.exists() ? userSnap.data().familyId : null;
  if (familyId) rememberFamilyId(familyId);
  return familyId || null;
}

export async function createFamily(name) {
  const result = await createFamilyFn({ name });
  const { familyId } = result.data;
  rememberFamilyId(familyId);
  return familyId;
}

export async function getFamily(familyId) {
  const snap = await getDoc(doc(db, `families/${familyId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeFamilyMembers(familyId, callback) {
  return onSnapshot(collection(db, `families/${familyId}/members`), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function listPendingInvites(familyId) {
  const snap = await getDocs(collection(db, `families/${familyId}/invites`));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((invite) => invite.status === 'pending');
}

export async function inviteFamilyMember(familyId, email) {
  const result = await inviteFamilyMemberFn({ familyId, email });
  return result.data; // { inviteId, token, expiresAt }
}

export async function acceptFamilyInvite({ familyId, inviteId, token }) {
  const result = await acceptFamilyInviteFn({ familyId, inviteId, token });
  rememberFamilyId(result.data.familyId);
  return result.data.familyId;
}

export async function removeFamilyMember(familyId, memberUid) {
  await removeFamilyMemberFn({ familyId, memberUid });
}

export function setKnownFamilyId(familyId) {
  rememberFamilyId(familyId);
}
