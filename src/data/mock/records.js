/**
 * Registos de demonstração, distribuídos pelas dez categorias.
 * Todas as datas são relativas a "agora" para que a linha do tempo pareça
 * sempre atual, independentemente de quando a demonstração é aberta.
 */
function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export const mockSeedRecords = [
  {
    id: 'rec-1',
    childId: 'child-exemplo-1',
    categoryId: 'sleep',
    createdAt: hoursAgo(10),
    summary: 'Dormiu cerca de 9 horas, sem acordares.',
    intensity: 'low',
  },
  {
    id: 'rec-2',
    childId: 'child-exemplo-1',
    categoryId: 'emotions',
    createdAt: hoursAgo(6),
    summary: 'Manhã tranquila, bem-disposto ao acordar.',
    intensity: 'low',
  },
  {
    id: 'rec-3',
    childId: 'child-exemplo-1',
    categoryId: 'food',
    createdAt: hoursAgo(4),
    summary: 'Almoço completo, boa aceitação de vegetais.',
    intensity: 'low',
  },
  {
    id: 'rec-4',
    childId: 'child-exemplo-1',
    categoryId: 'medication',
    createdAt: hoursAgo(3),
    summary: 'Toma da manhã administrada conforme habitual.',
    intensity: 'medium',
  },
  {
    id: 'rec-5',
    childId: 'child-exemplo-1',
    categoryId: 'school',
    createdAt: hoursAgo(2),
    summary: 'Participou na atividade de grupo com entusiasmo.',
    intensity: 'low',
  },
  {
    id: 'rec-6',
    childId: 'child-exemplo-1',
    categoryId: 'sensory',
    createdAt: hoursAgo(24),
    summary: 'Sensibilidade a ruído alto durante o recreio.',
    intensity: 'medium',
  },
  {
    id: 'rec-7',
    childId: 'child-exemplo-1',
    categoryId: 'achievements',
    createdAt: hoursAgo(30),
    summary: 'Concluiu sozinho a rotina de vestir.',
    intensity: 'low',
  },
  {
    id: 'rec-8',
    childId: 'child-exemplo-1',
    categoryId: 'communication',
    createdAt: hoursAgo(48),
    summary: 'Usou frases de três palavras para pedir ajuda.',
    intensity: 'low',
  },
  {
    id: 'rec-9',
    childId: 'child-exemplo-2',
    categoryId: 'sleep',
    createdAt: hoursAgo(12),
    summary: 'Acordou duas vezes durante a noite.',
    intensity: 'medium',
  },
  {
    id: 'rec-10',
    childId: 'child-exemplo-2',
    categoryId: 'behaviors',
    createdAt: hoursAgo(5),
    summary: 'Dificuldade em gerir a transição para o banho.',
    intensity: 'high',
  },
];

export function getSeedRecordsForChild(childId) {
  return mockSeedRecords
    .filter((record) => record.childId === childId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getLatestRecordByCategory(childId, categoryId) {
  return getSeedRecordsForChild(childId).find((record) => record.categoryId === categoryId);
}
