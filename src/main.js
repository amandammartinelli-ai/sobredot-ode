import './styles/main.css';
import { renderDemoBanner } from './components/demoBanner.js';
import { renderAppHeader } from './components/appHeader.js';
import { applyReducedMotionPreference } from './services/preferencesService.js';
import { initRouter } from './router/router.js';

function bootstrap() {
  applyReducedMotionPreference();
  renderDemoBanner();
  renderAppHeader();
  initRouter();
}

document.addEventListener('DOMContentLoaded', bootstrap);
