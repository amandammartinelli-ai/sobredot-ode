/**
 * Camada de configuração do Firebase.
 *
 * IMPORTANTE (Etapa 1): este ficheiro define apenas a FORMA da configuração
 * a partir de variáveis de ambiente. Não inicializa nenhum serviço Firebase
 * (Authentication, Firestore, Storage, Functions, App Check) e não importa
 * o SDK do Firebase. A ligação real ao backend fica para uma etapa futura.
 *
 * Nunca coloque credenciais reais em código-fonte. Em desenvolvimento,
 * copie ".env.example" para ".env" (ignorado pelo git) e, em produção,
 * configure as variáveis de ambiente no painel do Netlify.
 */

function readEnv(key, fallback = '') {
  const env = import.meta.env || {};
  return env[key] ?? fallback;
}

export function getFirebaseConfig() {
  return {
    apiKey: readEnv('VITE_FIREBASE_API_KEY'),
    authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnv('VITE_FIREBASE_APP_ID'),
    measurementId: readEnv('VITE_FIREBASE_MEASUREMENT_ID'),
  };
}

export function getAppCheckSiteKey() {
  return readEnv('VITE_FIREBASE_APPCHECK_SITE_KEY');
}

export function isDemoMode() {
  return readEnv('VITE_APP_DEMO_MODE', 'true') === 'true';
}

export function getAppName() {
  return readEnv('VITE_APP_NAME', 'Sobredot');
}

/**
 * Indica se existe uma configuração Firebase minimamente preenchida.
 * Nesta etapa será sempre `false` em ambiente de demonstração, o que é
 * esperado: ainda não há backend ligado.
 */
export function hasFirebaseConfig() {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.projectId && !isDemoMode());
}
