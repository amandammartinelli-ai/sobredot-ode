import { describe, it, expect } from 'vitest';
import { extractStructuredItemsFromPages } from '../src/extraction.js';

describe('extractStructuredItemsFromPages', () => {
  it('extrai secções reconhecidas com página e excerto', () => {
    const pages = [
      {
        num: 1,
        text: [
          'Relatório de avaliação psicopedagógica',
          '',
          'Pontos fortes:',
          'Boa memória visual e interesse por música.',
          '',
          'Necessidades:',
          'Apoio na transição entre atividades.',
        ].join('\n'),
      },
    ];

    const items = extractStructuredItemsFromPages(pages);
    const categories = items.map((item) => item.category);

    expect(categories).toContain('strengths');
    expect(categories).toContain('needs');

    const strengths = items.find((item) => item.category === 'strengths');
    expect(strengths.page).toBe(1);
    expect(strengths.value).toMatch(/memória visual/i);
    expect(strengths.excerpt.length).toBeLessThanOrEqual(300);
    expect(strengths.confidence).toBeGreaterThan(0);
  });

  it('nunca inventa uma categoria sem correspondência no texto', () => {
    const pages = [{ num: 1, text: 'Um parágrafo qualquer sem cabeçalhos reconhecíveis.' }];
    const items = extractStructuredItemsFromPages(pages);
    expect(items).toHaveLength(0);
  });

  it('respeita a página de origem quando há várias páginas', () => {
    const pages = [
      { num: 1, text: 'Introdução sem secções.' },
      { num: 2, text: 'Recomendações:\nManter rotina visual na sala de aula.' },
    ];
    const items = extractStructuredItemsFromPages(pages);
    expect(items).toHaveLength(1);
    expect(items[0].page).toBe(2);
    expect(items[0].category).toBe('recommendations');
  });

  it('para de capturar ao encontrar o próximo cabeçalho conhecido', () => {
    const pages = [
      {
        num: 1,
        text: ['Estratégias:', 'Usar apoio visual.', 'Metas:', 'Comunicar necessidades básicas.'].join('\n'),
      },
    ];
    const items = extractStructuredItemsFromPages(pages);
    const strategies = items.find((item) => item.category === 'strategies');
    expect(strategies.value).not.toMatch(/comunicar necessidades/i);
  });
});
