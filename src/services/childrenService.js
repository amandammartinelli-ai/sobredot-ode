/**
 * Serviço de crianças — nesta etapa serve exclusivamente dados fictícios
 * a partir de src/data/mock/children.js, com a criança selecionada guardada
 * localmente para persistir entre navegações e recarregamentos.
 */
import { mockChildren, getMockChildById } from '../data/mock/children.js';
import { readJSON, writeJSON } from './storageService.js';

const SELECTED_CHILD_KEY = 'selectedChildId';

export function listChildren() {
  return mockChildren;
}

export function getSelectedChildId() {
  return readJSON(SELECTED_CHILD_KEY, mockChildren[0].id);
}

export function getSelectedChild() {
  return getMockChildById(getSelectedChildId());
}

export function setSelectedChildId(childId) {
  writeJSON(SELECTED_CHILD_KEY, childId);
}
