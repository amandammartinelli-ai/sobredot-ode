/**
 * Divide uma transcrição de fala livre em rascunhos de registo, um por
 * categoria detetada. É uma heurística de palavras-chave — não é um
 * modelo de linguagem (ver docs/vendors.md: não existe, nesta etapa,
 * nenhum fornecedor de IA real ligado ao sistema). Por isso nunca
 * "entende" a fala, só reconhece palavras conhecidas: erra mais do que
 * uma IA real, e a revisão humana antes de guardar (ver speakView.js)
 * não é opcional.
 *
 * Cada excerto sem nenhuma palavra-chave reconhecida cai em
 * "observations" — a categoria genérica já existente — em vez de ser
 * descartado. Nunca se perde parte do que foi dito.
 */

// Pontuação normal (quando a transcrição do navegador a inclui) ou
// palavras de sequência ditas ao narrar o dia ("depois", "mais tarde")
// — o reconhecimento de voz raramente pontua sozinho.
const SEGMENT_SPLIT_PATTERN = /[.!?\n]+|\s+(?:depois|mais tarde|de seguida|entretanto)\s+/i;

const CATEGORY_KEYWORD_PATTERNS = [
  { categoryId: 'sleep', pattern: /dorm|\bsono\b|acord|\bsesta\b|\bcama\b|soneca/i },
  { categoryId: 'medication', pattern: /medicament|rem[ée]dio|\bdose\b|comprimido|xarope|\bgotas?\b/i },
  { categoryId: 'food', pattern: /com(eu|ida)|almo[çc]|jantar|lanch|apetite|\bfome\b|mamad(eira)?/i },
  { categoryId: 'school', pattern: /\bescola\b|\baula\b|professor|colega|recreio/i },
  { categoryId: 'communication', pattern: /falou|palavra|gestos?\b|apontou|comunicou|pediu/i },
  { categoryId: 'sensory', pattern: /barulho|ru[íi]do|textura|\bluz\b|ouvidos|sens[íi]vel|cheiro/i },
  { categoryId: 'achievements', pattern: /conseguiu|aprendeu|primeira vez|conquist/i },
  { categoryId: 'behaviors', pattern: /birra|gritou|bateu|mordeu|comportamento|regul|acalmou/i },
  { categoryId: 'emotions', pattern: /chorou|\briu\b|sorriu|feliz|triste|emo[çc][ãa]o|ansios|assustad/i },
];

const HIGH_INTENSITY_PATTERN = /\bmuito\b|\bbastante\b|\bextrema|\bfort(e|íssim)|\bimenso\b/i;
const LOW_INTENSITY_PATTERN = /\bpouco\b|\blevemente\b|\bligeir/i;

/**
 * Encontra, num excerto, todos os pontos onde começa uma palavra-chave
 * de categoria diferente da anterior — ex.: "acordou" (sono) ... "comeu"
 * (alimentação). Ditado por voz raramente tem pausas ou pontuação a
 * separar assuntos ("acordou bem disposto comeu pouco e brincou
 * bastante" sai tudo numa frase só), por isso a única pista fiável de
 * que mudou de assunto é aparecer uma palavra de outra categoria
 * conhecida.
 */
function findCategoryBoundaries(segment) {
  const matches = [];
  CATEGORY_KEYWORD_PATTERNS.forEach(({ categoryId, pattern }) => {
    const globalPattern = new RegExp(pattern.source, 'gi');
    let match = globalPattern.exec(segment);
    while (match !== null) {
      matches.push({ index: match.index, categoryId });
      match = globalPattern.exec(segment);
    }
  });
  matches.sort((a, b) => a.index - b.index);
  return matches.filter((match, i) => i === 0 || match.categoryId !== matches[i - 1].categoryId);
}

/**
 * Corta um excerto sempre que muda a categoria detetada. O texto antes
 * da primeira palavra-chave fica preso ao primeiro excerto (ex.: "Hoje
 * meu filho" antes de "acordou"); o texto depois da última fica preso
 * ao último — não há como saber, só por palavras-chave, onde um assunto
 * sem palavra reconhecida (ex.: "brincou bastante") deveria começar um
 * excerto à parte. É por isto que a revisão antes de guardar continua
 * essencial, não um detalhe.
 */
function splitByCategoryBoundaries(segment) {
  const boundaries = findCategoryBoundaries(segment);
  if (boundaries.length <= 1) return [segment];

  return boundaries
    .map((boundary, i) => {
      const start = i === 0 ? 0 : boundary.index;
      const end = i + 1 < boundaries.length ? boundaries[i + 1].index : segment.length;
      return segment.slice(start, end).trim();
    })
    .filter((piece) => piece.length > 0);
}

function splitIntoSegments(transcript) {
  return String(transcript || '')
    .split(SEGMENT_SPLIT_PATTERN)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .flatMap(splitByCategoryBoundaries);
}

function guessCategoryId(segment) {
  const match = CATEGORY_KEYWORD_PATTERNS.find(({ pattern }) => pattern.test(segment));
  return match ? match.categoryId : 'observations';
}

function guessIntensity(segment) {
  if (HIGH_INTENSITY_PATTERN.test(segment)) return 'high';
  if (LOW_INTENSITY_PATTERN.test(segment)) return 'low';
  return 'medium';
}

/**
 * @param {string} transcript
 * @returns {Array<{categoryId: string, intensity: string, notes: string}>}
 */
export function extractRecordDraftsFromTranscript(transcript) {
  return splitIntoSegments(transcript).map((notes) => ({
    categoryId: guessCategoryId(notes),
    intensity: guessIntensity(notes),
    notes,
  }));
}
