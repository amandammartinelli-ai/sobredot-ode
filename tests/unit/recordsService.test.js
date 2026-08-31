import { describe, it, expect, beforeEach } from 'vitest';
import { listRecordsForChild, createLocalRecord, getLatestRecordByCategory } from '../../src/services/recordsService.js';
import { clearAllSobredotData } from '../../src/services/storageService.js';

const CHILD_ID = 'child-exemplo-1';

describe('recordsService', () => {
  beforeEach(() => {
    clearAllSobredotData();
  });

  it('lists seed records for a known child', () => {
    const records = listRecordsForChild(CHILD_ID);
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.childId === CHILD_ID)).toBe(true);
  });

  it('creates a local record that then appears in the list', () => {
    const before = listRecordsForChild(CHILD_ID).length;

    createLocalRecord({
      childId: CHILD_ID,
      categoryId: 'observations',
      summary: 'Registo de teste automatizado.',
      intensity: 'low',
    });

    const after = listRecordsForChild(CHILD_ID);
    expect(after.length).toBe(before + 1);
    expect(after[0].summary).toBe('Registo de teste automatizado.');
  });

  it('finds the latest record for a category', () => {
    const latestSleep = getLatestRecordByCategory(CHILD_ID, 'sleep');
    expect(latestSleep).not.toBeNull();
    expect(latestSleep.categoryId).toBe('sleep');
  });

  it('returns null when there is no record for a category', () => {
    const latest = getLatestRecordByCategory('child-sem-registos', 'sleep');
    expect(latest).toBeNull();
  });
});
