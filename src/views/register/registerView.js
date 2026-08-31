import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { recordCategories, getCategoryById } from '../../data/mock/categories.js';
import { createCategoryTile } from '../../components/categoryTile.js';
import { loadChildContext } from '../../utils/childContext.js';
import { createRecord } from '../../services/recordsService.js';
import { openConfirmDialog } from '../../components/confirmDialog.js';
import { createSuccessState } from '../../components/states/successState.js';
import { createErrorState } from '../../components/states/errorState.js';
import { createEmptyState } from '../../components/states/emptyState.js';
import { hasMeaningfulContent } from '../../utils/recordValidation.js';

const INTENSITY_OPTIONS = [
  { value: 'low', labelKey: 'register.form.intensityLow' },
  { value: 'medium', labelKey: 'register.form.intensityMedium' },
  { value: 'high', labelKey: 'register.form.intensityHigh' },
];

const SOURCE_OPTIONS = [
  { value: 'family', labelKey: 'register.form.sourceFamily' },
  { value: 'school', labelKey: 'register.form.sourceSchool' },
  { value: 'professional', labelKey: 'register.form.sourceProfessional' },
  { value: 'other', labelKey: 'register.form.sourceOther' },
];

// Campos de detalhe específicos por categoria — só aparecem quando
// relevantes. Nenhum é obrigatório por si só; a validação exige apenas
// que o registo tenha ALGUM conteúdo (ver hasMeaningfulContent).
const DETAIL_FIELDS_BY_CATEGORY = {
  sleep: [
    { key: 'bedTime', labelKey: 'register.details.sleep.bedTime', type: 'time' },
    { key: 'wakeTime', labelKey: 'register.details.sleep.wakeTime', type: 'time' },
    { key: 'nightWakings', labelKey: 'register.details.sleep.nightWakings', type: 'number' },
    { key: 'sleepQuality', labelKey: 'register.details.sleep.sleepQuality', type: 'text' },
  ],
  food: [
    { key: 'mealType', labelKey: 'register.details.food.mealType', type: 'text' },
    { key: 'itemsAccepted', labelKey: 'register.details.food.itemsAccepted', type: 'text' },
    { key: 'itemsRefused', labelKey: 'register.details.food.itemsRefused', type: 'text' },
    { key: 'appetite', labelKey: 'register.details.food.appetite', type: 'text' },
  ],
  medication: [
    { key: 'medicationName', labelKey: 'register.details.medication.medicationName', type: 'text' },
    { key: 'doseGiven', labelKey: 'register.details.medication.doseGiven', type: 'text' },
    { key: 'sideEffects', labelKey: 'register.details.medication.sideEffects', type: 'text' },
  ],
  school: [
    { key: 'activity', labelKey: 'register.details.school.activity', type: 'text' },
    { key: 'participation', labelKey: 'register.details.school.participation', type: 'text' },
  ],
  communication: [
    { key: 'mode', labelKey: 'register.details.communication.mode', type: 'text' },
    { key: 'initiatedBy', labelKey: 'register.details.communication.initiatedBy', type: 'text' },
  ],
  sensory: [
    { key: 'stimulus', labelKey: 'register.details.sensory.stimulus', type: 'text' },
    { key: 'response', labelKey: 'register.details.sensory.response', type: 'text' },
  ],
  achievements: [{ key: 'skill', labelKey: 'register.details.achievements.skill', type: 'text' }],
};

export async function renderRegisterView({ navigate }) {
  const { familyId, selectedChild } = await loadChildContext();
  const container = h('div', { class: 'container view' });

  if (!selectedChild) {
    mount(container, [
      createEmptyState({
        title: t('children.newTitle'),
        body: t('onboarding.childStepSubtitle'),
        actionLabel: t('children.newTitle'),
        onAction: () => navigate('crianca', 'novo'),
      }),
    ]);
    return container;
  }

  let selectedCategoryId = null;
  let draft = {};

  function resetDraft() {
    draft = {
      occurredAt: new Date().toISOString().slice(0, 16),
      intensity: 'low',
      source: 'family',
      details: {},
    };
  }

  function renderCategoryStep() {
    const tiles = recordCategories.map((category) =>
      createCategoryTile(category, {
        isSelected: category.id === selectedCategoryId,
        onSelect: (categoryId) => {
          selectedCategoryId = categoryId;
          resetDraft();
          renderFormStep();
        },
      })
    );

    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('register.title')]), h('p', { class: 'view__lead' }, [t('register.subtitle')])]),
      h('div', { class: 'category-grid', role: 'group', 'aria-label': t('register.title') }, tiles),
    ]);
  }

  function renderFormStep({ error } = {}) {
    const category = getCategoryById(selectedCategoryId);
    const categoryLabel = t(`${category.i18nKey}.label`);
    const detailFields = DETAIL_FIELDS_BY_CATEGORY[category.id] || [];

    const bind = (key, value) => {
      draft[key] = value;
    };

    const occurredAtInput = h('input', {
      class: 'input',
      type: 'datetime-local',
      id: 'record-occurred-at',
      value: draft.occurredAt,
      required: true,
      onInput: (e) => bind('occurredAt', e.target.value),
    });

    const commonTextFields = [
      ['where', 'register.form.whereLabel', 200],
      ['withWhom', 'register.form.withWhomLabel', 200],
      ['antecedent', 'register.form.antecedentLabel', 500],
      ['emotion', 'register.form.emotionLabel', 100],
      ['behavior', 'register.form.behaviorLabel', 500],
      ['regulation', 'register.form.regulationLabel', 500],
      ['helper', 'register.form.helperLabel', 200],
      ['outcome', 'register.form.outcomeLabel', 500],
    ].map(([key, labelKey, maxLength]) =>
      h('div', { class: 'form-field' }, [
        h('label', { for: `record-${key}` }, [t(labelKey)]),
        h('input', {
          class: 'input',
          id: `record-${key}`,
          maxlength: maxLength,
          value: draft[key] || '',
          onInput: (e) => bind(key, e.target.value),
        }),
      ])
    );

    const durationInput = h('input', {
      class: 'input',
      type: 'number',
      min: 0,
      id: 'record-duration',
      value: draft.duration ?? '',
      onInput: (e) => bind('duration', e.target.value ? Number(e.target.value) : null),
    });

    const intensityGroup = h(
      'div',
      { class: 'radio-group', role: 'radiogroup', 'aria-label': t('register.form.intensityLabel') },
      INTENSITY_OPTIONS.map((option) =>
        h('label', { class: 'chip-option' }, [
          h('input', {
            type: 'radio',
            name: 'intensity',
            value: option.value,
            checked: draft.intensity === option.value || undefined,
            onChange: () => bind('intensity', option.value),
          }),
          t(option.labelKey),
        ])
      )
    );

    const sourceSelect = h(
      'select',
      { class: 'select', id: 'record-source', onChange: (e) => bind('source', e.target.value) },
      SOURCE_OPTIONS.map((option) =>
        h('option', { value: option.value, selected: draft.source === option.value || undefined }, [t(option.labelKey)])
      )
    );

    const detailInputs = detailFields.map(({ key, labelKey, type }) =>
      h('div', { class: 'form-field' }, [
        h('label', { for: `record-detail-${key}` }, [t(labelKey)]),
        h('input', {
          class: 'input',
          type,
          id: `record-detail-${key}`,
          value: draft.details[key] || '',
          onInput: (e) => {
            draft.details = { ...draft.details, [key]: e.target.value };
          },
        }),
      ])
    );

    const notesInput = h('textarea', {
      class: 'textarea',
      id: 'record-notes',
      maxlength: 4000,
      placeholder: t('register.form.notePlaceholder'),
      onInput: (e) => bind('notes', e.target.value),
    }, [draft.notes || '']);

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('button', { type: 'button', class: 'btn btn--ghost', onClick: renderCategoryStep }, [
          `← ${t('register.backToCategories')}`,
        ]),
        h('h1', { style: 'margin-top: var(--space-3)' }, [categoryLabel]),
        h('p', { class: 'view__lead' }, [selectedChild.name]),
      ]),

      error ? createErrorState({ body: error }) : '',

      h(
        'form',
        {
          onSubmit: (event) => {
            event.preventDefault();
            if (!hasMeaningfulContent(draft)) {
              renderFormStep({ error: t('register.form.validationError') });
              return;
            }
            confirmAndSave();
          },
        },
        [
          h('div', { class: 'form-field' }, [h('label', { for: 'record-occurred-at' }, [`${t('register.form.dateLabel')} *`]), occurredAtInput]),
          ...commonTextFields,
          h('div', { class: 'form-field' }, [h('label', { for: 'record-duration' }, [t('register.form.durationLabel')]), durationInput]),
          h('div', { class: 'form-field' }, [
            h('span', { style: 'font-weight:var(--font-weight-medium); display:block; margin-bottom:var(--space-2)' }, [
              t('register.form.intensityLabel'),
            ]),
            intensityGroup,
          ]),
          ...detailInputs,
          h('div', { class: 'form-field' }, [
            h('label', { for: 'record-notes' }, [`${t('register.form.noteLabel')} (${t('common.optional')})`]),
            notesInput,
          ]),
          h('div', { class: 'form-field' }, [h('label', { for: 'record-source' }, [t('register.form.sourceLabel')]), sourceSelect]),
          h('p', { class: 'form-field__hint' }, [t('register.form.requiredNotice')]),
          h('div', { style: 'display:flex; gap:var(--space-3); flex-wrap:wrap' }, [
            h('button', { type: 'submit', class: 'btn btn--primary' }, [t('register.form.saveDraft')]),
            h('button', { type: 'button', class: 'btn btn--secondary', onClick: renderCategoryStep }, [t('register.form.cancel')]),
          ]),
        ]
      ),
    ]);
  }

  function confirmAndSave() {
    openConfirmDialog({
      title: t('register.confirm.title'),
      body: t('register.confirm.body'),
      confirmLabel: t('register.confirm.confirmLabel'),
      cancelLabel: t('register.confirm.cancelLabel'),
      onConfirm: async () => {
        try {
          await createRecord(selectedChild.id, familyId, {
            categoryId: selectedCategoryId,
            ...draft,
            occurredAt: new Date(draft.occurredAt),
          });
          announce(t('register.success.title'));
          renderSuccessStep();
        } catch (err) {
          renderFormStep({ error: err.message });
        }
      },
    });
  }

  function renderSuccessStep() {
    mount(container, [
      createSuccessState({
        title: t('register.success.title'),
        body: t('register.success.body'),
        actions: [
          { label: t('register.success.newRecord'), variant: 'btn--primary', onClick: renderCategoryStep },
          { label: t('register.success.viewTimeline'), variant: 'btn--secondary', onClick: () => { window.location.hash = '#/timeline'; } },
        ],
      }),
    ]);
  }

  renderCategoryStep();
  return container;
}
