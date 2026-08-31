import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { mockDemoUser } from '../../data/mock/user.js';
import { listChildren } from '../../services/childrenService.js';
import { exitDemoMode } from '../../services/authService.js';
import { clearAllSobredotData } from '../../services/storageService.js';
import { getReducedMotionPreference, setReducedMotionPreference } from '../../services/preferencesService.js';
import { openConfirmDialog } from '../../components/confirmDialog.js';

const originLabelKey = {
  ode: 'origin.ode',
  partner: 'origin.partner',
  direct: 'origin.direct',
};

export function renderProfileView() {
  const container = h('div', { class: 'container view' });

  function render() {
    const children = listChildren();

    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('profile.title')]), h('p', { class: 'view__lead' }, [t('profile.subtitle')])]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('profile.sectionAccount')]),
        h('p', { style: 'margin:0' }, [mockDemoUser.name]),
        h('p', { class: 'card__meta' }, [mockDemoUser.role]),
        h('span', { class: 'category-chip', style: '--chip-color: var(--color-info-100); margin-top: var(--space-2); display:inline-flex' }, [
          t('demo.modeLabel'),
        ]),
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('profile.sectionChildren')]),
        h(
          'ul',
          { style: 'list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:var(--space-2)' },
          children.map((child) =>
            h('li', { style: 'display:flex; justify-content:space-between; gap:var(--space-3)' }, [
              h('span', {}, [child.name]),
              h('span', { class: 'card__meta' }, [t(originLabelKey[child.relationshipOrigin])]),
            ])
          )
        ),
      ]),

      h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
        h('h2', { style: 'font-size:var(--font-size-md)' }, [t('profile.sectionLanguage')]),
        h('select', { class: 'select', disabled: true, style: 'max-width:200px' }, [
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
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--danger',
            onClick: () => {
              openConfirmDialog({
                title: t('profile.clearLocalData'),
                body: t('profile.privacyNote'),
                confirmLabel: t('common.confirm'),
                cancelLabel: t('common.cancel'),
                onConfirm: () => {
                  clearAllSobredotData();
                  window.location.hash = '#/welcome';
                },
              });
            },
          },
          [t('profile.clearLocalData')]
        ),
      ]),

      h('button', {
        type: 'button',
        class: 'btn btn--secondary btn--block',
        onClick: () => {
          exitDemoMode();
          window.location.hash = '#/welcome';
        },
      }, [t('profile.exitDemo')]),
    ]);
  }

  render();
  return container;
}
