import { h } from '../utils/dom.js';

/**
 * Gráfico de barras acessível — requisito explícito da Etapa 4: "gráficos
 * acessíveis com descrição textual, legenda clara, unidades, amostra e
 * alternativa em tabela. Nunca use apenas cor para comunicar significado."
 *
 * Cada barra mostra sempre o valor em texto (não só a cor/comprimento);
 * existe sempre uma descrição textual equivalente e uma tabela alternativa
 * que pode ser mostrada/escondida.
 *
 * @param {{
 *   title: string,
 *   unit: string,
 *   sampleSize: number,
 *   bars: Array<{label: string, value: number, displayValue?: string}>,
 *   description: string,
 * }} props
 */
export function createAccessibleBarChart({ title, unit, sampleSize, bars, description }) {
  const maxValue = Math.max(1, ...bars.map((b) => b.value));
  const chartId = `chart-${Math.random().toString(36).slice(2, 8)}`;

  const barRows = bars.map((bar) =>
    h('div', { class: 'a11y-chart__row' }, [
      h('span', { class: 'a11y-chart__label' }, [bar.label]),
      h('div', { class: 'a11y-chart__track', role: 'presentation' }, [
        h('div', {
          class: 'a11y-chart__fill',
          style: `width:${Math.round((bar.value / maxValue) * 100)}%`,
        }),
      ]),
      h('span', { class: 'a11y-chart__value' }, [bar.displayValue ?? `${bar.value} ${unit}`]),
    ])
  );

  const table = h('table', { class: 'a11y-chart__table', hidden: true, id: `${chartId}-table` }, [
    h('caption', {}, [`${title} — tabela de dados (${unit}, amostra: ${sampleSize})`]),
    h('thead', {}, [h('tr', {}, [h('th', { scope: 'col' }, ['Categoria']), h('th', { scope: 'col' }, [`Valor (${unit})`])])]),
    h(
      'tbody',
      {},
      bars.map((bar) => h('tr', {}, [h('th', { scope: 'row' }, [bar.label]), h('td', {}, [bar.displayValue ?? String(bar.value)])]))
    ),
  ]);

  const toggleButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--ghost',
      style: 'margin-top:var(--space-2)',
      'aria-expanded': 'false',
      'aria-controls': `${chartId}-table`,
      onClick: (event) => {
        const expanded = table.hidden;
        table.hidden = !expanded;
        event.currentTarget.setAttribute('aria-expanded', String(expanded));
        event.currentTarget.textContent = expanded ? 'Ocultar tabela de dados' : 'Ver como tabela';
      },
    },
    ['Ver como tabela']
  );

  return h('figure', { class: 'a11y-chart', role: 'group', 'aria-labelledby': `${chartId}-title` }, [
    h('figcaption', { id: `${chartId}-title`, style: 'font-weight:var(--font-weight-medium)' }, [title]),
    h('p', { class: 'form-field__hint' }, [`${description} Unidade: ${unit}. Amostra: ${sampleSize}.`]),
    bars.length === 0
      ? h('p', { class: 'card__meta' }, ['Sem dados suficientes para desenhar este gráfico.'])
      : h('div', { class: 'a11y-chart__bars' }, barRows),
    bars.length > 0 ? toggleButton : '',
    table,
  ]);
}
