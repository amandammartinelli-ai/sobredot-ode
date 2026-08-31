/**
 * Consentimentos — ao nível da família (ex.: termos de utilização) e ao
 * nível da criança (ex.: partilha com a escola). Só o proprietário da
 * família pode registar/atualizar consentimentos (ver firestore.rules).
 */
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/app.js';
import { getCurrentUser } from './authService.js';

export async function listFamilyConsents(familyId) {
  const snap = await getDocs(query(collection(db, `families/${familyId}/consents`), orderBy('grantedAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listChildConsents(childId) {
  const snap = await getDocs(query(collection(db, `children/${childId}/consents`), orderBy('grantedAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function grantFamilyConsent(familyId, { type, description }) {
  const uid = getCurrentUser().uid;
  await addDoc(collection(db, `families/${familyId}/consents`), {
    familyId,
    type,
    description: description || null,
    grantedBy: uid,
    grantedAt: serverTimestamp(),
    revokedAt: null,
  });
}

export async function grantChildConsent(childId, { type, description }) {
  const uid = getCurrentUser().uid;
  await addDoc(collection(db, `children/${childId}/consents`), {
    childId,
    type,
    description: description || null,
    grantedBy: uid,
    grantedAt: serverTimestamp(),
    revokedAt: null,
  });
}

export async function revokeChildConsent(childId, consentId) {
  await updateDoc(doc(db, `children/${childId}/consents/${consentId}`), {
    revokedAt: serverTimestamp(),
  });
}
