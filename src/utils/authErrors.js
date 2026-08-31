import { t } from '../i18n/index.js';

export function describeAuthError(error) {
  const code = error?.code || '';
  const message = t(`auth.errors.${code}`);
  return message === `auth.errors.${code}` ? t('auth.errors.generic') : message;
}
