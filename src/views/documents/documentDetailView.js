import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import {
  getDocumentMeta,
  listExtractionItems,
  listVersions,
  reviewExtractionItem,
  approveDocument,
  rejectDocument,
  requestSoftDelete,
  getDocumentDownloadUrl,
} from '../../services/documentsService.js';
import { createErrorState } from '../../components/states/errorState.js';
import { createEmptyState } from '../../components/states/emptyState.js';
import { openConfirmDialog } from '../../components/confirmDialog.js';

function reviewStatusLabel(status) {
  return { pending: '⏳', confirmed: '✅', edited: '✏️', rejected: '🚫' }[status] || status;
}

export async function renderDocumentDetailView({ params }) {
  const [childId, documentId] = params;
  const container = h('div', { class: 'container view' });

  const docMeta = await getDocumentMeta(childId, documentId);
  if (!docMeta) {
    mount(container, [createEmptyState({ title: t('documents.detailTitle'), body: t('notFound.body') })]);
    return container;
  }

  async function render({ error } = {}) {
    const [items, versions] = await Promise.all([
      listExtractionItems(childId, documentId),
      listVersions(childId, documentId),
    ]);
    const pendingCount = items.filter((item) => item.reviewStatus === 'pending').length;
    const meta = await getDocumentMeta(childId, documentId);

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('a', { href: '#/documents', class: 'btn btn--ghost' }, [`← ${t('documents.title')}`]),
        h('h1', { style: 'margin-top: var(--space-3)' }, [meta.docType]),
        h('p', { class: 'view__lead' }, [t(`documents.status.${meta.deletedAt ? 'deleted' : meta.status}`)]),
      ]),

      error ? createErrorState({ body: error }) : '',

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('documents.metadataTitle')]),
        h('dl', {}, [
          h('dt', {}, [t('documents.issuerLabel')]),
          h('dd', {}, [meta.issuer || '—']),
          h('dt', {}, [t('documents.specialtyLabel')]),
          h('dd', {}, [meta.specialty || '—']),
          h('dt', {}, [t('documents.docDateLabel')]),
          h('dd', {}, [meta.docDate || '—']),
          h('dt', {}, [t('documents.originLabel')]),
          h('dd', {}, [t(`origin.${meta.origin === 'family' ? 'direct' : meta.origin}`) || meta.origin]),
        ]),
      ]),

      renderReviewSection(items, meta, pendingCount),
      renderVersionsSection(versions),
      renderPermissionsSection(),
      renderDangerZone(meta),
    ]);
  }

  function renderReviewSection(items, meta, pendingCount) {
    if (items.length === 0) {
      return h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('documents.reviewTitle')]),
        h('p', { class: 'card__meta' }, ['—']),
      ]);
    }

    const hasMedication = items.some((item) => item.category === 'medicationInfo');

    return h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('documents.reviewTitle')]),
      h('p', { class: 'view__lead' }, [t('documents.reviewInstructions')]),
      hasMedication ? h('p', { class: 'notice notice--warning' }, [t('documents.medicationWarning')]) : '',
      h(
        'ul',
        { style: 'list-style:none; padding:0; display:grid; gap:var(--space-3)' },
        items.map((item) => renderExtractionItem(item, meta))
      ),
      meta.status === 'pending_review'
        ? h('div', { style: 'margin-top: var(--space-4)' }, [
            pendingCount > 0 ? h('p', { class: 'notice notice--info' }, [t('documents.approveBlockedNotice')]) : '',
            h('div', { style: 'display:flex; gap:var(--space-3)' }, [
              h('button', {
                type: 'button',
                class: 'btn btn--primary',
                disabled: pendingCount > 0 || undefined,
                onClick: async () => {
                  try {
                    await approveDocument(childId, documentId);
                    render();
                  } catch (err) {
                    render({ error: err.message });
                  }
                },
              }, [t('documents.approveDocumentCta')]),
              h('button', {
                type: 'button',
                class: 'btn btn--danger',
                onClick: async () => {
                  await rejectDocument(childId, documentId);
                  render();
                },
              }, [t('documents.rejectDocumentCta')]),
            ]),
          ])
        : '',
    ]);
  }

  function renderExtractionItem(item) {
    const valueInput = h('textarea', { class: 'textarea' }, [item.value]);

    return h('li', { class: 'card' }, [
      h('div', { style: 'display:flex; justify-content:space-between; gap:var(--space-2)' }, [
        h('strong', {}, [t(`documents.categories.${item.category}`)]),
        h('span', {}, [`${reviewStatusLabel(item.reviewStatus)} ${t(`documents.itemPageLabel`)} ${item.page}`]),
      ]),
      h('p', { class: 'card__meta' }, [`${t('documents.itemConfidenceLabel')}: ${Math.round((item.confidence || 0) * 100)}%`]),
      h('p', { class: 'notice notice--info', style: 'font-size:var(--font-size-sm)' }, [
        h('strong', {}, [`${t('documents.reviewLegendExtraction')}: `]),
        item.excerpt,
      ]),
      valueInput,
      h('div', { style: 'display:flex; gap:var(--space-2); margin-top:var(--space-2); flex-wrap:wrap' }, [
        h('button', {
          type: 'button',
          class: 'btn btn--primary',
          onClick: async () => {
            await reviewExtractionItem(childId, documentId, item.id, { reviewStatus: 'confirmed', value: item.value });
            render();
          },
        }, [t('documents.itemConfirmCta')]),
        h('button', {
          type: 'button',
          class: 'btn btn--secondary',
          onClick: async () => {
            await reviewExtractionItem(childId, documentId, item.id, { reviewStatus: 'edited', value: valueInput.value });
            render();
          },
        }, [t('documents.itemEditCta')]),
        h('button', {
          type: 'button',
          class: 'btn btn--ghost',
          onClick: async () => {
            await reviewExtractionItem(childId, documentId, item.id, { reviewStatus: 'rejected', value: item.value });
            render();
          },
        }, [t('documents.itemRejectCta')]),
      ]),
    ]);
  }

  function renderVersionsSection(versions) {
    return h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('documents.versionsTitle')]),
      versions.length === 0
        ? h('p', { class: 'card__meta' }, ['—'])
        : h(
            'ul',
            {},
            versions.map((version) =>
              h('li', {}, [
                h('button', {
                  type: 'button',
                  class: 'btn btn--ghost',
                  onClick: async () => {
                    const url = await getDocumentDownloadUrl(childId, documentId, version.version);
                    window.open(url, '_blank', 'noopener');
                  },
                }, [`v${version.version} — ${formatDateTime(version.createdAt?.toDate ? version.createdAt.toDate() : version.createdAt)} (${version.pages} pág.)`]),
              ])
            )
          ),
    ]);
  }

  function renderPermissionsSection() {
    return h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('documents.permissionsTitle')]),
      h('p', { class: 'card__meta' }, [t('documents.permissionsHint')]),
      h('a', { href: '#/family', class: 'btn btn--secondary' }, [t('nav.family')]),
    ]);
  }

  function renderDangerZone(meta) {
    if (meta.deletedAt) return h('div', {});
    return h('section', {}, [
      h('button', {
        type: 'button',
        class: 'btn btn--danger',
        onClick: () => {
          openConfirmDialog({
            title: t('documents.deleteConfirmTitle'),
            body: t('documents.deleteConfirmBody'),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel'),
            onConfirm: async () => {
              await requestSoftDelete(childId, documentId);
              window.location.hash = '#/documents';
            },
          });
        },
      }, [t('documents.deleteCta')]),
    ]);
  }

  await render();
  return container;
}
