/**
 * Relatórios e partilha controlada (Etapa 4).
 *
 * O conteúdo de um relatório é sempre montado no servidor a partir dos
 * módulos/documentos/período que o pedido explicitamente escolheu — nunca
 * confiamos num "payload" pronto vindo do cliente para a versão
 * partilhável (`createReportShareLink` recalcula tudo). O link de
 * partilha nunca é uma leitura direta do Firestore (ver
 * docs/decisions.md, decisão 14): só a Cloud Function `getSharedReport`,
 * que verifica um token opaco contra um hash guardado, devolve o
 * conteúdo — e esse conteúdo fica "congelado" no momento da criação do
 * link, para que uma revogação ou alteração posterior nunca precise de
 * ser refletida retroativamente (e para que os testes de "escopo
 * parcial"/"link expirado" sejam determinísticos).
 *
 * Nunca colocamos dados sensíveis no próprio link: o token é opaco
 * (aleatório, sem relação com o nome da criança/família) e o e-mail/
 * notificação de partilha (quando existir, ver docs/roadmap.md) nunca
 * inclui o token em texto simples fora do URL controlado pela família.
 */
const crypto = require('crypto');
const { regionalFunctions: functions, HttpsError } = require('./regional');
const { db } = require('./init');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { writeAuditEvent } = require('./audit');
const { requireAuth, requireFamilyMembership, isNonEmptyString } = require('./util');
const { LIMITS, enforcePerUserLimit } = require('./rateLimit');
const metrics = require('./metrics');

const VALID_MODULES = ['summary', 'timeline', 'insights', 'documents', 'goals'];
const MAX_TIMELINE_ITEMS = 200;
const MAX_SHARE_HOURS = 24 * 30; // 30 dias
const REPORT_DISCLAIMER =
  'Este relatório é um apoio à comunicação e ao acompanhamento; não constitui diagnóstico ou orientação médica.';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeCompareHash(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Um `Timestamp` do Firestore não sobrevive à travessia de uma Cloud
 * Function "callable" como objeto com `.toDate()` — chega ao cliente como
 * um objeto simples sem esse método, partindo qualquer formatação de data
 * feita lá. Por isso todo valor de data devolvido num relatório é sempre
 * convertido aqui, no servidor, para uma string ISO 8601 simples.
 */
function toIsoString(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function validateModules(modules) {
  if (!Array.isArray(modules) || modules.length === 0 || !modules.every((m) => VALID_MODULES.includes(m))) {
    throw new HttpsError('invalid-argument', 'Módulos de relatório inválidos.');
  }
}

/**
 * Monta o conteúdo do relatório. Nunca chamado diretamente pelo cliente —
 * usado tanto por `generateReport` (pré-visualização) como por
 * `createReportShareLink` (versão congelada e partilhável).
 */
async function assembleReport({ childId, child, period, modules, documentIds, timeZone }) {
  const sections = {};
  const sensitivePreview = { categories: new Set(), documentCount: 0, recordCount: 0 };

  const recordsSnap = await db
    .collection(`children/${childId}/records`)
    .where('deletedAt', '==', null)
    .where('occurredAt', '>=', period.start)
    .where('occurredAt', '<=', period.end)
    .get();
  const records = recordsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  records.forEach((r) => sensitivePreview.categories.add(r.categoryId));
  sensitivePreview.recordCount = records.length;

  if (modules.includes('summary')) {
    const sampleInfo = metrics.buildSampleInfo(records, period, timeZone);
    sections.summary = {
      sampleInfo,
      frequencyByCategory: metrics.frequencyByCategory(records),
      intensity: metrics.intensityDistribution(records, period),
    };
  }

  if (modules.includes('timeline')) {
    sections.timeline = records
      .sort((a, b) => metrics.toDate(b.occurredAt) - metrics.toDate(a.occurredAt))
      .slice(0, MAX_TIMELINE_ITEMS)
      .map((r) => ({
        id: r.id,
        categoryId: r.categoryId,
        occurredAt: toIsoString(r.occurredAt),
        source: r.source ?? null,
        // O Firestore recusa gravar `undefined` (necessário para
        // `createReportShareLink`, que persiste este objeto) — cada
        // campo opcional do registo é normalizado para `null`.
        emotion: r.emotion ?? null,
        intensity: r.intensity ?? null,
        behavior: r.behavior ?? null,
        regulation: r.regulation ?? null,
        outcome: r.outcome ?? null,
        notes: r.notes ?? null,
      }));
  }

  if (modules.includes('insights')) {
    const insightsSnap = await db
      .collection(`children/${childId}/insights`)
      .where('deletedAt', '==', null)
      .orderBy('generatedAt', 'desc')
      .limit(50)
      .get();
    sections.insights = insightsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        factualObservation: data.factualObservation,
        possiblePattern: data.possiblePattern,
        confidence: data.confidence,
        status: data.status,
        limitations: data.limitations,
        evidence: data.evidence,
      };
    });
  }

  if (modules.includes('documents') && Array.isArray(documentIds) && documentIds.length > 0) {
    const docs = [];
    for (const documentId of documentIds) {
      // eslint-disable-next-line no-await-in-loop
      const docSnap = await db.doc(`children/${childId}/documents/${documentId}`).get();
      if (!docSnap.exists) continue;
      const data = docSnap.data();
      // Só documentos aprovados e não eliminados podem entrar num
      // relatório — nunca um documento ainda em revisão.
      if (data.status !== 'approved' || data.deletedAt) continue;
      docs.push({
        id: documentId,
        docType: data.docType,
        issuer: data.issuer,
        specialty: data.specialty,
        docDate: data.docDate,
        origin: data.origin,
        approvedAt: toIsoString(data.approvedAt),
      });
    }
    sections.documents = docs;
    sensitivePreview.documentCount = docs.length;
  }

  if (modules.includes('goals')) {
    const goalsSnap = await db
      .collection(`children/${childId}/goals`)
      .where('deletedAt', '==', null)
      .get();
    sections.goals = goalsSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        description: data.description,
        origin: data.origin,
        status: data.status,
        targetDate: data.targetDate,
      };
    });
  }

  return {
    header: {
      productName: 'Sobredot — uma solução da Oficina das Emoções',
      childName: child.name,
      period: { key: period.key, startAt: period.start.toISOString(), endAt: period.end.toISOString() },
      generatedAt: new Date().toISOString(),
    },
    modules,
    sections,
    sensitivePreview: {
      recordCount: sensitivePreview.recordCount,
      documentCount: sensitivePreview.documentCount,
      categories: [...sensitivePreview.categories],
      includesMedication: sensitivePreview.categories.has('medication'),
    },
    disclaimer: REPORT_DISCLAIMER,
  };
}

async function loadChildAndPeriod(data, uid) {
  const { childId, periodKey, customRange, modules, timeZone } = data || {};
  if (typeof childId !== 'string' || !childId) {
    throw new HttpsError('invalid-argument', 'Criança inválida.');
  }
  validateModules(modules);

  const childSnap = await db.doc(`children/${childId}`).get();
  if (!childSnap.exists || childSnap.data().deletedAt) {
    throw new HttpsError('not-found', 'Criança não encontrada.');
  }
  const child = childSnap.data();
  await requireFamilyMembership(child.familyId, uid);

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

  return { childId, child, period, modules, timeZone: typeof timeZone === 'string' && timeZone ? timeZone : 'UTC' };
}

/**
 * Pré-visualização do relatório (não persiste nada) — usada pela
 * interface para o utilizador escolher módulos/documentos/período antes
 * de gerar/partilhar, incluindo a pré-visualização obrigatória de
 * informações sensíveis.
 */
async function generateReportHandler(data, uid) {
  const { childId, child, period, modules, timeZone } = await loadChildAndPeriod(data, uid);
  await enforcePerUserLimit('generate_report', uid, LIMITS.REPORT_PER_USER);
  const documentIds = Array.isArray(data.documentIds) ? data.documentIds.slice(0, 50) : [];
  return assembleReport({ childId, child, period, modules, documentIds, timeZone });
}

const generateReport = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  return generateReportHandler(data, uid);
});

/**
 * Gera um link de partilha temporário e revogável. O conteúdo é montado
 * AQUI (nunca aceite do cliente) e guardado congelado — a partir deste
 * momento, revogar os documentos/insights originais não altera o que já
 * foi partilhado (mas revogar o PRÓPRIO link torna-o imediatamente
 * inacessível).
 */
async function createReportShareLinkHandler(data, uid) {
  const { childId, child, period, modules, timeZone } = await loadChildAndPeriod(data, uid);
  await enforcePerUserLimit('create_share_link', uid, LIMITS.SHARE_LINK_PER_USER);
  const documentIds = Array.isArray(data.documentIds) ? data.documentIds.slice(0, 50) : [];

  const expiresInHours = Number(data.expiresInHours);
  if (!Number.isFinite(expiresInHours) || expiresInHours <= 0 || expiresInHours > MAX_SHARE_HOURS) {
    throw new HttpsError('invalid-argument', `A validade tem de estar entre 1 e ${MAX_SHARE_HOURS} horas.`);
  }

  const reportSnapshot = await assembleReport({ childId, child, period, modules, documentIds, timeZone });

  const token = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = Timestamp.fromMillis(Date.now() + expiresInHours * 60 * 60 * 1000);

  const shareRef = db.collection(`children/${childId}/reportShares`).doc();
  await shareRef.set({
    childId,
    familyId: child.familyId,
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    revokedAt: null,
    revokedBy: null,
    tokenHash,
    scope: { modules, documentIds, periodKey: period.key },
    reportSnapshot,
    accessCount: 0,
    lastAccessedAt: null,
  });

  await writeAuditEvent({
    action: 'report_share.created',
    actorUid: uid,
    targetType: 'reportShare',
    targetId: shareRef.id,
    familyId: child.familyId,
    childId,
    metadata: { modules, expiresInHours },
  });

  return { shareId: shareRef.id, token, expiresAt: expiresAt.toMillis() };
}

const createReportShareLink = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  return createReportShareLinkHandler(data, uid);
});

async function revokeReportShareLinkHandler(data, uid) {
  const { childId, shareId } = data || {};
  if (typeof childId !== 'string' || !childId || typeof shareId !== 'string' || !shareId) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  const childSnap = await db.doc(`children/${childId}`).get();
  if (!childSnap.exists) {
    throw new HttpsError('not-found', 'Criança não encontrada.');
  }
  await requireFamilyMembership(childSnap.data().familyId, uid);

  const shareRef = db.doc(`children/${childId}/reportShares/${shareId}`);
  const shareSnap = await shareRef.get();
  if (!shareSnap.exists) {
    throw new HttpsError('not-found', 'Ligação de partilha não encontrada.');
  }

  await shareRef.update({ revokedAt: FieldValue.serverTimestamp(), revokedBy: uid });

  await writeAuditEvent({
    action: 'report_share.revoked',
    actorUid: uid,
    targetType: 'reportShare',
    targetId: shareId,
    familyId: childSnap.data().familyId,
    childId,
  });

  return { ok: true };
}

const revokeReportShareLink = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  return revokeReportShareLinkHandler(data, uid);
});

/**
 * Acesso público (sem sessão) através de um link de partilha. NUNCA lê
 * diretamente o Firestore do lado do cliente — este é o único caminho de
 * leitura, à semelhança das URLs assinadas do cofre de documentos (ver
 * docs/decisions.md, decisão 14). O token nunca é comparado por
 * igualdade direta (timing-safe).
 */
async function getSharedReportHandler(data) {
  const { childId, shareId, token } = data || {};
  if (
    typeof childId !== 'string' || !childId ||
    typeof shareId !== 'string' || !shareId ||
    !isNonEmptyString(token, 200)
  ) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  const shareRef = db.doc(`children/${childId}/reportShares/${shareId}`);
  const shareSnap = await shareRef.get();
  if (!shareSnap.exists) {
    throw new HttpsError('not-found', 'Ligação de partilha não encontrada ou já eliminada.');
  }
  const share = shareSnap.data();

  if (share.revokedAt) {
    throw new HttpsError('failed-precondition', 'Esta ligação de partilha foi revogada.');
  }
  if (share.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError('failed-precondition', 'Esta ligação de partilha expirou.');
  }
  if (!safeCompareHash(hashToken(token), share.tokenHash)) {
    throw new HttpsError('permission-denied', 'Ligação de partilha inválida.');
  }

  await shareRef.update({
    accessCount: FieldValue.increment(1),
    lastAccessedAt: FieldValue.serverTimestamp(),
  });

  return { reportSnapshot: share.reportSnapshot, scope: share.scope, disclaimer: REPORT_DISCLAIMER };
}

const getSharedReport = functions.https.onCall(async (data) => getSharedReportHandler(data));

module.exports = {
  REPORT_DISCLAIMER,
  assembleReport,
  generateReport,
  createReportShareLink,
  revokeReportShareLink,
  getSharedReport,
  // exportados para testes de integração diretos contra o emulador (ver
  // tests/rules/), sem precisar do Functions Emulator completo.
  generateReportHandler,
  createReportShareLinkHandler,
  revokeReportShareLinkHandler,
  getSharedReportHandler,
};
