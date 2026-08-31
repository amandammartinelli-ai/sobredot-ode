import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { createChildForm } from '../../components/childForm.js';
import { createErrorState } from '../../components/states/errorState.js';
import { openConfirmDialog } from '../../components/confirmDialog.js';
import { getFamilyId } from '../../state/appState.js';
import { createChild, getChild, updateChild, softDeleteChild, setSelectedChildId } from '../../services/childrenService.js';
import { setChildProcessingRestriction } from '../../services/dataRightsService.js';

export async function renderChildProfileView({ params }) {
  const childId = params[0] && params[0] !== 'novo' ? params[0] : null;
  const container = h('div', { class: 'container view', style: 'max-width: 32rem; margin-inline:auto' });
  const existing = childId ? await getChild(childId) : null;

  function render({ error } = {}) {
    const form = createChildForm({
      initial: existing || {},
      submitLabel: t('children.save'),
      onSubmit: async (fields) => {
        try {
          if (childId) {
            await updateChild(childId, fields);
          } else {
            const newId = await createChild(getFamilyId(), fields);
            setSelectedChildId(newId);
          }
          window.location.hash = '#/dashboard';
        } catch (err) {
          render({ error: err.message });
        }
      },
    });

    mount(container, [
      h('header', { class: 'view__header' }, [
        h('button', { type: 'button', class: 'btn btn--ghost', onClick: () => { window.location.hash = '#/dashboard'; } }, [
          `← ${t('common.back')}`,
        ]),
        h('h1', { style: 'margin-top: var(--space-3)' }, [childId ? t('children.editTitle') : t('children.newTitle')]),
      ]),
      error ? createErrorState({ body: error }) : '',
      form,
      childId ? renderProcessingRestrictionSection() : '',
      childId ? renderDeleteSection() : '',
    ]);
  }

  function renderProcessingRestrictionSection() {
    const isRestricted = Boolean(existing.processingRestricted);
    return h('section', { class: 'card', style: 'margin-top: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('children.processingRestrictionTitle')]),
      h('p', { class: 'view__lead' }, [t('children.processingRestrictionHint')]),
      h('label', { class: 'chip-option', style: 'width:fit-content' }, [
        h('input', {
          type: 'checkbox',
          checked: isRestricted || undefined,
          onChange: async (event) => {
            await setChildProcessingRestriction(childId, event.target.checked);
            existing.processingRestricted = event.target.checked;
            render();
          },
        }),
        t('children.processingRestrictionLabel'),
      ]),
    ]);
  }

  function renderDeleteSection() {
    return h('section', { class: 'card', style: 'margin-top: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('children.dangerZoneTitle')]),
      h('button', {
        type: 'button',
        class: 'btn btn--ghost',
        onClick: () => {
          openConfirmDialog({
            title: t('children.deleteConfirmTitle'),
            body: t('children.deleteConfirmBody'),
            confirmLabel: t('children.deleteCta'),
            cancelLabel: t('common.cancel'),
            onConfirm: async () => {
              await softDeleteChild(childId);
              window.location.hash = '#/dashboard';
            },
          });
        },
      }, [t('children.deleteCta')]),
    ]);
  }

  render();
  return container;
}
