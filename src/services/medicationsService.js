/**
 * Medicamentos cadastrados de uma criança. Só a família tem acesso de
 * escrita; terceiros precisam do âmbito explícito "medication" mesmo só
 * para ler (ver firestore.rules).
 */
import { addDoc, collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/app.js';
import { getCurrentUser } from './authService.js';

export async function listMedications(childId) {
  const snap = await getDocs(collection(db, `children/${childId}/medications`));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createMedication(childId, { name, dose, schedule, prescribedBy }) {
  const uid = getCurrentUser().uid;
  const docRef = await addDoc(collection(db, `children/${childId}/medications`), {
    childId,
    name: name.trim(),
    dose: dose || null,
    schedule: schedule || null,
    prescribedBy: prescribedBy || null,
    active: true,
    createdBy: uid,
    updatedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateMedication(childId, medicationId, fields) {
  const uid = getCurrentUser().uid;
  await updateDoc(doc(db, `children/${childId}/medications/${medicationId}`), {
    ...fields,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}
