import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { createChildForm } from '../../components/childForm.js';
import { createErrorState } from '../../components/states/errorState.js';
import { getFamilyId } from '../../state/appState.js';
import { createChild, getChild, updateChild, setSelectedChildId } from '../../services/childrenService.js';

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
    ]);
  }

  render();
  return container;
}
