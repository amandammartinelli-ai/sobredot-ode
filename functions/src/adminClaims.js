/**
 * Perfil de utilizador e papel de administrador técnico.
 *
 * O primeiro administrador NUNCA é criado através desta função — seria
 * uma forma de autopromoção. É criado uma única vez, manualmente, com
 * `scripts/bootstrap-admin.js` (Admin SDK com credenciais de serviço,
 * nunca através de um pedido HTTP). A partir daí, só um administrador já
 * existente pode promover ou despromover outra conta.
 */
const { regionalFunctions: functions, HttpsError } = require('./regional');
const { db, auth } = require('./init');
const { FieldValue } = require('firebase-admin/firestore');
const { writeAuditEvent } = require('./audit');

const onUserCreate = functions.auth.user().onCreate(async (user) => {
  await db
    .collection('users')
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
});

/**
 * Auditoria de início de sessão (Etapa 5). Chamada pelo cliente logo a
 * seguir a um login bem-sucedido (ver src/services/authService.js).
 * Nota de limitação honesta: por ser iniciada pelo cliente, é
 * telemetria "melhor esforço" (um cliente malicioso podia nunca a
 * chamar) — nunca um controlo de segurança por si só. A fronteira de
 * segurança real continua a ser sempre `firestore.rules`/
 * `resolveChildAccess`, nunca este registo. Um mecanismo de deteção de
 * início de sessão ao nível do próprio fornecedor de identidade (ex.:
 * Cloud Identity Platform "blocking functions") fica para uma etapa de
 * produção futura — ver docs/security-hardening.md.
 */
const logLoginEvent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new HttpsError('unauthenticated', 'É necessário iniciar sessão.');
  }
  await writeAuditEvent({
    action: 'auth.login',
    actorUid: context.auth.uid,
    targetType: 'user',
    targetId: context.auth.uid,
  });
  return { ok: true };
});

const setAdminClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new HttpsError(
      'permission-denied',
      'Só um administrador técnico existente pode atribuir este papel.'
    );
  }

  const { uid, admin: makeAdmin } = data || {};
  if (typeof uid !== 'string' || !uid || typeof makeAdmin !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }

  await auth.setCustomUserClaims(uid, { admin: makeAdmin });

  await writeAuditEvent({
    action: makeAdmin ? 'admin.granted' : 'admin.revoked',
    actorUid: context.auth.uid,
    targetType: 'user',
    targetId: uid,
  });

  return { ok: true };
});

module.exports = { onUserCreate, setAdminClaim, logLoginEvent };
