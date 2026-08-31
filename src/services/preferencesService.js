import { readJSON, writeJSON } from './storageService.js';

const REDUCED_MOTION_KEY = 'reducedMotion';

export function getReducedMotionPreference() {
  return readJSON(REDUCED_MOTION_KEY, false);
}

export function setReducedMotionPreference(enabled) {
  writeJSON(REDUCED_MOTION_KEY, enabled);
  applyReducedMotionPreference();
}

export function applyReducedMotionPreference() {
  document.documentElement.setAttribute('data-reduced-motion', String(getReducedMotionPreference()));
}
