/**
 * Inteligência Integrada (Etapa 4) — leitura de insights já calculados
 * pelo servidor e invocação das duas únicas Cloud Functions que os
 * geram/alteram (ver functions/src/insights.js). O cliente NUNCA calcula
 * nem edita `evidence`/`factualObservation` — só lê o que já foi
 * persistido e pode mudar o `status` através de `setInsightStatus`.
 */
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db, functions } from '../firebase/app.js';

const generateInsightsFn = httpsCallable(functions, 'generateInsights');
const setInsightStatusFn = httpsCallable(functions, 'setInsightStatus');

export function getLocalTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function generateInsights(childId, periodKey, customRange) {
  const { data } = await generateInsightsFn({
    childId,
    periodKey,
    customRange,
    timeZone: getLocalTimeZone(),
  });
  return data;
}

export async function setInsightStatus(childId, insightId, status, comment) {
  await setInsightStatusFn({ childId, insightId, status, comment: comment || null });
}

/** Devolve só o insight mais recente de cada patternType (evita repetir gerações antigas). */
export async function listLatestInsights(childId) {
  const snap = await getDocs(
    query(
      collection(db, `children/${childId}/insights`),
      where('deletedAt', '==', null),
      orderBy('generatedAt', 'desc')
    )
  );
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const latestByType = new Map();
  all.forEach((insight) => {
    if (!latestByType.has(insight.patternType)) {
      latestByType.set(insight.patternType, insight);
    }
  });
  return [...latestByType.values()];
}

export async function listInsightStatusHistory(childId, insightId) {
  const snap = await getDocs(
    query(collection(db, `children/${childId}/insights/${insightId}/statusHistory`), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function insightRef(childId, insightId) {
  return doc(db, `children/${childId}/insights/${insightId}`);
}
