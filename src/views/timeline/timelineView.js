import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import { getSelectedChild } from '../../services/childrenService.js';
import { listRecordsForChild } from '../../services/recordsService.js';
import { recordCategories, getCategoryById } from '../../data/mock/categories.js';
import { createCategoryChip } from '../../components/categoryTile.js';
import { createEmptyState } from '../../components/states/emptyState.js';

function createRecordItem(record) {
  const category = getCategoryById(record.categoryId);
  return h('li', { class: 'card', style: 'margin-bottom: var(--space-3)' }, [
    h('div', { style: 'display:flex; justify-content:space-between; gap:var(--space-3); flex-wrap:wrap; align-items:center' }, [
      createCategoryChip(category),
      h('time', { datetime: record.createdAt, class: 'card__meta' }, [formatDateTime(record.createdAt)]),
    ]),
    h('p', { style: 'margin: var(--space-3) 0 0' }, [record.summary || '—']),
  ]);
}

export function renderTimelineView() {
  const container = h('div', { class: 'container view' });
  const child = getSelectedChild();
  let activeCategoryId = 'all';

  function renderList() {
    const allRecords = listRecordsForChild(child.id);
    const records =
      activeCategoryId === 'all' ? allRecords : allRecords.filter((record) => record.categoryId === activeCategoryId);

    const filterSelect = h(
      'select',
      {
        class: 'select',
        style: 'max-width: 240px',
        'aria-label': t('timeline.filterAll'),
        onChange: (event) => {
          activeCategoryId = event.target.value;
          renderList();
        },
      },
      [
        h('option', { value: 'all', selected: activeCategoryId === 'all' || undefined }, [t('timeline.filterAll')]),
        ...recordCategories.map((category) =>
          h('option', { value: category.id, selected: activeCategoryId === category.id || undefined }, [
            t(`${category.i18nKey}.label`),
          ])
        ),
      ]
    );

    const listOrEmpty =
      records.length > 0
        ? h('ul', { style: 'list-style:none; padding:0; margin: var(--space-6) 0 0' }, records.map(createRecordItem))
        : createEmptyState({
            icon: '🗓️',
            title: t('timeline.emptyTitle'),
            body: t('timeline.emptyBody'),
            actionLabel: t('timeline.emptyCta'),
            onAction: () => {
              window.location.hash = '#/registar';
            },
          });

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('timeline.title')]),
        h('p', { class: 'view__lead' }, [t('timeline.subtitle')]),
        filterSelect,
      ]),
      listOrEmpty,
    ]);
  }

  renderList();
  return container;
}
