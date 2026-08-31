/**
 * Gestão de família — criação, convites e remoção de membros.
 *
 * Estas operações NUNCA são feitas por escrita direta do cliente ao
 * Firestore (ver firestore.rules: families e members têm `allow write:
 * if false`). Isto elimina, por construção, a possibilidade de um
 * utilizador se auto-atribuir o papel de "owner" ou entrar numa família
 * alheia.
 *
 * Limitação conhecida desta etapa: um utilizador só pode pertencer a UMA
 * família (verificado por consulta collectionGroup). Multi-família (ex.:
 * pais em agregados separados) fica para trabalho futuro — ver
 * docs/roadmap.md.
 *
 * Limitação conhecida: o envio de e-mail de convite não está implementado
 * (exigiria um fornecedor de e-mail transacional). O link de convite é
 * devolvido ao proprietário para partilhar manualmente.
 */
const { regionalFunctions: functions, HttpsError } = require('./regional');
const crypto = require('crypto');
const { db } = require('./init');
const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const { writeAuditEvent } = require('./audit');
const {
  requireAuth,
  requireVerifiedEmail,
  requireFamilyOwner,
  isNonEmptyString,
  isValidEmail,
} = require('./util');

const INVITE_TTL_DAYS = 7;

async function userHasFamily(uid) {
  const snap = await db
    .collectionGroup('members')
    .where('uid', '==', uid)
    .limit(1)
    .get();
  return !snap.empty;
}

const createFamily = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const name = (data && data.name ? String(data.name) : '').trim();

  if (!isNonEmptyString(name, 120)) {
    throw new HttpsError('invalid-argument', 'Nome da família inválido.');
  }
  if (await userHasFamily(uid)) {
    throw new HttpsError('already-exists', 'Já pertence a uma família.');
  }

  const familyRef = db.collection('families').doc();
  const memberRef = familyRef.collection('members').doc(uid);
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    tx.set(familyRef, {
      name,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
    });
    tx.set(memberRef, {
      uid,
      role: 'owner',
      status: 'active',
      invitedBy: null,
      joinedAt: now,
    });
    // Ponteiro de conveniência no perfil do utilizador — só o servidor o
    // escreve (ver firestore.rules: o cliente não pode alterar
    // "familyId" no seu próprio perfil). Não é uma decisão de permissão,
    // só evita que o cliente tenha de "adivinhar" a que família pertence
    // ao iniciar sessão num dispositivo novo.
    tx.set(db.doc(`users/${uid}`), { familyId: familyRef.id }, { merge: true });
  });

  await writeAuditEvent({
    action: 'family.created',
    actorUid: uid,
    targetType: 'family',
    targetId: familyRef.id,
    familyId: familyRef.id,
  });

  return { familyId: familyRef.id };
});

const inviteFamilyMember = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { familyId, email } = data || {};

  if (!isNonEmptyString(familyId, 200)) {
    throw new HttpsError('invalid-argument', 'Família inválida.');
  }
  if (!isValidEmail(email)) {
    throw new HttpsError('invalid-argument', 'E-mail inválido.');
  }

  await requireFamilyOwner(familyId, uid);

  const token = crypto.randomBytes(24).toString('base64url');
  const now = FieldValue.serverTimestamp();
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const inviteRef = db.collection('families').doc(familyId).collection('invites').doc();
  await inviteRef.set({
    familyId,
    email: email.toLowerCase(),
    role: 'caregiver',
    token,
    status: 'pending',
    invitedBy: uid,
    createdAt: now,
    expiresAt,
    acceptedByUid: null,
    acceptedAt: null,
  });

  await writeAuditEvent({
    action: 'family.member_invited',
    actorUid: uid,
    targetType: 'invite',
    targetId: inviteRef.id,
    familyId,
  });

  // O token só é devolvido nesta resposta — não fica visível para mais
  // ninguém através de leitura normal do documento (ver firestore.rules:
  // invites só permite leitura ao proprietário, ao administrador ou ao
  // próprio convidado pelo e-mail, mas quem aceita tem de fornecer o
  // token que só o proprietário recebeu aqui).
  return { inviteId: inviteRef.id, token, expiresAt: expiresAt.toMillis() };
});

const acceptFamilyInvite = functions.https.onCall(async (data, context) => {
  const uid = requireVerifiedEmail(context);
  const email = (context.auth.token.email || '').toLowerCase();
  const { familyId, inviteId, token } = data || {};

  if (!isNonEmptyString(familyId, 200) || !isNonEmptyString(inviteId, 200) || !isNonEmptyString(token, 200)) {
    throw new HttpsError('invalid-argument', 'Convite inválido.');
  }
  if (await userHasFamily(uid)) {
    throw new HttpsError('already-exists', 'Já pertence a uma família.');
  }

  const inviteRef = db.doc(`families/${familyId}/invites/${inviteId}`);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new HttpsError('not-found', 'Convite não encontrado.');
  }
  const invite = inviteSnap.data();

  if (invite.status !== 'pending') {
    throw new HttpsError('failed-precondition', 'Este convite já não está disponível.');
  }
  if (invite.token !== token) {
    throw new HttpsError('permission-denied', 'Convite inválido.');
  }
  if (invite.email !== email) {
    throw new HttpsError('permission-denied', 'Este convite foi emitido para outro e-mail.');
  }
  if (invite.expiresAt.toMillis() < Date.now()) {
    await inviteRef.update({ status: 'expired' });
    throw new HttpsError('failed-precondition', 'Este convite expirou.');
  }

  const memberRef = db.doc(`families/${familyId}/members/${uid}`);
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    tx.set(memberRef, {
      uid,
      role: invite.role || 'caregiver',
      status: 'active',
      invitedBy: invite.invitedBy,
      joinedAt: now,
    });
    tx.update(inviteRef, {
      status: 'accepted',
      acceptedByUid: uid,
      acceptedAt: now,
    });
    tx.set(db.doc(`users/${uid}`), { familyId }, { merge: true });
  });

  await writeAuditEvent({
    action: 'family.member_joined',
    actorUid: uid,
    targetType: 'family',
    targetId: familyId,
    familyId,
  });

  return { familyId };
});

const removeFamilyMember = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const { familyId, memberUid } = data || {};

  if (!isNonEmptyString(familyId, 200) || !isNonEmptyString(memberUid, 200)) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos.');
  }
  await requireFamilyOwner(familyId, uid);

  if (memberUid === uid) {
    throw new HttpsError(
      'failed-precondition',
      'O responsável proprietário não pode remover-se a si próprio.'
    );
  }

  await db.doc(`families/${familyId}/members/${memberUid}`).delete();

  await writeAuditEvent({
    action: 'family.member_removed',
    actorUid: uid,
    targetType: 'family',
    targetId: memberUid,
    familyId,
  });

  return { ok: true };
});

module.exports = { createFamily, inviteFamilyMember, acceptFamilyInvite, removeFamilyMember };
