// @vitest-environment node
//
// Teste de integração (não de regras): chama diretamente o código real de
// functions/src/util.js (resolveChildAccess) contra o Firestore Emulator,
// usando o Admin SDK (tal como as próprias Cloud Functions fazem). Isto
// valida a MESMA lógica usada por getDocumentUploadUrl,
// getDocumentDownloadUrl e askDocuments — incluindo o caso de uma
// concessão expirada, que é difícil de exercitar fim-a-fim através de uma
// URL assinada real neste ambiente (ver docs/architecture.md,
// "limitações conhecidas").
import { beforeEach, describe, it, expect } from 'vitest';
// Reutiliza a MESMA instância Admin SDK que as Cloud Functions usam
// (functions/src/init.js já chama admin.initializeApp() ao ser
// carregado). FIRESTORE_EMULATOR_HOST é definido automaticamente pelo
// "firebase emulators:exec" que envolve este teste.
import { admin, db } from '../../functions/src/init.js';
import { resolveChildAccess } from '../../functions/src/util.js';

beforeEach(async () => {
  const collections = ['families', 'children'];
  for (const name of collections) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection(name).listDocuments();
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(snap.map((d) => db.recursiveDelete(d)));
  }
});

const FAMILY_A = 'familyA';
const OWNER_A = 'uid-owner-a';
const CHILD_A1 = 'childA1';
const GRANTEE = 'uid-grantee';

async function seed() {
  await db.doc(`families/${FAMILY_A}`).set({ name: 'Família A', createdBy: OWNER_A });
  await db.doc(`families/${FAMILY_A}/members/${OWNER_A}`).set({ uid: OWNER_A, role: 'owner', status: 'active' });
  await db.doc(`children/${CHILD_A1}`).set({
    familyId: FAMILY_A,
    name: 'Criança A1',
    deletedAt: null,
  });
}

describe('resolveChildAccess (functions/src/util.js)', () => {
  beforeEach(seed);

  it('permite o acesso a um membro da família', async () => {
    const result = await resolveChildAccess(CHILD_A1, OWNER_A, { capability: 'view', category: 'documents' });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('family_member');
  });

  it('nega quando não há vínculo nenhum', async () => {
    const result = await resolveChildAccess(CHILD_A1, 'uid-desconhecido', { capability: 'view', category: 'documents' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_grant');
  });

  it('nega quando a concessão já expirou — mesmo com capacidade e âmbito corretos', async () => {
    await db.doc(`children/${CHILD_A1}/accessIndex/${GRANTEE}`).set({
      granteeUid: GRANTEE,
      childId: CHILD_A1,
      familyId: FAMILY_A,
      capabilities: ['view'],
      scopeCategories: ['documents'],
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 1000),
    });

    const result = await resolveChildAccess(CHILD_A1, GRANTEE, { capability: 'view', category: 'documents' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('grant_expired');
  });

  it('nega quando a concessão está ativa mas fora do âmbito pedido', async () => {
    await db.doc(`children/${CHILD_A1}/accessIndex/${GRANTEE}`).set({
      granteeUid: GRANTEE,
      childId: CHILD_A1,
      familyId: FAMILY_A,
      capabilities: ['view'],
      scopeCategories: ['school'],
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
    });

    const result = await resolveChildAccess(CHILD_A1, GRANTEE, { capability: 'view', category: 'documents' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('out_of_scope');
  });

  it('permite quando a concessão está ativa e cobre a capacidade/âmbito pedidos', async () => {
    await db.doc(`children/${CHILD_A1}/accessIndex/${GRANTEE}`).set({
      granteeUid: GRANTEE,
      childId: CHILD_A1,
      familyId: FAMILY_A,
      capabilities: ['view'],
      scopeCategories: ['documents'],
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
    });

    const result = await resolveChildAccess(CHILD_A1, GRANTEE, { capability: 'view', category: 'documents' });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('grant');
  });

  it('nega quando a criança não existe ou foi eliminada', async () => {
    const result = await resolveChildAccess('criança-inexistente', OWNER_A, { capability: 'view', category: 'documents' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('not_found');
  });
});
