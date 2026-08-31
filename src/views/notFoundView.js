import { h } from '../utils/dom.js';
import { t } from '../i18n/index.js';

export function renderNotFoundView() {
  return h('div', { class: 'container view' }, [
    h('div', { class: 'state-block' }, [
      h('span', { class: 'state-block__icon', 'aria-hidden': 'true' }, ['🧭']),
      h('h1', {}, [t('notFound.title')]),
      h('p', {}, [t('notFound.body')]),
      h('a', { class: 'btn btn--primary', href: '#/dashboard' }, [t('notFound.backHome')]),
    ]),
  ]);
}
