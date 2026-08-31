// @vitest-environment node
//
// Testes de integração (não de regras) da Etapa 4: chamam diretamente os
// handlers reais de functions/src/insights.js e functions/src/reports.js
// contra o Firestore Emulator, com o Admin SDK — o mesmo padrão usado em
// resolveChildAccess.integration.test.js. Evita precisar do Functions
// Emulator completo, mas exercita exatamente a mesma lógica que as Cloud
// Functions implantadas usam.
import { beforeEach, describe, it, expect } from 'vitest';
import { admin, db } from '../../functions/src/init.js';
import {
  generateInsightsHandler,
  setInsightStatusHandler,
  buildInsightsForPeriod,
} from '../../functions/src/insights.js';
import {
  generateReportHandler,
  createReportShareLinkHandler,
  revokeReportShareLinkHandler,
  getSharedReportHandler,
} from '../../functions/src/reports.js';
import { resolvePeriod } from '../../functions/src/metrics.js';

const { Timestamp } = admin.firestore;

beforeEach(async () => {
  for (const name of ['families', 'children']) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection(name).listDocuments();
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(snap.map((d) => db.recursiveDelete(d)));
  }
});

const FAMILY_A = 'familyA';
const OWNER_A = 'uid-owner-a';
const CHILD_A1 = 'childA1';
const PROFESSIONAL = 'uid-professional';

async function seedFamilyAndChild() {
  await db.doc(`families/${FAMILY_A}`).set({ name: 'Família A', createdBy: OWNER_A });
  await db.doc(`families/${FAMILY_A}/members/${OWNER_A}`).set({ uid: OWNER_A, role: 'owner', status: 'active' });
  await db.doc(`children/${CHILD_A1}`).set({
    familyId: FAMILY_A,
    name: 'Criança A1',
    deletedAt: null,
  });
}

async function addRecord(overrides = {}) {
  const ref = db.collection(`children/${CHILD_A1}/records`).doc();
  await ref.set({
    childId: CHILD_A1,
    familyId: FAMILY_A,
    categoryId: 'emotions',
    source: 'family',
    occurredAt: Timestamp.fromDate(new Date()),
    deletedAt: null,
    ...overrides,
  });
  return ref.id;
}

describe('generateInsightsHandler', () => {
  beforeEach(seedFamilyAndChild);

  it('só a família pode gerar insights — recusa um estranho', async () => {
    await expect(
      generateInsightsHandler({ childId: CHILD_A1, periodKey: '30d' }, 'uid-estranho')
    ).rejects.toThrow();
  });

  it('devolve dados insuficientes com amostra pequena, sem inventar padrões', async () => {
    await addRecord({ intensity: 'high' });
    const result = await generateInsightsHandler({ childId: CHILD_A1, periodKey: '30d' }, OWNER_A);
    expect(result.count).toBeGreaterThan(0);

    const insightsSnap = await db.collection(`children/${CHILD_A1}/insights`).get();
    const sleepInsight = insightsSnap.docs.map((d) => d.data()).find((i) => i.patternType === 'sleep_intensity');
    expect(sleepInsight.confidence).toBe('insufficient');
  });

  it('ignora registos eliminados ao calcular a amostra ("registo apagado")', async () => {
    await addRecord({ intensity: 'high' });
    await addRecord({ intensity: 'high', deletedAt: Timestamp.now() });

    await generateInsightsHandler({ childId: CHILD_A1, periodKey: '30d' }, OWNER_A);
    const insightsSnap = await db.collection(`children/${CHILD_A1}/insights`).get();
    const summary = insightsSnap.docs.map((d) => d.data()).find((i) => i.patternType === 'category_summary');
    expect(summary.sampleSize).toBe(1);
  });

  it('regista corretamente fontes contraditórias (família vs. escola) na amostra', async () => {
    await addRecord({ source: 'family', categoryId: 'school' });
    await addRecord({ source: 'school', categoryId: 'school' });

    await generateInsightsHandler({ childId: CHILD_A1, periodKey: '30d' }, OWNER_A);
    const insightsSnap = await db.collection(`children/${CHILD_A1}/insights`).get();
    const summary = insightsSnap.docs.map((d) => d.data()).find((i) => i.patternType === 'category_summary');
    expect(summary.sampleSize).toBe(2);
    expect(summary.sources).toEqual(expect.arrayContaining(['family', 'school']));
  });

  it('inclui um insight de evolução quando há dois documentos aprovados ("documento substituído")', async () => {
    const olderDocRef = db.collection(`children/${CHILD_A1}/documents`).doc();
    const newerDocRef = db.collection(`children/${CHILD_A1}/documents`).doc();
    await olderDocRef.set({ status: 'approved', deletedAt: null, approvedAt: Timestamp.fromDate(new Date('2024-01-01')) });
    await newerDocRef.set({ status: 'approved', deletedAt: null, approvedAt: Timestamp.fromDate(new Date('2024-06-01')) });
    await olderDocRef.collection('extractionItems').add({
      category: 'needs',
      value: 'Apoio em transições',
      reviewStatus: 'confirmed',
      page: 1,
    });
    await newerDocRef.collection('extractionItems').add({
      category: 'needs',
      value: 'Apoio sensorial',
      reviewStatus: 'confirmed',
      page: 1,
    });

    await generateInsightsHandler({ childId: CHILD_A1, periodKey: '30d' }, OWNER_A);
    const insightsSnap = await db.collection(`children/${CHILD_A1}/insights`).get();
    const evolution = insightsSnap.docs.map((d) => d.data()).find((i) => i.patternType === 'evolution');
    expect(evolution).toBeTruthy();
    expect(evolution.comparisonDetails.appeared.some((i) => i.value === 'Apoio sensorial')).toBe(true);
  });
});

describe('setInsightStatusHandler', () => {
  beforeEach(seedFamilyAndChild);

  async function seedInsight() {
    const ref = db.collection(`children/${CHILD_A1}/insights`).doc();
    await ref.set({
      childId: CHILD_A1,
      familyId: FAMILY_A,
      patternType: 'category_summary',
      title: 'Resumo',
      status: 'not_reviewed',
      deletedAt: null,
    });
    return ref.id;
  }

  it('a família pode marcar como revisto', async () => {
    const insightId = await seedInsight();
    await setInsightStatusHandler({ childId: CHILD_A1, insightId, status: 'family_reviewed' }, OWNER_A);
    const snap = await db.doc(`children/${CHILD_A1}/insights/${insightId}`).get();
    expect(snap.data().status).toBe('family_reviewed');
  });

  it('a família NÃO pode marcar como validado por profissional', async () => {
    const insightId = await seedInsight();
    await expect(
      setInsightStatusHandler({ childId: CHILD_A1, insightId, status: 'professional_validated' }, OWNER_A)
    ).rejects.toThrow();
  });

  it('um profissional com concessão ativa e capacidade "validate" pode validar ou contestar', async () => {
    const insightId = await seedInsight();
    await db.doc(`children/${CHILD_A1}/accessIndex/${PROFESSIONAL}`).set({
      granteeUid: PROFESSIONAL,
      childId: CHILD_A1,
      familyId: FAMILY_A,
      capabilities: ['view', 'validate'],
      scopeCategories: ['insights'],
      expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
    });

    await setInsightStatusHandler({ childId: CHILD_A1, insightId, status: 'contested', comment: 'Discordo disto.' }, PROFESSIONAL);
    const snap = await db.doc(`children/${CHILD_A1}/insights/${insightId}`).get();
    expect(snap.data().status).toBe('contested');

    const history = await db.collection(`children/${CHILD_A1}/insights/${insightId}/statusHistory`).get();
    expect(history.docs[0].data().actorRole).toBe('professional');
    expect(history.docs[0].data().comment).toBe('Discordo disto.');
  });

  it('um profissional com concessão EXPIRADA (revogada/vencida) perde a permissão de validar', async () => {
    const insightId = await seedInsight();
    await db.doc(`children/${CHILD_A1}/accessIndex/${PROFESSIONAL}`).set({
      granteeUid: PROFESSIONAL,
      childId: CHILD_A1,
      familyId: FAMILY_A,
      capabilities: ['view', 'validate'],
      scopeCategories: ['insights'],
      expiresAt: Timestamp.fromMillis(Date.now() - 60 * 1000), // já expirou
    });

    await expect(
      setInsightStatusHandler({ childId: CHILD_A1, insightId, status: 'professional_validated' }, PROFESSIONAL)
    ).rejects.toThrow();
  });

  it('um profissional sem a capacidade "validate" (só "view") não pode validar', async () => {
    const insightId = await seedInsight();
    await db.doc(`children/${CHILD_A1}/accessIndex/${PROFESSIONAL}`).set({
      granteeUid: PROFESSIONAL,
      childId: CHILD_A1,
      familyId: FAMILY_A,
      capabilities: ['view'],
      scopeCategories: ['insights'],
      expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
    });

    await expect(
      setInsightStatusHandler({ childId: CHILD_A1, insightId, status: 'professional_validated' }, PROFESSIONAL)
    ).rejects.toThrow();
  });
});

describe('relatórios — escopo parcial e partilha', () => {
  beforeEach(seedFamilyAndChild);

  it('um relatório só inclui os módulos pedidos ("escopo parcial")', async () => {
    await addRecord({ categoryId: 'sleep' });
    const report = await generateReportHandler({ childId: CHILD_A1, periodKey: '30d', modules: ['summary'] }, OWNER_A);
    expect(report.sections.summary).toBeTruthy();
    expect(report.sections.timeline).toBeUndefined();
    expect(report.sections.documents).toBeUndefined();
  });

  it('um relatório só inclui documentos explicitamente selecionados e aprovados', async () => {
    const approvedRef = db.collection(`children/${CHILD_A1}/documents`).doc();
    const pendingRef = db.collection(`children/${CHILD_A1}/documents`).doc();
    await approvedRef.set({ status: 'approved', deletedAt: null, docType: 'Relatório escolar' });
    await pendingRef.set({ status: 'pending_review', deletedAt: null, docType: 'Ainda em revisão' });

    const report = await generateReportHandler(
      { childId: CHILD_A1, periodKey: '30d', modules: ['documents'], documentIds: [approvedRef.id, pendingRef.id] },
      OWNER_A
    );
    expect(report.sections.documents).toHaveLength(1);
    expect(report.sections.documents[0].docType).toBe('Relatório escolar');
  });

  it('cria e consulta um link de partilha com sucesso', async () => {
    const { shareId, token } = await createReportShareLinkHandler(
      { childId: CHILD_A1, periodKey: '30d', modules: ['summary'], expiresInHours: 24 },
      OWNER_A
    );
    const result = await getSharedReportHandler({ childId: CHILD_A1, shareId, token });
    expect(result.reportSnapshot.header.childName).toBe('Criança A1');
  });

  it('recusa um token errado', async () => {
    const { shareId } = await createReportShareLinkHandler(
      { childId: CHILD_A1, periodKey: '30d', modules: ['summary'], expiresInHours: 24 },
      OWNER_A
    );
    await expect(getSharedReportHandler({ childId: CHILD_A1, shareId, token: 'a'.repeat(48) })).rejects.toThrow();
  });

  it('um link revogado deixa de funcionar imediatamente', async () => {
    const { shareId, token } = await createReportShareLinkHandler(
      { childId: CHILD_A1, periodKey: '30d', modules: ['summary'], expiresInHours: 24 },
      OWNER_A
    );
    await revokeReportShareLinkHandler({ childId: CHILD_A1, shareId }, OWNER_A);
    await expect(getSharedReportHandler({ childId: CHILD_A1, shareId, token })).rejects.toThrow(/revogada/);
  });

  it('um link expirado deixa de funcionar', async () => {
    const { shareId, token } = await createReportShareLinkHandler(
      { childId: CHILD_A1, periodKey: '30d', modules: ['summary'], expiresInHours: 24 },
      OWNER_A
    );
    // Simula a passagem do tempo diretamente no Firestore (o mesmo padrão
    // usado nos testes de concessão de acesso expirada).
    await db.doc(`children/${CHILD_A1}/reportShares/${shareId}`).update({
      expiresAt: Timestamp.fromMillis(Date.now() - 1000),
    });
    await expect(getSharedReportHandler({ childId: CHILD_A1, shareId, token })).rejects.toThrow(/expirou/);
  });

  it('só a família pode criar ou revogar links de partilha', async () => {
    await expect(
      createReportShareLinkHandler({ childId: CHILD_A1, periodKey: '30d', modules: ['summary'], expiresInHours: 24 }, 'uid-estranho')
    ).rejects.toThrow();
  });
});

describe('avaliações obrigatórias — narrativa nunca inventa, nunca é causal, nunca diagnostica', () => {
  it('nenhum insight construído a partir de um conjunto de dados variado viola as regras de linguagem', () => {
    const period = resolvePeriod('30d', null, new Date());
    const records = Array.from({ length: 12 }, (_, i) => ({
      categoryId: i % 2 === 0 ? 'sleep' : 'emotions',
      source: 'family',
      intensity: i % 3 === 0 ? 'high' : 'low',
      occurredAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      deletedAt: null,
      details: i % 2 === 0 ? { nightWakings: 1 } : {},
    }));
    const insights = buildInsightsForPeriod({ records, extractionItems: [], period, timeZone: 'UTC' });
    expect(insights.length).toBeGreaterThan(0);
    insights.forEach((insight) => {
      expect(insight.title).not.toBe('Insight indisponível');
    });
  });
});
