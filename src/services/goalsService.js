/**
 * Metas acompanháveis — sempre uma declaração da família (mesmo quando
 * "importada" de um documento, é uma cópia que a família decide adotar,
 * nunca uma obrigação derivada automaticamente de uma recomendação). Por
 * isso o cliente escreve diretamente no Firestore (ver firestore.rules,
 * `goals`), à semelhança de `consents`/`tags`.
 */
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase/app.js';
import { getCurrentUser } from './authService.js';

export async function listGoals(childId) {
  const snap = await getDocs(
    query(collection(db, `children/${childId}/goals`), where('deletedAt', '==', null), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createGoal(childId, familyId, { title, description, origin, sourceDocumentId, sourceExtractionItemId, targetDate }) {
  const uid = getCurrentUser().uid;
  await addDoc(collection(db, `children/${childId}/goals`), {
    childId,
    familyId,
    title,
    description: description || null,
    origin: origin || 'family',
    sourceDocumentId: sourceDocumentId || null,
    sourceExtractionItemId: sourceExtractionItemId || null,
    targetDate: targetDate || null,
    status: 'active',
    createdBy: uid,
    updatedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });
}

export async function updateGoalStatus(childId, goalId, status) {
  const uid = getCurrentUser().uid;
  await updateDoc(doc(db, `children/${childId}/goals/${goalId}`), {
    status,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}

export async function softDeleteGoal(childId, goalId) {
  const uid = getCurrentUser().uid;
  await updateDoc(doc(db, `children/${childId}/goals/${goalId}`), {
    deletedAt: serverTimestamp(),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
