import { h } from '../utils/dom.js';
import { t } from '../i18n/index.js';

/**
 * Botão de categoria para o fluxo de registo. `isSelected` controla
 * `aria-pressed`, usado tanto para o estilo como para leitores de ecrã.
 */
export function createCategoryTile(category, { isSelected = false, onSelect } = {}) {
  const icon = t(`${category.i18nKey}.icon`);
  const label = t(`${category.i18nKey}.label`);

  return h(
    'button',
    {
      type: 'button',
      class: 'category-tile',
      style: `--tile-color: var(${category.colorVar})`,
      'aria-pressed': String(isSelected),
      onClick: () => onSelect?.(category.id),
    },
    [h('span', { class: 'category-tile__icon', 'aria-hidden': 'true' }, [icon]), h('span', { class: 'category-tile__label' }, [label])]
  );
}

export function createCategoryChip(category) {
  const label = t(`${category.i18nKey}.label`);
  return h('span', { class: 'category-chip', style: `--chip-color: var(${category.colorVar})` }, [
    h('span', { class: 'category-chip__dot', 'aria-hidden': 'true' }),
    label,
  ]);
}
