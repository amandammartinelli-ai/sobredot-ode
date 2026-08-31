const { HttpsError } = require('./regional');
const { db } = require('./init');

function requireAuth(context) {
  if (!context.auth) {
    throw new HttpsError('unauthenticated', 'É necessário iniciar sessão.');
  }
  return context.auth.uid;
}

function requireVerifiedEmail(context) {
  const uid = requireAuth(context);
  if (!context.auth.token.email_verified) {
    throw new HttpsError(
      'failed-precondition',
      'É necessário confirmar o e-mail antes de continuar.'
    );
  }
  return uid;
}

async function getFamilyMember(familyId, uid) {
  const snap = await db.doc(`families/${familyId}/members/${uid}`).get();
  return snap.exists ? snap.data() : null;
}

async function requireFamilyOwner(familyId, uid) {
  const member = await getFamilyMember(familyId, uid);
  if (!member || member.role !== 'owner') {
    throw new HttpsError(
      'permission-denied',
      'Só o responsável proprietário da família pode executar esta ação.'
    );
  }
  return member;
}

async function requireFamilyMembership(familyId, uid) {
  const member = await getFamilyMember(familyId, uid);
  if (!member) {
    throw new HttpsError('permission-denied', 'Não pertence a esta família.');
  }
  return member;
}

async function requireChildFamilyOwner(childId, uid) {
  const childSnap = await db.doc(`children/${childId}`).get();
  if (!childSnap.exists || childSnap.data().deletedAt) {
    throw new HttpsError('not-found', 'Criança não encontrada.');
  }
  const child = childSnap.data();
  await requireFamilyOwner(child.familyId, uid);
  return child;
}

/**
 * Resolve, do lado do servidor, se `uid` pode ver os documentos de
 * `childId` — ou por pertencer à família dona, ou por ter uma concessão
 * de acesso ativa com a capacidade e o âmbito pedidos. Nunca confia em
 * nada vindo do cliente: lê sempre a criança, a família e o accessIndex
 * diretamente do Firestore.
 *
 * Partilhada por `askDocuments` e `getDocumentDownloadUrl` (e testada
 * isoladamente) para que as duas nunca divirjam na forma como decidem
 * acesso — incluindo a expiração de concessões, que é sempre comparada
 * contra a hora atual, nunca contra um campo "status" armazenado.
 */
async function resolveChildAccess(childId, uid, { capability = 'view', category = 'documents' } = {}) {
  const childSnap = await db.doc(`children/${childId}`).get();
  if (!childSnap.exists || childSnap.data().deletedAt) {
    return { allowed: false, reason: 'not_found' };
  }
  const child = childSnap.data();

  const member = await getFamilyMember(child.familyId, uid);
  if (member) {
    return { allowed: true, reason: 'family_member', familyId: child.familyId, child };
  }

  const indexSnap = await db.doc(`children/${childId}/accessIndex/${uid}`).get();
  if (!indexSnap.exists) {
    return { allowed: false, reason: 'no_grant' };
  }
  const index = indexSnap.data();
  const notExpired = index.expiresAt && index.expiresAt.toMillis() > Date.now();
  if (!notExpired) {
    return { allowed: false, reason: 'grant_expired' };
  }
  const hasCapability = Array.isArray(index.capabilities) && index.capabilities.includes(capability);
  const hasCategory =
    Array.isArray(index.scopeCategories) &&
    (index.scopeCategories.includes('all') || index.scopeCategories.includes(category));
  if (!hasCapability || !hasCategory) {
    return { allowed: false, reason: 'out_of_scope' };
  }

  return { allowed: true, reason: 'grant', familyId: child.familyId, child };
}

function isNonEmptyString(value, maxLen) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLen;
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

module.exports = {
  requireAuth,
  requireVerifiedEmail,
  getFamilyMember,
  requireFamilyOwner,
  requireFamilyMembership,
  requireChildFamilyOwner,
  resolveChildAccess,
  isNonEmptyString,
  isValidEmail,
};
