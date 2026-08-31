/**
 * Cofre de Documentos — camada de cliente. A criação do registo inicial é
 * uma escrita direta ao Firestore (permitida pelas regras: estado
 * "selected"); o envio do ficheiro em si passa sempre por uma URL
 * assinada pedida a uma Cloud Function (ver functions/src/documents.js e
 * storage.rules — o cliente nunca escreve diretamente no bucket).
 */
import { httpsCallable } from 'firebase/functions';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, functions } from '../firebase/app.js';
import { getCurrentUser } from './authService.js';

const getDocumentUploadUrlFn = httpsCallable(functions, 'getDocumentUploadUrl');
const getDocumentDownloadUrlFn = httpsCallable(functions, 'getDocumentDownloadUrl');
const approveDocumentFn = httpsCallable(functions, 'approveDocument');
const rejectDocumentFn = httpsCallable(functions, 'rejectDocument');

export async function listDocuments(childId) {
  const snap = await getDocs(
    query(collection(db, `children/${childId}/documents`), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribeDocument(childId, documentId, callback) {
  return onSnapshot(doc(db, `children/${childId}/documents/${documentId}`), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function getDocumentMeta(childId, documentId) {
  const snap = await getDoc(doc(db, `children/${childId}/documents/${documentId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listExtractionItems(childId, documentId) {
  const snap = await getDocs(collection(db, `children/${childId}/documents/${documentId}/extractionItems`));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listVersions(childId, documentId) {
  const snap = await getDocs(
    query(collection(db, `children/${childId}/documents/${documentId}/versions`), orderBy('version', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Cria o registo de metadados ("selected") — apenas os dados necessários,
 * nunca o ficheiro em si.
 */
export async function createDocumentRecord(childId, familyId, { docType, issuer, specialty, docDate, origin }) {
  const uid = getCurrentUser().uid;
  const docRef = await addDoc(collection(db, `children/${childId}/documents`), {
    childId,
    familyId,
    docType,
    issuer: issuer || null,
    specialty: specialty || null,
    docDate: docDate || null,
    origin,
    status: 'selected',
    currentVersion: 0,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    deletedAt: null,
  });
  return docRef.id;
}

/**
 * Envia o ficheiro: pede uma URL assinada de upload à Cloud Function e faz
 * o PUT diretamente para o Storage. O progresso é aproximado (fetch não
 * expõe progresso de upload nativamente); para progresso real seria
 * necessário XMLHttpRequest — ver docs/roadmap.md.
 */
export async function uploadDocumentFile(childId, documentId, file) {
  const { data } = await getDocumentUploadUrlFn({
    childId,
    documentId,
    mimeType: file.type,
    byteSize: file.size,
  });

  const response = await fetch(data.url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar o ficheiro (HTTP ${response.status}).`);
  }

  return { version: data.version };
}

export async function requestSoftDelete(childId, documentId) {
  await updateDoc(doc(db, `children/${childId}/documents/${documentId}`), {
    deletedAt: serverTimestamp(),
  });
}

export async function reviewExtractionItem(childId, documentId, itemId, { reviewStatus, value }) {
  const uid = getCurrentUser().uid;
  const itemRef = doc(db, `children/${childId}/documents/${documentId}/extractionItems/${itemId}`);
  const current = await getDoc(itemRef);
  if (!current.exists()) throw new Error('Item de extração não encontrado.');

  await updateDoc(itemRef, {
    category: current.data().category,
    page: current.data().page,
    excerpt: current.data().excerpt,
    confidence: current.data().confidence,
    sourceVersionId: current.data().sourceVersionId,
    reviewStatus,
    value: value !== undefined ? value : current.data().value,
    reviewedBy: uid,
    reviewedAt: serverTimestamp(),
  });
}

export async function approveDocument(childId, documentId) {
  await approveDocumentFn({ childId, documentId });
}

export async function rejectDocument(childId, documentId, reason) {
  await rejectDocumentFn({ childId, documentId, reason });
}

export async function getDocumentDownloadUrl(childId, documentId, version) {
  const { data } = await getDocumentDownloadUrlFn({ childId, documentId, version });
  return data.url;
}
