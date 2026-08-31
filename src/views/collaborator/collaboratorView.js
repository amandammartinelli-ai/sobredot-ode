import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import { getCurrentUser } from '../../services/authService.js';
import { getChild } from '../../services/childrenService.js';
import { acceptAccessGrant, getOwnAccessIndex } from '../../services/accessGrantsService.js';
import { listLatestInsights, listInsightStatusHistory, setInsightStatus } from '../../services/insightsService.js';
import { createErrorState } from '../../components/states/errorState.js';
import { createSuccessState } from '../../components/states/successState.js';

/**
 * Área do colaborador externo (escola/profissional) — a mesma pessoa que
 * a família convidou em Família → "Acessos de escola e profissionais"
 * (ver docs/permissions.md). Não exige nenhum "cadastro profissional"
 * prévio: só uma conta autenticada normal (ver `access: 'auth'` no
 * router) e uma concessão de acesso ativa para esta criança.
 *
 * Duas formas de chegar aqui:
 *  - `#/colaborador/:childId/:grantId` — primeira vez, aceita a
 *    concessão (o e-mail tem de corresponder ao da concessão).
 *  - `#/colaborador/:childId` — acesso contínuo, já aceite.
 */
export async function renderCollaboratorView({ params }) {
  const [childId, grantId] = params;
  const container = h('div', { class: 'container view' });

  if (grantId) {
    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('collaborator.acceptTitle')])]),
      h('p', {}, [t('collaborator.acceptBody')]),
      h('button', {
        type: 'button',
        class: 'btn btn--primary',
        onClick: async (event) => {
          event.target.disabled = true;
          try {
            await acceptAccessGrant(childId, grantId);
            mount(container, [
              createSuccessState({
                title: t('collaborator.acceptedTitle'),
                body: t('collaborator.acceptedBody'),
                actions: [{ label: t('collaborator.continueCta'), variant: 'btn--primary', onClick: () => { window.location.hash = `#/colaborador/${childId}`; } }],
              }),
            ]);
          } catch (err) {
            mount(container, [createErrorState({ body: err.message })]);
          }
        },
      }, [t('common.confirm')]),
    ]);
    return container;
  }

  const uid = getCurrentUser().uid;

  let child;
  let accessIndex;
  try {
    [child, accessIndex] = await Promise.all([getChild(childId), getOwnAccessIndex(childId, uid)]);
    if (!child) throw new Error(t('collaborator.noAccessBody'));
  } catch (err) {
    mount(container, [createErrorState({ title: t('collaborator.noAccessTitle'), body: err.message || t('collaborator.noAccessBody') })]);
    return container;
  }

  const canValidate =
    accessIndex &&
    Array.isArray(accessIndex.capabilities) &&
    accessIndex.capabilities.includes('validate') &&
    Array.isArray(accessIndex.scopeCategories) &&
    (accessIndex.scopeCategories.includes('all') || accessIndex.scopeCategories.includes('insights'));

  async function render() {
    let insights = [];
    try {
      insights = await listLatestInsights(childId);
    } catch (err) {
      mount(container, [createErrorState({ title: t('collaborator.noAccessTitle'), body: err.message })]);
      return;
    }

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [`${t('collaborator.title')} — ${child.name}`]),
        h('p', { class: 'view__lead' }, [canValidate ? t('collaborator.subtitleValidate') : t('collaborator.subtitleViewOnly')]),
      ]),
      h('div', { class: 'notice notice--info', style: 'margin-bottom: var(--space-4)' }, [t('collaborator.scopeNote')]),
      insights.length === 0
        ? h('p', { class: 'card__meta' }, [t('insights.noInsightsYet')])
        : h('div', {}, insights.map((insight) => renderInsightCard(insight))),
    ]);
  }

  function renderInsightCard(insight) {
    const commentInput = h('textarea', { class: 'textarea', maxlength: 1000, placeholder: t('collaborator.commentPlaceholder') });
    const historyContainer = h('div', { hidden: true });

    async function act(status) {
      await setInsightStatus(childId, insight.id, status, commentInput.value.trim() || null);
      announce(t('collaborator.actionDoneAnnounce'));
      render();
    }

    return h('article', { class: 'card', style: 'margin-bottom: var(--space-3)' }, [
      h('h3', { style: 'font-size:var(--font-size-md)' }, [insight.title]),
      h('p', {}, [insight.factualObservation]),
      insight.possiblePattern ? h('p', { style: 'font-style:italic' }, [insight.possiblePattern]) : '',
      h('p', { class: 'card__meta' }, [`${t('insights.confidenceLabel')}: ${t(`insights.confidence${insight.confidence[0].toUpperCase()}${insight.confidence.slice(1)}`)}`]),
      h('p', { class: 'card__meta' }, [`${t('insights.statusLabel')}: ${t(`insights.status${insight.status.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`)}`]),
      canValidate
        ? h('div', {}, [
            h('div', { class: 'form-field' }, [h('label', {}, [t('collaborator.commentLabel')]), commentInput]),
            h('div', { style: 'display:flex; gap:var(--space-2); flex-wrap:wrap' }, [
              h('button', { type: 'button', class: 'btn btn--secondary', onClick: () => act('professional_validated') }, [t('collaborator.validateCta')]),
              h('button', { type: 'button', class: 'btn btn--ghost', onClick: () => act('contested') }, [t('collaborator.contestCta')]),
              h('button', {
                type: 'button',
                class: 'btn btn--ghost',
                onClick: async () => {
                  const history = await listInsightStatusHistory(childId, insight.id);
                  mount(historyContainer, [
                    history.length === 0
                      ? h('p', { class: 'card__meta' }, [t('insights.noHistory')])
                      : h('ul', {}, history.map((entry) => h('li', { class: 'card__meta' }, [
                          `${formatDateTime(entry.createdAt?.toDate ? entry.createdAt.toDate() : entry.createdAt)} — ${entry.actorRole} — ${entry.comment || ''}`,
                        ]))),
                  ]);
                  historyContainer.hidden = false;
                },
              }, [t('insights.viewHistoryCta')]),
            ]),
            historyContainer,
          ])
        : '',
    ]);
  }

  await render();
  return container;
}
