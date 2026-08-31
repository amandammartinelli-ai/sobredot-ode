/**
 * Camada de configuração do Firebase.
 *
 * Define a FORMA da configuração a partir de variáveis de ambiente. A
 * inicialização real do SDK vive em src/firebase/app.js, que é o único
 * outro ficheiro que lê estas funções — nenhum outro módulo deve aceder
 * a `import.meta.env` diretamente para configuração do Firebase.
 *
 * Nunca coloque credenciais reais em código-fonte. Em desenvolvimento,
 * copie ".env.example" para ".env" (ignorado pelo git) e, em produção,
 * configure as variáveis de ambiente no painel do Netlify. As chaves
 * devolvidas aqui são a configuração pública do Firebase Web (não são
 * segredos — ver docs/threat-model.md); segredos de servidor/IA nunca
 * pertencem a este ficheiro nem a nenhum código do browser.
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
