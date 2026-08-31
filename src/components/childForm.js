import { h } from '../utils/dom.js';
import { t } from '../i18n/index.js';

const ORIGIN_OPTIONS = ['direct', 'ode', 'partner'];

/**
 * Formulário reutilizável de perfil da criança — só os dados necessários
 * (nome, data de nascimento opcional, origem da relação).
 */
export function createChildForm({ initial = {}, submitLabel, onSubmit }) {
  const nameInput = h('input', {
    class: 'input',
    id: 'child-name',
    type: 'text',
    required: true,
    maxlength: 120,
    value: initial.name || '',
  });
  const birthDateInput = h('input', {
    class: 'input',
    id: 'child-birthdate',
    type: 'date',
    value: initial.birthDate || '',
  });
  const originSelect = h(
    'select',
    { class: 'select', id: 'child-origin' },
    ORIGIN_OPTIONS.map((value) =>
      h('option', { value, selected: (initial.relationshipOrigin || 'direct') === value || undefined }, [
        t(`origin.${value}`),
      ])
    )
  );

  const form = h(
    'form',
    {
      onSubmit: (event) => {
        event.preventDefault();
        onSubmit({
          name: nameInput.value.trim(),
          birthDate: birthDateInput.value || null,
          relationshipOrigin: originSelect.value,
        });
      },
    },
    [
      h('div', { class: 'form-field' }, [h('label', { for: 'child-name' }, [t('children.nameLabel')]), nameInput]),
      h('div', { class: 'form-field' }, [
        h('label', { for: 'child-birthdate' }, [`${t('children.birthDateLabel')} (${t('common.optional')})`]),
        birthDateInput,
      ]),
      h('div', { class: 'form-field' }, [h('label', { for: 'child-origin' }, [t('children.originLabel')]), originSelect]),
      h('button', { type: 'submit', class: 'btn btn--primary' }, [submitLabel]),
    ]
  );

  return form;
}
