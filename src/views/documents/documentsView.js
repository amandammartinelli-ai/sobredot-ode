import { h } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { createEmptyState } from '../../components/states/emptyState.js';

export function renderDocumentsView() {
  return h('div', { class: 'container view' }, [
    h('header', { class: 'view__header' }, [
      h('h1', {}, [t('documents.title')]),
      h('p', { class: 'view__lead' }, [t('documents.subtitle')]),
    ]),
    createEmptyState({
      icon: '📄',
      title: t('documents.emptyTitle'),
      body: t('documents.emptyBody'),
    }),
    h('div', { style: 'text-align:center' }, [
      h('button', { type: 'button', class: 'btn btn--secondary', disabled: true }, [t('documents.uploadComingSoon')]),
    ]),
  ]);
}
