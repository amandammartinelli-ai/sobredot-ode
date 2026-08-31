/**
 * Serviço de registos — combina os registos fictícios "de fábrica"
 * (src/data/mock/records.js) com os registos criados localmente durante a
 * demonstração (guardados em localStorage). Nada disto é enviado para
 * nenhum servidor nesta etapa.
 */
import { mockSeedRecords } from '../data/mock/records.js';
import { readJSON, writeJSON } from './storageService.js';

const LOCAL_RECORDS_KEY = 'localRecords';

function getLocalRecords() {
  return readJSON(LOCAL_RECORDS_KEY, []);
}

function saveLocalRecords(records) {
  writeJSON(LOCAL_RECORDS_KEY, records);
}

export function listRecordsForChild(childId) {
  const combined = [...mockSeedRecords, ...getLocalRecords()].filter(
    (record) => record.childId === childId
  );
  return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getLatestRecordByCategory(childId, categoryId) {
  return listRecordsForChild(childId).find((record) => record.categoryId === categoryId) || null;
}

/**
 * Cria um novo registo local (rascunho de demonstração). Devolve o registo
 * criado, já com identificador e data atribuídos.
 */
export function createLocalRecord({ childId, categoryId, summary, intensity }) {
  const record = {
    id: `local-${Date.now()}`,
    childId,
    categoryId,
    summary: summary?.trim() || '',
    intensity: intensity || 'low',
    createdAt: new Date().toISOString(),
    local: true,
  };

  const records = getLocalRecords();
  records.push(record);
  saveLocalRecords(records);

  return record;
}

export function countRecordsForChild(childId) {
  return listRecordsForChild(childId).length;
}
