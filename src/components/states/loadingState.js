import { h } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';

export function createLoadingState(label = t('states.loading')) {
  return h('div', { class: 'state-block state-block--loading', role: 'status', 'aria-live': 'polite' }, [
    h('span', { class: 'spinner', 'aria-hidden': 'true' }),
    h('p', {}, [label]),
  ]);
}

/**
 * Placeholder tipo "esqueleto" para cartões enquanto o conteúdo é preparado.
 */
export function createSkeletonCard() {
  return h('div', { class: 'card', 'aria-hidden': 'true' }, [
    h('div', { class: 'skeleton', style: 'height:1.25rem;width:60%;margin-bottom:.75rem' }),
    h('div', { class: 'skeleton', style: 'height:1.75rem;width:40%;margin-bottom:.5rem' }),
    h('div', { class: 'skeleton', style: 'height:1rem;width:80%' }),
  ]);
}
