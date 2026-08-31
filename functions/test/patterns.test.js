import { describe, it, expect } from 'vitest';
import {
  coOccurrenceByDay,
  analyzeSleepVsIntensity,
  analyzeDocumentRecommendationsVsObservations,
  compareAssessments,
} from '../src/patterns.js';

function record(overrides = {}) {
  return {
    categoryId: 'emotions',
    source: 'family',
    deletedAt: null,
    occurredAt: new Date('2024-06-10T10:00:00Z'),
    ...overrides,
  };
}

describe('coOccurrenceByDay', () => {
  it('marca dados insuficientes com amostra muito pequena', () => {
    const records = [
      record({ occurredAt: new Date('2024-06-01T08:00:00Z'), intensity: 'high' }),
      record({ occurredAt: new Date('2024-06-02T08:00:00Z'), intensity: 'low' }),
    ];
    const result = coOccurrenceByDay(records, {
      conditionFn: () => true,
      outcomeFn: (r) => r.intensity === 'high',
      timeZone: 'UTC',
    });
    expect(result.insufficientData).toBe(true);
  });

  it('calcula taxas corretas com um conjunto conhecido', () => {
    // 6 dias com a condição, 3 deles com o resultado; 6 dias sem a
    // condição, 1 deles com o resultado.
    const records = [];
    for (let i = 1; i <= 6; i += 1) {
      records.push(record({ occurredAt: new Date(`2024-06-0${i}T08:00:00Z`), source: 'condition' }));
      if (i <= 3) records.push(record({ occurredAt: new Date(`2024-06-0${i}T09:00:00Z`), intensity: 'high' }));
    }
    for (let i = 7; i <= 12; i += 1) {
      const day = i < 10 ? `0${i}` : `${i}`;
      records.push(record({ occurredAt: new Date(`2024-06-${day}T08:00:00Z`), source: 'no-condition' }));
      if (i === 7) records.push(record({ occurredAt: new Date(`2024-06-${day}T09:00:00Z`), intensity: 'high' }));
    }

    const result = coOccurrenceByDay(records, {
      conditionFn: (r) => r.source === 'condition',
      outcomeFn: (r) => r.intensity === 'high',
      timeZone: 'UTC',
    });

    expect(result.daysWithCondition).toBe(6);
    expect(result.daysWithoutCondition).toBe(6);
    expect(result.rateWithCondition).toBeCloseTo(3 / 6);
    expect(result.rateWithoutCondition).toBeCloseTo(1 / 6);
    expect(result.insufficientData).toBe(false);
  });
});

describe('analyzeSleepVsIntensity', () => {
  it('nunca afirma causa — devolve só taxas de coocorrência', () => {
    const records = [
      record({ categoryId: 'sleep', occurredAt: new Date('2024-06-01T07:00:00Z'), details: { nightWakings: 2 } }),
      record({ occurredAt: new Date('2024-06-01T18:00:00Z'), intensity: 'high' }),
    ];
    const result = analyzeSleepVsIntensity(records, 'UTC');
    expect(result.patternType).toBe('sleep_intensity');
    expect(result).not.toHaveProperty('cause');
    expect(result).not.toHaveProperty('causes');
  });
});

describe('analyzeDocumentRecommendationsVsObservations', () => {
  it('devolve dados insuficientes sem recomendações confirmadas', () => {
    const result = analyzeDocumentRecommendationsVsObservations([], []);
    expect(result.insufficientData).toBe(true);
  });

  it('encontra registos que mencionam palavras semelhantes a uma recomendação', () => {
    const extractionItems = [
      {
        documentId: 'doc-1',
        category: 'recommendations',
        reviewStatus: 'confirmed',
        value: 'Utilizar apoio visual estruturado durante as transições',
        page: 3,
        excerpt: 'apoio visual estruturado',
      },
    ];
    const records = [
      record({ regulation: 'Usámos apoio visual estruturado e ajudou' }),
      record({ regulation: 'Nada relacionado' }),
    ];
    const result = analyzeDocumentRecommendationsVsObservations(records, extractionItems);
    expect(result.insufficientData).toBe(true); // amostra pequena (1 correspondência) — mostra dados insuficientes, não infere
    expect(result.matches[0].matchingRecordCount).toBe(1);
  });
});

describe('compareAssessments — evolução entre documentos', () => {
  const older = [
    { category: 'strengths', value: 'Boa memória visual', reviewStatus: 'confirmed' },
    { category: 'needs', value: 'Apoio em transições', reviewStatus: 'confirmed' },
    { category: 'needs', value: 'Item ainda pendente de revisão', reviewStatus: 'pending' },
  ];
  const newer = [
    { category: 'strengths', value: 'Boa memória visual', reviewStatus: 'confirmed' },
    { category: 'needs', value: 'Apoio sensorial na sala', reviewStatus: 'edited' },
  ];

  it('identifica o que permaneceu, mudou, surgiu e deixou de ser mencionado', () => {
    const result = compareAssessments(older, newer);
    expect(result.remained).toHaveLength(1);
    expect(result.remained[0].value).toBe('Boa memória visual');
    expect(result.disappeared.some((i) => i.value === 'Apoio em transições')).toBe(true);
    expect(result.appeared.some((i) => i.value === 'Apoio sensorial na sala')).toBe(true);
  });

  it('ignora itens ainda não revistos por um humano (pending)', () => {
    const result = compareAssessments(older, newer);
    expect(result.disappeared.some((i) => i.value === 'Item ainda pendente de revisão')).toBe(false);
  });

  it('nunca interpreta uma ausência como resolução — a limitação é sempre incluída', () => {
    const result = compareAssessments(older, newer);
    expect(result.limitations.join(' ')).toMatch(/não significa que foi resolvido/);
  });
});
