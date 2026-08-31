/**
 * Crianças de demonstração — nomes claramente fictícios.
 * `relationshipOrigin` reflete a origem prevista na arquitetura:
 * 'ode' (aluno/a da Oficina das Emoções), 'partner' (instituição parceira)
 * ou 'direct' (família direta). Isto não concede à ODE acesso automático
 * a dados sensíveis — é apenas um metadado de proveniência da relação.
 */
export const mockChildren = [
  {
    id: 'child-exemplo-1',
    name: 'Matias Exemplo',
    birthYear: 2018,
    relationshipOrigin: 'ode',
    avatarInitials: 'ME',
  },
  {
    id: 'child-exemplo-2',
    name: 'Beatriz Fictícia',
    birthYear: 2016,
    relationshipOrigin: 'direct',
    avatarInitials: 'BF',
  },
  {
    id: 'child-exemplo-3',
    name: 'Rafael Amostra',
    birthYear: 2020,
    relationshipOrigin: 'partner',
    avatarInitials: 'RA',
  },
];

export function getMockChildById(childId) {
  return mockChildren.find((child) => child.id === childId) || mockChildren[0];
}
