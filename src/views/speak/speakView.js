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

function getSpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Traduz o código de erro do SpeechRecognition (ver
 * https://developer.mozilla.org/docs/Web/API/SpeechRecognitionErrorEvent/error)
 * numa mensagem que diga o que fazer a seguir — "não foi possível aceder"
 * sozinho não distinguia permissão bloqueada de falta de microfone ou de
 * falha de rede, o que tornava impossível diagnosticar à distância.
 */
function describeSpeechRecognitionError(errorCode) {
  if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
    return t('speak.micPermissionError');
  }
  if (errorCode === 'audio-capture') {
    return t('speak.micNotFoundError');
  }
  if (errorCode === 'network') {
    return t('speak.micNetworkError');
  }
  return t('speak.micGenericError');
}

export async function renderSpeakView() {
  const { familyId, selectedChild } = await loadChildContext();
  const container = h('div', { class: 'container view' });

  if (!selectedChild) {
    mount(container, [
      createEmptyState({ title: t('children.newTitle'), body: t('onboarding.childStepSubtitle') }),
    ]);
    return container;
  }

  const SpeechRecognitionCtor = getSpeechRecognitionCtor();

  let phase = 'idle'; // 'idle' | 'recording' | 'reviewing'
  let finalTranscript = '';
  let interimTranscript = '';
  let recognition = null;
  let manualStop = false;
  let errorMessage = null;
  let occurredAt = new Date().toISOString().slice(0, 16);
  let drafts = [];
  let transcriptNode = null;

  // Não há gancho de "saída da vista" neste router (ver src/router/router.js)
  // — sem isto, mudar de rota a meio de uma gravação deixava o microfone a
  // ouvir indefinidamente.
  window.addEventListener(
    'hashchange',
    () => {
      if (recognition && phase === 'recording') {
        manualStop = true;
        try {
          recognition.stop();
        } catch {
          // já parado — nada a fazer.
        }
      }
    },
    { once: true }
  );

  function getDisplayTranscript() {
    return `${finalTranscript}${interimTranscript}`.replace(/\s+/g, ' ').trim();
  }

  function updateTranscriptDisplay() {
    if (transcriptNode) {
      transcriptNode.textContent = getDisplayTranscript() || t('speak.transcriptEmptyHint');
    }
  }

  function toggleRecording() {
    if (phase === 'recording') {
      manualStop = true;
      if (recognition) recognition.stop();
      phase = 'idle';
      renderIdle();
      return;
    }

    if (!SpeechRecognitionCtor) return;

    errorMessage = null;
    interimTranscript = '';
    manualStop = false;

    recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-PT';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += `${result[0].transcript} `;
        } else {
          interim += result[0].transcript;
        }
      }
      interimTranscript = interim;
      updateTranscriptDisplay();
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return;
      errorMessage = describeSpeechRecognitionError(event.error);
      manualStop = true;
      phase = 'idle';
      renderIdle();
    };

    recognition.onend = () => {
      // Alguns navegadores param sozinhos ao fim de uma pausa no discurso
      // mesmo com `continuous: true` — se não foi um "toque para parar"
      // deliberado, recomeça para não cortar a fala a meio.
      if (!manualStop && phase === 'recording') {
        try {
          recognition.start();
        } catch {
          // já a correr — ignora.
        }
      }
    };

    phase = 'recording';
    try {
      recognition.start();
    } catch {
      errorMessage = t('speak.micPermissionError');
      phase = 'idle';
    }
    renderIdle();
  }

  function handleAnalyze() {
    if (recognition && phase === 'recording') {
      manualStop = true;
      recognition.stop();
    }
    const transcript = getDisplayTranscript();
    if (!transcript) {
      errorMessage = t('speak.emptyTranscriptError');
      phase = 'idle';
      renderIdle();
      return;
    }
    drafts = extractRecordDraftsFromTranscript(transcript).map((draft) => ({ ...draft, status: 'pending' }));
    phase = 'reviewing';
    announce(t('speak.reviewTitle'));
    renderReview();
  }

  function startOver() {
    finalTranscript = '';
    interimTranscript = '';
    drafts = [];
    errorMessage = null;
    phase = 'idle';
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
    const transcriptText = getDisplayTranscript();

    const micButton = SpeechRecognitionCtor
      ? h(
          'button',
          {
            type: 'button',
            class: phase === 'recording' ? 'mic-button mic-button--recording' : 'mic-button',
            onClick: toggleRecording,
          },
          [
            h('span', { class: 'mic-button__icon', 'aria-hidden': 'true' }, [t('speak.micIcon')]),
            phase === 'recording' ? t('speak.micRecordingLabel') : t('speak.micIdleLabel'),
          ]
        )
      : '';

    transcriptNode = SpeechRecognitionCtor
      ? h('p', { class: 'card', style: 'min-height:4rem; white-space:pre-wrap' }, [
          transcriptText || t('speak.transcriptEmptyHint'),
        ])
      : null;

    // Mostra a alternativa de escrever sempre que a voz não é uma opção
    // fiável agora — sem suporte no navegador, ou depois de um erro (ex.:
    // permissão de microfone bloqueada) — nunca deixa a pessoa "presa" só
    // com um botão de microfone que não funciona.
    const fallbackTextarea = !SpeechRecognitionCtor || errorMessage
      ? h('div', { class: 'form-field' }, [
          h('label', { for: 'speak-fallback-text' }, [t('speak.fallbackTextareaLabel')]),
          h(
            'textarea',
            {
              class: 'textarea',
              id: 'speak-fallback-text',
              rows: 6,
              onInput: (e) => {
                finalTranscript = e.target.value;
              },
            },
            [finalTranscript]
          ),
        ])
      : '';

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('speak.title')]),
        h('p', { class: 'view__lead' }, [t('speak.subtitle')]),
        h('p', { class: 'view__lead' }, [selectedChild.name]),
      ]),

      !SpeechRecognitionCtor
        ? createErrorState({ title: t('speak.notSupportedTitle'), body: t('speak.notSupportedBody') })
        : '',
      errorMessage ? createErrorState({ body: errorMessage }) : '',

      micButton ? h('div', { style: 'margin: var(--space-6) 0' }, [micButton]) : '',
      transcriptNode || '',
      fallbackTextarea,

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
