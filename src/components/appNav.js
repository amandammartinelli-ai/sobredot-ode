import { h, mount } from '../utils/dom.js';
import { t } from '../i18n/index.js';

const NAV_ITEMS = [
  { route: 'dashboard', icon: '🏠', labelKey: 'nav.dashboard' },
  { route: 'timeline', icon: '📅', labelKey: 'nav.timeline' },
  { route: 'documents', icon: '📄', labelKey: 'nav.documents' },
  { route: 'insights', icon: '💡', labelKey: 'nav.insights' },
  { route: 'reports', icon: '📊', labelKey: 'nav.reports' },
  { route: 'profile', icon: '👤', labelKey: 'nav.profile' },
];

/**
 * Volta a desenhar a navegação principal, assinalando a rota ativa com
 * aria-current="page" (essencial para leitores de ecrã e para o estilo).
 */
export function renderAppNav(activeRoute) {
  const root = document.querySelector('[data-app-nav]');
  if (!root) return;

  const links = NAV_ITEMS.map((item) =>
    h(
      'a',
      {
        class: 'app-nav__link',
        href: `#/${item.route}`,
        'aria-current': activeRoute === item.route ? 'page' : undefined,
      },
      [h('span', { class: 'app-nav__icon', 'aria-hidden': 'true' }, [item.icon]), h('span', {}, [t(item.labelKey)])]
    )
  );

  mount(root, links);
}
