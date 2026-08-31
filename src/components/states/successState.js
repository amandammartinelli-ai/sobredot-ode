import { h } from '../../utils/dom.js';

export function createSuccessState({ title, body, actions = [] }) {
  return h('div', { class: 'state-block state-block--success', role: 'status' }, [
    h('span', { class: 'state-block__icon', 'aria-hidden': 'true' }, ['✅']),
    h('h3', {}, [title]),
    h('p', {}, [body]),
    h(
      'div',
      { style: 'display:flex; gap: var(--space-3); flex-wrap: wrap; justify-content:center' },
      actions.map((action) =>
        h('button', { type: 'button', class: `btn ${action.variant || 'btn--secondary'}`, onClick: action.onClick }, [
          action.label,
        ])
      )
    ),
  ]);
}
