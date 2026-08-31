import { describe, it, expect } from 'vitest';
import { t, getLocale, getAvailableLocales } from '../../src/i18n/index.js';

describe('i18n', () => {
  it('resolves a nested key from the dictionary', () => {
    expect(t('app.name')).toBe('Sobredot');
  });

  it('resolves deeply nested keys', () => {
    expect(t('register.categories.sleep.label')).toBe('Sono');
  });

  it('falls back to the key itself when missing', () => {
    expect(t('nao.existe.esta.chave')).toBe('nao.existe.esta.chave');
  });

  it('defaults to Portuguese', () => {
    expect(getLocale()).toBe('pt');
    expect(getAvailableLocales()).toContain('pt');
  });
});
