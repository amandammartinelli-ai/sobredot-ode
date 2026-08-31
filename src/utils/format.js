/**
 * Formatação de datas/horas em português, sem bibliotecas externas.
 */

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('pt-PT', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(isoString) {
  return dateFormatter.format(new Date(isoString));
}

export function formatTime(isoString) {
  return timeFormatter.format(new Date(isoString));
}

export function formatDateTime(isoString) {
  return `${formatDate(isoString)} · ${formatTime(isoString)}`;
}

export function formatRelativeToNow(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Há instantes';
  if (diffHours < 24) return `Há ${diffHours}h`;

  const diffDays = Math.round(diffHours / 24);
  return diffDays === 1 ? 'Há 1 dia' : `Há ${diffDays} dias`;
}

export function getInitials(fullName) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
