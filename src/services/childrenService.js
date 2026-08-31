/**
 * Crianças — criação, edição e listagem, sempre filtradas pela família do
 * utilizador (ver firestore.rules). A criança selecionada é uma
 * preferência de interface guardada localmente, nunca uma decisão de
 * acesso.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/app.js';
import { getCurrentUser } from './authService.js';
import { readJSON, writeJSON } from './storageService.js';

const SELECTED_CHILD_KEY = 'selectedChildId';

export async function listChildrenForFamily(familyId) {
  const q = query(
    collection(db, 'children'),
    where('familyId', '==', familyId),
    where('deletedAt', '==', null)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getChild(childId) {
  const snap = await getDoc(doc(db, `children/${childId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createChild(familyId, { name, birthDate, relationshipOrigin }) {
  const uid = getCurrentUser().uid;
  const docRef = await addDoc(collection(db, 'children'), {
    familyId,
    name: name.trim(),
    birthDate: birthDate || null,
    relationshipOrigin,
    createdBy: uid,
    updatedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });
  return docRef.id;
}

export async function updateChild(childId, { name, birthDate, relationshipOrigin }) {
  const uid = getCurrentUser().uid;
  await updateDoc(doc(db, `children/${childId}`), {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(birthDate !== undefined ? { birthDate } : {}),
    ...(relationshipOrigin !== undefined ? { relationshipOrigin } : {}),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}

export async function softDeleteChild(childId) {
  const uid = getCurrentUser().uid;
  await updateDoc(doc(db, `children/${childId}`), {
    deletedAt: serverTimestamp(),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}

export function getSelectedChildId() {
  return readJSON(SELECTED_CHILD_KEY, null);
}

export function setSelectedChildId(childId) {
  writeJSON(SELECTED_CHILD_KEY, childId);
}
