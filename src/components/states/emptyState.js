import { h } from '../../utils/dom.js';

/**
 * @param {{icon?:string, title:string, body:string, actionLabel?:string, onAction?:Function}} props
 */
export function createEmptyState({ icon = '🗂️', title, body, actionLabel, onAction }) {
  const children = [
    h('span', { class: 'state-block__icon', 'aria-hidden': 'true' }, [icon]),
    h('h3', {}, [title]),
    h('p', {}, [body]),
  ];

  if (actionLabel) {
    children.push(h('button', { type: 'button', class: 'btn btn--primary', onClick: onAction }, [actionLabel]));
  }

  return h('div', { class: 'state-block state-block--empty', role: 'status' }, children);
}
