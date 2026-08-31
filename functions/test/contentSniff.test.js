import { describe, it, expect } from 'vitest';
import { detectRealMimeType, declaredTypeMatchesReal } from '../src/contentSniff.js';

describe('contentSniff', () => {
  it('reconhece um PDF pelos bytes reais', () => {
    const buffer = Buffer.from('%PDF-1.4 resto do ficheiro', 'utf8');
    expect(detectRealMimeType(buffer)).toBe('application/pdf');
  });

  it('reconhece um PNG pela assinatura', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    expect(detectRealMimeType(buffer)).toBe('image/png');
  });

  it('devolve null para bytes desconhecidos', () => {
    const buffer = Buffer.from('isto não é nenhum tipo de ficheiro conhecido', 'utf8');
    expect(detectRealMimeType(buffer)).toBeNull();
  });

  it('recusa um ficheiro cujo conteúdo real não corresponde ao tipo declarado', () => {
    // Um executável/HTML disfarçado de PDF pela extensão, mas os bytes não
    // batem certo com a assinatura real de PDF.
    expect(declaredTypeMatchesReal('application/pdf', 'image/png')).toBe(false);
  });

  it('aceita DOCX porque, por dentro, é sempre um ZIP', () => {
    expect(
      declaredTypeMatchesReal(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip'
      )
    ).toBe(true);
  });

  it('recusa quando não há tipo real detetado', () => {
    expect(declaredTypeMatchesReal('application/pdf', null)).toBe(false);
  });
});
