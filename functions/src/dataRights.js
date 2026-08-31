/**
 * Direitos da família sobre os seus dados (Etapa 5): acesso/exportação,
 * restrição de processamento e eliminação — sempre com confirmação
 * reforçada e um caminho auditável para as ações destrutivas.
 *
 * Acesso e correção já existem desde a Etapa 2 (a família lê/edita os
 * seus próprios registos diretamente, sujeito a `firestore.rules`).
 * Revogação de acessos já existe desde a Etapa 2
 * (`revokeAccessGrant`). Este ficheiro cobre o que faltava: exportação
 * estruturada, restrição de processamento de IA por criança, e o pedido
 * de eliminação com prazo de reflexão e cancelamento.
 */
const { regionalFunctions: functions, HttpsError } = require('./regional');
const { db, storage, Timestamp, FieldValue } = require('./init');
const { writeAuditEvent } = require('./audit');
const { requireAuth, requireFamilyOwner, requireFamilyMembership, isNonEmptyString } = require('./util');
const { enforcePerUserLimit, LIMITS } = require('./rateLimit');

const DELETION_GRACE_DAYS = 14;
const EXPORT_FORMAT_VERSION = 'sobredot-export-v1';

/**
 * Converte recursivamente qualquer `Timestamp` do Firestore em string
 * ISO 8601 — necessário porque o valor devolvido por um callable
 * atravessa a mesma fronteira de serialização documentada em
 * functions/src/reports.js (ver docs/decisions.md).
 */
function serializeForExport(value) {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeForExport);
  if (typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([key, v]) => {
      out[key] = serializeForExport(v);
    });
    return out;
  }
  return value;
}

async function collectionAsArray(ref) {
  const snap = await ref.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Exportação estruturada e legível (JSON) de tudo o que a família tem
 * guardado na Sobredot — ver docs/insights.md e docs/data-model.md para
 * o significado de cada campo. NÃO inclui os ficheiros binários do
 * cofre de documentos (permanecem grandes demais para um único
 * documento de resposta e já têm o seu próprio caminho de download,
 * sempre por URL assinada — ver `getDocumentDownloadUrl`); inclui os
 * seus METADADOS e a extração já revista, para que a exportação continue
 * a ser completa quanto à informação, mesmo sem o ficheiro original.
 */
async function exportFamilyDataHandler(data, uid) {
  const { familyId } = data || {};
  if (!isNonEmptyString(familyId, 200)) {
    throw new HttpsError('invalid-argument', 'Família inválida.');
  }
  await requireFamilyMembership(familyId, uid);
  await enforcePerUserLimit('export_data', uid, LIMITS.EXPORT_PER_USER);

  const familySnap = await db.doc(`families/${familyId}`).get();
  if (!familySnap.exists) {
    throw new HttpsError('not-found', 'Família não encontrada.');
  }

  const [members, invites, tags, familyConsents, childrenSnap] = await Promise.all([
    collectionAsArray(db.collection(`families/${familyId}/members`)),
    collectionAsArray(db.collection(`families/${familyId}/invites`)),
    collectionAsArray(db.collection(`families/${familyId}/tags`)),
    collectionAsArray(db.collection(`families/${familyId}/consents`)),
    db.collection('children').where('familyId', '==', familyId).get(),
  ]);

  const children = await Promise.all(
    childrenSnap.docs.map(async (childDoc) => {
      const childId = childDoc.id;
      const [records, medications, consents, accessGrants, documents, goals, insights] = await Promise.all([
        collectionAsArray(db.collection(`children/${childId}/records`)),
        collectionAsArray(db.collection(`children/${childId}/medications`)),
        collectionAsArray(db.collection(`children/${childId}/consents`)),
        collectionAsArray(db.collection(`children/${childId}/accessGrants`)),
        collectionAsArray(db.collection(`children/${childId}/documents`)),
        collectionAsArray(db.collection(`children/${childId}/goals`)),
        collectionAsArray(db.collection(`children/${childId}/insights`)),
      ]);

      const documentsWithExtraction = await Promise.all(
        documents.map(async (documentMeta) => ({
          ...documentMeta,
          extractionItems: await collectionAsArray(
            db.collection(`children/${childId}/documents/${documentMeta.id}/extractionItems`)
          ),
        }))
      );

      return {
        profile: { id: childId, ...childDoc.data() },
        records,
        medications,
        consents,
        accessGrants,
        documents: documentsWithExtraction,
        goals,
        insights,
      };
    })
  );

  await writeAuditEvent({
    action: 'data.exported',
    actorUid: uid,
    targetType: 'family',
    targetId: familyId,
    familyId,
    metadata: { childCount: children.length },
  });

  const payload = {
    format: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    family: { id: familyId, ...familySnap.data() },
    members,
    invites,
    tags,
    consents: familyConsents,
    children,
    disclaimer:
      'Esta exportação contém uma cópia estruturada dos dados guardados sobre a sua família na Sobredot. Não inclui os ficheiros binários dos documentos do cofre — descarregue-os individualmente em Documentos.',
  };

  return serializeForExport(payload);
}

const exportFamilyData = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  return exportFamilyDataHandler(data, uid);
});

/**
 * Restrição de processamento (RGPD, art. 18-like): quando ativa, a
 * criança continua com os registos/documentos normais (leitura,
 * registo, consulta), mas o gateway de IA (`askDocuments`) e a geração
 * de insights (`generateInsights`) recusam-se a processar essa criança
 * até a família reverter a restrição.
 */
async function setChildProcessingRestrictionHandler(data, uid) {
  const { childId, restricted } = data || {};
  if (typeof childId !== 'string' || !childId || typeof restricted !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  const childRef = db.doc(`children/${childId}`);
  const childSnap = await childRef.get();
  if (!childSnap.exists || childSnap.data().deletedAt) {
    throw new HttpsError('not-found', 'Criança não encontrada.');
  }
  const child = childSnap.data();
  await requireFamilyMembership(child.familyId, uid);

  await childRef.update({
    processingRestricted: restricted,
    processingRestrictedAt: restricted ? FieldValue.serverTimestamp() : null,
    processingRestrictedBy: restricted ? uid : null,
  });

  await writeAuditEvent({
    action: restricted ? 'child.processing_restricted' : 'child.processing_unrestricted',
    actorUid: uid,
    targetType: 'child',
    targetId: childId,
    familyId: child.familyId,
    childId,
  });

  return { ok: true };
}

const setChildProcessingRestriction = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  return setChildProcessingRestrictionHandler(data, uid);
});

/**
 * Pedido de eliminação da família — nunca imediato. Fica agendado com um
 * prazo de reflexão (`DELETION_GRACE_DAYS`), durante o qual pode ser
 * cancelado por qualquer momento pelo proprietário. Exige confirmação
 * reforçada (o nome exato da família, não só um "sim/não").
 */
async function requestFamilyDeletionHandler(data, uid) {
  const { familyId, confirmationText, reason } = data || {};
  if (!isNonEmptyString(familyId, 200)) {
    throw new HttpsError('invalid-argument', 'Família inválida.');
  }

  const familyRef = db.doc(`families/${familyId}`);
  const familySnap = await familyRef.get();
  if (!familySnap.exists) {
    throw new HttpsError('not-found', 'Família não encontrada.');
  }
  await requireFamilyOwner(familyId, uid);
  const family = familySnap.data();

  if (family.deletionRequest && family.deletionRequest.status === 'pending') {
    throw new HttpsError('failed-precondition', 'Já existe um pedido de eliminação pendente para esta família.');
  }
  if (confirmationText !== family.name) {
    throw new HttpsError(
      'failed-precondition',
      'Confirmação incorreta — escreva exatamente o nome da família para confirmar a eliminação.'
    );
  }

  const scheduledFor = Timestamp.fromMillis(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  await familyRef.update({
    deletionRequest: {
      status: 'pending',
      requestedBy: uid,
      requestedAt: FieldValue.serverTimestamp(),
      scheduledFor,
      reason: typeof reason === 'string' ? reason.slice(0, 500) : null,
      cancelledAt: null,
      cancelledBy: null,
    },
  });

  await writeAuditEvent({
    action: 'family.deletion_requested',
    actorUid: uid,
    targetType: 'family',
    targetId: familyId,
    familyId,
    metadata: { scheduledFor: scheduledFor.toMillis() },
  });

  return { ok: true, scheduledFor: scheduledFor.toMillis() };
}

const requestFamilyDeletion = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  return requestFamilyDeletionHandler(data, uid);
});

async function cancelFamilyDeletionHandler(data, uid) {
  const { familyId } = data || {};
  if (!isNonEmptyString(familyId, 200)) {
    throw new HttpsError('invalid-argument', 'Família inválida.');
  }

  const familyRef = db.doc(`families/${familyId}`);
  const familySnap = await familyRef.get();
  if (!familySnap.exists) {
    throw new HttpsError('not-found', 'Família não encontrada.');
  }
  await requireFamilyOwner(familyId, uid);
  const deletionRequest = familySnap.data().deletionRequest;

  if (!deletionRequest || deletionRequest.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Não existe nenhum pedido de eliminação pendente.');
  }

  await familyRef.update({
    'deletionRequest.status': 'cancelled',
    'deletionRequest.cancelledAt': FieldValue.serverTimestamp(),
    'deletionRequest.cancelledBy': uid,
  });

  await writeAuditEvent({
    action: 'family.deletion_cancelled',
    actorUid: uid,
    targetType: 'family',
    targetId: familyId,
    familyId,
  });

  return { ok: true };
}

const cancelFamilyDeletion = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  return cancelFamilyDeletionHandler(data, uid);
});

/**
 * Elimina fisicamente TODOS os dados de uma família (Firestore e
 * Storage) — chamada só pelo processamento agendado, nunca por um
 * pedido direto do cliente. Idempotente o suficiente para ser
 * reexecutada em segurança (cada apagamento verifica existência
 * primeiro através do próprio SDK, que já trata "documento inexistente"
 * como sucesso).
 *
 * Âmbito assumido: elimina todos os dados do produto (crianças,
 * registos, documentos incluindo ficheiros no Storage, insights, metas,
 * concessões, consentimentos, convites). NÃO elimina as contas de
 * autenticação Firebase dos membros — ver docs/threat-model.md /
 * docs/data-map.md, "Limitação conhecida", para a justificação e para
 * o procedimento manual complementar.
 */
async function deleteFamilyDataCompletely(familyId) {
  const childrenSnap = await db.collection('children').where('familyId', '==', familyId).get();

  for (const childDoc of childrenSnap.docs) {
    const childId = childDoc.id;
    // eslint-disable-next-line no-await-in-loop
    const documentsSnap = await db.collection(`children/${childId}/documents`).get();

    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      documentsSnap.docs.map(async (documentDoc) => {
        const versionsSnap = await documentDoc.ref.collection('versions').get();
        await Promise.all(
          versionsSnap.docs.map((versionDoc) =>
            storage
              .bucket()
              .file(versionDoc.data().storagePath)
              .delete({ ignoreNotFound: true })
              .catch(() => null)
          )
        );
      })
    );

    // eslint-disable-next-line no-await-in-loop
    await db.recursiveDelete(childDoc.ref);
  }

  const membersSnap = await db.collection(`families/${familyId}/members`).get();
  await Promise.all(
    membersSnap.docs.map((memberDoc) => db.doc(`users/${memberDoc.id}`).set({ familyId: null }, { merge: true }))
  );

  const familyRef = db.doc(`families/${familyId}`);
  await db.recursiveDelete(familyRef);

  await writeAuditEvent({
    action: 'family.deleted',
    actorUid: null,
    actorRole: 'system',
    targetType: 'family',
    targetId: familyId,
    familyId,
    metadata: { childCount: childrenSnap.size },
  });
}

/**
 * Corre diariamente (mesmo padrão de `cleanupExpiredGrants`/
 * `purgeExpiredDocuments`): processa qualquer pedido de eliminação cujo
 * prazo de reflexão já tenha passado.
 */
const processScheduledDeletions = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const now = Timestamp.now();
  const familiesSnap = await db
    .collection('families')
    .where('deletionRequest.status', '==', 'pending')
    .where('deletionRequest.scheduledFor', '<=', now)
    .get();

  for (const familyDoc of familiesSnap.docs) {
    // eslint-disable-next-line no-await-in-loop
    await deleteFamilyDataCompletely(familyDoc.id);
  }

  return null;
});

const AI_QUERY_LOG_RETENTION_DAYS = 180;
const RATE_LIMIT_COUNTER_RETENTION_DAYS = 7;

/**
 * Retenção de metadados técnicos derivados (Etapa 5) — nunca conteúdo em
 * si: registos de "Perguntar aos documentos" (`aiQueries`, só metadados
 * desde a Etapa 3 — ver docs/logging-policy.md) e contadores de
 * anti-abuso (`rateLimits`). Ambos são "cópias derivadas" que não têm
 * motivo para sobreviver indefinidamente. Ver docs/data-map.md,
 * "Retenção por categoria".
 */
const purgeOldTechnicalLogs = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const aiQueryCutoff = Timestamp.fromMillis(Date.now() - AI_QUERY_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const oldAiQueries = await db.collectionGroup('aiQueries').where('createdAt', '<=', aiQueryCutoff).get();
  await Promise.all(oldAiQueries.docs.map((d) => d.ref.delete()));

  const rateLimitCutoff = Timestamp.fromMillis(Date.now() - RATE_LIMIT_COUNTER_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const oldRateLimits = await db.collection('rateLimits').where('updatedAt', '<=', rateLimitCutoff).get();
  await Promise.all(oldRateLimits.docs.map((d) => d.ref.delete()));

  return null;
});

module.exports = {
  exportFamilyData,
  exportFamilyDataHandler,
  setChildProcessingRestriction,
  setChildProcessingRestrictionHandler,
  requestFamilyDeletion,
  requestFamilyDeletionHandler,
  cancelFamilyDeletion,
  cancelFamilyDeletionHandler,
  processScheduledDeletions,
  deleteFamilyDataCompletely,
  purgeOldTechnicalLogs,
  serializeForExport,
};
