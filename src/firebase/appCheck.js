/**
 * Firebase App Check.
 *
 * Em desenvolvimento (emuladores), App Check não é inicializado — os
 * emuladores não o exigem. Fora dos emuladores, App Check é sempre
 * inicializado com reCAPTCHA v3. Para testar App Check contra um projeto
 * REAL a partir de uma máquina de desenvolvimento (sem publicar em
 * produção), defina `VITE_APPCHECK_DEBUG_MODE=true` no seu `.env` local
 * (nunca em produção): isso ativa o modo de depuração documentado do
 * Firebase, que imprime um token de depuração na consola do browser na
 * primeira execução. Esse token tem de ser registado manualmente na
 * consola do Firebase (App Check → gerir tokens de depuração) — NUNCA o
 * comite no repositório nem o publique no Netlify.
 */
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAppCheckSiteKey } from '../config/firebase.config.js';

export function initAppCheck(app) {
  const siteKey = getAppCheckSiteKey();
  if (!siteKey) {
    console.warn('[appCheck] VITE_FIREBASE_APPCHECK_SITE_KEY não definido — App Check não foi inicializado.');
    return null;
  }

  if (import.meta.env.VITE_APPCHECK_DEBUG_MODE === 'true') {
    // Nunca definir isto como uma string fixa (um token real) — `true`
    // pede ao SDK para gerar um token novo a cada execução e imprimi-lo na
    // consola, para ser registado manualmente. Ver docs/firebase-setup.md.
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  return initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
