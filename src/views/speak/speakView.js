import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { loadChildContext } from '../../utils/childContext.js';
import { createRecord } from '../../services/recordsService.js';
import { extractRecordDraftsFromTranscript } from '../../utils/speechRecordExtraction.js';
import { recordCategories, getCategoryById } from '../../data/mock/categories.js';
import { createEmptyState } from '../../components/states/emptyState.js';
import { createErrorState } from '../../components/states/errorState.js';
import { createSuccessState } from '../../components/states/successState.js';

const INTENSITY_OPTIONS = [
  { value: 'low', labelKey: 'register.form.intensityLow' },
  { value: 'medium', labelKey: 'register.form.intensityMedium' },
  { value: 'high', labelKey: 'register.form.intensityHigh' },
];

/**
 * Em vez de um `SpeechRecognition` próprio da página (que se mostrou, na
 * prática, dependente de configurações de permissão que variam por
 * navegador e por fabricante — Chrome, Samsung Internet, Safari — e que
 * ninguém deveria ter de ir configurar para poder falar), a "voz" aqui é
 * o botão de microfone que já existe em qualquer teclado de telemóvel
 * (o mesmo do WhatsApp). É um campo de texto normal — sem pedir nenhuma
 * permissão nova, sem nada para configurar.
 */
export async function renderSpeakView() {
  const { familyId, selectedChild } = await loadChildContext();
  const container = h('div', { class: 'container view' });

  if (!selectedChild) {
    mount(container, [
      createEmptyState({ title: t('children.newTitle'), body: t('onboarding.childStepSubtitle') }),
    ]);
    return container;
  }

  let transcript = '';
  let errorMessage = null;
  let occurredAt = new Date().toISOString().slice(0, 16);
  let drafts = [];

  function handleAnalyze() {
    const text = transcript.trim();
    if (!text) {
      errorMessage = t('speak.emptyTranscriptError');
      renderIdle();
      return;
    }
    drafts = extractRecordDraftsFromTranscript(text).map((draft) => ({ ...draft, status: 'pending' }));
    announce(t('speak.reviewTitle'));
    renderReview();
  }

  function startOver() {
    transcript = '';
    drafts = [];
    errorMessage = null;
    renderIdle();
  }

  async function saveDraft(index) {
    const draft = drafts[index];
    draft.status = 'saving';
    renderReview();
    try {
      await createRecord(selectedChild.id, familyId, {
        categoryId: draft.categoryId,
        intensity: draft.intensity,
        notes: draft.notes,
        occurredAt: new Date(occurredAt),
        source: 'family',
      });
      draft.status = 'saved';
    } catch (err) {
      draft.status = 'pending';
      errorMessage = err.message;
    }
    renderReview();
  }

  function discardDraft(index) {
    drafts[index].status = 'discarded';
    renderReview();
  }

  function renderIdle() {
    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('speak.title')]),
        h('p', { class: 'view__lead' }, [t('speak.subtitle')]),
        h('p', { class: 'view__lead' }, [selectedChild.name]),
      ]),

      errorMessage ? createErrorState({ body: errorMessage }) : '',

      h('div', { class: 'form-field' }, [
        h('label', { for: 'speak-text' }, [t('speak.fallbackTextareaLabel')]),
        h('p', { class: 'form-field__hint' }, [t('speak.micHint')]),
        h(
          'textarea',
          {
            class: 'textarea',
            id: 'speak-text',
            rows: 8,
            onInput: (e) => {
              transcript = e.target.value;
            },
          },
          [transcript]
        ),
      ]),

      h('div', { style: 'display:flex; gap:var(--space-3); flex-wrap:wrap; margin-top: var(--space-4)' }, [
        h('button', { type: 'button', class: 'btn btn--primary', onClick: handleAnalyze }, [t('speak.analyzeCta')]),
      ]),
    ]);
  }

  function renderDraftCard(draft, index) {
    const category = getCategoryById(draft.categoryId);
    const categoryLabel = t(`${category.i18nKey}.label`);

    if (draft.status === 'saved') {
      return h('div', { class: 'card', style: 'margin-bottom:var(--space-3); opacity:0.7' }, [
        h('p', { class: 'card__meta' }, [`${categoryLabel} — ${t('speak.savedBadge')}`]),
        h('p', {}, [draft.notes]),
      ]);
    }
    if (draft.status === 'discarded') {
      return h('div', { class: 'card', style: 'margin-bottom:var(--space-3); opacity:0.5' }, [
        h('p', { class: 'card__meta' }, [`${categoryLabel} — ${t('speak.discardedBadge')}`]),
      ]);
    }

    const categorySelect = h(
      'select',
      {
        class: 'select',
        'aria-label': t('speak.categoryLabel'),
        onChange: (e) => {
          draft.categoryId = e.target.value;
          renderReview();
        },
      },
      recordCategories.map((c) =>
        h('option', { value: c.id, selected: draft.categoryId === c.id || undefined }, [t(`${c.i18nKey}.label`)])
      )
    );

    const intensityGroup = h(
      'div',
      { class: 'radio-group', role: 'radiogroup', 'aria-label': t('register.form.intensityLabel') },
      INTENSITY_OPTIONS.map((option) =>
        h('label', { class: 'chip-option' }, [
          h('input', {
            type: 'radio',
            name: `speak-intensity-${index}`,
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

    const notesTextarea = h(
      'textarea',
      {
        class: 'textarea',
        rows: 3,
        onInput: (e) => {
          draft.notes = e.target.value;
        },
      },
      [draft.notes]
    );

    return h('div', { class: 'card', style: 'margin-bottom:var(--space-3)' }, [
      h('div', { class: 'form-field' }, [h('label', {}, [t('speak.categoryLabel')]), categorySelect]),
      h('div', { class: 'form-field' }, [
        h('span', { style: 'font-weight:var(--font-weight-medium); display:block; margin-bottom:var(--space-2)' }, [
          t('register.form.intensityLabel'),
        ]),
        intensityGroup,
      ]),
      h('div', { class: 'form-field' }, [h('label', {}, [t('speak.notesLabel')]), notesTextarea]),
      h('div', { style: 'display:flex; gap:var(--space-2)' }, [
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary',
            disabled: draft.status === 'saving' || undefined,
            onClick: () => saveDraft(index),
          },
          [t('speak.saveCta')]
        ),
        h('button', { type: 'button', class: 'btn btn--ghost', onClick: () => discardDraft(index) }, [
          t('speak.discardCta'),
        ]),
      ]),
    ]);
  }

  function renderReview() {
    const allHandled = drafts.every((d) => d.status === 'saved' || d.status === 'discarded');
    if (allHandled) announce(t('speak.allDoneTitle'));

    const occurredAtInput = h('input', {
      class: 'input',
      type: 'datetime-local',
      id: 'speak-occurred-at',
      value: occurredAt,
      onInput: (e) => {
        occurredAt = e.target.value;
      },
    });

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('button', { type: 'button', class: 'btn btn--ghost', onClick: startOver }, [`← ${t('speak.recordAgainCta')}`]),
        h('h1', { style: 'margin-top: var(--space-3)' }, [t('speak.reviewTitle')]),
        h('p', { class: 'view__lead' }, [t('speak.reviewSubtitle')]),
      ]),

      errorMessage ? createErrorState({ body: errorMessage }) : '',

      h('div', { class: 'form-field', style: 'max-width:320px' }, [
        h('label', { for: 'speak-occurred-at' }, [t('speak.occurredAtLabel')]),
        occurredAtInput,
      ]),

      h('div', {}, drafts.map((draft, index) => renderDraftCard(draft, index))),

      allHandled
        ? h('div', { style: 'margin-top: var(--space-6)' }, [
            createSuccessState({
              title: t('speak.allDoneTitle'),
              body: t('speak.allDoneBody'),
              actions: [
                { label: t('speak.speakAgainCta'), variant: 'btn--primary', onClick: startOver },
                {
                  label: t('speak.viewTimelineCta'),
                  variant: 'btn--secondary',
                  onClick: () => {
                    window.location.hash = '#/timeline';
                  },
                },
              ],
            }),
          ])
        : '',
    ]);
  }

  renderIdle();
  return container;
}
