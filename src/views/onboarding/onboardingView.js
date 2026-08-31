import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { createFamily } from '../../services/familyService.js';
import { createChild, setSelectedChildId } from '../../services/childrenService.js';
import { createChildForm } from '../../components/childForm.js';
import { createErrorState } from '../../components/states/errorState.js';

export function renderOnboardingView() {
  const container = h('div', { class: 'container view', style: 'max-width: 32rem; margin-inline:auto' });

  let familyId = null;

  function renderFamilyStep({ error } = {}) {
    const familyNameInput = h('input', { class: 'input', id: 'family-name', type: 'text', required: true, maxlength: 120 });

    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('onboarding.title')]), h('p', { class: 'view__lead' }, [t('onboarding.subtitle')])]),
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('onboarding.familyStepTitle')]),
      error ? createErrorState({ body: error }) : '',
      h(
        'form',
        {
          onSubmit: async (event) => {
            event.preventDefault();
            try {
              familyId = await createFamily(familyNameInput.value.trim());
              renderChildStep();
            } catch (err) {
              renderFamilyStep({ error: err.message });
            }
          },
        },
        [
          h('div', { class: 'form-field' }, [
            h('label', { for: 'family-name' }, [t('onboarding.familyNameLabel')]),
            familyNameInput,
            h('p', { class: 'form-field__hint' }, [t('onboarding.familyNameHint')]),
          ]),
          h('button', { type: 'submit', class: 'btn btn--primary' }, [t('onboarding.createFamilyCta')]),
        ]
      ),
    ]);
  }

  function renderChildStep({ error } = {}) {
    const form = createChildForm({
      submitLabel: t('onboarding.finishCta'),
      onSubmit: async (fields) => {
        try {
          const childId = await createChild(familyId, fields);
          setSelectedChildId(childId);
          window.location.hash = '#/dashboard';
        } catch (err) {
          renderChildStep({ error: err.message });
        }
      },
    });

    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('onboarding.title')]), h('p', { class: 'view__lead' }, [t('onboarding.subtitle')])]),
      h('h2', { style: 'font-size:var(--font-size-lg)' }, [t('onboarding.childStepTitle')]),
      h('p', { class: 'view__lead' }, [t('onboarding.childStepSubtitle')]),
      error ? createErrorState({ body: error }) : '',
      form,
    ]);
  }

  renderFamilyStep();
  return container;
}
