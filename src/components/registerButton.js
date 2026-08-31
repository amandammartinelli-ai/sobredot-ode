import { h } from '../utils/dom.js';
import { t } from '../i18n/index.js';

export function createRegisterButton() {
  return h('a', { class: 'register-fab', href: '#/registar' }, [
    h('span', { class: 'register-fab__icon', 'aria-hidden': 'true' }, ['✏️']),
    t('dashboard.registerCta'),
  ]);
}
