/**
 * Relatórios e partilha controlada (Etapa 4). Todo o conteúdo é montado
 * no servidor (ver functions/src/reports.js) — o cliente só escolhe
 * módulos/documentos/período e mostra o que recebe de volta.
 */
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db, functions } from '../firebase/app.js';
import { getLocalTimeZone } from './insightsService.js';

const generateReportFn = httpsCallable(functions, 'generateReport');
const createReportShareLinkFn = httpsCallable(functions, 'createReportShareLink');
const revokeReportShareLinkFn = httpsCallable(functions, 'revokeReportShareLink');
const getSharedReportFn = httpsCallable(functions, 'getSharedReport');

export async function generateReport(childId, { periodKey, customRange, modules, documentIds }) {
  const { data } = await generateReportFn({
    childId,
    periodKey,
    customRange,
    modules,
    documentIds,
    timeZone: getLocalTimeZone(),
  });
  return data;
}

export async function createReportShareLink(childId, { periodKey, customRange, modules, documentIds, expiresInHours }) {
  const { data } = await createReportShareLinkFn({
    childId,
    periodKey,
    customRange,
    modules,
    documentIds,
    expiresInHours,
    timeZone: getLocalTimeZone(),
  });
  return data;
}

export async function revokeReportShareLink(childId, shareId) {
  await revokeReportShareLinkFn({ childId, shareId });
}

export async function getSharedReport(childId, shareId, token) {
  const { data } = await getSharedReportFn({ childId, shareId, token });
  return data;
}

export async function listReportShares(childId) {
  const snap = await getDocs(query(collection(db, `children/${childId}/reportShares`), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
