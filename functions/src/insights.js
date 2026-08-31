/**
 * Modelo de insight e narrativa grounded — "Inteligência Integrada"
 * (Etapa 4).
 *
 * Separação rigorosa exigida pelo produto:
 *   (A) métricas determinísticas  → functions/src/metrics.js
 *   (B) padrões estatísticos       → functions/src/patterns.js
 *   (C) narrativa gerada aqui      → SÓ interpola valores que (A)/(B) já
 *       calcularam. Nunca calcula, nunca inventa um número, nunca afirma
 *       causa. Ver `buildInsightsForPeriod` — cada frase é montada a
 *       partir de um template fixo mais os números da evidência; não há
 *       nenhuma chamada a um modelo de linguagem nesta etapa (à
 *       semelhança do adaptador mock de `ai.js`).
 *
 * Cada insight gerado tem de sobreviver a `assertNoCausalLanguage` e a
 * `assertNumbersAreGrounded` (ver testes) — se um template alguma vez for
 * alterado para violar isto, os testes falham.
 */
const { regionalFunctions: functions, HttpsError } = require('./regional');
const { db } = require('./init');
const { FieldValue } = require('firebase-admin/firestore');
const { writeAuditEvent } = require('./audit');
const { containsBlockedIntent, containsFalseCertaintyLanguage } = require('./ai');
const {
  requireAuth,
  requireFamilyMembership,
  resolveChildAccess,
  getFamilyMember,
} = require('./util');
const { LIMITS, enforcePerUserAndChildLimit } = require('./rateLimit');
const metrics = require('./metrics');
const patterns = require('./patterns');

const METHOD_VERSION = 'insights-v1';

// ---------------------------------------------------------------------
// Guardas de qualidade da narrativa (também usadas pelos testes
// obrigatórios da Etapa 4: "avaliações que falhem quando a narrativa
// inventar número... ou usar linguagem causal indevida").
// ---------------------------------------------------------------------
const CAUSAL_LANGUAGE_PATTERNS = [
  /provoc(a|ou|am)/i,
  /caus(a|ou|am)(?!\s*a)/i, // evita falso positivo em "causa" usada só como substantivo neutro é aceitável ser restritivo aqui
  /faz(em)? com que/i,
  /lev(a|ou|am) a\b/i,
  /respons[áa]vel por/i,
  /desencade(ia|ou|iam)/i,
  /por causa d[eo]/i,
];

function assertNoCausalLanguage(text) {
  const violations = CAUSAL_LANGUAGE_PATTERNS.filter((pattern) => pattern.test(text || ''));
  return violations.map((pattern) => pattern.source);
}

function extractNumbers(text) {
  return (String(text || '').match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.'));
}

/**
 * Verifica que todo número presente no texto também aparece entre os
 * valores da evidência declarada — defesa contra a IA "inventar" um
 * número que não veio do motor de métricas/padrões.
 */
function assertNumbersAreGrounded(text, evidence) {
  const groundedNumbers = new Set();
  (evidence || []).forEach((item) => {
    extractNumbers(String(item.value)).forEach((n) => groundedNumbers.add(n));
  });
  const textNumbers = extractNumbers(text);
  return textNumbers.filter((n) => !groundedNumbers.has(n));
}

const SAFE_ACTIONS = [
  { id: 'continue_observing', label: 'Continuar a observar' },
  { id: 'discuss_with_professional', label: 'Levar esta pergunta ao profissional' },
];

const STANDARD_LIMITATIONS = [
  'Uma redução no número de episódios pode significar melhoria, mas também pode significar menos registos ou uma mudança de ambiente — os dados aqui não permitem distinguir estas hipóteses.',
  'Esta análise organiza informação já registada; não substitui a avaliação de um profissional.',
];

function pct(ratio) {
  return ratio == null ? null : Math.round(ratio * 1000) / 10;
}

function baseInsightShape({ patternType, title, period, sampleInfo, confidence, evidence, factualObservation, possiblePattern, limitations, sources }) {
  return {
    title,
    patternType,
    factualObservation,
    possiblePattern: possiblePattern || null,
    evidence: evidence || [],
    period: { key: period.key, startAt: period.start, endAt: period.end },
    sources: sources || Object.keys(sampleInfo.sourceDistribution).filter((k) => sampleInfo.sourceDistribution[k] > 0),
    sampleSize: sampleInfo.sampleSize,
    daysWithRecords: sampleInfo.daysWithRecords,
    daysWithoutRecords: sampleInfo.daysWithoutRecords,
    confidence,
    limitations: [...(limitations || []), ...STANDARD_LIMITATIONS],
    safeActions: SAFE_ACTIONS,
    methodVersion: METHOD_VERSION,
    status: 'not_reviewed',
  };
}

function coOccurrenceInsight({ patternResult, period, sampleInfo, dimensionLabel }) {
  if (patternResult.insufficientData) {
    return baseInsightShape({
      patternType: patternResult.patternType,
      title: patternResult.title,
      period,
      sampleInfo,
      confidence: 'insufficient',
      evidence: [{ metricKey: 'sampleSize', label: 'Dias considerados', value: String(patternResult.sampleSize) }],
      factualObservation: `Ainda há dados insuficientes para analisar "${dimensionLabel}" nesta criança e período (${patternResult.sampleSize} dia(s) considerados).`,
      possiblePattern: null,
      limitations: ['Dados insuficientes: nenhuma inferência foi feita — só a contagem é mostrada.'],
    });
  }

  const withPct = pct(patternResult.rateWithCondition);
  const withoutPct = pct(patternResult.rateWithoutCondition);

  const factualObservation =
    `Em ${patternResult.daysWithCondition} dia(s) com "${dimensionLabel.split(' vs. ')[0]}", ` +
    `isso foi observado em conjunto com "${dimensionLabel.split(' vs. ')[1] || 'o outro fator'}" em ${withPct}% desses dias. ` +
    `Nos ${patternResult.daysWithoutCondition} dia(s) sem essa condição, isso aconteceu em ${withoutPct == null ? 'dados insuficientes' : `${withoutPct}%`} dos dias.`;

  const possiblePattern =
    withPct != null && withoutPct != null && Math.abs(withPct - withoutPct) >= 15
      ? `Foi observada uma diferença entre estes dois grupos de dias nesta criança. Isto é uma coocorrência, não uma prova de causa.`
      : `Não foi observada, nestes dados, uma diferença clara entre estes dois grupos de dias.`;

  return baseInsightShape({
    patternType: patternResult.patternType,
    title: patternResult.title,
    period,
    sampleInfo,
    confidence: patternResult.confidence,
    evidence: [
      { metricKey: 'daysWithCondition', label: 'Dias com a condição', value: String(patternResult.daysWithCondition) },
      { metricKey: 'daysWithoutCondition', label: 'Dias sem a condição', value: String(patternResult.daysWithoutCondition) },
      { metricKey: 'rateWithCondition', label: 'Taxa nos dias com a condição', value: `${withPct}%` },
      {
        metricKey: 'rateWithoutCondition',
        label: 'Taxa nos dias sem a condição',
        value: withoutPct == null ? 'dados insuficientes' : `${withoutPct}%`,
      },
    ],
    factualObservation,
    possiblePattern,
  });
}

function buildCategorySummaryInsight({ records, period, sampleInfo }) {
  const frequency = metrics.frequencyByCategory(records);
  const intensity = metrics.intensityDistribution(records, period);
  const topCategoriesEntries = Object.entries(frequency).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topCategories = topCategoriesEntries.map(([categoryId, count]) => `${categoryId}: ${count}`);

  const factualObservation =
    `Nos últimos dias considerados, foram feitos ${sampleInfo.sampleSize} registo(s) em ${sampleInfo.daysWithRecords} dia(s) (de ${sampleInfo.totalDays} dias no período). ` +
    `Categorias mais frequentes: ${topCategories.join(', ') || 'sem registos suficientes'}.` +
    (intensity.sampleSize > 0
      ? ` Da intensidade emocional registada, ${intensity.counts.high} registo(s) foram de intensidade alta, em ${intensity.sampleSize} registo(s) com intensidade indicada.`
      : '');

  return baseInsightShape({
    patternType: 'category_summary',
    title: 'Resumo do período',
    period,
    sampleInfo,
    confidence: metrics.confidenceForSampleSize(sampleInfo.sampleSize),
    evidence: [
      { metricKey: 'sampleSize', label: 'Registos no período', value: String(sampleInfo.sampleSize) },
      { metricKey: 'daysWithRecords', label: 'Dias com registo', value: String(sampleInfo.daysWithRecords) },
      { metricKey: 'daysWithoutRecords', label: 'Dias sem registo', value: String(sampleInfo.daysWithoutRecords) },
      { metricKey: 'totalDays', label: 'Dias no período', value: String(sampleInfo.totalDays) },
      ...topCategoriesEntries.map(([categoryId, count]) => ({
        metricKey: `category_${categoryId}`,
        label: `Registos em ${categoryId}`,
        value: String(count),
      })),
      ...(intensity.sampleSize > 0
        ? [{ metricKey: 'highIntensityCount', label: 'Registos de intensidade alta', value: String(intensity.counts.high) }]
        : []),
    ],
    factualObservation,
    possiblePattern: null,
    limitations:
      sampleInfo.sampleSize === 0
        ? ['Não existem registos suficientes neste período para qualquer leitura — considere alargar o período.']
        : [],
  });
}

function buildEvolutionInsight({ comparison, period, sampleInfo }) {
  const factualObservation =
    `Comparando os dois documentos considerados: ${comparison.remained.length} ponto(s) permaneceram iguais, ` +
    `${comparison.appeared.length} ponto(s) são novos no documento mais recente e ${comparison.disappeared.length} ponto(s) do documento anterior já não constam no mais recente.`;

  return baseInsightShape({
    patternType: 'evolution',
    title: comparison.title,
    period,
    sampleInfo,
    confidence: comparison.remained.length + comparison.appeared.length + comparison.disappeared.length >= metrics.THRESHOLDS.MIN_SAMPLE_FOR_PATTERN ? 'medium' : 'low',
    evidence: [
      { metricKey: 'remainedCount', label: 'Pontos que permaneceram', value: String(comparison.remained.length) },
      { metricKey: 'appearedCount', label: 'Pontos novos', value: String(comparison.appeared.length) },
      { metricKey: 'disappearedCount', label: 'Pontos que deixaram de constar', value: String(comparison.disappeared.length) },
    ],
    factualObservation,
    possiblePattern: null,
    limitations: comparison.limitations,
    sources: ['professional'],
  });
}

function attachComparisonDetails(insight, comparison) {
  return {
    ...insight,
    comparisonDetails: {
      remained: comparison.remained,
      appeared: comparison.appeared,
      disappeared: comparison.disappeared,
    },
  };
}

function buildDocumentRecommendationsInsight({ result, period, sampleInfo }) {
  if (result.insufficientData) {
    return baseInsightShape({
      patternType: result.patternType,
      title: result.title,
      period,
      sampleInfo,
      confidence: 'insufficient',
      evidence: [{ metricKey: 'sampleSize', label: 'Registos relacionados encontrados', value: String(result.sampleSize) }],
      factualObservation: 'Ainda não há recomendações/estratégias aprovadas em documentos, ou não foram encontrados registos do quotidiano que as mencionem.',
      possiblePattern: null,
      limitations: ['Dados insuficientes: sem recomendações documentais confirmadas ou sem registos que as mencionem.'],
    });
  }

  const topMatch = [...result.matches].sort((a, b) => b.matchingRecordCount - a.matchingRecordCount)[0];
  const factualObservation =
    `Foram encontradas ${result.matches.length} recomendação(ões)/estratégia(s) em documentos aprovados. ` +
    `A mais mencionada nos registos do quotidiano ("${topMatch.recommendationValue.slice(0, 80)}") aparece relacionada com ${topMatch.matchingRecordCount} registo(s).`;

  return baseInsightShape({
    patternType: result.patternType,
    title: result.title,
    period,
    sampleInfo,
    confidence: result.confidence,
    evidence: [
      { metricKey: 'recommendationCount', label: 'Recomendações/estratégias encontradas', value: String(result.matches.length) },
      // O "topMatch" citado na narrativa vem sempre incluído aqui, mesmo
      // que não esteja entre os 5 primeiros por ordem — garante que o
      // número citado no texto está sempre grounded na evidência.
      {
        metricKey: 'topMatch',
        label: `Registos relacionados com recomendação de ${topMatch.documentId} (p.${topMatch.page})`,
        value: String(topMatch.matchingRecordCount),
        documentId: topMatch.documentId,
        page: topMatch.page,
        excerpt: topMatch.excerpt,
      },
      ...result.matches
        .filter((m) => m !== topMatch)
        .slice(0, 4)
        .map((m, index) => ({
          metricKey: `match_${index}`,
          label: `Registos relacionados com recomendação de ${m.documentId} (p.${m.page})`,
          value: String(m.matchingRecordCount),
          documentId: m.documentId,
          page: m.page,
          excerpt: m.excerpt,
        })),
    ],
    factualObservation,
    possiblePattern: 'Estes registos usam palavras semelhantes às da recomendação — não confirma que a estratégia foi seguida ou eficaz.',
    sources: ['professional', 'family'],
  });
}

/**
 * Monta todos os insights de um período, a partir de registos já
 * autorizados (o chamador — `generateInsights` — já verificou acesso).
 * Pura o suficiente para ser testada com conjuntos de dados conhecidos:
 * não faz I/O, recebe tudo o que precisa como argumento.
 */
function buildInsightsForPeriod({ records, extractionItems, olderExtractionItems, newerExtractionItems, period, timeZone }) {
  const active = metrics.filterActiveInPeriod(records, period);
  const sampleInfo = metrics.buildSampleInfo(records, period, timeZone);

  const insights = [];
  insights.push(buildCategorySummaryInsight({ records: active, period, sampleInfo }));

  const patternDefs = [
    { fn: patterns.analyzeSleepVsIntensity, dimensionLabel: 'sono perturbado vs. intensidade emocional alta' },
    { fn: patterns.analyzeEnvironmentVsDysregulation, dimensionLabel: 'ambiente ruidoso/cheio vs. desregulação' },
    { fn: patterns.analyzeFoodHydrationVsWellbeing, dimensionLabel: 'recusa alimentar vs. sinais de mal-estar' },
    { fn: patterns.analyzeMedicationVsEffects, dimensionLabel: 'dose de medicação dada vs. efeitos/intensidade alta' },
    { fn: patterns.analyzeSchoolEventsVsEmotions, dimensionLabel: 'registo escolar vs. intensidade emocional alta' },
    { fn: patterns.analyzeStrategiesVsOutcomes, dimensionLabel: 'estratégia de regulação vs. resultado positivo' },
  ];

  patternDefs.forEach(({ fn, dimensionLabel }) => {
    const result = fn(active, timeZone);
    insights.push(coOccurrenceInsight({ patternResult: result, period, sampleInfo, dimensionLabel }));
  });

  if (extractionItems) {
    const docResult = patterns.analyzeDocumentRecommendationsVsObservations(active, extractionItems);
    insights.push(buildDocumentRecommendationsInsight({ result: docResult, period, sampleInfo }));
  }

  if (olderExtractionItems && newerExtractionItems) {
    const comparison = patterns.compareAssessments(olderExtractionItems, newerExtractionItems);
    insights.push(attachComparisonDetails(buildEvolutionInsight({ comparison, period, sampleInfo }), comparison));
  }

  // Defesa em profundidade: nenhum insight gerado pode conter linguagem
  // causal indevida, um número não citável na evidência, linguagem de
  // falsa certeza, ou conteúdo que pareça diagnóstico/prescrição — mesmo
  // vindo de templates fixos.
  return insights.map((insight) => {
    const text = `${insight.title} ${insight.factualObservation} ${insight.possiblePattern || ''}`;
    const causalViolations = assertNoCausalLanguage(text);
    const ungroundedNumbers = assertNumbersAreGrounded(text, insight.evidence);
    const blocked = containsBlockedIntent(text) || containsFalseCertaintyLanguage(text);
    if (causalViolations.length > 0 || ungroundedNumbers.length > 0 || blocked) {
      return {
        ...insight,
        title: 'Insight indisponível',
        factualObservation: 'Este insight foi bloqueado automaticamente por não cumprir as regras de linguagem da Sobredot (defesa em profundidade). Contacte o suporte se isto persistir.',
        possiblePattern: null,
        evidence: [],
        confidence: 'insufficient',
      };
    }
    return insight;
  });
}

// ---------------------------------------------------------------------
// Cloud Functions
// ---------------------------------------------------------------------

const VALID_PERIOD_KEYS = ['7d', '30d', '90d', 'custom'];

async function fetchRecordsForPeriod(childId, period) {
  const snap = await db
    .collection(`children/${childId}/records`)
    .where('deletedAt', '==', null)
    .where('occurredAt', '>=', period.start)
    .where('occurredAt', '<=', period.end)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchApprovedExtractionItems(childId) {
  const documentsSnap = await db
    .collection(`children/${childId}/documents`)
    .where('status', '==', 'approved')
    .where('deletedAt', '==', null)
    .orderBy('approvedAt', 'desc')
    .get();

  const items = [];
  for (const documentDoc of documentsSnap.docs) {
    // eslint-disable-next-line no-await-in-loop
    const itemsSnap = await db
      .collection(`children/${childId}/documents/${documentDoc.id}/extractionItems`)
      .where('reviewStatus', 'in', ['confirmed', 'edited'])
      .get();
    itemsSnap.docs.forEach((itemDoc) => {
      items.push({ documentId: documentDoc.id, ...itemDoc.data() });
    });
  }

  return { items, orderedDocumentIds: documentsSnap.docs.map((d) => d.id) };
}

/**
 * Gera (e persiste) os insights de um período para uma criança. Só a
 * família pode disparar a geração — reutilizar todas as categorias de
 * registo só é seguro para quem já vê tudo; um profissional com âmbito
 * restrito nunca gera insights (pode comentar/validar/contestar os já
 * existentes através de `setInsightStatus`).
 */
async function generateInsightsHandler(data, uid) {
  const { childId, periodKey, customRange, timeZone } = data || {};

  if (typeof childId !== 'string' || !childId) {
    throw new HttpsError('invalid-argument', 'Criança inválida.');
  }
  if (!VALID_PERIOD_KEYS.includes(periodKey)) {
    throw new HttpsError('invalid-argument', 'Período inválido.');
  }

  const childSnap = await db.doc(`children/${childId}`).get();
  if (!childSnap.exists || childSnap.data().deletedAt) {
    throw new HttpsError('not-found', 'Criança não encontrada.');
  }
  const child = childSnap.data();
  await requireFamilyMembership(child.familyId, uid);

  if (child.processingRestricted) {
    throw new HttpsError(
      'failed-precondition',
      'O processamento de IA para esta criança está restringido a pedido da família.'
    );
  }

  await enforcePerUserAndChildLimit('generate_insights', uid, childId, LIMITS.INSIGHTS_PER_USER, LIMITS.INSIGHTS_PER_CHILD);

  let period;
  try {
    period = metrics.resolvePeriod(
      periodKey,
      customRange ? { start: new Date(customRange.start), end: new Date(customRange.end) } : null,
      new Date()
    );
  } catch (err) {
    throw new HttpsError('invalid-argument', err.message);
  }

  const records = await fetchRecordsForPeriod(childId, period);
  const { items, orderedDocumentIds } = await fetchApprovedExtractionItems(childId);

  let olderExtractionItems = null;
  let newerExtractionItems = null;
  if (orderedDocumentIds.length >= 2) {
    newerExtractionItems = items.filter((i) => i.documentId === orderedDocumentIds[0]);
    olderExtractionItems = items.filter((i) => i.documentId === orderedDocumentIds[1]);
  }

  const resolvedTimeZone = typeof timeZone === 'string' && timeZone ? timeZone : 'UTC';
  const insightsToWrite = buildInsightsForPeriod({
    records,
    extractionItems: items,
    olderExtractionItems,
    newerExtractionItems,
    period,
    timeZone: resolvedTimeZone,
  });

  const batch = db.batch();
  const generatedAt = FieldValue.serverTimestamp();
  const refs = [];
  insightsToWrite.forEach((insight) => {
    const ref = db.collection(`children/${childId}/insights`).doc();
    refs.push(ref);
    batch.set(ref, {
      ...insight,
      childId,
      familyId: child.familyId,
      generatedAt,
      generatedBy: uid,
      deletedAt: null,
    });
  });
  await batch.commit();

  await writeAuditEvent({
    action: 'insights.generated',
    actorUid: uid,
    targetType: 'child',
    targetId: childId,
    familyId: child.familyId,
    childId,
    metadata: { periodKey: period.key, count: insightsToWrite.length },
  });

  return { insightIds: refs.map((r) => r.id), count: insightsToWrite.length };
}

const generateInsights = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  return generateInsightsHandler(data, uid);
});

const VALID_STATUSES = ['not_reviewed', 'family_reviewed', 'professional_validated', 'contested'];
const FAMILY_ALLOWED_STATUSES = ['not_reviewed', 'family_reviewed'];
const PROFESSIONAL_ALLOWED_STATUSES = ['professional_validated', 'contested'];

/**
 * Regista um comentário/confirmação/correção/contestação de um insight.
 * NUNCA edita `evidence`/`metricsSnapshot`/`factualObservation` — só
 * `status`, mais uma entrada imutável em `statusHistory` (autoria e
 * data). Ver docs/permissions.md: "não editar silenciosamente o registo
 * original".
 */
async function setInsightStatusHandler(data, uid) {
  const { childId, insightId, status, comment } = data || {};

  if (typeof childId !== 'string' || !childId || typeof insightId !== 'string' || !insightId) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }
  if (!VALID_STATUSES.includes(status)) {
    throw new HttpsError('invalid-argument', 'Estado inválido.');
  }
  if (comment != null && (typeof comment !== 'string' || comment.length > 1000)) {
    throw new HttpsError('invalid-argument', 'Comentário inválido.');
  }

  const childSnap = await db.doc(`children/${childId}`).get();
  if (!childSnap.exists || childSnap.data().deletedAt) {
    throw new HttpsError('not-found', 'Criança não encontrada.');
  }
  const child = childSnap.data();

  const member = await getFamilyMember(child.familyId, uid);
  let actorRole;
  if (member) {
    if (!FAMILY_ALLOWED_STATUSES.includes(status)) {
      throw new HttpsError('permission-denied', 'A família só pode marcar como revisto ou não revisto.');
    }
    actorRole = 'family';
  } else {
    const access = await resolveChildAccess(childId, uid, { capability: 'validate', category: 'insights' });
    if (!access.allowed) {
      throw new HttpsError('permission-denied', 'Sem permissão para validar insights desta criança.');
    }
    if (!PROFESSIONAL_ALLOWED_STATUSES.includes(status)) {
      throw new HttpsError('permission-denied', 'Um profissional só pode validar ou contestar.');
    }
    actorRole = 'professional';
  }

  const insightRef = db.doc(`children/${childId}/insights/${insightId}`);
  const insightSnap = await insightRef.get();
  if (!insightSnap.exists || insightSnap.data().deletedAt) {
    throw new HttpsError('not-found', 'Insight não encontrado.');
  }

  await insightRef.update({ status, updatedAt: FieldValue.serverTimestamp() });
  await insightRef.collection('statusHistory').add({
    status,
    actorUid: uid,
    actorRole,
    comment: comment || null,
    createdAt: FieldValue.serverTimestamp(),
  });

  await writeAuditEvent({
    action: 'insight.status_changed',
    actorUid: uid,
    actorRole: actorRole === 'family' ? 'user' : 'user',
    targetType: 'insight',
    targetId: insightId,
    familyId: child.familyId,
    childId,
    metadata: { status, actorRole },
  });

  return { ok: true };
}

const setInsightStatus = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  return setInsightStatusHandler(data, uid);
});

module.exports = {
  METHOD_VERSION,
  SAFE_ACTIONS,
  assertNoCausalLanguage,
  assertNumbersAreGrounded,
  buildInsightsForPeriod,
  generateInsights,
  setInsightStatus,
  // exportados para testes de integração diretos contra o emulador (ver
  // tests/rules/), sem precisar do Functions Emulator completo — o mesmo
  // padrão usado por resolveChildAccess (functions/src/util.js).
  generateInsightsHandler,
  setInsightStatusHandler,
};
