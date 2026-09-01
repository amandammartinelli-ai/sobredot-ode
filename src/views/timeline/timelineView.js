import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import { loadChildContext } from '../../utils/childContext.js';
import { listRecords, softDeleteRecord, listRecordHistory } from '../../services/recordsService.js';
import { getFamilyMemberNames } from '../../services/familyService.js';
import { recordCategories, getCategoryById } from '../../data/mock/categories.js';
import { createCategoryChip } from '../../components/categoryTile.js';
import { createEmptyState } from '../../components/states/emptyState.js';
import { openConfirmDialog } from '../../components/confirmDialog.js';

const SOURCE_OPTIONS = ['family', 'school', 'professional', 'other'];

function createRecordItem(record, { childId, memberNames, onDeleted, onShowHistory }) {
  const category = getCategoryById(record.categoryId);
  const occurredAt = record.occurredAt?.toDate ? record.occurredAt.toDate() : record.occurredAt;
  const authorName = memberNames[record.createdBy] || t('timeline.unknownAuthor');

  return h('li', { class: 'card', style: 'margin-bottom: var(--space-3)' }, [
    h('div', { style: 'display:flex; justify-content:space-between; gap:var(--space-3); flex-wrap:wrap; align-items:center' }, [
      createCategoryChip(category),
      h('time', { datetime: String(occurredAt), class: 'card__meta' }, [formatDateTime(occurredAt)]),
    ]),
    h('p', { style: 'margin: var(--space-3) 0 0' }, [record.notes || record.outcome || record.behavior || '—']),
    h('p', { class: 'card__meta' }, [`${t('timeline.authorLabel')}: ${authorName}`, record.version > 1 ? ` · ${t('timeline.editedBadge')}` : '']),
    h('div', { style: 'display:flex; gap:var(--space-2); margin-top:var(--space-2)' }, [
      h('button', { type: 'button', class: 'btn btn--ghost', onClick: () => onShowHistory(record) }, [t('timeline.historyTitle')]),
      h('button', {
        type: 'button',
        class: 'btn btn--ghost',
        onClick: () => {
          openConfirmDialog({
            title: t('timeline.deleteConfirmTitle'),
            body: t('timeline.deleteConfirmBody'),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel'),
            onConfirm: async () => {
              await softDeleteRecord(childId, record.id);
              onDeleted();
            },
          });
        },
      }, [t('timeline.deleteCta')]),
    ]),
  ]);
}

export async function renderTimelineView() {
  const { familyId, selectedChild } = await loadChildContext();
  const container = h('div', { class: 'container view' });

  if (!selectedChild) {
    mount(container, [createEmptyState({ title: t('timeline.emptyTitle'), body: t('timeline.emptyBody') })]);
    return container;
  }

  let filters = { categoryId: '', source: '' };
  // Resolvido uma única vez (não muda por filtro) — se falhar, os
  // registos continuam a aparecer, só com o nome genérico de fallback.
  const memberNames = await getFamilyMemberNames(familyId).catch(() => ({}));

  async function renderList() {
    const records = await listRecords(selectedChild.id, {
      categoryId: filters.categoryId || undefined,
      source: filters.source || undefined,
      max: 200,
    });

    const categorySelect = h(
      'select',
      {
        class: 'select',
        style: 'max-width: 220px',
        'aria-label': t('timeline.filterCategory'),
        onChange: (e) => {
          filters.categoryId = e.target.value;
          renderList();
        },
      },
      [
        h('option', { value: '', selected: filters.categoryId === '' || undefined }, [t('timeline.filterAll')]),
        ...recordCategories.map((category) =>
          h('option', { value: category.id, selected: filters.categoryId === category.id || undefined }, [
            t(`${category.i18nKey}.label`),
          ])
        ),
      ]
    );

    const sourceSelect = h(
      'select',
      {
        class: 'select',
        style: 'max-width: 220px',
        'aria-label': t('timeline.filterSource'),
        onChange: (e) => {
          filters.source = e.target.value;
          renderList();
        },
      },
      [
        h('option', { value: '', selected: filters.source === '' || undefined }, [t('timeline.filterSourceAll')]),
        ...SOURCE_OPTIONS.map((source) =>
          h('option', { value: source, selected: filters.source === source || undefined }, [
            t(`register.form.source${source[0].toUpperCase()}${source.slice(1)}`),
          ])
        ),
      ]
    );

    const listOrEmpty =
      records.length > 0
        ? h(
            'ul',
            { style: 'list-style:none; padding:0; margin: var(--space-6) 0 0' },
            records.map((record) =>
              createRecordItem(record, {
                childId: selectedChild.id,
                memberNames,
                onDeleted: renderList,
                onShowHistory: (record) => showHistory(selectedChild.id, record),
              })
            )
          )
        : createEmptyState({
            icon: '🗓️',
            title: t('timeline.emptyTitle'),
            body: t('timeline.emptyBody'),
            actionLabel: t('timeline.emptyCta'),
            onAction: () => { window.location.hash = '#/registar'; },
          });

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('timeline.title')]),
        h('p', { class: 'view__lead' }, [t('timeline.subtitle')]),
        h('div', { style: 'display:flex; gap:var(--space-3); flex-wrap:wrap; margin-top:var(--space-3)' }, [
          categorySelect,
          sourceSelect,
        ]),
      ]),
      listOrEmpty,
    ]);
  }

  async function showHistory(childId, record) {
    const history = await listRecordHistory(childId, record.id);
    const dialogRoot = document.getElementById('dialog-root');
    const items =
      history.length > 0
        ? h(
            'ul',
            {},
            history.map((entry) =>
              h('li', {}, [`${formatDateTime(entry.editedAt?.toDate ? entry.editedAt.toDate() : entry.editedAt)} — ${entry.notes || '—'}`])
            )
          )
        : h('p', {}, [t('timeline.historyEmpty')]);

    mount(dialogRoot, [
      h('div', { class: 'dialog-backdrop', onClick: (e) => { if (e.target === e.currentTarget) mount(dialogRoot, []); } }, [
        h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' }, [
          h('h2', {}, [t('timeline.historyTitle')]),
          items,
          h('div', { class: 'dialog__actions' }, [
            h('button', { type: 'button', class: 'btn btn--secondary', onClick: () => mount(dialogRoot, []) }, [t('common.close')]),
          ]),
        ]),
      ]),
    ]);
  }

  await renderList();
  return container;
}
