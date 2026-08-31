import { h, mount, announce } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { getCurrentUser, signOutUser, isEmailVerified, resendVerificationEmail } from '../../services/authService.js';
import { getReducedMotionPreference, setReducedMotionPreference } from '../../services/preferencesService.js';
import { getFamilyId } from '../../state/appState.js';
import { exportAndDownloadFamilyData } from '../../services/dataRightsService.js';
import { createErrorState } from '../../components/states/errorState.js';

export function renderProfileView() {
  const container = h('div', { class: 'container view' });
  const user = getCurrentUser();

  function render() {
    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('profile.title')]), h('p', { class: 'view__lead' }, [t('profile.subtitle')])]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('profile.sectionAccount')]),
        h('p', { style: 'margin:0' }, [user.displayName || user.email]),
        h('p', { class: 'card__meta' }, [user.email]),
        !isEmailVerified()
          ? h('div', { class: 'notice notice--warning', style: 'margin-top: var(--space-3)' }, [
              h('p', { style: 'margin:0' }, [t('auth.verifyEmail.notice')]),
              h('button', {
                type: 'button',
                class: 'btn btn--secondary',
                style: 'margin-top: var(--space-2)',
                onClick: async (event) => {
                  await resendVerificationEmail();
                  event.target.textContent = t('auth.verifyEmail.resent');
                },
              }, [t('auth.verifyEmail.resend')]),
            ])
          : '',
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('a', { href: '#/family', class: 'btn btn--secondary btn--block' }, [t('profile.goToFamily')]),
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('profile.sectionLanguage')]),
        h('select', { class: 'select', disabled: true, 'aria-label': t('profile.sectionLanguage'), style: 'max-width:200px' }, [
          h('option', { selected: true }, [t('profile.languagePt')]),
        ]),
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('profile.sectionAccessibility')]),
        h('label', { class: 'chip-option', style: 'width:fit-content' }, [
          h('input', {
            type: 'checkbox',
            checked: getReducedMotionPreference() || undefined,
            onChange: (event) => setReducedMotionPreference(event.target.checked),
          }),
          t('profile.reducedMotionLabel'),
        ]),
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('profile.sectionPrivacy')]),
        h('p', {}, [t('profile.privacyNote')]),
        h('div', { id: 'export-feedback' }, []),
        h('button', {
          type: 'button',
          class: 'btn btn--secondary',
          style: 'margin-top: var(--space-3)',
          onClick: async (event) => {
            const feedback = container.querySelector('#export-feedback');
            event.target.disabled = true;
            const originalLabel = event.target.textContent;
            event.target.textContent = t('profile.exportingLabel');
            try {
              const familyId = getFamilyId();
              await exportAndDownloadFamilyData(familyId);
              announce(t('profile.exportDoneAnnounce'));
            } catch (err) {
              mount(feedback, [createErrorState({ body: err.message })]);
            } finally {
              event.target.disabled = false;
              event.target.textContent = originalLabel;
            }
          },
        }, [t('profile.exportDataCta')]),
        h('p', { class: 'form-field__hint' }, [t('profile.exportDataHint')]),
      ]),

      h('button', {
        type: 'button',
        class: 'btn btn--secondary btn--block',
        onClick: async () => {
          await signOutUser();
          window.location.hash = '#/welcome';
        },
      }, [t('auth.signOut')]),
    ]);
  }

  render();
  return container;
}
