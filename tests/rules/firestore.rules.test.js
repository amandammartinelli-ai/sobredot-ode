// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { getTestEnv, teardownTestEnv, futureTimestamp, pastTimestamp } from './setup.js';

const FAMILY_A = 'familyA';
const FAMILY_B = 'familyB';
const OWNER_A = 'uid-owner-a';
const OWNER_B = 'uid-owner-b';
const SCHOOL_COLLABORATOR = 'uid-school-collab';
const EXPIRED_PROFESSIONAL = 'uid-expired-pro';
const CHILD_A1 = 'childA1';
const CHILD_A2 = 'childA2';
const CHILD_B1 = 'childB1';

let testEnv;

async function seedFixtures() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, `families/${FAMILY_A}`), {
      name: 'Família A',
      createdBy: OWNER_A,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, `families/${FAMILY_A}/members/${OWNER_A}`), {
      uid: OWNER_A,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });

    await setDoc(doc(db, `families/${FAMILY_B}`), {
      name: 'Família B',
      createdBy: OWNER_B,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(db, `families/${FAMILY_B}/members/${OWNER_B}`), {
      uid: OWNER_B,
      role: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });

    await setDoc(doc(db, `children/${CHILD_A1}`), {
      familyId: FAMILY_A,
      name: 'Criança A1',
      relationshipOrigin: 'direct',
      createdBy: OWNER_A,
      updatedBy: OWNER_A,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    await setDoc(doc(db, `children/${CHILD_A2}`), {
      familyId: FAMILY_A,
      name: 'Criança A2',
      relationshipOrigin: 'direct',
      createdBy: OWNER_A,
      updatedBy: OWNER_A,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    await setDoc(doc(db, `children/${CHILD_B1}`), {
      familyId: FAMILY_B,
      name: 'Criança B1',
      relationshipOrigin: 'direct',
      createdBy: OWNER_B,
      updatedBy: OWNER_B,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    // Registos da criança A1: um de sono, um de medicação.
    await setDoc(doc(db, `children/${CHILD_A1}/records/rec-sleep`), {
      childId: CHILD_A1,
      familyId: FAMILY_A,
      categoryId: 'sleep',
      createdBy: OWNER_A,
      updatedBy: OWNER_A,
      version: 1,
      deletedAt: null,
      occurredAt: new Date(),
      source: 'family',
      notes: 'Dormiu bem.',
    });
    await setDoc(doc(db, `children/${CHILD_A1}/records/rec-medication`), {
      childId: CHILD_A1,
      familyId: FAMILY_A,
      categoryId: 'medication',
      createdBy: OWNER_A,
      updatedBy: OWNER_A,
      version: 1,
      deletedAt: null,
      occurredAt: new Date(),
      source: 'family',
      notes: 'Toma da manhã administrada.',
    });

    // Registo da criança A2, na MESMA família — usado para o teste de
    // isolamento entre crianças da mesma família.
    await setDoc(doc(db, `children/${CHILD_A2}/records/rec-emotion`), {
      childId: CHILD_A2,
      familyId: FAMILY_A,
      categoryId: 'emotions',
      createdBy: OWNER_A,
      updatedBy: OWNER_A,
      version: 1,
      deletedAt: null,
      occurredAt: new Date(),
      source: 'family',
      notes: 'Manhã tranquila.',
    });

    await setDoc(doc(db, `children/${CHILD_A1}/medications/med-1`), {
      childId: CHILD_A1,
      name: 'Medicamento de exemplo',
      createdBy: OWNER_A,
      updatedBy: OWNER_A,
    });

    // Colaborador escolar ativo, com âmbito restrito a 'school' (nunca
    // 'medication' nem 'all').
    await setDoc(doc(db, `children/${CHILD_A1}/accessIndex/${SCHOOL_COLLABORATOR}`), {
      granteeUid: SCHOOL_COLLABORATOR,
      childId: CHILD_A1,
      familyId: FAMILY_A,
      capabilities: ['view'],
      scopeCategories: ['school'],
      expiresAt: Timestamp.fromDate(futureTimestamp(30)),
    });

    // Profissional cuja concessão já expirou.
    await setDoc(doc(db, `children/${CHILD_A1}/accessIndex/${EXPIRED_PROFESSIONAL}`), {
      granteeUid: EXPIRED_PROFESSIONAL,
      childId: CHILD_A1,
      familyId: FAMILY_A,
      capabilities: ['view', 'register'],
      scopeCategories: ['all'],
      expiresAt: Timestamp.fromDate(pastTimestamp(1)),
    });

    await setDoc(doc(db, 'auditLog/audit-1'), {
      action: 'child.created',
      actorUid: OWNER_A,
      targetType: 'child',
      targetId: CHILD_A1,
      familyId: FAMILY_A,
      childId: CHILD_A1,
      metadata: {},
      createdAt: new Date(),
    });

    await setDoc(doc(db, `users/${OWNER_A}`), {
      uid: OWNER_A,
      displayName: 'Responsável A',
      email: 'a@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
}

beforeAll(async () => {
  testEnv = await getTestEnv();
});

afterAll(async () => {
  await teardownTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedFixtures();
});

describe('Isolamento entre famílias', () => {
  it('a família A não consegue ler uma criança da família B', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore();
    await assertFails(getDoc(doc(db, `children/${CHILD_B1}`)));
  });

  it('a família A não consegue listar crianças filtrando pela família B', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore();
    const q = query(collection(db, 'children'), where('familyId', '==', FAMILY_B));
    await assertFails(getDocs(q));
  });

  it('um utilizador não autenticado não lê nada', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, `children/${CHILD_A1}`)));
  });
});

describe('Concessão de acesso expirada', () => {
  it('um profissional cuja concessão expirou perde o acesso à criança', async () => {
    const db = testEnv.authenticatedContext(EXPIRED_PROFESSIONAL).firestore();
    await assertFails(getDoc(doc(db, `children/${CHILD_A1}`)));
  });

  it('um profissional expirado não consegue ler registos da criança', async () => {
    const db = testEnv.authenticatedContext(EXPIRED_PROFESSIONAL).firestore();
    await assertFails(getDoc(doc(db, `children/${CHILD_A1}/records/rec-sleep`)));
  });
});

describe('Âmbito de concessão (colaborador escolar)', () => {
  it('não lê um registo de medicação sem "medication" no âmbito', async () => {
    const db = testEnv.authenticatedContext(SCHOOL_COLLABORATOR).firestore();
    await assertFails(getDoc(doc(db, `children/${CHILD_A1}/records/rec-medication`)));
  });

  it('não consegue listar registos filtrados por categoria "medication"', async () => {
    const db = testEnv.authenticatedContext(SCHOOL_COLLABORATOR).firestore();
    const q = query(
      collection(db, `children/${CHILD_A1}/records`),
      where('categoryId', '==', 'medication')
    );
    await assertFails(getDocs(q));
  });

  it('não consegue listar TODOS os registos sem filtro de categoria', async () => {
    const db = testEnv.authenticatedContext(SCHOOL_COLLABORATOR).firestore();
    await assertFails(getDocs(collection(db, `children/${CHILD_A1}/records`)));
  });

  it('não lê a coleção de medicamentos cadastrados', async () => {
    const db = testEnv.authenticatedContext(SCHOOL_COLLABORATOR).firestore();
    await assertFails(getDoc(doc(db, `children/${CHILD_A1}/medications/med-1`)));
  });

  it('CONSEGUE ler um registo dentro do seu âmbito (school)', async () => {
    // fixture não tem um registo 'school' — criamos um específico para
    // provar que o âmbito permitido efetivamente funciona (não é tudo
    // negado por engano).
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `children/${CHILD_A1}/records/rec-school`), {
        childId: CHILD_A1,
        familyId: FAMILY_A,
        categoryId: 'school',
        createdBy: OWNER_A,
        updatedBy: OWNER_A,
        version: 1,
        deletedAt: null,
        occurredAt: new Date(),
        source: 'family',
      });
    });
    const db = testEnv.authenticatedContext(SCHOOL_COLLABORATOR).firestore();
    await assertSucceeds(getDoc(doc(db, `children/${CHILD_A1}/records/rec-school`)));
  });
});

describe('Isolamento entre crianças da mesma família', () => {
  it('listar os registos da criança A1 nunca traz o registo da criança A2', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore();
    const snap = await assertSucceeds(getDocs(collection(db, `children/${CHILD_A1}/records`)));
    expect(snap.size).toBe(2); // rec-sleep + rec-medication
    snap.docs.forEach((docSnap) => {
      expect(docSnap.data().childId).toBe(CHILD_A1);
    });
  });

  it('a criança A2 tem os seus próprios registos, sem misturar com A1', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore();
    const snap = await assertSucceeds(getDocs(collection(db, `children/${CHILD_A2}/records`)));
    expect(snap.size).toBe(1);
    expect(snap.docs[0].data().categoryId).toBe('emotions');
  });
});

describe('Autopromoção a administrador', () => {
  it('não é possível criar o próprio perfil já com admin:true', async () => {
    const db = testEnv.authenticatedContext(OWNER_B).firestore();
    await assertFails(
      setDoc(doc(db, `users/${OWNER_B}`), {
        uid: OWNER_B,
        displayName: 'Responsável B',
        admin: true,
      })
    );
  });

  it('não é possível adicionar admin:true a um perfil existente', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore();
    await assertFails(updateDoc(doc(db, `users/${OWNER_A}`), { admin: true }));
  });
});

describe('Auditoria imutável pelo cliente', () => {
  it('o proprietário da família pode LER o registo de auditoria da sua família', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore();
    await assertSucceeds(getDoc(doc(db, 'auditLog/audit-1')));
  });

  it('ninguém consegue apagar um registo de auditoria a partir do cliente', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore();
    await assertFails(deleteDoc(doc(db, 'auditLog/audit-1')));
  });

  it('ninguém consegue alterar um registo de auditoria a partir do cliente', async () => {
    const db = testEnv.authenticatedContext(OWNER_A).firestore();
    await assertFails(updateDoc(doc(db, 'auditLog/audit-1'), { action: 'forjado' }));
  });
});
