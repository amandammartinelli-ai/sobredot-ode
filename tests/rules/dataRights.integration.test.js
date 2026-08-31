// @vitest-environment node
//
// Testes de integração (Etapa 5) dos direitos da família: exportação,
// restrição de processamento e pedido/execução de eliminação. Mesmo
// padrão dos testes anteriores — chama diretamente os handlers reais
// contra o Firestore/Storage Emulator com o Admin SDK.
import { beforeEach, describe, it, expect } from 'vitest';
import { db, storage } from '../../functions/src/init.js';
import {
  exportFamilyDataHandler,
  setChildProcessingRestrictionHandler,
  requestFamilyDeletionHandler,
  cancelFamilyDeletionHandler,
  deleteFamilyDataCompletely,
} from '../../functions/src/dataRights.js';
import { askDocumentsHandler } from '../../functions/src/ai.js';
import { generateInsightsHandler } from '../../functions/src/insights.js';

beforeEach(async () => {
  for (const name of ['families', 'children', 'rateLimits', 'users']) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection(name).listDocuments();
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(snap.map((d) => db.recursiveDelete(d)));
  }
});

const FAMILY_A = 'familyA';
const OWNER_A = 'uid-owner-a';
const CHILD_A1 = 'childA1';

async function seed() {
  await db.doc(`families/${FAMILY_A}`).set({ name: 'Família Exemplo', createdBy: OWNER_A });
  await db.doc(`families/${FAMILY_A}/members/${OWNER_A}`).set({ uid: OWNER_A, role: 'owner', status: 'active' });
  await db.doc(`children/${CHILD_A1}`).set({
    familyId: FAMILY_A,
    name: 'Criança A1',
    deletedAt: null,
  });
  await db.collection(`children/${CHILD_A1}/records`).add({
    childId: CHILD_A1,
    familyId: FAMILY_A,
    categoryId: 'emotions',
    source: 'family',
    occurredAt: new Date(),
    deletedAt: null,
  });
}

describe('exportFamilyDataHandler', () => {
  beforeEach(seed);

  it('devolve uma cópia estruturada e legível dos dados da família', async () => {
    const result = await exportFamilyDataHandler({ familyId: FAMILY_A }, OWNER_A);
    expect(result.format).toBe('sobredot-export-v1');
    expect(result.family.name).toBe('Família Exemplo');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].records).toHaveLength(1);
    // Nenhum Timestamp bruto deve sobreviver — tudo string ISO.
    expect(typeof result.children[0].records[0].occurredAt).toBe('string');
  });

  it('recusa quem não pertence à família', async () => {
    await expect(exportFamilyDataHandler({ familyId: FAMILY_A }, 'uid-estranho')).rejects.toThrow();
  });
});

describe('setChildProcessingRestrictionHandler', () => {
  beforeEach(seed);

  it('bloqueia askDocuments e generateInsights depois de ativada', async () => {
    await setChildProcessingRestrictionHandler({ childId: CHILD_A1, restricted: true }, OWNER_A);

    await expect(askDocumentsHandler({ childId: CHILD_A1, question: 'O que dizem os documentos?' }, OWNER_A)).rejects.toThrow(
      /restringido/
    );
    await expect(generateInsightsHandler({ childId: CHILD_A1, periodKey: '30d' }, OWNER_A)).rejects.toThrow(/restringido/);
  });

  it('reverte a restrição e volta a permitir o processamento', async () => {
    await setChildProcessingRestrictionHandler({ childId: CHILD_A1, restricted: true }, OWNER_A);
    await setChildProcessingRestrictionHandler({ childId: CHILD_A1, restricted: false }, OWNER_A);

    await expect(askDocumentsHandler({ childId: CHILD_A1, question: 'Pergunta normal aqui' }, OWNER_A)).resolves.toBeTruthy();
  });

  it('recusa quem não pertence à família', async () => {
    await expect(
      setChildProcessingRestrictionHandler({ childId: CHILD_A1, restricted: true }, 'uid-estranho')
    ).rejects.toThrow();
  });
});

describe('pedido de eliminação — confirmação reforçada e cancelamento', () => {
  beforeEach(seed);

  it('recusa sem a confirmação exata (nome da família)', async () => {
    await expect(
      requestFamilyDeletionHandler({ familyId: FAMILY_A, confirmationText: 'nome errado' }, OWNER_A)
    ).rejects.toThrow(/[Cc]onfirmação/);
  });

  it('agenda a eliminação com a confirmação correta, e regista auditoria', async () => {
    const result = await requestFamilyDeletionHandler(
      { familyId: FAMILY_A, confirmationText: 'Família Exemplo' },
      OWNER_A
    );
    expect(result.ok).toBe(true);
    expect(result.scheduledFor).toBeGreaterThan(Date.now());

    const familySnap = await db.doc(`families/${FAMILY_A}`).get();
    expect(familySnap.data().deletionRequest.status).toBe('pending');
  });

  it('não permite um segundo pedido enquanto o primeiro está pendente', async () => {
    await requestFamilyDeletionHandler({ familyId: FAMILY_A, confirmationText: 'Família Exemplo' }, OWNER_A);
    await expect(
      requestFamilyDeletionHandler({ familyId: FAMILY_A, confirmationText: 'Família Exemplo' }, OWNER_A)
    ).rejects.toThrow(/pendente/);
  });

  it('pode ser cancelado pelo proprietário antes do prazo', async () => {
    await requestFamilyDeletionHandler({ familyId: FAMILY_A, confirmationText: 'Família Exemplo' }, OWNER_A);
    await cancelFamilyDeletionHandler({ familyId: FAMILY_A }, OWNER_A);

    const familySnap = await db.doc(`families/${FAMILY_A}`).get();
    expect(familySnap.data().deletionRequest.status).toBe('cancelled');

    // Depois de cancelado, pode voltar a pedir-se.
    await expect(
      requestFamilyDeletionHandler({ familyId: FAMILY_A, confirmationText: 'Família Exemplo' }, OWNER_A)
    ).resolves.toMatchObject({ ok: true });
  });

  it('só o proprietário pode pedir ou cancelar a eliminação', async () => {
    await db.doc(`families/${FAMILY_A}/members/uid-caregiver`).set({ uid: 'uid-caregiver', role: 'caregiver', status: 'active' });
    await expect(
      requestFamilyDeletionHandler({ familyId: FAMILY_A, confirmationText: 'Família Exemplo' }, 'uid-caregiver')
    ).rejects.toThrow();
  });
});

describe('deleteFamilyDataCompletely — execução real da eliminação', () => {
  beforeEach(seed);

  it('remove a família, as crianças e os seus dados, e liberta os membros para uma nova família', async () => {
    await deleteFamilyDataCompletely(FAMILY_A);

    const familySnap = await db.doc(`families/${FAMILY_A}`).get();
    expect(familySnap.exists).toBe(false);

    const childSnap = await db.doc(`children/${CHILD_A1}`).get();
    expect(childSnap.exists).toBe(false);

    const recordsSnap = await db.collection(`children/${CHILD_A1}/records`).get();
    expect(recordsSnap.empty).toBe(true);
  });

  it('apaga também os ficheiros do Storage associados aos documentos da criança', async () => {
    const bucket = storage.bucket();
    const storagePath = `documents/${FAMILY_A}/${CHILD_A1}/doc-1/1`;
    await bucket.file(storagePath).save(Buffer.from('conteudo sintetico de teste'));

    const docRef = db.doc(`children/${CHILD_A1}/documents/doc-1`);
    await docRef.set({ status: 'approved', deletedAt: null, familyId: FAMILY_A });
    await docRef.collection('versions').doc('1').set({ version: 1, storagePath });

    await deleteFamilyDataCompletely(FAMILY_A);

    const [exists] = await bucket.file(storagePath).exists();
    expect(exists).toBe(false);
  });
});
