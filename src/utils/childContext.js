import { getFamilyId } from '../state/appState.js';
import { listChildrenForFamily, getSelectedChildId, setSelectedChildId } from '../services/childrenService.js';

/**
 * Carrega as crianças da família atual e determina qual está selecionada.
 * Usado por todas as vistas que dependem de "a criança atual" (dashboard,
 * registo, linha do tempo, documentos). Nunca mistura dados entre
 * famílias: a consulta já filtra por familyId (ver childrenService).
 */
export async function loadChildContext() {
  const familyId = getFamilyId();
  const children = await listChildrenForFamily(familyId);

  let selectedId = getSelectedChildId();
  if (!selectedId || !children.some((child) => child.id === selectedId)) {
    selectedId = children[0]?.id || null;
    if (selectedId) setSelectedChildId(selectedId);
  }

  const selectedChild = children.find((child) => child.id === selectedId) || null;
  return { familyId, children, selectedChild };
}
