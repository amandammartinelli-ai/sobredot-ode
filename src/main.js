import './firebase/app.js';
import './styles/main.css';
import { renderDemoBanner } from './components/demoBanner.js';
import { renderAppHeader } from './components/appHeader.js';
import { applyReducedMotionPreference } from './services/preferencesService.js';
import { waitForAuthReady } from './services/authService.js';
import { initRouter } from './router/router.js';

async function bootstrap() {
  applyReducedMotionPreference();
  renderDemoBanner();
  renderAppHeader();
  // Espera que o Firebase Auth determine, pela primeira vez, se há sessão
  // persistida — evita um redirecionamento momentâneo para o login em
  // cada recarregamento de página.
  await waitForAuthReady();
  initRouter();
}

document.addEventListener('DOMContentLoaded', bootstrap);
