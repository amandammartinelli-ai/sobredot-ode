import { h } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatRelativeToNow } from '../../utils/format.js';
import { loadChildContext } from '../../utils/childContext.js';
import { getLatestRecordByCategory, listRecords } from '../../services/recordsService.js';
import { createChildSelector } from '../../components/childSelector.js';
import { createSummaryCard, createShortcutCard } from '../../components/card.js';
import { createRegisterButton } from '../../components/registerButton.js';
import { createEmptyState } from '../../components/states/emptyState.js';
import { recordCategories } from '../../data/mock/categories.js';

const SUMMARY_CARDS = [
  { categoryId: 'sleep', i18nKey: 'dashboard.cards.sleep' },
  { categoryId: 'emotions', i18nKey: 'dashboard.cards.mood' },
  { categoryId: 'food', i18nKey: 'dashboard.cards.food' },
  { categoryId: 'medication', i18nKey: 'dashboard.cards.medication' },
];

const SHORTCUTS = [
  { route: 'timeline', icon: '📅', i18nKey: 'dashboard.shortcuts.timeline' },
  { route: 'documents', icon: '📄', i18nKey: 'dashboard.shortcuts.documents' },
  { route: 'insights', icon: '💡', i18nKey: 'dashboard.shortcuts.insights' },
  { route: 'reports', icon: '📊', i18nKey: 'dashboard.shortcuts.reports' },
];

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashboard.greetingMorning';
  if (hour < 19) return 'dashboard.greetingAfternoon';
  return 'dashboard.greetingEvening';
}

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export async function renderDashboardView({ navigate }) {
  const { children, selectedChild } = await loadChildContext();

  if (!selectedChild) {
    return h('div', { class: 'container view' }, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('app.name')])]),
      createEmptyState({
        icon: '🧒',
        title: t('children.newTitle'),
        body: t('onboarding.childStepSubtitle'),
        actionLabel: t('dashboard.addChildCta'),
        onAction: () => navigate('crianca', 'novo'),
      }),
    ]);
  }

  const [summaryRecords, recentRecords] = await Promise.all([
    Promise.all(SUMMARY_CARDS.map(({ categoryId }) => getLatestRecordByCategory(selectedChild.id, categoryId))),
    listRecords(selectedChild.id, { sinceDate: sevenDaysAgo(), max: 500 }),
  ]);

  const cards = SUMMARY_CARDS.map(({ i18nKey }, index) => {
    const record = summaryRecords[index];
    return createSummaryCard({
      icon: t(`${i18nKey}.icon`),
      title: t(`${i18nKey}.title`),
      value: record ? formatRelativeToNow(record.occurredAt?.toDate?.() || record.occurredAt) : '—',
      meta: record ? record.notes || t(`${i18nKey}.title`) : t(`${i18nKey}.emptyMeta`),
      href: '#/timeline',
    });
  });

  const shortcuts = SHORTCUTS.map(({ route, icon, i18nKey }) =>
    createShortcutCard({ icon, label: t(i18nKey), href: `#/${route}` })
  );

  const countsByCategory = recordCategories
    .map((category) => ({
      category,
      count: recentRecords.filter((record) => record.categoryId === category.id).length,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const statsSection =
    recentRecords.length === 0
      ? h('p', { class: 'card__meta' }, [t('dashboard.statsNoData')])
      : h('div', {}, [
          h('p', {}, [`${recentRecords.length} ${t('dashboard.statsTotalRecords')}`]),
          h(
            'ul',
            { style: 'list-style:none; padding:0; display:flex; flex-wrap:wrap; gap:var(--space-2)' },
            countsByCategory.map(({ category, count }) =>
              h(
                'li',
                {
                  class: 'category-chip',
                  style: `--chip-color: var(${category.colorVar})`,
                },
                [`${t(`${category.i18nKey}.label`)}: ${count}`]
              )
            )
          ),
          h('p', { class: 'form-field__hint', style: 'margin-top: var(--space-3)' }, [t('dashboard.statsDisclaimer')]),
        ]);

  return h('div', { class: 'container view' }, [
    h(
      'header',
      {
        class: 'view__header',
        style: 'display:flex; flex-wrap:wrap; gap:var(--space-4); align-items:center; justify-content:space-between',
      },
      [
        h('div', {}, [
          h('h1', {}, [`${t(getGreetingKey())} — ${selectedChild.name}`]),
          h('p', { class: 'view__lead' }, [t('dashboard.subtitle')]),
        ]),
        createChildSelector({
          children,
          selectedChild,
          onChange: () => renderCurrentRoute(),
        }),
      ]
    ),

    h('section', { 'aria-label': t('dashboard.subtitle'), class: 'dashboard-grid' }, cards),

    h('div', { style: 'margin-block: var(--space-8)' }, [createRegisterButton()]),

    h('section', { class: 'card', style: 'margin-bottom: var(--space-6)' }, [
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('dashboard.statsTitle')]),
      statsSection,
    ]),

    h('section', {}, [
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('nav.timeline')]),
      h('div', { class: 'shortcuts-row' }, shortcuts),
    ]),
  ]);
}

function renderCurrentRoute() {
  // Recarrega a vista atual para refletir a nova criança selecionada.
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
