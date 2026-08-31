// @vitest-environment node
//
// TESTE CANÁRIO (obrigatório na Etapa 3): prova que a recuperação de
// contexto para "Perguntar aos documentos" nunca atravessa crianças. Seed
// de duas crianças com itens de extração aprovados e claramente
// distinguíveis; qualquer citação da criança B a aparecer numa pergunta
// feita sobre a criança A faz este teste falhar.
import { beforeEach, describe, it, expect } from 'vitest';
import { db } from '../../functions/src/init.js';
import { retrieveChildContext, buildGroundedAnswer } from '../../functions/src/ai.js';

const CHILD_A = 'canary-child-a';
const CHILD_B = 'canary-child-b';

const SECRET_MARKER_B = 'MARCADOR-EXCLUSIVO-DA-CRIANCA-B-NUNCA-PODE-APARECER-EM-A';

beforeEach(async () => {
  await db.recursiveDelete(db.doc(`children/${CHILD_A}`)).catch(() => null);
  await db.recursiveDelete(db.doc(`children/${CHILD_B}`)).catch(() => null);

  await db.doc(`children/${CHILD_A}`).set({ familyId: 'family-canary-a', name: 'Criança A' });
  await db.doc(`children/${CHILD_B}`).set({ familyId: 'family-canary-b', name: 'Criança B' });

  await db.doc(`children/${CHILD_A}/documents/doc-a1`).set({
    childId: CHILD_A,
    familyId: 'family-canary-a',
    status: 'approved',
    deletedAt: null,
    docType: 'laudo',
  });
  await db
    .collection(`children/${CHILD_A}/documents/doc-a1/extractionItems`)
    .doc('item-a1')
    .set({
      category: 'strengths',
      value: 'Pontos fortes: boa memória visual e interesse por música.',
      page: 1,
      excerpt: 'Boa memória visual',
      confidence: 0.8,
      reviewStatus: 'confirmed',
      sourceVersionId: '1',
    });

  await db.doc(`children/${CHILD_B}/documents/doc-b1`).set({
    childId: CHILD_B,
    familyId: 'family-canary-b',
    status: 'approved',
    deletedAt: null,
    docType: 'laudo',
  });
  await db
    .collection(`children/${CHILD_B}/documents/doc-b1/extractionItems`)
    .doc('item-b1')
    .set({
      category: 'strengths',
      value: `Pontos fortes da criança B: ${SECRET_MARKER_B}`,
      page: 1,
      excerpt: SECRET_MARKER_B,
      confidence: 0.8,
      reviewStatus: 'confirmed',
      sourceVersionId: '1',
    });
});

describe('Canário: isolamento entre crianças na recuperação de contexto de IA', () => {
  it('uma pergunta sobre a criança A nunca recupera itens da criança B', async () => {
    const items = await retrieveChildContext(CHILD_A, 'pontos fortes');

    // Não pode ser um teste vazio por acidente: tem de haver conteúdo real
    // da própria criança A para provar que o filtro é seletivo, não que
    // simplesmente não devolveu nada.
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.documentId !== 'doc-b1')).toBe(true);
    expect(JSON.stringify(items)).not.toContain(SECRET_MARKER_B);
    expect(JSON.stringify(items)).not.toContain(CHILD_B);
  });

  it('a resposta construída a partir da recuperação da criança A nunca cita a criança B', async () => {
    const items = await retrieveChildContext(CHILD_A, 'pontos fortes');
    const answer = buildGroundedAnswer(items);

    expect(answer.sources.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(answer);
    expect(serialized).not.toContain(SECRET_MARKER_B);
    expect(answer.sources.every((source) => source.documentId !== 'doc-b1')).toBe(true);
  });

  it('mesmo pedindo tudo (sem palavras-chave), a criança B não aparece na recuperação de A', async () => {
    const items = await retrieveChildContext(CHILD_A, '');
    expect(items.every((item) => item.documentId !== 'doc-b1')).toBe(true);
  });

  it('a criança B, pelo seu lado, recupera o seu próprio conteúdo normalmente', async () => {
    const items = await retrieveChildContext(CHILD_B, 'pontos fortes');
    expect(items.length).toBeGreaterThan(0);
    expect(JSON.stringify(items)).toContain(SECRET_MARKER_B);
  });
});
