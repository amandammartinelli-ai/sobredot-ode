import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { isAuthenticated } from '../../services/authService.js';
import { acceptFamilyInvite } from '../../services/familyService.js';
import { createErrorState } from '../../components/states/errorState.js';
import { createSuccessState } from '../../components/states/successState.js';

export async function renderAcceptInviteView({ params }) {
  const [familyId, inviteId, token] = params;
  const container = h('div', { class: 'container view', style: 'max-width: 28rem; margin-inline:auto' });

  if (!isAuthenticated()) {
    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('family.pendingInvitesTitle')])]),
      h('p', {}, [t('auth.login.noAccount')]),
      h('div', { style: 'display:flex; gap:var(--space-3)' }, [
        h('a', { class: 'btn btn--primary', href: `#/login/${familyId}/${inviteId}/${token}` }, [t('auth.login.title')]),
        h('a', { class: 'btn btn--secondary', href: '#/signup' }, [t('auth.login.goSignup')]),
      ]),
    ]);
    return container;
  }

  async function render({ error } = {}) {
    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('family.pendingInvitesTitle')])]),
      error ? createErrorState({ body: error }) : '',
      h('button', {
        type: 'button',
        class: 'btn btn--primary',
        onClick: async () => {
          try {
            await acceptFamilyInvite({ familyId, inviteId, token });
            mount(container, [
              createSuccessState({
                title: t('family.pendingInvitesTitle'),
                body: t('family.inviteSentBody'),
                actions: [{ label: t('dashboard.subtitle'), variant: 'btn--primary', onClick: () => { window.location.hash = '#/dashboard'; } }],
              }),
            ]);
          } catch (err) {
            render({ error: err.message });
          }
        },
      }, [t('common.confirm')]),
    ]);
  }

  await render();
  return container;
}
