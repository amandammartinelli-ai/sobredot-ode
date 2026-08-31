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

module.exports = { onUserCreate, setAdminClaim };
