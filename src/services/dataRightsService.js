/**
 * Direitos da família sobre os seus dados (Etapa 5): exportação
 * estruturada, restrição de processamento de IA por criança, e pedido/
 * cancelamento de eliminação da família. Ver
 * functions/src/dataRights.js e docs/data-map.md.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/app.js';

const exportFamilyDataFn = httpsCallable(functions, 'exportFamilyData');
const setChildProcessingRestrictionFn = httpsCallable(functions, 'setChildProcessingRestriction');
const requestFamilyDeletionFn = httpsCallable(functions, 'requestFamilyDeletion');
const cancelFamilyDeletionFn = httpsCallable(functions, 'cancelFamilyDeletion');

/** Pede a exportação e desencadeia o download como um ficheiro .json local. */
export async function exportAndDownloadFamilyData(familyId) {
  const { data } = await exportFamilyDataFn({ familyId });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sobredot-exportacao-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function setChildProcessingRestriction(childId, restricted) {
  await setChildProcessingRestrictionFn({ childId, restricted });
}

export async function requestFamilyDeletion(familyId, confirmationText, reason) {
  const { data } = await requestFamilyDeletionFn({ familyId, confirmationText, reason });
  return data;
}

export async function cancelFamilyDeletion(familyId) {
  await cancelFamilyDeletionFn({ familyId });
}
