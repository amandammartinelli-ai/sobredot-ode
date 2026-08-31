import { mount, focusMainHeading } from '../utils/dom.js';
import { renderAppNav } from '../components/appNav.js';
import { isAuthenticated } from '../services/authService.js';
import { renderWelcomeView } from '../views/welcome/welcomeView.js';
import { renderDashboardView } from '../views/dashboard/dashboardView.js';
import { renderRegisterView } from '../views/register/registerView.js';
import { renderTimelineView } from '../views/timeline/timelineView.js';
import { renderDocumentsView } from '../views/documents/documentsView.js';
import { renderInsightsView } from '../views/insights/insightsView.js';
import { renderReportsView } from '../views/reports/reportsView.js';
import { renderProfileView } from '../views/profile/profileView.js';
import { renderNotFoundView } from '../views/notFoundView.js';

/**
 * Router muito simples baseado em hash (#/rota). Foi escolhido por não
 * exigir configuração de redirecionamentos no servidor de alojamento —
 * ver docs/decisions.md para o registo desta decisão.
 */
const routes = {
  '': { view: renderWelcomeView, public: true, showChrome: false },
  welcome: { view: renderWelcomeView, public: true, showChrome: false },
  dashboard: { view: renderDashboardView, showChrome: true },
  registar: { view: renderRegisterView, showChrome: true },
  timeline: { view: renderTimelineView, showChrome: true },
  documents: { view: renderDocumentsView, showChrome: true },
  insights: { view: renderInsightsView, showChrome: true },
  reports: { view: renderReportsView, showChrome: true },
  profile: { view: renderProfileView, showChrome: true },
};

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash.split('?')[0];
}

function setChromeVisible(visible) {
  const nav = document.querySelector('[data-app-nav]');
  const header = document.querySelector('[data-app-header]');
  const body = document.querySelector('[data-app-body]');
  if (nav) nav.hidden = !visible;
  if (header) header.hidden = !visible;
  if (body) body.classList.toggle('app-shell', visible);
}

export function renderRoute({ moveFocus = true } = {}) {
  const root = document.querySelector('[data-app-root]');
  if (!root) return;

  const routeName = parseRoute();
  const route = routes[routeName] || routes.notFound;

  if (!route) {
    mount(root, renderNotFoundView());
    setChromeVisible(false);
    if (moveFocus) focusMainHeading();
    return;
  }

  if (!route.public && !isAuthenticated()) {
    window.location.hash = '#/welcome';
    return;
  }

  setChromeVisible(Boolean(route.showChrome));
  if (route.showChrome) {
    renderAppNav(routeName || 'dashboard');
  }

  const node = route.view({ navigate });
  mount(root, node);
  if (moveFocus) focusMainHeading();
}

export function navigate(routeName) {
  window.location.hash = `#/${routeName}`;
}

/**
 * No carregamento inicial da página não movemos o foco: deve permanecer no
 * início do documento para que a "skip link" seja o primeiro elemento
 * alcançável por teclado. Em navegações seguintes (mudança de rota dentro
 * da aplicação), movemos o foco para o conteúdo principal — prática
 * recomendada para aplicações de página única.
 */
export function initRouter() {
  window.addEventListener('hashchange', renderRoute);
  renderRoute({ moveFocus: false });
}
