import { h } from '../utils/dom.js';
import { t } from '../i18n/index.js';

export function createSpeakButton() {
  return h('a', { class: 'register-fab register-fab--outline', href: '#/falar' }, [
    h('span', { class: 'register-fab__icon', 'aria-hidden': 'true' }, ['🎙️']),
    t('dashboard.speakCta'),
  ]);
}
