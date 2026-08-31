import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { recordCategories, getCategoryById } from '../../data/mock/categories.js';
import { createCategoryTile } from '../../components/categoryTile.js';
import { getSelectedChild } from '../../services/childrenService.js';
import { createLocalRecord } from '../../services/recordsService.js';
import { openConfirmDialog } from '../../components/confirmDialog.js';
import { createSuccessState } from '../../components/states/successState.js';

const INTENSITY_OPTIONS = [
  { value: 'low', labelKey: 'register.form.intensityLow' },
  { value: 'medium', labelKey: 'register.form.intensityMedium' },
  { value: 'high', labelKey: 'register.form.intensityHigh' },
];

export function renderRegisterView() {
  const container = h('div', { class: 'container view' });
  const child = getSelectedChild();

  let selectedCategoryId = null;
  let draft = { summary: '', intensity: 'low' };

  function renderCategoryStep() {
    const tiles = recordCategories.map((category) =>
      createCategoryTile(category, {
        isSelected: category.id === selectedCategoryId,
        onSelect: (categoryId) => {
          selectedCategoryId = categoryId;
          draft = { summary: '', intensity: 'low' };
          renderFormStep();
        },
      })
    );

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('register.title')]),
        h('p', { class: 'view__lead' }, [t('register.subtitle')]),
      ]),
      h('div', { class: 'category-grid', role: 'group', 'aria-label': t('register.title') }, tiles),
    ]);
  }

  function renderFormStep() {
    const category = getCategoryById(selectedCategoryId);
    const categoryLabel = t(`${category.i18nKey}.label`);

    const noteField = h('textarea', {
      class: 'textarea',
      id: 'record-note',
      placeholder: t('register.form.notePlaceholder'),
      onInput: (event) => {
        draft.summary = event.target.value;
      },
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
            onChange: () => {
              draft.intensity = option.value;
            },
          }),
          t(option.labelKey),
        ])
      )
    );

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('button', { type: 'button', class: 'btn btn--ghost', onClick: renderCategoryStep }, [
          `← ${t('register.backToCategories')}`,
        ]),
        h('h1', { style: 'margin-top: var(--space-3)' }, [categoryLabel]),
        h('p', { class: 'view__lead' }, [child.name]),
      ]),

      h(
        'form',
        {
          onSubmit: (event) => {
            event.preventDefault();
            confirmAndSave();
          },
        },
        [
          h('div', { class: 'form-field' }, [
            h('label', { for: 'record-note' }, [`${t('register.form.noteLabel')} (${t('common.optional')})`]),
            noteField,
          ]),
          h('div', { class: 'form-field' }, [
            h('span', { style: 'font-weight:var(--font-weight-medium); display:block; margin-bottom:var(--space-2)' }, [
              t('register.form.intensityLabel'),
            ]),
            intensityGroup,
          ]),
          h('div', { style: 'display:flex; gap:var(--space-3); flex-wrap:wrap' }, [
            h('button', { type: 'submit', class: 'btn btn--primary' }, [t('register.form.saveDraft')]),
            h('button', { type: 'button', class: 'btn btn--secondary', onClick: renderCategoryStep }, [
              t('register.form.cancel'),
            ]),
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
      onConfirm: () => {
        createLocalRecord({
          childId: child.id,
          categoryId: selectedCategoryId,
          summary: draft.summary,
          intensity: draft.intensity,
        });
        announce(t('register.success.title'));
        renderSuccessStep();
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
          {
            label: t('register.success.viewTimeline'),
            variant: 'btn--secondary',
            onClick: () => {
              window.location.hash = '#/timeline';
            },
          },
        ],
      }),
    ]);
  }

  renderCategoryStep();
  return container;
}
