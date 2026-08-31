/**
 * Leitura do registo de auditoria — nunca escrita (ver firestore.rules e
 * functions/src/audit.js). Só o proprietário da família vê os eventos da
 * sua própria família.
 */
import { collection, getDocs, limit as fsLimit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/app.js';

export async function listFamilyAuditEvents(familyId, max = 50) {
  const q = query(
    collection(db, 'auditLog'),
    where('familyId', '==', familyId),
    orderBy('createdAt', 'desc'),
    fsLimit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
