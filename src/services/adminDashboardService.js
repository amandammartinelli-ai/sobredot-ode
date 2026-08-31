/**
 * Painel administrativo operacional (Etapa 5) — ver docs/admin-dashboard.md.
 *
 * `getOperationalSummary` é uma Cloud Function (agregações contam
 * documentos no servidor — não fazia sentido, nem seria seguro, o
 * cliente listar tudo só para contar). `incidents` é uma coleção simples
 * (título/gravidade/estado), por isso o cliente lê/escreve diretamente
 * no Firestore, tal como `goals` — a validação real de "só um
 * administrador" está em `firestore.rules`.
 */
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/app.js';
import { getCurrentUser } from './authService.js';

const getOperationalSummaryFn = httpsCallable(functions, 'getOperationalSummary');

export async function getOperationalSummary() {
  const result = await getOperationalSummaryFn();
  return result.data;
}

export async function listIncidents() {
  const snap = await getDocs(query(collection(db, 'incidents'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createIncident({ title, severity }) {
  const uid = getCurrentUser().uid;
  await addDoc(collection(db, 'incidents'), {
    title,
    severity,
    status: 'open',
    createdBy: uid,
    createdAt: serverTimestamp(),
    resolvedAt: null,
  });
}

export async function resolveIncident(incidentId) {
  await updateDoc(doc(db, `incidents/${incidentId}`), {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
  });
}
