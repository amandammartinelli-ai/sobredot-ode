import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDate, formatDateTime } from '../../utils/format.js';
import { loadChildContext } from '../../utils/childContext.js';
import { createChildSelector } from '../../components/childSelector.js';
import { createEmptyState } from '../../components/states/emptyState.js';
import { createErrorState } from '../../components/states/errorState.js';
import { openConfirmDialog } from '../../components/confirmDialog.js';
import { listDocuments } from '../../services/documentsService.js';
import {
  generateReport,
  createReportShareLink,
  revokeReportShareLink,
  listReportShares,
} from '../../services/reportsService.js';

const MODULE_OPTIONS = [
  { id: 'summary', labelKey: 'reports.moduleSummary' },
  { id: 'timeline', labelKey: 'reports.moduleTimeline' },
  { id: 'insights', labelKey: 'reports.moduleInsights' },
  { id: 'documents', labelKey: 'reports.moduleDocuments' },
  { id: 'goals', labelKey: 'reports.moduleGoals' },
];

const PERIOD_OPTIONS = [
  { value: '7d', labelKey: 'insights.period7d' },
  { value: '30d', labelKey: 'insights.period30d' },
  { value: '90d', labelKey: 'insights.period90d' },
];

export async function renderReportsView() {
  const { children, selectedChild } = await loadChildContext();
  const container = h('div', { class: 'container view' });

  if (!selectedChild) {
    mount(container, [
      createEmptyState({ icon: '📊', title: t('reports.emptyTitle'), body: t('reports.emptyBody') }),
    ]);
    return container;
  }

  let periodKey = '30d';
  const selectedModules = new Set(['summary', 'timeline']);
  const selectedDocumentIds = new Set();
  let lastPreview = null;
  const previewContainer = h('div', { id: 'report-preview' });
  const feedback = h('div', {});

  const approvedDocuments = (await listDocuments(selectedChild.id)).filter((d) => d.status === 'approved' && !d.deletedAt);

  async function render() {
    mount(container, [
      h(
        'header',
        { class: 'view__header', style: 'display:flex; flex-wrap:wrap; gap:var(--space-4); align-items:center; justify-content:space-between' },
        [
          h('div', {}, [h('h1', {}, [t('reports.title')]), h('p', { class: 'view__lead' }, [t('reports.subtitle')])]),
          createChildSelector({ children, selectedChild, onChange: () => render() }),
        ]
      ),
      renderBuilder(),
      feedback,
      previewContainer,
      await renderSharesSection(),
    ]);
  }

  function renderBuilder() {
    const periodSelect = h(
      'select',
      { class: 'select', id: 'reports-period' },
      PERIOD_OPTIONS.map((opt) => h('option', { value: opt.value, selected: opt.value === periodKey || undefined }, [t(opt.labelKey)]))
    );
    periodSelect.addEventListener('change', () => {
      periodKey = periodSelect.value;
    });

    const moduleChecks = MODULE_OPTIONS.map((opt) =>
      h('label', { class: 'chip-option' }, [
        h('input', {
          type: 'checkbox',
          value: opt.id,
          checked: selectedModules.has(opt.id) || undefined,
          onChange: (e) => {
            if (e.target.checked) selectedModules.add(opt.id);
            else selectedModules.delete(opt.id);
          },
        }),
        t(opt.labelKey),
      ])
    );

    const documentChecks =
      approvedDocuments.length === 0
        ? [h('p', { class: 'card__meta' }, [t('reports.noApprovedDocuments')])]
        : approvedDocuments.map((doc) =>
            h('label', { class: 'chip-option' }, [
              h('input', {
                type: 'checkbox',
                value: doc.id,
                onChange: (e) => {
                  if (e.target.checked) selectedDocumentIds.add(doc.id);
                  else selectedDocumentIds.delete(doc.id);
                },
              }),
              `${doc.docType}${doc.docDate ? ` (${formatDate(doc.docDate)})` : ''}`,
            ])
          );

    return h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('reports.builderTitle')]),
      h('div', { class: 'form-field' }, [h('label', { for: 'reports-period' }, [t('reports.periodLabel')]), periodSelect]),
      h('div', { class: 'form-field' }, [
        h('span', { style: 'font-weight:var(--font-weight-medium)' }, [t('reports.modulesLabel')]),
        h('div', { class: 'checkbox-group' }, moduleChecks),
      ]),
      h('div', { class: 'form-field' }, [
        h('span', { style: 'font-weight:var(--font-weight-medium)' }, [t('reports.documentsLabel')]),
        h('div', { class: 'checkbox-group' }, documentChecks),
      ]),
      h('div', { style: 'display:flex; gap:var(--space-3); flex-wrap:wrap' }, [
        h('button', { type: 'button', class: 'btn btn--secondary', onClick: onPreview }, [t('reports.previewCta')]),
      ]),
    ]);
  }

  async function onPreview() {
    mount(feedback, []);
    try {
      lastPreview = await generateReport(selectedChild.id, {
        periodKey,
        modules: [...selectedModules],
        documentIds: [...selectedDocumentIds],
      });
      mount(previewContainer, renderPreview(lastPreview));
    } catch (err) {
      mount(feedback, [createErrorState({ body: err.message })]);
    }
  }

  function renderPreview(report) {
    const sensitive = report.sensitivePreview;
    return [
      h('section', { class: 'notice notice--warning', style: 'margin-bottom: var(--space-4)' }, [
        h('h3', { style: 'font-size:var(--font-size-sm); margin:0 0 var(--space-2) 0' }, [t('reports.sensitivePreviewTitle')]),
        h('p', { style: 'margin:0' }, [
          `${sensitive.recordCount} ${t('reports.sensitivePreviewRecords')}` +
            (sensitive.includesMedication ? ` · ${t('reports.sensitivePreviewMedication')}` : '') +
            (sensitive.documentCount > 0 ? ` · ${sensitive.documentCount} ${t('reports.sensitivePreviewDocuments')}` : ''),
        ]),
      ]),

      h('div', { id: 'report-printable', class: 'card' }, [
        h('header', {}, [
          h('h2', {}, [report.header.productName]),
          h('p', {}, [`${t('reports.reportForChild')}: ${report.header.childName}`]),
          h('p', { class: 'card__meta' }, [`${t('reports.periodLabel')}: ${report.header.period.key}`]),
        ]),

        report.sections.summary
          ? h('section', {}, [
              h('h3', {}, [t('reports.moduleSummary')]),
              h('p', {}, [
                `${report.sections.summary.sampleInfo.sampleSize} registos, ${report.sections.summary.sampleInfo.daysWithRecords} dias com registo.`,
              ]),
            ])
          : '',

        report.sections.timeline
          ? h('section', {}, [
              h('h3', {}, [t('reports.moduleTimeline')]),
              h(
                'ul',
                {},
                report.sections.timeline.slice(0, 30).map((r) =>
                  h('li', {}, [
                    `${formatDateTime(r.occurredAt?.toDate ? r.occurredAt.toDate() : r.occurredAt)} — ${r.categoryId}${r.emotion ? ` — ${r.emotion}` : ''}`,
                  ])
                )
              ),
            ])
          : '',

        report.sections.insights
          ? h('section', {}, [
              h('h3', {}, [t('reports.moduleInsights')]),
              h(
                'ul',
                {},
                report.sections.insights.map((i) => h('li', {}, [`${i.title} — ${i.factualObservation}`]))
              ),
            ])
          : '',

        report.sections.documents
          ? h('section', {}, [
              h('h3', {}, [t('reports.moduleDocuments')]),
              h(
                'ul',
                {},
                report.sections.documents.map((d) => h('li', {}, [`${d.docType}${d.issuer ? ` — ${d.issuer}` : ''}`]))
              ),
            ])
          : '',

        report.sections.goals
          ? h('section', {}, [
              h('h3', {}, [t('reports.moduleGoals')]),
              h(
                'ul',
                {},
                report.sections.goals.map((g) => h('li', {}, [g.title]))
              ),
            ])
          : '',

        h('footer', { class: 'notice notice--info', style: 'margin-top: var(--space-4)' }, [report.disclaimer]),
      ]),

      h('div', { style: 'display:flex; gap:var(--space-3); flex-wrap:wrap; margin-top: var(--space-4)' }, [
        h('button', { type: 'button', class: 'btn btn--primary', onClick: () => window.print() }, [t('reports.printCta')]),
        h('button', { type: 'button', class: 'btn btn--secondary', onClick: onCreateShareLink }, [t('reports.createShareLinkCta')]),
      ]),
    ];
  }

  async function onCreateShareLink() {
    const expiresInHours = Number(window.prompt(t('reports.expiresPrompt'), '168')) || 168;
    try {
      const result = await createReportShareLink(selectedChild.id, {
        periodKey,
        modules: [...selectedModules],
        documentIds: [...selectedDocumentIds],
        expiresInHours,
      });
      const url = `${window.location.origin}${window.location.pathname}#/relatorio-partilhado/${selectedChild.id}/${result.shareId}/${result.token}`;
      mount(feedback, [
        h('div', { class: 'notice notice--success' }, [
          h('p', {}, [t('reports.shareLinkCreatedBody')]),
          h('code', { style: 'word-break:break-all; display:block' }, [url]),
          h('p', { class: 'form-field__hint' }, [t('reports.shareLinkNeverInTitleNote')]),
        ]),
      ]);
      announce(t('reports.shareLinkCreatedBody'));
      render();
    } catch (err) {
      mount(feedback, [createErrorState({ body: err.message })]);
    }
  }

  async function renderSharesSection() {
    let shares = [];
    try {
      shares = await listReportShares(selectedChild.id);
    } catch {
      shares = [];
    }

    return h('section', { class: 'card' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('reports.sharesTitle')]),
      shares.length === 0
        ? h('p', { class: 'card__meta' }, [t('reports.noShares')])
        : h(
            'ul',
            { style: 'list-style:none; padding:0; display:grid; gap:var(--space-2)' },
            shares.map((share) => {
              const expiresAtMillis = share.expiresAt?.toMillis ? share.expiresAt.toMillis() : share.expiresAt;
              const isExpired = expiresAtMillis < Date.now();
              const status = share.revokedAt ? t('reports.shareStatusRevoked') : isExpired ? t('reports.shareStatusExpired') : t('reports.shareStatusActive');
              return h('li', { class: 'card', style: 'padding:var(--space-3)' }, [
                h('div', { style: 'display:flex; justify-content:space-between; gap:var(--space-2); flex-wrap:wrap' }, [
                  h('span', {}, [`${t('reports.shareCreatedAt')}: ${formatDateTime(share.createdAt?.toDate ? share.createdAt.toDate() : share.createdAt)}`]),
                  h('span', { class: 'category-chip' }, [status]),
                ]),
                h('p', { class: 'card__meta' }, [`${t('reports.shareAccessCount')}: ${share.accessCount || 0}`]),
                !share.revokedAt
                  ? h('button', {
                      type: 'button',
                      class: 'btn btn--ghost',
                      onClick: () => {
                        openConfirmDialog({
                          title: t('reports.revokeShareConfirmTitle'),
                          body: t('reports.revokeShareConfirmBody'),
                          confirmLabel: t('common.confirm'),
                          cancelLabel: t('common.cancel'),
                          onConfirm: async () => {
                            await revokeReportShareLink(selectedChild.id, share.id);
                            render();
                          },
                        });
                      },
                    }, [t('reports.revokeShareCta')])
                  : '',
              ]);
            })
          ),
    ]);
  }

  await render();
  return container;
}
