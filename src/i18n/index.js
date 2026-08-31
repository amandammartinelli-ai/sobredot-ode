import pt from './pt.js';

const dictionaries = { pt };
const DEFAULT_LOCALE = 'pt';

let currentLocale = DEFAULT_LOCALE;

/**
 * Resolve uma chave aninhada, por exemplo "dashboard.cards.sleep.title".
 */
function resolve(dict, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dict);
}

/**
 * Traduz uma chave para o idioma atual. Se a chave não existir, devolve a
 * própria chave para nunca deixar a interface vazia (mais fácil de detetar
 * em revisão do que uma string em branco).
 */
export function t(key) {
  const dict = dictionaries[currentLocale] || dictionaries[DEFAULT_LOCALE];
  const value = resolve(dict, key);
  if (value === undefined) {
    return key;
  }
  return value;
}

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  if (dictionaries[locale]) {
    currentLocale = locale;
  }
}

export function getAvailableLocales() {
  return Object.keys(dictionaries);
}
