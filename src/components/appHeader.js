import { h, mount } from '../utils/dom.js';
import { t } from '../i18n/index.js';

export function renderAppHeader() {
  const root = document.querySelector('[data-app-header]');
  if (!root) return;

  const header = h('div', { class: 'app-header' }, [
    h('div', { class: 'container app-header__bar' }, [
      h('a', { class: 'app-header__brand', href: '#/dashboard' }, [
        t('app.name'),
        h('span', { class: 'app-header__endorsement' }, [` — ${t('app.endorsement')}`]),
      ]),
    ]),
  ]);

  mount(root, header);
}
