import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import { getSharedReport } from '../../services/reportsService.js';
import { createErrorState } from '../../components/states/errorState.js';

/**
 * Vista pública (sem sessão) de um relatório partilhado por link — ver
 * functions/src/reports.js, `getSharedReport`. Nunca lê o Firestore
 * diretamente: só a Cloud Function verifica o token e devolve o conteúdo
 * já congelado no momento da partilha.
 */
export async function renderSharedReportView({ params }) {
  const [childId, shareId, token] = params;
  const container = h('div', { class: 'container view' });

  try {
    const { reportSnapshot, disclaimer } = await getSharedReport(childId, shareId, token);
    mount(container, [
      h('div', { id: 'report-printable', class: 'card' }, [
        h('header', {}, [
          h('h1', {}, [reportSnapshot.header.productName]),
          h('p', {}, [`${t('reports.reportForChild')}: ${reportSnapshot.header.childName}`]),
        ]),
        reportSnapshot.sections.timeline
          ? h('section', {}, [
              h('h2', {}, [t('reports.moduleTimeline')]),
              h(
                'ul',
                {},
                reportSnapshot.sections.timeline.slice(0, 30).map((r) =>
                  h('li', {}, [`${formatDateTime(r.occurredAt?.toDate ? r.occurredAt.toDate() : r.occurredAt)} — ${r.categoryId}`])
                )
              ),
            ])
          : '',
        reportSnapshot.sections.insights
          ? h('section', {}, [
              h('h2', {}, [t('reports.moduleInsights')]),
              h('ul', {}, reportSnapshot.sections.insights.map((i) => h('li', {}, [`${i.title} — ${i.factualObservation}`]))),
            ])
          : '',
        h('footer', { class: 'notice notice--info', style: 'margin-top: var(--space-4)' }, [disclaimer]),
      ]),
      h('button', { type: 'button', class: 'btn btn--primary', style: 'margin-top:var(--space-4)', onClick: () => window.print() }, [
        t('reports.printCta'),
      ]),
    ]);
  } catch (err) {
    mount(container, [createErrorState({ title: t('reports.shareLinkErrorTitle'), body: err.message })]);
  }

  return container;
}
