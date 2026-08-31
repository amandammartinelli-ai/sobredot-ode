import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { requestPasswordReset } from '../../services/authService.js';
import { describeAuthError } from '../../utils/authErrors.js';
import { createErrorState } from '../../components/states/errorState.js';
import { createSuccessState } from '../../components/states/successState.js';

export function renderResetPasswordView() {
  const container = h('div', { class: 'container view', style: 'max-width: 28rem; margin-inline:auto' });

  function renderForm({ error } = {}) {
    const emailInput = h('input', { class: 'input', id: 'reset-email', type: 'email', required: true, autocomplete: 'email' });

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('auth.resetPassword.title')]),
        h('p', { class: 'view__lead' }, [t('auth.resetPassword.subtitle')]),
      ]),
      error ? createErrorState({ title: t('states.error.title'), body: error }) : '',
      h(
        'form',
        {
          onSubmit: async (event) => {
            event.preventDefault();
            try {
              await requestPasswordReset(emailInput.value.trim());
            } catch (err) {
              // Nunca revelamos se o e-mail existe ou não — a mensagem de
              // sucesso é sempre a mesma, exceto para erros de formato.
              if (err.code !== 'auth/invalid-email') {
                renderSuccess();
                return;
              }
              renderForm({ error: describeAuthError(err) });
              return;
            }
            renderSuccess();
          },
        },
        [
          h('div', { class: 'form-field' }, [h('label', { for: 'reset-email' }, [t('auth.emailLabel')]), emailInput]),
          h('button', { type: 'submit', class: 'btn btn--primary btn--block' }, [t('auth.resetPassword.submit')]),
        ]
      ),
      h('p', { style: 'text-align:center; margin-top: var(--space-4)' }, [
        h('a', { href: '#/login' }, [t('auth.resetPassword.backToLogin')]),
      ]),
    ]);
  }

  function renderSuccess() {
    mount(container, [
      createSuccessState({
        title: t('auth.resetPassword.title'),
        body: t('auth.resetPassword.sentNotice'),
        actions: [{ label: t('auth.resetPassword.backToLogin'), variant: 'btn--primary', onClick: () => { window.location.hash = '#/login'; } }],
      }),
    ]);
  }

  renderForm();
  return container;
}
