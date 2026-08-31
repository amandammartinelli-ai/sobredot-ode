/**
 * Concessões de acesso (escola/profissional) e o "accessIndex" — o
 * documento achatado que as regras do Firestore e do Storage consultam
 * para decidir, em tempo real, se um colaborador externo pode ver/registar
 * conteúdo de uma criança específica.
 *
 * O ciclo de vida de uma concessão é sempre gerido por estas funções — o
 * cliente nunca escreve diretamente em accessGrants nem em accessIndex
 * (ver firestore.rules). O `onAccessGrantWrite` mantém o accessIndex
 * sincronizado sempre que uma concessão é criada, aceite, atualizada ou
 * revogada.
 *
 * Importante: as regras do Firestore NUNCA confiam no campo `status` do
 * accessIndex — comparam sempre `expiresAt` com o tempo do pedido. O
 * campo `status` na concessão (accessGrants) serve apenas para a
 * interface mostrar o estado a humanos.
 */
const { regionalFunctions: functions, HttpsError } = require('./regional');
const { db } = require('./init');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { writeAuditEvent } = require('./audit');
const { requireAuth, requireVerifiedEmail, requireChildFamilyOwner, isValidEmail } = require('./util');

const VALID_ROLES = ['school_collaborator', 'professional_reviewer'];
const VALID_CAPABILITIES = ['view', 'register', 'comment', 'validate'];
const VALID_CATEGORIES = [
  'emotions', 'behaviors', 'sleep', 'food', 'medication',
  'school', 'communication', 'sensory', 'achievements', 'observations',
  'documents', 'all',
];
const MAX_GRANT_DAYS = 365;

function validateGrantInput({ role, capabilities, scopeCategories, expiresAtMillis }) {
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', 'Papel de concessão inválido.');
  }
  if (
    !Array.isArray(capabilities) ||
    capabilities.length === 0 ||
    !capabilities.every((c) => VALID_CAPABILITIES.includes(c))
  ) {
    throw new HttpsError('invalid-argument', 'Capacidades inválidas.');
  }
  if (
    !Array.isArray(scopeCategories) ||
    scopeCategories.length === 0 ||
    !scopeCategories.every((c) => VALID_CATEGORIES.includes(c))
  ) {
    throw new HttpsError('invalid-argument', 'Âmbito de categorias inválido.');
  }
  const now = Date.now();
  const maxMillis = now + MAX_GRANT_DAYS * 24 * 60 * 60 * 1000;
  if (typeof expiresAtMillis !== 'number' || expiresAtMillis <= now || expiresAtMillis > maxMillis) {
    throw new HttpsError(
      'invalid-argument',
      `A validade tem de estar entre agora e ${MAX_GRANT_DAYS} dias.`
    );
  }
}

const createAccessGrant = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { childId, granteeEmail, role, capabilities, scopeCategories, expiresAtMillis } = data || {};

  if (typeof childId !== 'string' || !childId) {
    throw new HttpsError('invalid-argument', 'Criança inválida.');
  }
  if (!isValidEmail(granteeEmail)) {
    throw new HttpsError('invalid-argument', 'E-mail do concessionário inválido.');
  }
  validateGrantInput({ role, capabilities, scopeCategories, expiresAtMillis });

  const child = await requireChildFamilyOwner(childId, uid);

  const grantRef = db.collection(`children/${childId}/accessGrants`).doc();
  const now = FieldValue.serverTimestamp();

  await grantRef.set({
    childId,
    familyId: child.familyId,
    granteeEmail: granteeEmail.toLowerCase(),
    granteeUid: null,
    role,
    capabilities,
    scopeCategories,
    startAt: now,
    expiresAt: Timestamp.fromMillis(expiresAtMillis),
    revokedAt: null,
    revokedBy: null,
    grantedBy: uid,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  return { grantId: grantRef.id };
});

const acceptAccessGrant = functions.https.onCall(async (data, context) => {
  const uid = requireVerifiedEmail(context);
  const email = (context.auth.token.email || '').toLowerCase();
  const { childId, grantId } = data || {};

  if (typeof childId !== 'string' || !childId || typeof grantId !== 'string' || !grantId) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  const grantRef = db.doc(`children/${childId}/accessGrants/${grantId}`);
  const grantSnap = await grantRef.get();
  if (!grantSnap.exists) {
    throw new HttpsError('not-found', 'Concessão não encontrada.');
  }
  const grant = grantSnap.data();

  if (grant.revokedAt) {
    throw new HttpsError('failed-precondition', 'Esta concessão foi revogada.');
  }
  if (grant.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError('failed-precondition', 'Esta concessão expirou.');
  }
  if (grant.granteeEmail !== email) {
    throw new HttpsError('permission-denied', 'Esta concessão foi emitida para outro e-mail.');
  }

  await grantRef.update({
    granteeUid: uid,
    status: 'active',
    acceptedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { childId, grantId };
});

const revokeAccessGrant = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { childId, grantId } = data || {};

  if (typeof childId !== 'string' || !childId || typeof grantId !== 'string' || !grantId) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  await requireChildFamilyOwner(childId, uid);

  const grantRef = db.doc(`children/${childId}/accessGrants/${grantId}`);
  const grantSnap = await grantRef.get();
  if (!grantSnap.exists) {
    throw new HttpsError('not-found', 'Concessão não encontrada.');
  }

  await grantRef.update({
    revokedAt: FieldValue.serverTimestamp(),
    revokedBy: uid,
    status: 'revoked',
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

const onAccessGrantWrite = functions.firestore
  .document('children/{childId}/accessGrants/{grantId}')
  .onWrite(async (change, context) => {
    const { childId, grantId } = context.params;
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return null;

    const isActive = Boolean(
      after.granteeUid && !after.revokedAt && after.expiresAt && after.expiresAt.toMillis() > Date.now()
    );

    if (after.granteeUid) {
      const indexRef = db.doc(`children/${childId}/accessIndex/${after.granteeUid}`);
      if (isActive) {
        await indexRef.set({
          granteeUid: after.granteeUid,
          childId,
          familyId: after.familyId,
          grantId,
          capabilities: after.capabilities,
          scopeCategories: after.scopeCategories,
          expiresAt: after.expiresAt,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        await indexRef.delete().catch(() => null);
      }
    }

    const before = change.before.exists ? change.before.data() : null;
    let action = 'access_grant.updated';
    if (!before) action = 'access_grant.created';
    else if (!before.revokedAt && after.revokedAt) action = 'access_grant.revoked';
    else if (!before.granteeUid && after.granteeUid) action = 'access_grant.accepted';

    return writeAuditEvent({
      action,
      actorUid: after.revokedAt ? after.revokedBy : after.grantedBy,
      targetType: 'accessGrant',
      targetId: grantId,
      familyId: after.familyId,
      childId,
      metadata: { role: after.role, capabilities: after.capabilities, scopeCategories: after.scopeCategories },
    });
  });

// Faxina diária: remove entradas do accessIndex cuja validade já passou e
// marca a concessão de origem como "expired" para a interface. Isto é só
// conveniência de apresentação — a segurança nunca depende desta função,
// porque as regras do Firestore/Storage já comparam `expiresAt` em cada
// pedido (ver firestore.rules, grantActive()).
const cleanupExpiredGrants = functions.pubsub.schedule('every 24 hours').onRun(async () => {
  const now = Timestamp.now();
  const expiredIndexEntries = await db
    .collectionGroup('accessIndex')
    .where('expiresAt', '<', now)
    .get();

  const batchDeletes = expiredIndexEntries.docs.map((doc) => doc.ref.delete());
  await Promise.all(batchDeletes);

  const expiredGrants = await db
    .collectionGroup('accessGrants')
    .where('expiresAt', '<', now)
    .where('status', '==', 'active')
    .get();

  const batchUpdates = expiredGrants.docs.map((doc) => doc.ref.update({ status: 'expired' }));
  await Promise.all(batchUpdates);

  return null;
});

module.exports = {
  createAccessGrant,
  acceptAccessGrant,
  revokeAccessGrant,
  onAccessGrantWrite,
  cleanupExpiredGrants,
};
