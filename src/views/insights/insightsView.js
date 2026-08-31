import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import { loadChildContext } from '../../utils/childContext.js';
import { createChildSelector } from '../../components/childSelector.js';
import { createEmptyState } from '../../components/states/emptyState.js';
import { createErrorState } from '../../components/states/errorState.js';
import { createAccessibleBarChart } from '../../components/accessibleBarChart.js';
import { listRecords } from '../../services/recordsService.js';
import {
  generateInsights,
  listLatestInsights,
  listInsightStatusHistory,
  setInsightStatus,
} from '../../services/insightsService.js';
import { listGoals, createGoal, updateGoalStatus, softDeleteGoal } from '../../services/goalsService.js';
import { recordCategories } from '../../data/mock/categories.js';

const PERIOD_OPTIONS = [
  { value: '7d', labelKey: 'insights.period7d' },
  { value: '30d', labelKey: 'insights.period30d' },
  { value: '90d', labelKey: 'insights.period90d' },
];

const CONFIDENCE_LABEL_KEYS = {
  insufficient: 'insights.confidenceInsufficient',
  low: 'insights.confidenceLow',
  medium: 'insights.confidenceMedium',
  high: 'insights.confidenceHigh',
};

const STATUS_LABEL_KEYS = {
  not_reviewed: 'insights.statusNotReviewed',
  family_reviewed: 'insights.statusFamilyReviewed',
  professional_validated: 'insights.statusProfessionalValidated',
  contested: 'insights.statusContested',
};

const QUESTIONS_STORAGE_PREFIX = 'sobredot.nextVisitQuestions.';

function loadQuestions(childId) {
  try {
    const raw = localStorage.getItem(QUESTIONS_STORAGE_PREFIX + childId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQuestions(childId, questions) {
  try {
    localStorage.setItem(QUESTIONS_STORAGE_PREFIX + childId, JSON.stringify(questions));
  } catch {
    // localStorage indisponível (ex.: modo privado) — as perguntas só não
    // persistem entre sessões; não é um erro que impeça o resto da vista.
  }
}

export async function renderInsightsView({ navigate }) {
  const { children, selectedChild } = await loadChildContext();
  const container = h('div', { class: 'container view' });

  if (!selectedChild) {
    mount(container, [
      createEmptyState({
        icon: '🧒',
        title: t('children.newTitle'),
        body: t('onboarding.childStepSubtitle'),
        actionLabel: t('dashboard.addChildCta'),
        onAction: () => navigate('crianca', 'novo'),
      }),
    ]);
    return container;
  }

  let periodKey = '30d';
  let filters = { source: '', categoryId: '', contextText: '' };

  async function render() {
    mount(container, [h('p', {}, [t('states.loading')])]);

    let insights = [];
    let goals = [];
    let error = null;
    try {
      [insights, goals] = await Promise.all([listLatestInsights(selectedChild.id), listGoals(selectedChild.id)]);
    } catch (err) {
      error = err;
    }

    const sinceDate = new Date(Date.now() - Number(periodKey.replace('d', '')) * 24 * 60 * 60 * 1000);
    let periodRecords = [];
    try {
      periodRecords = await listRecords(selectedChild.id, {
        sinceDate,
        source: filters.source || undefined,
        categoryId: filters.categoryId || undefined,
        max: 1000,
      });
    } catch {
      periodRecords = [];
    }
    if (filters.contextText) {
      const needle = filters.contextText.toLowerCase();
      periodRecords = periodRecords.filter((r) =>
        [r.where, r.withWhom, r.antecedent].filter(Boolean).some((v) => v.toLowerCase().includes(needle))
      );
    }

    mount(container, [
      renderHeader(),
      error ? createErrorState({ body: error.message }) : '',
      renderFiltersSection(),
      renderSummarySection(periodRecords),
      renderPatternsSection(insights),
      renderStrategiesSection(insights),
      renderTalkingPointsSection(insights),
      renderNextVisitQuestionsSection(),
      renderGoalsSection(goals, insights),
      h('div', { style: 'margin-top: var(--space-6)' }, [
        h('a', { href: '#/documents', class: 'btn btn--ghost' }, [t('insights.goToDocuments')]),
        ' ',
        h('a', { href: '#/reports', class: 'btn btn--ghost' }, [t('insights.goToReports')]),
        ' ',
        h('a', { href: '#/biblioteca-ode', class: 'btn btn--ghost' }, [t('odeLibrary.linkCta')]),
      ]),
    ]);
  }

  function renderHeader() {
    const periodSelect = h(
      'select',
      { class: 'select', 'aria-label': t('insights.periodLabel') },
      PERIOD_OPTIONS.map((opt) => h('option', { value: opt.value, selected: opt.value === periodKey || undefined }, [t(opt.labelKey)]))
    );
    periodSelect.addEventListener('change', () => {
      periodKey = periodSelect.value;
      render();
    });

    const refreshButton = h(
      'button',
      {
        type: 'button',
        class: 'btn btn--primary',
        onClick: async (event) => {
          event.target.disabled = true;
          event.target.textContent = t('insights.refreshing');
          try {
            await generateInsights(selectedChild.id, periodKey);
            announce(t('insights.refreshedAnnounce'));
            await render();
          } catch (err) {
            mount(container, [createErrorState({ body: err.message })]);
          }
        },
      },
      [t('insights.refreshCta')]
    );

    return h(
      'header',
      { class: 'view__header', style: 'display:flex; flex-wrap:wrap; gap:var(--space-4); align-items:center; justify-content:space-between' },
      [
        h('div', {}, [h('h1', {}, [t('insights.title')]), h('p', { class: 'view__lead' }, [t('insights.subtitle')])]),
        h('div', { style: 'display:flex; gap:var(--space-3); flex-wrap:wrap; align-items:center' }, [
          createChildSelector({ children, selectedChild, onChange: () => render() }),
          periodSelect,
          refreshButton,
        ]),
      ]
    );
  }

  function renderFiltersSection() {
    const sourceSelect = h('select', { class: 'select' }, [
      h('option', { value: '' }, [t('insights.filterSourceAll')]),
      h('option', { value: 'family' }, [t('register.form.sourceFamily')]),
      h('option', { value: 'school' }, [t('register.form.sourceSchool')]),
      h('option', { value: 'professional' }, [t('register.form.sourceProfessional')]),
      h('option', { value: 'other' }, [t('register.form.sourceOther')]),
    ]);
    sourceSelect.value = filters.source;
    sourceSelect.addEventListener('change', () => {
      filters.source = sourceSelect.value;
      render();
    });

    const categorySelect = h('select', { class: 'select' }, [
      h('option', { value: '' }, [t('insights.filterCategoryAll')]),
      ...recordCategories.map((c) => h('option', { value: c.id }, [t(`${c.i18nKey}.label`)])),
    ]);
    categorySelect.value = filters.categoryId;
    categorySelect.addEventListener('change', () => {
      filters.categoryId = categorySelect.value;
      render();
    });

    const contextInput = h('input', { class: 'input', type: 'search', value: filters.contextText, placeholder: t('insights.filterContextPlaceholder') });
    contextInput.addEventListener('change', () => {
      filters.contextText = contextInput.value.trim();
      render();
    });

    return h('section', { class: 'card', style: 'margin-bottom: var(--space-4); display:flex; gap:var(--space-3); flex-wrap:wrap; align-items:end' }, [
      h('div', { class: 'form-field' }, [h('label', {}, [t('insights.filterSourceLabel')]), sourceSelect]),
      h('div', { class: 'form-field' }, [h('label', {}, [t('insights.filterCategoryLabel')]), categorySelect]),
      h('div', { class: 'form-field' }, [h('label', {}, [t('insights.filterContextLabel')]), contextInput]),
      h('p', { class: 'form-field__hint', style: 'flex-basis:100%' }, [t('insights.filtersScopeHint')]),
    ]);
  }

  function renderSummarySection(periodRecords) {
    const counts = recordCategories
      .map((category) => ({ category, count: periodRecords.filter((r) => r.categoryId === category.id).length }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    const daysWithRecords = new Set(
      periodRecords.map((r) => (r.occurredAt?.toDate ? r.occurredAt.toDate() : new Date(r.occurredAt)).toDateString())
    ).size;

    const chart = createAccessibleBarChart({
      title: t('insights.summaryChartTitle'),
      unit: t('insights.summaryChartUnit'),
      sampleSize: periodRecords.length,
      description: t('insights.summaryChartDescription'),
      bars: counts.map(({ category, count }) => ({ label: t(`${category.i18nKey}.label`), value: count })),
    });

    return h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('insights.summaryTitle')]),
      h('p', {}, [`${periodRecords.length} ${t('insights.summaryTextRecords')}, ${daysWithRecords} ${t('insights.summaryTextDays')}.`]),
      chart,
      h('p', { class: 'form-field__hint' }, [t('dashboard.statsDisclaimer')]),
    ]);
  }

  function renderConfidenceBadge(confidence) {
    return h('span', { class: 'category-chip' }, [t(CONFIDENCE_LABEL_KEYS[confidence] || confidence)]);
  }

  function renderStatusBadge(status) {
    return h('span', { class: 'category-chip' }, [t(STATUS_LABEL_KEYS[status] || status)]);
  }

  function renderInsightActions(insight, onChanged) {
    const historyContainer = h('div', { hidden: true });

    const historyToggle = h(
      'button',
      {
        type: 'button',
        class: 'btn btn--ghost',
        onClick: async (event) => {
          if (!historyContainer.hidden) {
            historyContainer.hidden = true;
            return;
          }
          const history = await listInsightStatusHistory(selectedChild.id, insight.id);
          mount(historyContainer, [
            history.length === 0
              ? h('p', { class: 'card__meta' }, [t('insights.noHistory')])
              : h(
                  'ul',
                  { style: 'list-style:none; padding:0' },
                  history.map((entry) =>
                    h('li', { class: 'card__meta' }, [
                      `${formatDateTime(entry.createdAt?.toDate ? entry.createdAt.toDate() : entry.createdAt)} — `,
                      t(STATUS_LABEL_KEYS[entry.status] || entry.status),
                      entry.comment ? ` — "${entry.comment}"` : '',
                    ])
                  )
                ),
          ]);
          historyContainer.hidden = false;
          void event;
        },
      },
      [t('insights.viewHistoryCta')]
    );

    const continueButton = h(
      'button',
      {
        type: 'button',
        class: 'btn btn--secondary',
        onClick: async () => {
          await setInsightStatus(selectedChild.id, insight.id, 'family_reviewed');
          announce(t('insights.markedReviewedAnnounce'));
          onChanged();
        },
      },
      [t('insights.safeActionContinueObserving')]
    );

    return h('div', { style: 'display:flex; gap:var(--space-2); flex-wrap:wrap; margin-top:var(--space-2)' }, [
      continueButton,
      historyToggle,
      historyContainer,
    ]);
  }

  function renderInsightCard(insight) {
    const evidenceBars =
      Array.isArray(insight.evidence) && insight.evidence.length > 0 && insight.evidence.every((e) => typeof e.value === 'string')
        ? createAccessibleBarChart({
            title: t('insights.evidenceChartTitle'),
            unit: '',
            sampleSize: insight.sampleSize ?? 0,
            description: t('insights.evidenceChartDescription'),
            bars: insight.evidence
              .filter((e) => /^\d+(\.\d+)?%?$/.test(e.value))
              .map((e) => ({ label: e.label, value: parseFloat(e.value), displayValue: e.value })),
          })
        : '';

    const comparison = insight.comparisonDetails
      ? h('div', { style: 'margin-top:var(--space-3)' }, [
          h('h4', { style: 'font-size:var(--font-size-sm)' }, [t('insights.comparisonRemained')]),
          renderComparisonList(insight.comparisonDetails.remained),
          h('h4', { style: 'font-size:var(--font-size-sm)' }, [t('insights.comparisonAppeared')]),
          renderComparisonList(insight.comparisonDetails.appeared),
          h('h4', { style: 'font-size:var(--font-size-sm)' }, [t('insights.comparisonDisappeared')]),
          renderComparisonList(insight.comparisonDetails.disappeared),
        ])
      : '';

    return h('article', { class: 'card', style: 'margin-bottom: var(--space-3)' }, [
      h('div', { style: 'display:flex; justify-content:space-between; gap:var(--space-2); flex-wrap:wrap' }, [
        h('h3', { style: 'font-size:var(--font-size-md); margin:0' }, [insight.title]),
        h('div', { style: 'display:flex; gap:var(--space-2)' }, [renderConfidenceBadge(insight.confidence), renderStatusBadge(insight.status)]),
      ]),
      h('p', {}, [insight.factualObservation]),
      insight.possiblePattern ? h('p', { style: 'font-style:italic' }, [insight.possiblePattern]) : '',
      evidenceBars,
      comparison,
      insight.limitations?.length
        ? h(
            'ul',
            { class: 'form-field__hint', style: 'padding-left:var(--space-4)' },
            insight.limitations.map((l) => h('li', {}, [l]))
          )
        : '',
      renderInsightActions(insight, render),
    ]);
  }

  function renderComparisonList(items) {
    if (!items || items.length === 0) return h('p', { class: 'card__meta' }, [t('insights.comparisonEmpty')]);
    return h(
      'ul',
      {},
      items.map((item) => h('li', {}, [`${getCategoryLabelSafe(item.category)}: ${item.value}`]))
    );
  }

  const EXTRACTION_CATEGORY_LABELS = {
    strengths: 'Pontos fortes',
    needs: 'Necessidades',
    observations: 'Observações',
    assessmentResults: 'Resultados de avaliação',
    recommendations: 'Recomendações',
    strategies: 'Estratégias',
    goals: 'Metas',
    schoolAdaptations: 'Adaptações escolares',
    sensory: 'Aspetos sensoriais',
    communication: 'Comunicação',
    sleep: 'Sono',
    food: 'Alimentação',
    medicationInfo: 'Informação sobre medicação',
    dates: 'Datas',
    responsibleProfessional: 'Profissional responsável',
    limitations: 'Limitações',
  };

  function getCategoryLabelSafe(categoryId) {
    return EXTRACTION_CATEGORY_LABELS[categoryId] || categoryId;
  }

  function renderPatternsSection(insights) {
    const summary = insights.find((i) => i.patternType === 'category_summary');
    const patternInsights = insights.filter((i) => i.patternType !== 'category_summary' && i.patternType !== 'strategies_outcomes');

    return h('section', { style: 'margin-bottom: var(--space-6)' }, [
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('insights.patternsTitle')]),
      insights.length === 0
        ? h('p', { class: 'card__meta' }, [t('insights.noInsightsYet')])
        : h('div', {}, [summary ? renderInsightCard(summary) : '', ...patternInsights.map(renderInsightCard)]),
    ]);
  }

  function renderStrategiesSection(insights) {
    const strategies = insights.find((i) => i.patternType === 'strategies_outcomes');
    if (!strategies) return '';
    return h('section', { style: 'margin-bottom: var(--space-6)' }, [
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('insights.strategiesTitle')]),
      renderInsightCard(strategies),
    ]);
  }

  function renderTalkingPointsSection(insights) {
    const talkingPoints = insights.filter(
      (i) => i.confidence !== 'insufficient' && i.possiblePattern && /diferença/i.test(i.possiblePattern)
    );
    return h('section', { class: 'card', style: 'margin-bottom: var(--space-6)' }, [
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('insights.talkingPointsTitle')]),
      talkingPoints.length === 0
        ? h('p', { class: 'card__meta' }, [t('insights.noTalkingPoints')])
        : h(
            'ul',
            {},
            talkingPoints.map((i) => h('li', {}, [i.title]))
          ),
    ]);
  }

  function renderNextVisitQuestionsSection() {
    let questions = loadQuestions(selectedChild.id);
    const list = h('ul', { style: 'padding-left:var(--space-4)' });
    const input = h('input', { class: 'input', type: 'text', placeholder: t('insights.newQuestionPlaceholder') });

    function renderList() {
      mount(
        list,
        questions.length === 0
          ? [h('p', { class: 'card__meta' }, [t('insights.noQuestionsYet')])]
          : questions.map((q, index) =>
              h('li', { style: 'display:flex; justify-content:space-between; gap:var(--space-2)' }, [
                h('span', {}, [q]),
                h('button', {
                  type: 'button',
                  class: 'btn btn--ghost',
                  onClick: () => {
                    questions = questions.filter((_, i) => i !== index);
                    saveQuestions(selectedChild.id, questions);
                    renderList();
                  },
                }, [t('common.remove')]),
              ])
            )
      );
    }
    renderList();

    const form = h(
      'form',
      {
        style: 'display:flex; gap:var(--space-2); margin-top:var(--space-3)',
        onSubmit: (event) => {
          event.preventDefault();
          if (!input.value.trim()) return;
          questions = [...questions, input.value.trim()];
          saveQuestions(selectedChild.id, questions);
          input.value = '';
          renderList();
        },
      },
      [input, h('button', { type: 'submit', class: 'btn btn--secondary' }, [t('insights.addQuestionCta')])]
    );

    return h('section', { class: 'card', style: 'margin-bottom: var(--space-6)' }, [
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('insights.nextVisitQuestionsTitle')]),
      h('p', { class: 'view__lead' }, [t('insights.nextVisitQuestionsHint')]),
      list,
      form,
    ]);
  }

  function renderGoalsSection(goals, insights) {
    const titleInput = h('input', { class: 'input', type: 'text', required: true });
    const descriptionInput = h('textarea', { class: 'textarea' });
    const targetDateInput = h('input', { class: 'input', type: 'date' });

    const recommendationInsight = insights.find((i) => i.patternType === 'document_recommendations');
    const importableEvidence = (recommendationInsight?.evidence || []).filter((e) => e.documentId);

    return h('section', { class: 'card' }, [
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('goals.title')]),
      h('p', { class: 'view__lead' }, [t('goals.subtitle')]),

      goals.length === 0
        ? h('p', { class: 'card__meta' }, [t('goals.empty')])
        : h(
            'ul',
            { style: 'list-style:none; padding:0; display:grid; gap:var(--space-2)' },
            goals.map((goal) =>
              h('li', { class: 'card', style: 'padding:var(--space-3)' }, [
                h('div', { style: 'display:flex; justify-content:space-between; gap:var(--space-2); flex-wrap:wrap' }, [
                  h('strong', {}, [goal.title]),
                  h('span', { class: 'category-chip' }, [t(`goals.origin${goal.origin === 'document' ? 'Document' : 'Family'}`)]),
                ]),
                goal.description ? h('p', { class: 'card__meta' }, [goal.description]) : '',
                h('p', { class: 'card__meta' }, [`${t('goals.statusLabel')}: ${t(`goals.status_${goal.status}`)}`]),
                h('div', { style: 'display:flex; gap:var(--space-2); flex-wrap:wrap' }, [
                  goal.status === 'active'
                    ? h('button', {
                        type: 'button',
                        class: 'btn btn--ghost',
                        onClick: async () => {
                          await updateGoalStatus(selectedChild.id, goal.id, 'achieved');
                          render();
                        },
                      }, [t('goals.markAchievedCta')])
                    : '',
                  h('button', {
                    type: 'button',
                    class: 'btn btn--ghost',
                    onClick: async () => {
                      await softDeleteGoal(selectedChild.id, goal.id);
                      render();
                    },
                  }, [t('common.remove')]),
                ]),
              ])
            )
          ),

      h(
        'form',
        {
          style: 'margin-top: var(--space-4)',
          onSubmit: async (event) => {
            event.preventDefault();
            if (!titleInput.value.trim()) return;
            await createGoal(selectedChild.id, selectedChild.familyId, {
              title: titleInput.value.trim(),
              description: descriptionInput.value.trim() || null,
              origin: 'family',
              targetDate: targetDateInput.value || null,
            });
            render();
          },
        },
        [
          h('div', { class: 'form-field' }, [h('label', {}, [t('goals.titleLabel')]), titleInput]),
          h('div', { class: 'form-field' }, [h('label', {}, [t('goals.descriptionLabel')]), descriptionInput]),
          h('div', { class: 'form-field' }, [h('label', {}, [t('goals.targetDateLabel')]), targetDateInput]),
          h('button', { type: 'submit', class: 'btn btn--secondary' }, [t('goals.createCta')]),
        ]
      ),

      importableEvidence.length > 0
        ? h('div', { style: 'margin-top: var(--space-4)' }, [
            h('h3', { style: 'font-size:var(--font-size-sm)' }, [t('goals.importFromDocumentTitle')]),
            h(
              'ul',
              {},
              importableEvidence.map((evidence) =>
                h('li', { style: 'display:flex; justify-content:space-between; gap:var(--space-2)' }, [
                  h('span', {}, [`${evidence.label} (p.${evidence.page})`]),
                  h('button', {
                    type: 'button',
                    class: 'btn btn--ghost',
                    onClick: async () => {
                      await createGoal(selectedChild.id, selectedChild.familyId, {
                        title: evidence.label.slice(0, 200),
                        description: `${t('goals.importedFromDocumentNotePrefix')} p.${evidence.page}`,
                        origin: 'document',
                        sourceDocumentId: evidence.documentId,
                      });
                      render();
                    },
                  }, [t('goals.importCta')]),
                ])
              )
            ),
          ])
        : '',
    ]);
  }

  await render();
  return container;
}
