import { h } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { enterDemoMode } from '../../services/authService.js';

export function renderWelcomeView() {
  return h('div', { class: 'container view' }, [
    h('header', { class: 'view__header', style: 'text-align:center; padding-top: var(--space-8)' }, [
      h('p', { style: 'color:var(--color-brand-500); font-weight:700; letter-spacing:.04em; text-transform:uppercase; font-size:var(--font-size-sm)' }, [
        t('app.name'),
      ]),
      h('h1', {}, [t('welcome.title')]),
      h('p', { class: 'view__lead', style: 'margin-inline:auto' }, [t('welcome.subtitle')]),
      h(
        'a',
        {
          class: 'btn btn--primary',
          href: '#/dashboard',
          onClick: () => enterDemoMode(),
          style: 'margin-top: var(--space-4)',
        },
        [t('welcome.ctaEnter')]
      ),
    ]),

    h('section', { class: 'notice notice--info', style: 'margin-top: var(--space-8)' }, [
      h('h2', { style: 'font-size:var(--font-size-md); margin-bottom: var(--space-2)' }, [t('welcome.disclaimerTitle')]),
      h('p', { style: 'margin:0' }, [t('welcome.disclaimerBody')]),
    ]),

    h('section', { class: 'consent-box', style: 'margin-top: var(--space-4)' }, [
      h('p', { class: 'consent-box__title' }, [t('welcome.consentTitle')]),
      h('p', { style: 'margin:0' }, [t('welcome.consentBody')]),
    ]),
  ]);
}
