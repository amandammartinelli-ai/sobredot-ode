/**
 * Painel administrativo operacional (Etapa 5) — ver docs/admin-dashboard.md.
 *
 * Só números agregados: nunca o conteúdo de um registo, documento,
 * pergunta de IA ou insight, e nunca uma lista de famílias/crianças por
 * nome. Um administrador vê "quantos", nunca "quem disse o quê". Isto é
 * uma escolha de âmbito deliberada, não uma limitação técnica — mesmo
 * que fosse tecnicamente possível mostrar mais, o painel administrativo
 * não é um canal de acesso a conteúdo de família.
 */
const { regionalFunctions: functions, HttpsError } = require('./regional');
const { db } = require('./init');
const { requireAdmin } = require('./util');

const DAY_MS = 24 * 60 * 60 * 1000;

const DOCUMENT_STATUSES = [
  'pending_review',
  'approved',
  'rejected',
  'error',
  'quarantine',
];

async function countOf(query) {
  const snap = await query.count().get();
  return snap.data().count;
}

async function getOperationalSummaryHandler() {
  const since24h = new Date(Date.now() - DAY_MS);

  const [
    familiesTotal,
    childrenActive,
    pendingDeletions,
    processingRestricted,
    aiQueriesLast24h,
    aiQueriesBlockedLast24h,
    aiQueriesEmergencyLast24h,
    rateLimitedLast24h,
    documentsByStatus,
  ] = await Promise.all([
    countOf(db.collection('families')),
    countOf(db.collection('children').where('deletedAt', '==', null)),
    countOf(db.collection('families').where('deletionRequest.status', '==', 'pending')),
    countOf(db.collection('children').where('processingRestricted', '==', true)),
    countOf(db.collectionGroup('aiQueries').where('createdAt', '>=', since24h)),
    countOf(
      db.collectionGroup('aiQueries').where('createdAt', '>=', since24h).where('blocked', '==', true)
    ),
    countOf(
      db.collectionGroup('aiQueries').where('createdAt', '>=', since24h).where('emergency', '==', true)
    ),
    countOf(
      db
        .collection('auditLog')
        .where('action', '==', 'abuse.rate_limited')
        .where('createdAt', '>=', since24h)
    ),
    Promise.all(
      DOCUMENT_STATUSES.map(async (status) => [
        status,
        await countOf(db.collectionGroup('documents').where('status', '==', status)),
      ])
    ),
  ]);

  return {
    generatedAt: Date.now(),
    functionsVersion: require('../package.json').version,
    families: { total: familiesTotal, pendingDeletions },
    children: { active: childrenActive, processingRestricted },
    documents: { byStatus: Object.fromEntries(documentsByStatus) },
    aiQueries: {
      last24h: aiQueriesLast24h,
      blockedLast24h: aiQueriesBlockedLast24h,
      emergencyLast24h: aiQueriesEmergencyLast24h,
    },
    abuse: { rateLimitedLast24h },
  };
}

const getOperationalSummary = functions.https.onCall(async (data, context) => {
  requireAdmin(context);
  try {
    return await getOperationalSummaryHandler();
  } catch (err) {
    // Índices compostos em falta (collectionGroup + where + orderBy) são o
    // erro mais provável aqui em produção antes de todos serem criados —
    // devolvemos uma mensagem acionável em vez do erro cru do Firestore.
    throw new HttpsError('internal', `Falha ao calcular o resumo operacional: ${err.message}`);
  }
});

module.exports = { getOperationalSummary, getOperationalSummaryHandler };
