import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDate } from '../../utils/format.js';
import { loadChildContext } from '../../utils/childContext.js';
import { listDocuments, createDocumentRecord, uploadDocumentFile } from '../../services/documentsService.js';
import { askDocuments } from '../../services/aiService.js';
import { createEmptyState } from '../../components/states/emptyState.js';
import { createErrorState } from '../../components/states/errorState.js';
import { createLoadingState } from '../../components/states/loadingState.js';

const DOC_TYPE_OPTIONS = ['laudo', 'avaliacao', 'relatorio_escolar', 'relatorio_medico', 'outro'];
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function statusBadge(status) {
  return h('span', { class: 'category-chip' }, [t(`documents.status.${status}`)]);
}

export async function renderDocumentsView() {
  const { familyId, selectedChild } = await loadChildContext();
  const container = h('div', { class: 'container view' });

  if (!selectedChild) {
    mount(container, [createEmptyState({ title: t('documents.emptyTitle'), body: t('documents.emptyBody') })]);
    return container;
  }

  let statusFilter = '';

  async function renderList() {
    const documents = await listDocuments(selectedChild.id);
    const filtered = statusFilter ? documents.filter((doc) => doc.status === statusFilter) : documents;

    const statusSelect = h(
      'select',
      {
        class: 'select',
        style: 'max-width: 220px',
        'aria-label': t('documents.filterStatus'),
        onChange: (e) => {
          statusFilter = e.target.value;
          renderList();
        },
      },
      [
        h('option', { value: '' }, [t('documents.filterStatusAll')]),
        ...['selected', 'uploading', 'quarantine', 'verifying', 'extracting', 'pending_review', 'approved', 'rejected', 'error'].map(
          (status) => h('option', { value: status, selected: statusFilter === status || undefined }, [t(`documents.status.${status}`)])
        ),
      ]
    );

    const list =
      filtered.length > 0
        ? h(
            'ul',
            { style: 'list-style:none; padding:0; display:grid; gap:var(--space-3)' },
            filtered.map((docItem) =>
              h('li', { class: 'card' }, [
                h('div', { style: 'display:flex; justify-content:space-between; gap:var(--space-3); flex-wrap:wrap; align-items:center' }, [
                  h('a', { href: `#/documento/${selectedChild.id}/${docItem.id}` }, [
                    h('strong', {}, [docItem.docType || t('documents.docTypeLabel')]),
                  ]),
                  statusBadge(docItem.deletedAt ? 'deleted' : docItem.status),
                ]),
                h('p', { class: 'card__meta' }, [
                  docItem.issuer ? `${docItem.issuer} · ` : '',
                  docItem.docDate ? formatDate(docItem.docDate) : '',
                ]),
                docItem.errorReason
                  ? h('p', { class: 'notice notice--warning', style: 'margin-top:var(--space-2)' }, [
                      t(`documents.statusHint.error_${docItem.errorReason}`) === `documents.statusHint.error_${docItem.errorReason}`
                        ? docItem.errorReason
                        : t(`documents.statusHint.error_${docItem.errorReason}`),
                    ])
                  : '',
                docItem.status === 'quarantine'
                  ? h('p', { class: 'notice notice--warning', style: 'margin-top:var(--space-2)' }, [t('documents.statusHint.quarantine')])
                  : '',
              ])
            )
          )
        : createEmptyState({
            icon: '📄',
            title: t('documents.emptyTitle'),
            body: t('documents.emptyBody'),
          });

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('documents.title')]),
        h('p', { class: 'view__lead' }, [t('documents.subtitle')]),
        statusSelect,
      ]),

      renderUploadForm(),
      h('div', { style: 'margin-top: var(--space-6)' }, [list]),
      h('div', { style: 'margin-top: var(--space-8)' }, [renderAskDocuments()]),
    ]);
  }

  function renderUploadForm() {
    const fileInput = h('input', {
      class: 'input',
      type: 'file',
      id: 'doc-file',
      accept: ACCEPTED_MIME_TYPES.join(','),
      required: true,
    });
    const docTypeInput = h(
      'select',
      { class: 'select', id: 'doc-type' },
      DOC_TYPE_OPTIONS.map((value) => h('option', { value }, [value]))
    );
    const issuerInput = h('input', { class: 'input', id: 'doc-issuer', maxlength: 200 });
    const specialtyInput = h('input', { class: 'input', id: 'doc-specialty', maxlength: 200 });
    const docDateInput = h('input', { class: 'input', type: 'date', id: 'doc-date' });

    let statusNode = h('div', {});

    const form = h(
      'form',
      {
        class: 'card',
        onSubmit: async (event) => {
          event.preventDefault();
          const file = fileInput.files[0];
          if (!file) return;
          if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
            mount(statusNode, [createErrorState({ body: t('documents.docTypeLabel') })]);
            return;
          }

          mount(statusNode, [createLoadingState(t('documents.progressUploading'))]);
          try {
            const documentId = await createDocumentRecord(selectedChild.id, familyId, {
              docType: docTypeInput.value,
              issuer: issuerInput.value.trim() || null,
              specialty: specialtyInput.value.trim() || null,
              docDate: docDateInput.value || null,
              origin: 'family',
            });
            await uploadDocumentFile(selectedChild.id, documentId, file);
            mount(statusNode, [h('p', { class: 'notice notice--success' }, [t('documents.uploadSuccess')])]);
            renderList();
          } catch (err) {
            mount(statusNode, [createErrorState({ body: err.message })]);
          }
        },
      },
      [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('documents.uploadCta')]),
        h('div', { class: 'form-field' }, [h('label', { for: 'doc-file' }, [t('documents.selectFileLabel')]), fileInput]),
        h('div', { class: 'form-field' }, [h('label', { for: 'doc-type' }, [t('documents.docTypeLabel')]), docTypeInput]),
        h('div', { class: 'form-field' }, [h('label', { for: 'doc-issuer' }, [`${t('documents.issuerLabel')} (${t('common.optional')})`]), issuerInput]),
        h('div', { class: 'form-field' }, [h('label', { for: 'doc-specialty' }, [`${t('documents.specialtyLabel')} (${t('common.optional')})`]), specialtyInput]),
        h('div', { class: 'form-field' }, [h('label', { for: 'doc-date' }, [`${t('documents.docDateLabel')} (${t('common.optional')})`]), docDateInput]),
        h('button', { type: 'submit', class: 'btn btn--primary' }, [t('documents.uploadCta')]),
        statusNode,
      ]
    );

    return form;
  }

  function renderAskDocuments() {
    const questionInput = h('input', { class: 'input', id: 'ask-question', maxlength: 500, placeholder: t('documents.askPlaceholder') });
    const answerNode = h('div', {});

    const form = h(
      'form',
      {
        class: 'card',
        onSubmit: async (event) => {
          event.preventDefault();
          if (!questionInput.value.trim()) return;
          mount(answerNode, [createLoadingState()]);
          try {
            const answer = await askDocuments(selectedChild.id, questionInput.value.trim());
            renderAnswer(answer);
          } catch (err) {
            mount(answerNode, [createErrorState({ body: err.message })]);
          }
        },
      },
      [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('documents.askTitle')]),
        h('p', { class: 'view__lead' }, [t('documents.askSubtitle')]),
        h('div', { class: 'form-field' }, [
          h('label', { for: 'ask-question', class: 'visually-hidden' }, [t('documents.askTitle')]),
          questionInput,
        ]),
        h('button', { type: 'submit', class: 'btn btn--primary' }, [t('documents.askSubmit')]),
        answerNode,
      ]
    );

    function renderAnswer(answer) {
      if (answer.blocked) {
        mount(answerNode, [
          h('div', { class: 'notice notice--warning', style: 'margin-top:var(--space-4)' }, [
            h('strong', {}, [t('documents.askBlockedTitle')]),
            h('p', { style: 'margin: var(--space-2) 0 0' }, [answer.summary]),
            h('p', { style: 'margin: var(--space-2) 0 0' }, [answer.suggestion]),
          ]),
        ]);
        return;
      }

      if (!answer.facts || answer.facts.length === 0) {
        mount(answerNode, [
          h('div', { class: 'notice notice--info', style: 'margin-top:var(--space-4)' }, [
            h('strong', {}, [t('documents.askInsufficientTitle')]),
            h('p', { style: 'margin: var(--space-2) 0 0' }, [answer.summary]),
          ]),
        ]);
        return;
      }

      mount(answerNode, [
        h('div', { style: 'margin-top:var(--space-4)' }, [
          h('p', {}, [answer.summary]),
          h('h3', { style: 'font-size:var(--font-size-sm)' }, [t('documents.askFactsTitle')]),
          h(
            'ul',
            {},
            answer.facts.map((fact) => h('li', {}, [`${t(`documents.categories.${fact.category}`)}: ${fact.text}`]))
          ),
          h('h3', { style: 'font-size:var(--font-size-sm)' }, [t('documents.askSourcesTitle')]),
          h(
            'ul',
            {},
            answer.sources.map((source) =>
              h('li', {}, [
                h('a', { href: `#/documento/${selectedChild.id}/${source.documentId}` }, [
                  `${source.docType} — ${t('documents.itemPageLabel')} ${source.page}`,
                ]),
              ])
            )
          ),
          answer.uncertainties?.length
            ? h('div', {}, [
                h('h3', { style: 'font-size:var(--font-size-sm)' }, [t('documents.askUncertaintiesTitle')]),
                h('ul', {}, answer.uncertainties.map((item) => h('li', {}, [item]))),
              ])
            : '',
          h('p', { class: 'form-field__hint' }, [answer.disclaimer || t('documents.askDisclaimer')]),
        ]),
      ]);
    }

    return form;
  }

  await renderList();
  return container;
}
