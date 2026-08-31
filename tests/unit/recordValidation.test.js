import { describe, it, expect } from 'vitest';
import { hasMeaningfulContent, isValidEmail } from '../../src/utils/recordValidation.js';

describe('hasMeaningfulContent', () => {
  it('rejects a draft with every field empty', () => {
    expect(hasMeaningfulContent({ details: {} })).toBe(false);
  });

  it('rejects a draft with only whitespace', () => {
    expect(hasMeaningfulContent({ notes: '   ', where: '\n', details: {} })).toBe(false);
  });

  it('accepts a draft with a common field filled', () => {
    expect(hasMeaningfulContent({ notes: 'Dormiu bem.', details: {} })).toBe(true);
  });

  it('accepts a draft with only a category-specific detail filled', () => {
    expect(hasMeaningfulContent({ details: { bedTime: '21:00' } })).toBe(true);
  });

  it('ignores whitespace-only detail values', () => {
    expect(hasMeaningfulContent({ details: { bedTime: '   ' } })).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('accepts a well-formed e-mail', () => {
    expect(isValidEmail('familia@exemplo.pt')).toBe(true);
  });

  it('rejects a string without an @', () => {
    expect(isValidEmail('familia-exemplo.pt')).toBe(false);
  });

  it('rejects a string without a domain', () => {
    expect(isValidEmail('familia@exemplo')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
});
