/**
 * As dez categorias de registo do quotidiano, com a cor de token associada.
 * Os rótulos ficam no dicionário de i18n (register.categories.*); aqui só
 * vive a estrutura estável (id, chave i18n, variável de cor).
 */
export const recordCategories = [
  { id: 'emotions', i18nKey: 'register.categories.emotions', colorVar: '--color-cat-emocoes' },
  { id: 'behaviors', i18nKey: 'register.categories.behaviors', colorVar: '--color-cat-comportamentos' },
  { id: 'sleep', i18nKey: 'register.categories.sleep', colorVar: '--color-cat-sono' },
  { id: 'food', i18nKey: 'register.categories.food', colorVar: '--color-cat-alimentacao' },
  { id: 'medication', i18nKey: 'register.categories.medication', colorVar: '--color-cat-medicacao' },
  { id: 'school', i18nKey: 'register.categories.school', colorVar: '--color-cat-escola' },
  { id: 'communication', i18nKey: 'register.categories.communication', colorVar: '--color-cat-comunicacao' },
  { id: 'sensory', i18nKey: 'register.categories.sensory', colorVar: '--color-cat-sensorial' },
  { id: 'achievements', i18nKey: 'register.categories.achievements', colorVar: '--color-cat-conquistas' },
  { id: 'observations', i18nKey: 'register.categories.observations', colorVar: '--color-cat-observacoes' },
];

export function getCategoryById(categoryId) {
  return recordCategories.find((category) => category.id === categoryId);
}
