import { describe, it, expect } from 'vitest';
import { recordCategories, getCategoryById } from '../../src/data/mock/categories.js';

describe('record categories', () => {
  it('exposes exactly the ten categories required by the product brief', () => {
    expect(recordCategories).toHaveLength(10);
  });

  it('resolves a category by id', () => {
    expect(getCategoryById('sleep')?.id).toBe('sleep');
  });

  it('returns undefined for an unknown category id', () => {
    expect(getCategoryById('inexistente')).toBeUndefined();
  });
});
