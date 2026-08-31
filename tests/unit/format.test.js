import { describe, it, expect } from 'vitest';
import { getInitials, formatRelativeToNow } from '../../src/utils/format.js';

describe('format utils', () => {
  it('builds initials from a full name', () => {
    expect(getInitials('Matias Exemplo')).toBe('ME');
  });

  it('ignores extra names beyond the first two', () => {
    expect(getInitials('Beatriz Fictícia Amostra')).toBe('BF');
  });

  it('describes a recent timestamp as instantaneous', () => {
    const now = new Date().toISOString();
    expect(formatRelativeToNow(now)).toBe('Há instantes');
  });

  it('describes a timestamp from days ago', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeToNow(twoDaysAgo)).toBe('Há 2 dias');
  });
});
