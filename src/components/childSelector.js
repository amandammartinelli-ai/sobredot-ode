import { h } from '../utils/dom.js';
import { t } from '../i18n/index.js';
import { listChildren, getSelectedChildId, setSelectedChildId } from '../services/childrenService.js';

const originLabelKey = {
  ode: 'origin.ode',
  partner: 'origin.partner',
  direct: 'origin.direct',
};

/**
 * Seletor de criança. Chama `onChange(childId)` quando a seleção muda,
 * para que a vista que o usa possa voltar a desenhar-se.
 */
export function createChildSelector(onChange) {
  const children = listChildren();
  const selectedId = getSelectedChildId();
  const selectedChild = children.find((child) => child.id === selectedId) || children[0];

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
      h('option', { value: child.id, selected: child.id === selectedId || undefined }, [child.name])
    )
  );

  return h('div', { class: 'child-selector' }, [
    h('span', { class: 'child-selector__avatar', 'aria-hidden': 'true' }, [selectedChild.avatarInitials]),
    h('div', {}, [select, h('p', { class: 'child-selector__origin' }, [t(originLabelKey[selectedChild.relationshipOrigin])])]),
  ]);
}
