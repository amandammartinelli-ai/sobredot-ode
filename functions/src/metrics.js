/**
 * Motor de métricas — cálculos deterministas sobre registos do quotidiano.
 *
 * Princípio não negociável desta etapa (ver docs/architecture.md,
 * "Arquitetura da inteligência"): TODO o número que aparece num insight
 * tem de ter passado por uma função pura deste ficheiro (ou de
 * `patterns.js`). Nenhum destes cálculos chama nenhum modelo de IA — são
 * simples contagens, médias, percentagens e comparações sobre os dados já
 * autorizados que o chamador (uma Cloud Function que já verificou acesso)
 * lhe entrega. A camada de narrativa (`insights.js`) só pode citar valores
 * que já saíram destas funções — nunca pode inventar um número.
 *
 * Todas as funções são puras (sem I/O, sem `Date.now()` implícito nas
 * contas — a hora "agora" é sempre passada como argumento) para serem
 * testáveis com conjuntos de dados conhecidos.
 */

// ---------------------------------------------------------------------
// Limiares documentados e configuráveis (ver docs/insights.md).
// ---------------------------------------------------------------------
const THRESHOLDS = {
  // Abaixo disto, um padrão nunca é mostrado — aparece "dados
  // insuficientes" em vez de qualquer inferência.
  MIN_SAMPLE_FOR_PATTERN: 5,
  // A partir destes tamanhos de amostra, a confiança de um padrão sobe.
  MIN_FOR_MEDIUM_CONFIDENCE: 15,
  MIN_FOR_HIGH_CONFIDENCE: 30,
  // Dias mínimos com registo para calcular distribuição por hora do dia
  // (poucos dias tornam a distribuição pouco significativa).
  MIN_DAYS_FOR_TIME_OF_DAY: 3,
};

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const METHOD_VERSION = 'metrics-v1';

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value.toDate === 'function') return value.toDate();
  return null;
}

/**
 * Resolve um período nomeado (7d/30d/90d) ou um intervalo personalizado
 * para {start, end, key, label}. `now` é sempre recebido como argumento
 * (nunca `new Date()` implícito) para que os cálculos sejam testáveis de
 * forma determinística e imunes a fuso horário do processo do servidor.
 */
function resolvePeriod(periodKey, custom, now) {
  const end = now instanceof Date ? now : new Date(now);
  if (periodKey === 'custom') {
    if (!custom || !custom.start || !custom.end) {
      throw new Error('Período personalizado requer start e end.');
    }
    const start = toDate(custom.start);
    const customEnd = toDate(custom.end);
    if (!start || !customEnd || start > customEnd) {
      throw new Error('Intervalo personalizado inválido.');
    }
    return { key: 'custom', start, end: customEnd, label: 'Período personalizado' };
  }
  const days = PERIOD_DAYS[periodKey];
  if (!days) {
    throw new Error(`Período desconhecido: ${periodKey}`);
  }
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { key: periodKey, start, end, label: `Últimos ${days} dias` };
}

function isWithinPeriod(record, period) {
  const occurredAt = toDate(record.occurredAt);
  if (!occurredAt) return false;
  return occurredAt >= period.start && occurredAt <= period.end;
}

/** Filtra registos não eliminados e dentro do período — base de todos os cálculos. */
function filterActiveInPeriod(records, period) {
  return (records || []).filter((record) => !record.deletedAt && isWithinPeriod(record, period));
}

/** Chave de dia local (YYYY-MM-DD) num fuso horário explícito — nunca o do processo do servidor. */
function dayKey(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function localHour(date, timeZone) {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || 'UTC',
    hour: '2-digit',
    hour12: false,
  }).format(date);
  return Number(formatted.replace(/\D/g, '')) % 24;
}

function allDayKeysInPeriod(period, timeZone) {
  const keys = [];
  const cursor = new Date(period.start);
  cursor.setUTCHours(12, 0, 0, 0); // evita saltos por DST ao incrementar
  const endKey = dayKey(period.end, timeZone);
  let guard = 0;
  while (guard < 400) {
    const key = dayKey(cursor, timeZone);
    keys.push(key);
    if (key === endKey) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return [...new Set(keys)];
}

/**
 * Tamanho da amostra, dias com/sem registo e distribuição das fontes —
 * requisito explícito: "mostre tamanho da amostra, dias com registo e
 * dias sem registo e distribuição das fontes".
 */
function buildSampleInfo(records, period, timeZone) {
  const active = filterActiveInPeriod(records, period);
  const allDays = allDayKeysInPeriod(period, timeZone);
  const daysWithRecordsSet = new Set(active.map((r) => dayKey(toDate(r.occurredAt), timeZone)));

  const sourceDistribution = { family: 0, school: 0, professional: 0, other: 0 };
  active.forEach((r) => {
    const key = ['family', 'school', 'professional', 'other'].includes(r.source) ? r.source : 'other';
    sourceDistribution[key] += 1;
  });

  return {
    sampleSize: active.length,
    totalDays: allDays.length,
    daysWithRecords: daysWithRecordsSet.size,
    daysWithoutRecords: Math.max(0, allDays.length - daysWithRecordsSet.size),
    sourceDistribution,
  };
}

function confidenceForSampleSize(sampleSize) {
  if (sampleSize < THRESHOLDS.MIN_SAMPLE_FOR_PATTERN) return 'insufficient';
  if (sampleSize < THRESHOLDS.MIN_FOR_MEDIUM_CONFIDENCE) return 'low';
  if (sampleSize < THRESHOLDS.MIN_FOR_HIGH_CONFIDENCE) return 'medium';
  return 'high';
}

function frequencyByCategory(records) {
  const counts = {};
  records.forEach((r) => {
    counts[r.categoryId] = (counts[r.categoryId] || 0) + 1;
  });
  return counts;
}

const INTENSITY_ORDER = ['low', 'medium', 'high'];

/**
 * Distribuição de intensidade + tendência simples (metade inicial do
 * período vs. metade final, por contagem de registos "high"). A tendência
 * é só descritiva — nunca "melhoria"/"piora" sem contexto, ver
 * `docs/insights.md`.
 */
function intensityDistribution(records, period) {
  const withIntensity = records.filter((r) => INTENSITY_ORDER.includes(r.intensity));
  const counts = { low: 0, medium: 0, high: 0 };
  withIntensity.forEach((r) => {
    counts[r.intensity] += 1;
  });

  if (withIntensity.length === 0) {
    return { sampleSize: 0, counts, highRatio: null, trend: 'insufficient_data' };
  }

  const midpoint = new Date((period.start.getTime() + period.end.getTime()) / 2);
  const firstHalf = withIntensity.filter((r) => toDate(r.occurredAt) < midpoint);
  const secondHalf = withIntensity.filter((r) => toDate(r.occurredAt) >= midpoint);

  const highRatio = counts.high / withIntensity.length;

  let trend = 'stable';
  if (firstHalf.length < 3 || secondHalf.length < 3) {
    trend = 'insufficient_data';
  } else {
    const firstHighRatio = firstHalf.filter((r) => r.intensity === 'high').length / firstHalf.length;
    const secondHighRatio = secondHalf.filter((r) => r.intensity === 'high').length / secondHalf.length;
    const delta = secondHighRatio - firstHighRatio;
    if (delta > 0.15) trend = 'more_high_intensity_recently';
    else if (delta < -0.15) trend = 'less_high_intensity_recently';
  }

  return { sampleSize: withIntensity.length, counts, highRatio, trend };
}

function durationStats(records) {
  const durations = records.map((r) => r.duration).filter((v) => typeof v === 'number' && v >= 0);
  if (durations.length === 0) return { sampleSize: 0, averageMinutes: null, medianMinutes: null };
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = durations.reduce((acc, v) => acc + v, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    sampleSize: durations.length,
    averageMinutes: Math.round((sum / durations.length) * 10) / 10,
    medianMinutes: median,
  };
}

const TIME_BUCKETS = [
  { id: 'morning', label: 'Manhã (06h–12h)', from: 6, to: 12 },
  { id: 'afternoon', label: 'Tarde (12h–18h)', from: 12, to: 18 },
  { id: 'evening', label: 'Fim de dia (18h–22h)', from: 18, to: 22 },
  { id: 'night', label: 'Noite (22h–06h)', from: 22, to: 30 }, // "to" > 24 tratado com módulo abaixo
];

function bucketForHour(hour) {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
}

/** Distribuição por hora do dia, sempre calculada num fuso horário explícito. */
function timeOfDayDistribution(records, timeZone, sampleInfo) {
  if (!sampleInfo || sampleInfo.daysWithRecords < THRESHOLDS.MIN_DAYS_FOR_TIME_OF_DAY) {
    return { insufficientData: true, buckets: {}, timeZone: timeZone || 'UTC' };
  }
  const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  records.forEach((r) => {
    const date = toDate(r.occurredAt);
    if (!date) return;
    buckets[bucketForHour(localHour(date, timeZone))] += 1;
  });
  return { insufficientData: false, buckets, timeZone: timeZone || 'UTC', labels: TIME_BUCKETS.map((b) => ({ id: b.id, label: b.label })) };
}

function topFrequency(values, max = 5) {
  const counts = new Map();
  values.filter(Boolean).forEach((v) => {
    const key = String(v).trim().toLowerCase();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([value, count]) => ({ value, count }));
}

function contextDistribution(records) {
  return {
    where: topFrequency(records.map((r) => r.where)),
    withWhom: topFrequency(records.map((r) => r.withWhom)),
  };
}

function recurrenceTopAntecedents(records) {
  return topFrequency(records.map((r) => r.antecedent));
}

function regulationOutcomeStats(records) {
  const withBoth = records.filter((r) => r.regulation && r.outcome);
  return {
    sampleSize: withBoth.length,
    topStrategies: topFrequency(withBoth.map((r) => r.regulation)),
  };
}

function sleepMetrics(records) {
  const sleepRecords = records.filter((r) => r.categoryId === 'sleep');
  const nightWakings = sleepRecords
    .map((r) => Number(r.details && r.details.nightWakings))
    .filter((v) => Number.isFinite(v));
  return {
    sampleSize: sleepRecords.length,
    averageNightWakings:
      nightWakings.length > 0
        ? Math.round((nightWakings.reduce((a, v) => a + v, 0) / nightWakings.length) * 10) / 10
        : null,
  };
}

function foodMetrics(records) {
  const foodRecords = records.filter((r) => r.categoryId === 'food');
  const withAppetite = foodRecords.filter((r) => r.details && r.details.appetite);
  return {
    sampleSize: foodRecords.length,
    appetiteMentions: topFrequency(withAppetite.map((r) => r.details.appetite)),
    refusalMentions: foodRecords.filter((r) => r.details && r.details.itemsRefused).length,
  };
}

/**
 * Adesão à medicação: proporção de dias, dentro dos dias em que a
 * medicação foi registada, em que existe uma dose efetivamente marcada
 * como dada (`details.doseGiven` preenchido). Não confunde "sem registo"
 * com "não tomou" — reporta separadamente `daysWithMedicationRecord`.
 */
function medicationAdherence(records, timeZone) {
  const medicationRecords = records.filter((r) => r.categoryId === 'medication');
  const dayKeys = new Set(medicationRecords.map((r) => dayKey(toDate(r.occurredAt), timeZone)));
  const withDose = medicationRecords.filter((r) => r.details && r.details.doseGiven);
  const daysWithDose = new Set(withDose.map((r) => dayKey(toDate(r.occurredAt), timeZone)));

  return {
    sampleSize: medicationRecords.length,
    daysWithMedicationRecord: dayKeys.size,
    daysWithDoseGiven: daysWithDose.size,
    adherenceRatio: dayKeys.size > 0 ? Math.round((daysWithDose.size / dayKeys.size) * 100) / 100 : null,
    sideEffectMentions: medicationRecords.filter((r) => r.details && r.details.sideEffects).length,
  };
}

function schoolParticipation(records) {
  const schoolRecords = records.filter((r) => r.categoryId === 'school');
  return {
    sampleSize: schoolRecords.length,
    participationMentions: topFrequency(schoolRecords.map((r) => r.details && r.details.participation)),
    activityMentions: topFrequency(schoolRecords.map((r) => r.details && r.details.activity)),
  };
}

function communicationMetrics(records) {
  const communicationRecords = records.filter((r) => r.categoryId === 'communication');
  return {
    sampleSize: communicationRecords.length,
    modeMentions: topFrequency(communicationRecords.map((r) => r.details && r.details.mode)),
  };
}

function sensoryMetrics(records) {
  const sensoryRecords = records.filter((r) => r.categoryId === 'sensory');
  return {
    sampleSize: sensoryRecords.length,
    stimulusMentions: topFrequency(sensoryRecords.map((r) => r.details && r.details.stimulus)),
    responseMentions: topFrequency(sensoryRecords.map((r) => r.details && r.details.response)),
  };
}

module.exports = {
  THRESHOLDS,
  PERIOD_DAYS,
  METHOD_VERSION,
  toDate,
  dayKey,
  localHour,
  resolvePeriod,
  filterActiveInPeriod,
  allDayKeysInPeriod,
  buildSampleInfo,
  confidenceForSampleSize,
  frequencyByCategory,
  intensityDistribution,
  durationStats,
  timeOfDayDistribution,
  contextDistribution,
  recurrenceTopAntecedents,
  regulationOutcomeStats,
  sleepMetrics,
  foodMetrics,
  medicationAdherence,
  schoolParticipation,
  communicationMetrics,
  sensoryMetrics,
  topFrequency,
};
