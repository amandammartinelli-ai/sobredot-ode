// @vitest-environment node
//
// Testes de integração (Etapa 5) do resumo operacional do painel
// administrativo: confirma que os números agregados batem certo e,
// sobretudo, que a resposta nunca inclui nomes de família/criança nem
// qualquer conteúdo — só contagens (ver docs/admin-dashboard.md).
import { beforeEach, describe, it, expect } from 'vitest';
import { db } from '../../functions/src/init.js';
import { getOperationalSummaryHandler } from '../../functions/src/adminDashboard.js';

beforeEach(async () => {
  for (const name of ['families', 'children', 'auditLog']) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection(name).listDocuments();
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(snap.map((d) => db.recursiveDelete(d)));
  }
});

const NOW = new Date();
const YESTERDAY_PLUS = new Date(Date.now() - 2 * 60 * 60 * 1000); // há 2h
const TWO_DAYS_AGO = new Date(Date.now() - 48 * 60 * 60 * 1000);

async function seed() {
  await db.doc('families/familyA').set({ name: 'Família A', createdBy: 'ownerA' });
  await db.doc('families/familyB').set({
    name: 'Família B',
    createdBy: 'ownerB',
    deletionRequest: { status: 'pending', requestedAt: NOW },
  });

  await db.doc('children/child1').set({ familyId: 'familyA', name: 'Criança 1', deletedAt: null, processingRestricted: false });
  await db.doc('children/child2').set({ familyId: 'familyA', name: 'Criança 2', deletedAt: null, processingRestricted: true });
  await db.doc('children/child3').set({ familyId: 'familyB', name: 'Criança 3', deletedAt: NOW }); // soft-apagada

  await db.collection('children/child1/documents').add({ status: 'approved', createdAt: NOW });
  await db.collection('children/child1/documents').add({ status: 'error', createdAt: NOW });
  await db.collection('children/child2/documents').add({ status: 'rejected', createdAt: NOW });

  await db.collection('children/child1/aiQueries').add({ blocked: false, emergency: false, createdAt: YESTERDAY_PLUS });
  await db.collection('children/child1/aiQueries').add({ blocked: true, emergency: false, createdAt: YESTERDAY_PLUS });
  await db.collection('children/child2/aiQueries').add({ blocked: true, emergency: true, createdAt: YESTERDAY_PLUS });
  // Fora da janela de 24h — não deve entrar em nenhuma contagem "last24h".
  await db.collection('children/child1/aiQueries').add({ blocked: false, emergency: false, createdAt: TWO_DAYS_AGO });

  await db.collection('auditLog').add({ action: 'abuse.rate_limited', metadata: { action: 'ai_ask' }, createdAt: YESTERDAY_PLUS });
  await db.collection('auditLog').add({ action: 'abuse.rate_limited', metadata: { action: 'ai_ask' }, createdAt: TWO_DAYS_AGO });
  await db.collection('auditLog').add({ action: 'auth.login', actorUid: 'ownerA', createdAt: YESTERDAY_PLUS });
}

describe('getOperationalSummaryHandler', () => {
  beforeEach(seed);

  it('agrega famílias, crianças e pedidos de eliminação pendentes', async () => {
    const summary = await getOperationalSummaryHandler();
    expect(summary.families.total).toBe(2);
    expect(summary.families.pendingDeletions).toBe(1);
    expect(summary.children.active).toBe(2);
    expect(summary.children.processingRestricted).toBe(1);
  });

  it('agrega documentos por estado', async () => {
    const summary = await getOperationalSummaryHandler();
    expect(summary.documents.byStatus.approved).toBe(1);
    expect(summary.documents.byStatus.error).toBe(1);
    expect(summary.documents.byStatus.rejected).toBe(1);
    expect(summary.documents.byStatus.pending_review).toBe(0);
  });

  it('conta perguntas de IA só das últimas 24h, incluindo bloqueadas e de emergência', async () => {
    const summary = await getOperationalSummaryHandler();
    expect(summary.aiQueries.last24h).toBe(3);
    expect(summary.aiQueries.blockedLast24h).toBe(2);
    expect(summary.aiQueries.emergencyLast24h).toBe(1);
  });

  it('conta pedidos recusados por limite de utilização nas últimas 24h', async () => {
    const summary = await getOperationalSummaryHandler();
    expect(summary.abuse.rateLimitedLast24h).toBe(1);
  });

  it('nunca inclui nomes de família/criança nem qualquer texto livre na resposta', () => {
    return getOperationalSummaryHandler().then((summary) => {
      const serialized = JSON.stringify(summary);
      expect(serialized).not.toMatch(/Família|Criança/);
    });
  });
});
