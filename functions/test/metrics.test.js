import { describe, it, expect } from 'vitest';
import {
  resolvePeriod,
  buildSampleInfo,
  confidenceForSampleSize,
  intensityDistribution,
  durationStats,
  timeOfDayDistribution,
  dayKey,
  medicationAdherence,
  THRESHOLDS,
} from '../src/metrics.js';

const NOW = new Date('2024-06-15T12:00:00Z');

function record(overrides = {}) {
  return {
    categoryId: 'emotions',
    source: 'family',
    deletedAt: null,
    occurredAt: new Date('2024-06-10T10:00:00Z'),
    ...overrides,
  };
}

describe('resolvePeriod', () => {
  it('resolve períodos nomeados de 7/30/90 dias', () => {
    const period7 = resolvePeriod('7d', null, NOW);
    expect(period7.end.getTime()).toBe(NOW.getTime());
    expect(NOW.getTime() - period7.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);

    const period90 = resolvePeriod('90d', null, NOW);
    expect(NOW.getTime() - period90.start.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('resolve um período personalizado válido', () => {
    const period = resolvePeriod('custom', { start: '2024-01-01T00:00:00Z', end: '2024-01-31T00:00:00Z' }, NOW);
    expect(period.key).toBe('custom');
  });

  it('rejeita período personalizado com start depois de end', () => {
    expect(() =>
      resolvePeriod('custom', { start: '2024-02-01T00:00:00Z', end: '2024-01-01T00:00:00Z' }, NOW)
    ).toThrow();
  });

  it('rejeita chave de período desconhecida', () => {
    expect(() => resolvePeriod('365d', null, NOW)).toThrow();
  });
});

describe('buildSampleInfo — conjunto conhecido', () => {
  const period = resolvePeriod('7d', null, NOW);

  it('conta amostra, dias com/sem registo e distribuição de fontes, ignorando eliminados e fora do período', () => {
    const records = [
      record({ occurredAt: new Date('2024-06-14T08:00:00Z'), source: 'family' }),
      record({ occurredAt: new Date('2024-06-14T20:00:00Z'), source: 'school' }),
      record({ occurredAt: new Date('2024-06-13T08:00:00Z'), source: 'professional' }),
      // eliminado — não deve contar
      record({ occurredAt: new Date('2024-06-12T08:00:00Z'), deletedAt: new Date('2024-06-12T09:00:00Z') }),
      // fora do período de 7 dias (antes do início)
      record({ occurredAt: new Date('2024-01-01T08:00:00Z') }),
    ];

    const info = buildSampleInfo(records, period, 'UTC');
    expect(info.sampleSize).toBe(3);
    expect(info.daysWithRecords).toBe(2); // 14 e 13 de junho
    expect(info.sourceDistribution).toEqual({ family: 1, school: 1, professional: 1, other: 0 });
    expect(info.totalDays).toBeGreaterThan(0);
    expect(info.daysWithoutRecords).toBe(info.totalDays - info.daysWithRecords);
  });

  it('devolve amostra zero quando não há registos no período', () => {
    const info = buildSampleInfo([], period, 'UTC');
    expect(info.sampleSize).toBe(0);
    expect(info.daysWithRecords).toBe(0);
    expect(info.daysWithoutRecords).toBe(info.totalDays);
  });
});

describe('confidenceForSampleSize — limiares documentados', () => {
  it('classifica corretamente nos limites configurados', () => {
    expect(confidenceForSampleSize(0)).toBe('insufficient');
    expect(confidenceForSampleSize(THRESHOLDS.MIN_SAMPLE_FOR_PATTERN - 1)).toBe('insufficient');
    expect(confidenceForSampleSize(THRESHOLDS.MIN_SAMPLE_FOR_PATTERN)).toBe('low');
    expect(confidenceForSampleSize(THRESHOLDS.MIN_FOR_MEDIUM_CONFIDENCE)).toBe('medium');
    expect(confidenceForSampleSize(THRESHOLDS.MIN_FOR_HIGH_CONFIDENCE)).toBe('high');
  });
});

describe('intensityDistribution', () => {
  const period = resolvePeriod('custom', { start: '2024-06-01T00:00:00Z', end: '2024-06-15T00:00:00Z' }, NOW);

  it('devolve dados insuficientes para tendência com poucos registos', () => {
    const records = [
      record({ intensity: 'high', occurredAt: new Date('2024-06-05T00:00:00Z') }),
      record({ intensity: 'low', occurredAt: new Date('2024-06-10T00:00:00Z') }),
    ];
    const result = intensityDistribution(records, period);
    expect(result.trend).toBe('insufficient_data');
    expect(result.counts.high).toBe(1);
  });

  it('não confunde ausência de intensidade com intensidade baixa', () => {
    const records = [record({ intensity: null })];
    const result = intensityDistribution(records, period);
    expect(result.sampleSize).toBe(0);
    expect(result.trend).toBe('insufficient_data');
  });

  it('deteta mais intensidade alta na segunda metade do período', () => {
    const firstHalf = Array.from({ length: 4 }, (_, i) =>
      record({ intensity: 'low', occurredAt: new Date(`2024-06-0${i + 2}T00:00:00Z`) })
    );
    const secondHalf = Array.from({ length: 4 }, (_, i) =>
      record({ intensity: 'high', occurredAt: new Date(`2024-06-1${i + 1}T00:00:00Z`) })
    );
    const result = intensityDistribution([...firstHalf, ...secondHalf], period);
    expect(result.trend).toBe('more_high_intensity_recently');
  });
});

describe('durationStats', () => {
  it('calcula média e mediana com um conjunto conhecido', () => {
    const records = [record({ duration: 10 }), record({ duration: 20 }), record({ duration: 30 })];
    const stats = durationStats(records);
    expect(stats.sampleSize).toBe(3);
    expect(stats.averageMinutes).toBe(20);
    expect(stats.medianMinutes).toBe(20);
  });

  it('ignora registos sem duração', () => {
    const stats = durationStats([record({ duration: null }), record({})]);
    expect(stats.sampleSize).toBe(0);
    expect(stats.averageMinutes).toBeNull();
  });
});

describe('timeOfDayDistribution — sensível ao fuso horário', () => {
  it('a mesma marca temporal UTC cai em baldes diferentes consoante o fuso horário', () => {
    // 23:30 UTC — noite em UTC, mas tarde em Los Angeles (UTC-8 em junho, -7 com DST => 16:30).
    const records = Array.from({ length: 4 }, (_, i) =>
      record({ occurredAt: new Date(`2024-06-1${i + 1}T23:30:00Z`) })
    );
    const period = resolvePeriod('7d', null, NOW);
    const sampleInfoUtc = buildSampleInfo(records, period, 'UTC');
    const distributionUtc = timeOfDayDistribution(records, 'UTC', sampleInfoUtc);
    const distributionLA = timeOfDayDistribution(records, 'America/Los_Angeles', sampleInfoUtc);

    expect(distributionUtc.buckets.night).toBeGreaterThan(0);
    expect(distributionLA.buckets.night).toBe(0);
    expect(distributionLA.buckets.afternoon + distributionLA.buckets.evening).toBeGreaterThan(0);
  });

  it('mostra dados insuficientes com poucos dias distintos', () => {
    const records = [record({ occurredAt: new Date('2024-06-10T08:00:00Z') })];
    const sampleInfo = { daysWithRecords: 1 };
    const result = timeOfDayDistribution(records, 'UTC', sampleInfo);
    expect(result.insufficientData).toBe(true);
  });
});

describe('dayKey — fuso horário explícito, nunca implícito', () => {
  it('a mesma marca temporal UTC pode cair em dias de calendário diferentes consoante o fuso', () => {
    const date = new Date('2024-06-10T23:30:00Z');
    expect(dayKey(date, 'UTC')).toBe('2024-06-10');
    expect(dayKey(date, 'Pacific/Kiritimati')).toBe('2024-06-11');
  });
});

describe('medicationAdherence', () => {
  it('distingue dias sem registo de dias com registo mas sem dose marcada', () => {
    const records = [
      record({ categoryId: 'medication', occurredAt: new Date('2024-06-10T08:00:00Z'), details: { doseGiven: 'sim' } }),
      record({ categoryId: 'medication', occurredAt: new Date('2024-06-11T08:00:00Z'), details: {} }),
    ];
    const adherence = medicationAdherence(records, 'UTC');
    expect(adherence.daysWithMedicationRecord).toBe(2);
    expect(adherence.daysWithDoseGiven).toBe(1);
    expect(adherence.adherenceRatio).toBe(0.5);
  });

  it('devolve adesão nula quando não há nenhum registo de medicação', () => {
    const adherence = medicationAdherence([record({ categoryId: 'sleep' })], 'UTC');
    expect(adherence.adherenceRatio).toBeNull();
  });
});
