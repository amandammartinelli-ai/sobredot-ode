import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { signIn } from '../../services/authService.js';
import { describeAuthError } from '../../utils/authErrors.js';
import { createErrorState } from '../../components/states/errorState.js';

export function renderLoginView({ params } = {}) {
  const container = h('div', { class: 'container view', style: 'max-width: 28rem; margin-inline:auto' });

  function render({ error, submitting } = {}) {
    const emailInput = h('input', { class: 'input', id: 'login-email', type: 'email', required: true, autocomplete: 'email' });
    const passwordInput = h('input', {
      class: 'input',
      id: 'login-password',
      type: 'password',
      required: true,
      autocomplete: 'current-password',
    });

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('auth.login.title')]),
        h('p', { class: 'view__lead' }, [t('auth.login.subtitle')]),
      ]),

      error ? createErrorState({ title: t('states.error.title'), body: error }) : '',

      h(
        'form',
        {
          onSubmit: async (event) => {
            event.preventDefault();
            render({ submitting: true });
            try {
              await signIn({ email: emailInput.value.trim(), password: passwordInput.value });
              announce(t('auth.login.title'));
              window.location.hash = params?.length === 3 ? `#/aceitar-convite/${params.join('/')}` : '#/dashboard';
            } catch (err) {
              render({ error: describeAuthError(err) });
            }
          },
        },
        [
          h('div', { class: 'form-field' }, [h('label', { for: 'login-email' }, [t('auth.emailLabel')]), emailInput]),
          h('div', { class: 'form-field' }, [
            h('label', { for: 'login-password' }, [t('auth.passwordLabel')]),
            passwordInput,
          ]),
          h('button', { type: 'submit', class: 'btn btn--primary btn--block', disabled: submitting || undefined }, [
            t('auth.login.submit'),
          ]),
        ]
      ),

      h('p', { style: 'text-align:center; margin-top: var(--space-4)' }, [
        h('a', { href: '#/reset-password' }, [t('auth.login.forgotPassword')]),
      ]),
      h('p', { style: 'text-align:center' }, [
        `${t('auth.login.noAccount')} `,
        h('a', { href: '#/signup' }, [t('auth.login.goSignup')]),
      ]),
    ]);
  }

  render();
  return container;
}
