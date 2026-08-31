import { h } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { createEmptyState } from '../../components/states/emptyState.js';

export function renderReportsView() {
  return h('div', { class: 'container view' }, [
    h('header', { class: 'view__header' }, [
      h('h1', {}, [t('reports.title')]),
      h('p', { class: 'view__lead' }, [t('reports.subtitle')]),
    ]),
    createEmptyState({
      icon: '📊',
      title: t('reports.emptyTitle'),
      body: t('reports.emptyBody'),
    }),
  ]);
}
