import { describe, it, expect } from 'vitest';
import { resolvePeriod } from '../src/metrics.js';
import { assertNoCausalLanguage, assertNumbersAreGrounded, buildInsightsForPeriod } from '../src/insights.js';

const NOW = new Date('2024-06-30T12:00:00Z');

function record(overrides = {}) {
  return {
    categoryId: 'emotions',
    source: 'family',
    deletedAt: null,
    occurredAt: new Date('2024-06-10T10:00:00Z'),
    ...overrides,
  };
}

describe('assertNoCausalLanguage — avaliação obrigatória', () => {
  it('deteta linguagem causal indevida', () => {
    expect(assertNoCausalLanguage('O sono provocou a crise.').length).toBeGreaterThan(0);
    expect(assertNoCausalLanguage('Isto faz com que a criança se desregule.').length).toBeGreaterThan(0);
    expect(assertNoCausalLanguage('A escola é responsável por isto.').length).toBeGreaterThan(0);
  });

  it('aceita linguagem de coocorrência', () => {
    expect(assertNoCausalLanguage('Foi observado em conjunto com dias de sono perturbado.')).toHaveLength(0);
  });
});

describe('assertNumbersAreGrounded — avaliação obrigatória', () => {
  const evidence = [{ metricKey: 'a', label: 'A', value: '8' }, { metricKey: 'b', label: 'B', value: '40%' }];

  it('deteta um número inventado que não está na evidência', () => {
    const ungrounded = assertNumbersAreGrounded('Em 8 dias, com 99% de certeza absoluta.', evidence);
    expect(ungrounded).toContain('99');
  });

  it('não assinala nada quando todos os números citados vêm da evidência', () => {
    const ungrounded = assertNumbersAreGrounded('Em 8 dias, isso aconteceu em 40% dos casos.', evidence);
    expect(ungrounded).toHaveLength(0);
  });
});

describe('buildInsightsForPeriod', () => {
  const period = resolvePeriod('30d', null, NOW);

  it('devolve "dados insuficientes" em vez de inferir com amostra pequena', () => {
    const insights = buildInsightsForPeriod({ records: [], extractionItems: [], period, timeZone: 'UTC' });
    const sleepInsight = insights.find((i) => i.patternType === 'sleep_intensity');
    expect(sleepInsight.confidence).toBe('insufficient');
    expect(sleepInsight.possiblePattern).toBeNull();
  });

  it('nenhum insight gerado contém linguagem causal ou números não citáveis na evidência (defesa em profundidade)', () => {
    const records = [];
    for (let day = 1; day <= 20; day += 1) {
      const iso = `2024-06-${String(day).padStart(2, '0')}`;
      records.push(record({ occurredAt: new Date(`${iso}T08:00:00Z`), intensity: day % 2 === 0 ? 'high' : 'low' }));
      if (day % 3 === 0) {
        records.push(
          record({
            categoryId: 'sleep',
            occurredAt: new Date(`${iso}T07:00:00Z`),
            details: { nightWakings: 2 },
          })
        );
      }
      if (day % 4 === 0) {
        records.push(
          record({
            occurredAt: new Date(`${iso}T09:00:00Z`),
            regulation: 'Respiração guiada',
            outcome: 'Conseguiu acalmar-se depois de alguns minutos',
          })
        );
      }
    }

    const insights = buildInsightsForPeriod({ records, extractionItems: [], period, timeZone: 'UTC' });
    expect(insights.length).toBeGreaterThan(0);

    insights.forEach((insight) => {
      const text = `${insight.title} ${insight.factualObservation} ${insight.possiblePattern || ''}`;
      expect(assertNoCausalLanguage(text)).toHaveLength(0);
      expect(assertNumbersAreGrounded(text, insight.evidence)).toHaveLength(0);
      expect(insight.status).toBe('not_reviewed');
      expect(insight.methodVersion).toBeTruthy();
      expect(insight.limitations.length).toBeGreaterThan(0);
      expect(insight.safeActions.length).toBeGreaterThan(0);
    });
  });

  it('bloqueia (defesa em profundidade) um insight cujo texto citado de um documento contém conteúdo proibido', () => {
    const extractionItems = [
      {
        documentId: 'doc-1',
        category: 'recommendations',
        reviewStatus: 'confirmed',
        value: 'prescrição de apoio visual estruturado durante as rotinas',
        page: 4,
        excerpt: 'prescrição de apoio visual estruturado',
      },
    ];
    // 6 registos mencionando "apoio" para ultrapassar o limiar de amostra
    // mínima e produzir um padrão (não "dados insuficientes").
    const records = Array.from({ length: 6 }, (_, i) =>
      record({
        occurredAt: new Date(`2024-06-${String(i + 1).padStart(2, '0')}T09:00:00Z`),
        regulation: 'Demos apoio visual estruturado durante a rotina',
      })
    );

    const insights = buildInsightsForPeriod({ records, extractionItems, period, timeZone: 'UTC' });
    const docInsight = insights.find((i) => i.patternType === 'document_recommendations');
    // O padrão de bloqueio (`containsBlockedIntent`) reage a "prescriç" —
    // o insight tem de ser substituído pelo texto seguro de bloqueio.
    expect(docInsight.title).toBe('Insight indisponível');
    expect(docInsight.evidence).toHaveLength(0);
  });

  it('inclui um insight de evolução quando há dois documentos para comparar', () => {
    const olderExtractionItems = [{ category: 'needs', value: 'Apoio em transições', reviewStatus: 'confirmed' }];
    const newerExtractionItems = [{ category: 'needs', value: 'Apoio sensorial', reviewStatus: 'confirmed' }];
    const insights = buildInsightsForPeriod({
      records: [],
      extractionItems: [],
      olderExtractionItems,
      newerExtractionItems,
      period,
      timeZone: 'UTC',
    });
    const evolution = insights.find((i) => i.patternType === 'evolution');
    expect(evolution).toBeTruthy();
    expect(evolution.limitations.join(' ')).toMatch(/não significa que foi resolvido/);
  });
});
