import { h } from '../utils/dom.js';

/**
 * Cartão de resumo do dashboard (sono, humor, alimentação, medicação).
 * @param {{icon:string, title:string, value:string, meta:string, href:string}} props
 */
export function createSummaryCard({ icon, title, value, meta, href }) {
  return h('a', { class: 'card card--link', href }, [
    h('div', { class: 'card__header' }, [
      h('span', { class: 'card__icon', 'aria-hidden': 'true' }, [icon]),
      h('h3', { class: 'card__title' }, [title]),
    ]),
    h('p', { class: 'card__value' }, [value]),
    h('p', { class: 'card__meta' }, [meta]),
  ]);
}

/**
 * Cartão de atalho (linha do tempo, documentos, insights, relatórios).
 */
export function createShortcutCard({ icon, label, href }) {
  return h('a', { class: 'shortcut-card', href }, [
    h('span', { class: 'shortcut-card__icon', 'aria-hidden': 'true' }, [icon]),
    h('span', {}, [label]),
  ]);
}
