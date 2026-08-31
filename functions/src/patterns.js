/**
 * Motor de cruzamentos — padrões estatísticos descritivos entre
 * categorias de registo (e, nalguns casos, documentos aprovados).
 *
 * Regra central desta etapa: um padrão nunca afirma causa. Cada função
 * devolve uma "taxa de coocorrência" (com que frequência X e Y aparecem
 * juntos, nos dados desta criança, neste período) — nunca "X provoca Y".
 * A linguagem factual ("foi observado em conjunto") só é composta em
 * `insights.js`; aqui só existem números e a estrutura de evidência.
 *
 * Quando a amostra é pequena (< THRESHOLDS.MIN_SAMPLE_FOR_PATTERN),
 * `insufficientData` vem `true` e nenhuma inferência é feita — só a
 * contagem em si é devolvida.
 */
const { THRESHOLDS, toDate, dayKey, confidenceForSampleSize, filterActiveInPeriod } = require('./metrics');

/**
 * Taxa de coocorrência genérica, agrupada por dia (fuso horário
 * explícito): entre os dias em que `conditionFn` é verdadeiro para pelo
 * menos um registo desse dia, em quantos desses dias `outcomeFn` também é
 * verdadeiro para pelo menos um registo — comparado com a mesma taxa nos
 * dias em que a condição NÃO se verificou.
 */
function coOccurrenceByDay(records, { conditionFn, outcomeFn, timeZone }) {
  const byDay = new Map();
  records.forEach((record) => {
    const date = toDate(record.occurredAt);
    if (!date) return;
    const key = dayKey(date, timeZone);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(record);
  });

  const daysWithCondition = [];
  const daysWithoutCondition = [];
  byDay.forEach((dayRecords) => {
    const hasCondition = dayRecords.some(conditionFn);
    if (hasCondition) daysWithCondition.push(dayRecords);
    else daysWithoutCondition.push(dayRecords);
  });

  const outcomeCount = (days) => days.filter((dayRecords) => dayRecords.some(outcomeFn)).length;

  const withConditionOutcomeCount = outcomeCount(daysWithCondition);
  const withoutConditionOutcomeCount = outcomeCount(daysWithoutCondition);

  const sampleSize = daysWithCondition.length + daysWithoutCondition.length;

  return {
    sampleSize,
    daysWithCondition: daysWithCondition.length,
    daysWithoutCondition: daysWithoutCondition.length,
    rateWithCondition: daysWithCondition.length > 0 ? withConditionOutcomeCount / daysWithCondition.length : null,
    rateWithoutCondition: daysWithoutCondition.length > 0 ? withoutConditionOutcomeCount / daysWithoutCondition.length : null,
    insufficientData: sampleSize < THRESHOLDS.MIN_SAMPLE_FOR_PATTERN || daysWithCondition.length === 0,
    confidence: confidenceForSampleSize(sampleSize),
  };
}

const isHighIntensity = (r) => r.intensity === 'high';
const hasNightWakings = (r) => r.categoryId === 'sleep' && Number(r.details && r.details.nightWakings) > 0;
const hasLowSleepQuality = (r) =>
  r.categoryId === 'sleep' && typeof (r.details && r.details.sleepQuality) === 'string' &&
  /m[áa]|pouc|fraca|dif[íi]cil/i.test(r.details.sleepQuality);

function analyzeSleepVsIntensity(records, timeZone) {
  const co = coOccurrenceByDay(records, {
    conditionFn: (r) => hasNightWakings(r) || hasLowSleepQuality(r),
    outcomeFn: isHighIntensity,
    timeZone,
  });
  return {
    patternType: 'sleep_intensity',
    title: 'Sono e intensidade emocional',
    dataConsidered: { dimension: 'noites com despertares/qualidade de sono baixa vs. dias com intensidade alta' },
    ...co,
  };
}

const NOISE_KEYWORDS = /ru[íi]do|barulh|multid[ãa]o|festa|muita gente|ambiente cheio/i;
const hasNoisyContext = (r) =>
  (typeof r.where === 'string' && NOISE_KEYWORDS.test(r.where)) ||
  (typeof r.antecedent === 'string' && NOISE_KEYWORDS.test(r.antecedent)) ||
  (typeof r.notes === 'string' && NOISE_KEYWORDS.test(r.notes));

function analyzeEnvironmentVsDysregulation(records, timeZone) {
  const co = coOccurrenceByDay(records, {
    conditionFn: hasNoisyContext,
    outcomeFn: (r) => isHighIntensity(r) || (r.categoryId === 'behaviors' && r.behavior),
    timeZone,
  });
  return {
    patternType: 'environment_dysregulation',
    title: 'Ambientes/ruído e desregulação',
    dataConsidered: { dimension: 'dias com menção a ambiente ruidoso/cheio vs. dias com desregulação' },
    ...co,
  };
}

const hasFoodRefusal = (r) => r.categoryId === 'food' && Boolean(r.details && r.details.itemsRefused);
const hasLowWellbeing = (r) => isHighIntensity(r) || (r.categoryId === 'behaviors' && r.behavior);

function analyzeFoodHydrationVsWellbeing(records, timeZone) {
  const co = coOccurrenceByDay(records, {
    conditionFn: hasFoodRefusal,
    outcomeFn: hasLowWellbeing,
    timeZone,
  });
  return {
    patternType: 'food_wellbeing',
    title: 'Alimentação/hidratação e bem-estar',
    dataConsidered: { dimension: 'dias com recusa alimentar registada vs. dias com sinais de mal-estar' },
    ...co,
  };
}

const hasMedicationDose = (r) => r.categoryId === 'medication' && Boolean(r.details && r.details.doseGiven);
const hasSideEffect = (r) => r.categoryId === 'medication' && Boolean(r.details && r.details.sideEffects);

function analyzeMedicationVsEffects(records, timeZone) {
  const co = coOccurrenceByDay(records, {
    conditionFn: hasMedicationDose,
    outcomeFn: (r) => hasSideEffect(r) || isHighIntensity(r),
    timeZone,
  });
  return {
    patternType: 'medication_effects',
    title: 'Horários de medicação e efeitos registados',
    dataConsidered: { dimension: 'dias com dose registada como dada vs. dias com efeitos/intensidade alta' },
    ...co,
  };
}

const isSchoolEvent = (r) => r.categoryId === 'school';
function analyzeSchoolEventsVsEmotions(records, timeZone) {
  const co = coOccurrenceByDay(records, {
    conditionFn: isSchoolEvent,
    outcomeFn: isHighIntensity,
    timeZone,
  });
  return {
    patternType: 'school_emotions',
    title: 'Acontecimentos escolares e emoções',
    dataConsidered: { dimension: 'dias com registo escolar vs. dias com intensidade emocional alta' },
    ...co,
  };
}

const hasRegulationStrategy = (r) => Boolean(r.regulation);
const hasPositiveOutcome = (r) =>
  typeof r.outcome === 'string' && /consegui|acalm|melhor|resolv|regulou/i.test(r.outcome);

function analyzeStrategiesVsOutcomes(records, timeZone) {
  const co = coOccurrenceByDay(records, {
    conditionFn: hasRegulationStrategy,
    outcomeFn: hasPositiveOutcome,
    timeZone,
  });
  return {
    patternType: 'strategies_outcomes',
    title: 'Estratégias de regulação e resultados',
    dataConsidered: { dimension: 'dias com estratégia de regulação registada vs. dias com resultado descrito como positivo' },
    ...co,
  };
}

/**
 * Cruza recomendações/estratégias de documentos aprovados com observações
 * do quotidiano que mencionem palavras semelhantes — correspondência
 * simples por palavra-chave (não há NLP/embeddings nesta etapa, à
 * semelhança do gateway de IA — ver docs/decisions.md, decisão 17).
 */
function analyzeDocumentRecommendationsVsObservations(records, extractionItems) {
  const recommendations = (extractionItems || []).filter((item) =>
    ['recommendations', 'strategies'].includes(item.category) &&
    ['confirmed', 'edited'].includes(item.reviewStatus)
  );

  if (recommendations.length === 0) {
    return {
      patternType: 'document_recommendations',
      title: 'Recomendações documentais e observações quotidianas',
      dataConsidered: { dimension: 'recomendações/estratégias de documentos aprovados vs. registos que as mencionam' },
      sampleSize: 0,
      insufficientData: true,
      confidence: 'insufficient',
      matches: [],
    };
  }

  const matches = recommendations.map((item) => {
    const keywords = String(item.value || '')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 5)
      .slice(0, 8);
    const matchingRecords = records.filter((r) => {
      const haystack = `${r.regulation || ''} ${r.notes || ''} ${r.outcome || ''}`.toLowerCase();
      return keywords.some((kw) => haystack.includes(kw));
    });
    return {
      documentId: item.documentId,
      page: item.page,
      excerpt: item.excerpt,
      recommendationValue: item.value,
      matchingRecordCount: matchingRecords.length,
    };
  });

  const sampleSize = matches.reduce((acc, m) => acc + m.matchingRecordCount, 0);

  return {
    patternType: 'document_recommendations',
    title: 'Recomendações documentais e observações quotidianas',
    dataConsidered: { dimension: 'recomendações/estratégias de documentos aprovados vs. registos que as mencionam' },
    sampleSize,
    insufficientData: sampleSize < THRESHOLDS.MIN_SAMPLE_FOR_PATTERN,
    confidence: confidenceForSampleSize(sampleSize),
    matches,
  };
}

/**
 * Compara os itens estruturados de dois documentos (tipicamente duas
 * avaliações da mesma criança, em datas diferentes) por categoria e
 * texto normalizado — o que permaneceu, mudou, surgiu ou deixou de ser
 * mencionado. Nunca interpreta uma ausência como "resolvido" (ver
 * limitação obrigatória devolvida junto do resultado).
 */
function normalizeForComparison(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function compareAssessments(olderItems, newerItems) {
  const older = (olderItems || []).filter((i) => ['confirmed', 'edited'].includes(i.reviewStatus));
  const newer = (newerItems || []).filter((i) => ['confirmed', 'edited'].includes(i.reviewStatus));

  const olderByKey = new Map(older.map((i) => [`${i.category}::${normalizeForComparison(i.value)}`, i]));
  const newerByKey = new Map(newer.map((i) => [`${i.category}::${normalizeForComparison(i.value)}`, i]));

  const remained = [];
  const disappeared = [];
  const appeared = [];

  olderByKey.forEach((item, key) => {
    if (newerByKey.has(key)) remained.push(item);
    else disappeared.push(item);
  });
  newerByKey.forEach((item, key) => {
    if (!olderByKey.has(key)) appeared.push(item);
  });

  // "Mudou": mesma categoria, texto diferente — aproximação por categoria
  // (uma correspondência exata já conta como "permaneceu").
  const changedByCategory = new Map();
  disappeared.forEach((item) => {
    if (!changedByCategory.has(item.category)) changedByCategory.set(item.category, { before: [], after: [] });
    changedByCategory.get(item.category).before.push(item);
  });
  appeared.forEach((item) => {
    if (!changedByCategory.has(item.category)) changedByCategory.set(item.category, { before: [], after: [] });
    changedByCategory.get(item.category).after.push(item);
  });

  return {
    patternType: 'evolution',
    title: 'Evolução entre avaliações',
    remained: remained.map((i) => ({ category: i.category, value: i.value, page: i.page, documentId: i.documentId })),
    disappeared: disappeared.map((i) => ({ category: i.category, value: i.value, page: i.page, documentId: i.documentId })),
    appeared: appeared.map((i) => ({ category: i.category, value: i.value, page: i.page, documentId: i.documentId })),
    changedCategories: [...changedByCategory.entries()].map(([category, v]) => ({ category, ...v })),
    limitations: [
      'A ausência de um ponto no documento mais recente não significa que foi resolvido — pode simplesmente não ter sido reavaliado.',
    ],
  };
}

module.exports = {
  coOccurrenceByDay,
  analyzeSleepVsIntensity,
  analyzeEnvironmentVsDysregulation,
  analyzeFoodHydrationVsWellbeing,
  analyzeMedicationVsEffects,
  analyzeSchoolEventsVsEmotions,
  analyzeStrategiesVsOutcomes,
  analyzeDocumentRecommendationsVsObservations,
  compareAssessments,
  filterActiveInPeriod,
};
