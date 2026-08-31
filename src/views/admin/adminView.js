import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import { isAdmin } from '../../services/authService.js';
import { createEmptyState } from '../../components/states/emptyState.js';
import { createErrorState } from '../../components/states/errorState.js';
import {
  getOperationalSummary,
  listIncidents,
  createIncident,
  resolveIncident,
} from '../../services/adminDashboardService.js';
import { version as appVersion } from '../../../package.json';

const DOCUMENT_STATUS_ORDER = ['pending_review', 'approved', 'rejected', 'error', 'quarantine'];

function renderStat(label, value) {
  return h('div', { class: 'card', style: 'padding: var(--space-3)' }, [
    h('p', { class: 'card__meta', style: 'margin:0' }, [label]),
    h('p', { style: 'margin:0; font-size:var(--font-size-lg); font-weight:600' }, [String(value)]),
  ]);
}

function renderStatGrid(stats) {
  return h(
    'div',
    { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:var(--space-3)' },
    stats.map(([label, value]) => renderStat(label, value))
  );
}

/**
 * Painel só para administradores técnicos (Etapa 5) — ver
 * docs/admin-dashboard.md. Nunca mostra nome de família/criança nem
 * conteúdo: só contagens agregadas que a própria Cloud Function
 * calcula (functions/src/adminDashboard.js).
 */
export async function renderAdminView() {
  const container = h('div', { class: 'container view' });

  const allowed = await isAdmin();
  if (!allowed) {
    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('admin.title')])]),
      createEmptyState({ icon: '🔒', title: t('admin.deniedTitle'), body: t('admin.deniedBody') }),
    ]);
    return container;
  }

  async function render() {
    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('admin.title')]),
        h('p', { class: 'view__lead' }, [t('admin.subtitle')]),
      ]),
      h('p', {}, [t('states.loading')]),
    ]);

    let summary;
    let incidents;
    try {
      [summary, incidents] = await Promise.all([getOperationalSummary(), listIncidents()]);
    } catch (err) {
      mount(container, [
        h('header', { class: 'view__header' }, [h('h1', {}, [t('admin.title')])]),
        createErrorState({ body: err.message, onRetry: render }),
      ]);
      return;
    }

    const documentsSection = h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('admin.sectionDocuments')]),
      renderStatGrid(DOCUMENT_STATUS_ORDER.map((status) => [status, summary.documents.byStatus[status] ?? 0])),
    ]);

    const incidentsList =
      incidents.length === 0
        ? h('p', { class: 'card__meta' }, [t('admin.incidentsEmpty')])
        : h(
            'ul',
            { style: 'list-style:none; padding:0; display:flex; flex-direction:column; gap:var(--space-2)' },
            incidents.map((incident) =>
              h('li', { class: 'card', style: 'display:flex; justify-content:space-between; align-items:center; gap:var(--space-2)' }, [
                h('div', {}, [
                  h('p', { style: 'margin:0; font-weight:600' }, [incident.title]),
                  h('p', { class: 'card__meta', style: 'margin:0' }, [
                    `${t(`admin.incidentSeverity${incident.severity[0].toUpperCase()}${incident.severity.slice(1)}`)} — `,
                    incident.status === 'resolved' ? t('admin.incidentStatusResolved') : t('admin.incidentStatusOpen'),
                  ]),
                ]),
                incident.status !== 'resolved'
                  ? h('button', {
                      type: 'button',
                      class: 'btn btn--secondary',
                      onClick: async () => {
                        await resolveIncident(incident.id);
                        announce(t('admin.incidentResolveCta'));
                        await render();
                      },
                    }, [t('admin.incidentResolveCta')])
                  : '',
              ])
            )
          );

    let newTitle = '';
    let newSeverity = 'low';

    const incidentsSection = h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('admin.sectionIncidents')]),
      incidentsList,
      h('form', {
        style: 'display:flex; gap:var(--space-2); margin-top:var(--space-3); flex-wrap:wrap; align-items:flex-end',
        onSubmit: async (event) => {
          event.preventDefault();
          if (!newTitle.trim()) return;
          await createIncident({ title: newTitle.trim(), severity: newSeverity });
          announce(t('admin.incidentCreateCta'));
          await render();
        },
      }, [
        h('div', { class: 'form-field' }, [
          h('label', { for: 'incident-title' }, [t('admin.incidentTitleLabel')]),
          h('input', {
            id: 'incident-title',
            type: 'text',
            class: 'input',
            required: true,
            onInput: (event) => { newTitle = event.target.value; },
          }),
        ]),
        h('div', { class: 'form-field' }, [
          h('label', { for: 'incident-severity' }, [t('admin.incidentSeverityLabel')]),
          h('select', {
            id: 'incident-severity',
            class: 'select',
            onChange: (event) => { newSeverity = event.target.value; },
          }, [
            h('option', { value: 'low' }, [t('admin.incidentSeverityLow')]),
            h('option', { value: 'medium' }, [t('admin.incidentSeverityMedium')]),
            h('option', { value: 'high' }, [t('admin.incidentSeverityHigh')]),
          ]),
        ]),
        h('button', { type: 'submit', class: 'btn btn--primary' }, [t('admin.incidentCreateCta')]),
      ]),
    ]);

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('admin.title')]),
        h('p', { class: 'view__lead' }, [t('admin.subtitle')]),
      ]),
      h('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3)' }, [
        h('p', { class: 'card__meta', style: 'margin:0' }, [
          `${t('admin.generatedAtLabel')} ${formatDateTime(summary.generatedAt)}`,
        ]),
        h('button', { type: 'button', class: 'btn btn--secondary', onClick: render }, [t('admin.refreshCta')]),
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('admin.sectionFamilies')]),
        renderStatGrid([
          [t('admin.familiesTotal'), summary.families.total],
          [t('admin.familiesPendingDeletions'), summary.families.pendingDeletions],
        ]),
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('admin.sectionChildren')]),
        renderStatGrid([
          [t('admin.childrenActive'), summary.children.active],
          [t('admin.childrenProcessingRestricted'), summary.children.processingRestricted],
        ]),
      ]),

      documentsSection,

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('admin.sectionAiQueries')]),
        renderStatGrid([
          [t('admin.aiQueriesTotal'), summary.aiQueries.last24h],
          [t('admin.aiQueriesBlocked'), summary.aiQueries.blockedLast24h],
          [t('admin.aiQueriesEmergency'), summary.aiQueries.emergencyLast24h],
        ]),
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('admin.sectionAbuse')]),
        renderStatGrid([[t('admin.abuseRateLimited'), summary.abuse.rateLimitedLast24h]]),
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('admin.sectionVersions')]),
        renderStatGrid([
          [t('admin.versionFrontend'), appVersion],
          [t('admin.versionFunctions'), summary.functionsVersion],
        ]),
      ]),

      incidentsSection,
    ]);
  }

  await render();
  return container;
}
