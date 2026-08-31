import { h } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatRelativeToNow } from '../../utils/format.js';
import { getSelectedChild } from '../../services/childrenService.js';
import { getLatestRecordByCategory } from '../../services/recordsService.js';
import { createChildSelector } from '../../components/childSelector.js';
import { createSummaryCard, createShortcutCard } from '../../components/card.js';
import { createRegisterButton } from '../../components/registerButton.js';
import { renderRoute } from '../../router/router.js';

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

export function renderDashboardView() {
  const child = getSelectedChild();

  const cards = SUMMARY_CARDS.map(({ categoryId, i18nKey }) => {
    const record = getLatestRecordByCategory(child.id, categoryId);
    return createSummaryCard({
      icon: t(`${i18nKey}.icon`),
      title: t(`${i18nKey}.title`),
      value: record ? formatRelativeToNow(record.createdAt) : '—',
      meta: record ? record.summary : t(`${i18nKey}.emptyMeta`),
      href: '#/timeline',
    });
  });

  const shortcuts = SHORTCUTS.map(({ route, icon, i18nKey }) =>
    createShortcutCard({ icon, label: t(i18nKey), href: `#/${route}` })
  );

  return h('div', { class: 'container view' }, [
    h('header', { class: 'view__header', style: 'display:flex; flex-wrap:wrap; gap:var(--space-4); align-items:center; justify-content:space-between' }, [
      h('div', {}, [
        h('h1', {}, [`${t(getGreetingKey())} — ${child.name}`]),
        h('p', { class: 'view__lead' }, [t('dashboard.subtitle')]),
      ]),
      createChildSelector(() => renderRoute()),
    ]),

    h('section', { 'aria-label': t('dashboard.subtitle'), class: 'dashboard-grid' }, cards),

    h('div', { style: 'margin-block: var(--space-8)' }, [createRegisterButton()]),

    h('section', {}, [
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('nav.timeline')]),
      h('div', { class: 'shortcuts-row' }, shortcuts),
    ]),
  ]);
}
