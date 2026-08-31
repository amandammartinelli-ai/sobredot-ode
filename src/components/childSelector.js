import { h } from '../utils/dom.js';
import { t } from '../i18n/index.js';
import { getInitials } from '../utils/format.js';
import { setSelectedChildId } from '../services/childrenService.js';

/**
 * Seletor de criança. Recebe a lista de crianças já carregada pela vista
 * (dados assíncronos não pertencem a este componente) e a criança
 * selecionada. Chama `onChange(childId)` quando a seleção muda, para que
 * a vista possa voltar a desenhar-se com os dados da nova criança.
 */
export function createChildSelector({ children, selectedChild, onChange }) {
  if (!selectedChild) {
    return h('p', { class: 'card__meta' }, ['—']);
  }

  const select = h(
    'select',
    {
      'aria-label': t('dashboard.changeChild'),
      onChange: (event) => {
        setSelectedChildId(event.target.value);
        onChange?.(event.target.value);
      },
    },
    children.map((child) =>
      h('option', { value: child.id, selected: child.id === selectedChild.id || undefined }, [child.name])
    )
  );

  return h('div', { class: 'child-selector' }, [
    h('span', { class: 'child-selector__avatar', 'aria-hidden': 'true' }, [getInitials(selectedChild.name)]),
    h('div', {}, [select, h('p', { class: 'child-selector__origin' }, [t(`origin.${selectedChild.relationshipOrigin}`)])]),
  ]);
}
