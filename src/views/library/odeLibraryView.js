import { h } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { odeLibraryResources } from '../../data/mock/odeLibrary.js';

/**
 * Biblioteca ODE — opcional, separada da análise da criança. A família
 * só a vê se explicitamente navegar até aqui (nunca aparece dentro de um
 * insight ou como sugestão automática da IA).
 */
export function renderOdeLibraryView() {
  return h('div', { class: 'container view' }, [
    h('header', { class: 'view__header' }, [
      h('h1', {}, [t('odeLibrary.title')]),
      h('p', { class: 'view__lead' }, [t('odeLibrary.subtitle')]),
    ]),
    h('div', { class: 'notice notice--info', style: 'margin-bottom: var(--space-4)' }, [t('odeLibrary.disclaimer')]),
    h(
      'div',
      { style: 'display:grid; gap:var(--space-3)' },
      odeLibraryResources.map((resource) =>
        h('article', { class: 'card' }, [
          h('span', { class: 'category-chip' }, [resource.type]),
          h('h2', { style: 'font-size:var(--font-size-md)' }, [resource.title]),
          h('p', {}, [resource.description]),
        ])
      )
    ),
  ]);
}
