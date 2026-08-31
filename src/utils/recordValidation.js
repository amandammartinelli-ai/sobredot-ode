/**
 * Validação client-side do formulário de registo — espelha (mas não
 * substitui) a validação do servidor em firestore.rules. Um registo só
 * pode ser guardado se tiver algum conteúdo real, para evitar registos
 * vazios por engano.
 */
export function hasMeaningfulContent(draft) {
  const commonFilled = [
    draft.where,
    draft.withWhom,
    draft.antecedent,
    draft.emotion,
    draft.behavior,
    draft.regulation,
    draft.helper,
    draft.outcome,
    draft.notes,
  ].some((value) => value && value.trim());
  const detailsFilled = Object.values(draft.details || {}).some((value) => value && String(value).trim());
  return commonFilled || detailsFilled;
}

export function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
