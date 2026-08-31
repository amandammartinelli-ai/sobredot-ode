/**
 * Registos quotidianos — CRUD estruturado sobre children/{childId}/records
 * (ver docs/data-model.md). Edição incrementa a versão e grava um
 * instantâneo do estado anterior em .../history (imutável, ver
 * firestore.rules).
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/app.js';
import { getCurrentUser } from './authService.js';

function toTimestamp(dateLike) {
  return dateLike instanceof Date ? Timestamp.fromDate(dateLike) : dateLike;
}

/**
 * Lista registos de uma criança, com filtros opcionais. Um colaborador
 * com âmbito restrito a certas categorias TEM de filtrar por categoria
 * (ver firestore.rules: uma consulta sem esse filtro é recusada por
 * inteiro para quem não é membro da família — por desenho, não por
 * omissão de resultados).
 */
export async function listRecords(childId, { categoryId, authorUid, source, sinceDate, untilDate, max = 100 } = {}) {
  const constraints = [where('deletedAt', '==', null)];

  if (categoryId) constraints.push(where('categoryId', '==', categoryId));
  if (authorUid) constraints.push(where('createdBy', '==', authorUid));
  if (source) constraints.push(where('source', '==', source));
  if (sinceDate) constraints.push(where('occurredAt', '>=', toTimestamp(sinceDate)));
  if (untilDate) constraints.push(where('occurredAt', '<=', toTimestamp(untilDate)));

  constraints.push(orderBy('occurredAt', 'desc'));
  constraints.push(fsLimit(max));

  const q = query(collection(db, `children/${childId}/records`), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getLatestRecordByCategory(childId, categoryId) {
  const records = await listRecords(childId, { categoryId, max: 1 });
  return records[0] || null;
}

export async function getRecord(childId, recordId) {
  const snap = await getDoc(doc(db, `children/${childId}/records/${recordId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Campos comuns a todas as categorias, ver docs/data-model.md: onde
 * estava, com quem, o que aconteceu antes, emoção, intensidade, duração,
 * comportamento observado, como se regulou, quem ajudou, resultado,
 * notas, data/hora, fonte — mais `details`, específico da categoria.
 */
export async function createRecord(childId, familyId, fields) {
  const uid = getCurrentUser().uid;
  const docRef = await addDoc(collection(db, `children/${childId}/records`), {
    childId,
    familyId,
    categoryId: fields.categoryId,
    where: fields.where || null,
    withWhom: fields.withWhom || null,
    antecedent: fields.antecedent || null,
    emotion: fields.emotion || null,
    intensity: fields.intensity || null,
    duration: fields.duration ?? null,
    behavior: fields.behavior || null,
    regulation: fields.regulation || null,
    helper: fields.helper || null,
    outcome: fields.outcome || null,
    notes: fields.notes || null,
    details: fields.details || {},
    occurredAt: toTimestamp(fields.occurredAt || new Date()),
    source: fields.source || 'family',
    createdBy: uid,
    updatedBy: uid,
    version: 1,
    deletedAt: null,
  });
  return docRef.id;
}

export async function updateRecord(childId, recordId, fields) {
  const uid = getCurrentUser().uid;
  const recordRef = doc(db, `children/${childId}/records/${recordId}`);
  const current = await getDoc(recordRef);
  if (!current.exists()) throw new Error('Registo não encontrado.');

  // Grava o estado anterior no histórico ANTES de sobrescrever.
  await addDoc(collection(db, `children/${childId}/records/${recordId}/history`), {
    ...current.data(),
    editedBy: uid,
    editedAt: serverTimestamp(),
  });

  await updateDoc(recordRef, {
    ...fields,
    occurredAt: fields.occurredAt ? toTimestamp(fields.occurredAt) : current.data().occurredAt,
    updatedBy: uid,
    version: (current.data().version || 1) + 1,
  });
}

export async function softDeleteRecord(childId, recordId) {
  await updateRecord(childId, recordId, { deletedAt: serverTimestamp() });
}

export async function listRecordHistory(childId, recordId) {
  const snap = await getDocs(
    query(collection(db, `children/${childId}/records/${recordId}/history`), orderBy('editedAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
