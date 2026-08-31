/**
 * Envolve o localStorage com um espaço de nomes próprio e leitura/escrita
 * segura em JSON. É a única camada que toca diretamente no localStorage,
 * para que o resto da aplicação possa ser testado sem depender do browser.
 */
const NAMESPACE = 'sobredot';

function buildKey(key) {
  return `${NAMESPACE}:${key}`;
}

export function readJSON(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(buildKey(key));
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn(`[storageService] Falha ao ler "${key}":`, error);
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    window.localStorage.setItem(buildKey(key), JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[storageService] Falha ao escrever "${key}":`, error);
    return false;
  }
}

export function remove(key) {
  window.localStorage.removeItem(buildKey(key));
}

/**
 * Remove todos os dados guardados pela Sobredot neste dispositivo (usado em
 * "Apagar dados locais desta demonstração" no perfil).
 */
export function clearAllSobredotData() {
  const keysToRemove = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(`${NAMESPACE}:`)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}
