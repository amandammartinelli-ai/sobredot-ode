import { h } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';

export function createErrorState({ title = t('states.error.title'), body = t('states.error.body'), onRetry } = {}) {
  const children = [
    h('span', { class: 'state-block__icon', 'aria-hidden': 'true' }, ['⚠️']),
    h('h3', {}, [title]),
    h('p', {}, [body]),
  ];

  if (onRetry) {
    children.push(h('button', { type: 'button', class: 'btn btn--secondary', onClick: onRetry }, [t('states.error.retry')]));
  }

  return h('div', { class: 'state-block state-block--error', role: 'alert' }, children);
}
