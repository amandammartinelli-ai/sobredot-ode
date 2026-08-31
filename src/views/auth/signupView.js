import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { signUp } from '../../services/authService.js';
import { describeAuthError } from '../../utils/authErrors.js';
import { createErrorState } from '../../components/states/errorState.js';

export function renderSignupView() {
  const container = h('div', { class: 'container view', style: 'max-width: 28rem; margin-inline:auto' });

  function render({ error, submitting } = {}) {
    const nameInput = h('input', { class: 'input', id: 'signup-name', type: 'text', required: true, maxlength: 120 });
    const emailInput = h('input', { class: 'input', id: 'signup-email', type: 'email', required: true, autocomplete: 'email' });
    const passwordInput = h('input', {
      class: 'input',
      id: 'signup-password',
      type: 'password',
      required: true,
      minlength: 8,
      autocomplete: 'new-password',
    });
    const confirmInput = h('input', {
      class: 'input',
      id: 'signup-confirm',
      type: 'password',
      required: true,
      autocomplete: 'new-password',
    });

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('h1', {}, [t('auth.signup.title')]),
        h('p', { class: 'view__lead' }, [t('auth.signup.subtitle')]),
      ]),

      error ? createErrorState({ title: t('states.error.title'), body: error }) : '',

      h(
        'form',
        {
          onSubmit: async (event) => {
            event.preventDefault();
            if (passwordInput.value !== confirmInput.value) {
              render({ error: t('auth.errors.passwordMismatch') });
              return;
            }
            render({ submitting: true });
            try {
              await signUp({
                email: emailInput.value.trim(),
                password: passwordInput.value,
                displayName: nameInput.value.trim(),
              });
              announce(t('auth.signup.title'));
              window.location.hash = '#/onboarding';
            } catch (err) {
              render({ error: describeAuthError(err) });
            }
          },
        },
        [
          h('div', { class: 'form-field' }, [h('label', { for: 'signup-name' }, [t('auth.signup.nameLabel')]), nameInput]),
          h('div', { class: 'form-field' }, [h('label', { for: 'signup-email' }, [t('auth.emailLabel')]), emailInput]),
          h('div', { class: 'form-field' }, [
            h('label', { for: 'signup-password' }, [t('auth.passwordLabel')]),
            passwordInput,
            h('p', { class: 'form-field__hint' }, [t('auth.signup.passwordHint')]),
          ]),
          h('div', { class: 'form-field' }, [
            h('label', { for: 'signup-confirm' }, [t('auth.signup.confirmPasswordLabel')]),
            confirmInput,
          ]),
          h('p', { class: 'form-field__hint' }, [t('auth.signup.termsNotice')]),
          h('button', { type: 'submit', class: 'btn btn--primary btn--block', disabled: submitting || undefined }, [
            t('auth.signup.submit'),
          ]),
        ]
      ),

      h('p', { style: 'text-align:center; margin-top: var(--space-4)' }, [
        `${t('auth.signup.alreadyHaveAccount')} `,
        h('a', { href: '#/login' }, [t('auth.signup.goLogin')]),
      ]),
    ]);
  }

  render();
  return container;
}
