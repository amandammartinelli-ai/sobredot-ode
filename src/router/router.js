import { mount, focusMainHeading } from '../utils/dom.js';
import { renderAppNav } from '../components/appNav.js';
import { isAuthenticated } from '../services/authService.js';
import { findMyFamilyId } from '../services/familyService.js';
import { setFamilyId } from '../state/appState.js';
import { renderWelcomeView } from '../views/welcome/welcomeView.js';
import { renderLoginView } from '../views/auth/loginView.js';
import { renderSignupView } from '../views/auth/signupView.js';
import { renderResetPasswordView } from '../views/auth/resetPasswordView.js';
import { renderOnboardingView } from '../views/onboarding/onboardingView.js';
import { renderDashboardView } from '../views/dashboard/dashboardView.js';
import { renderChildProfileView } from '../views/children/childProfileView.js';
import { renderRegisterView } from '../views/register/registerView.js';
import { renderTimelineView } from '../views/timeline/timelineView.js';
import { renderDocumentsView } from '../views/documents/documentsView.js';
import { renderDocumentDetailView } from '../views/documents/documentDetailView.js';
import { renderInsightsView } from '../views/insights/insightsView.js';
import { renderReportsView } from '../views/reports/reportsView.js';
import { renderFamilyView } from '../views/family/familyView.js';
import { renderAcceptInviteView } from '../views/family/acceptInviteView.js';
import { renderProfileView } from '../views/profile/profileView.js';
import { renderNotFoundView } from '../views/notFoundView.js';
import { createLoadingState } from '../components/states/loadingState.js';

/**
 * Router muito simples baseado em hash (#/rota/param). Foi escolhido por
 * não exigir configuração de redirecionamentos no servidor de alojamento
 * — ver docs/decisions.md.
 *
 * `access`:
 *  - 'public'      — qualquer pessoa, mesmo sem sessão
 *  - 'auth'        — exige sessão iniciada (não exige família)
 *  - 'family'      — exige sessão E família (onboarding concluído)
 */
const routes = {
  '': { view: renderWelcomeView, access: 'public', showChrome: false },
  welcome: { view: renderWelcomeView, access: 'public', showChrome: false },
  login: { view: renderLoginView, access: 'public', showChrome: false },
  signup: { view: renderSignupView, access: 'public', showChrome: false },
  'reset-password': { view: renderResetPasswordView, access: 'public', showChrome: false },
  onboarding: { view: renderOnboardingView, access: 'auth', showChrome: false },
  dashboard: { view: renderDashboardView, access: 'family', showChrome: true },
  crianca: { view: renderChildProfileView, access: 'family', showChrome: true },
  registar: { view: renderRegisterView, access: 'family', showChrome: true },
  timeline: { view: renderTimelineView, access: 'family', showChrome: true },
  documents: { view: renderDocumentsView, access: 'family', showChrome: true },
  documento: { view: renderDocumentDetailView, access: 'family', showChrome: true },
  insights: { view: renderInsightsView, access: 'family', showChrome: true },
  reports: { view: renderReportsView, access: 'family', showChrome: true },
  family: { view: renderFamilyView, access: 'family', showChrome: true },
  'aceitar-convite': { view: renderAcceptInviteView, access: 'public', showChrome: false },
  profile: { view: renderProfileView, access: 'family', showChrome: true },
};

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [pathPart] = hash.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const routeName = segments[0] || '';
  const params = segments.slice(1);
  return { routeName, params };
}

function setChromeVisible(visible) {
  const nav = document.querySelector('[data-app-nav]');
  const header = document.querySelector('[data-app-header]');
  const body = document.querySelector('[data-app-body]');
  if (nav) nav.hidden = !visible;
  if (header) header.hidden = !visible;
  if (body) body.classList.toggle('app-shell', visible);
}

export async function renderRoute({ moveFocus = true } = {}) {
  const root = document.querySelector('[data-app-root]');
  if (!root) return;

  const { routeName, params } = parseRoute();
  const route = routes[routeName];

  if (!route) {
    mount(root, renderNotFoundView());
    setChromeVisible(false);
    if (moveFocus) focusMainHeading();
    return;
  }

  if (route.access !== 'public' && !isAuthenticated()) {
    window.location.hash = '#/login';
    return;
  }

  if (route.access === 'family') {
    mount(root, createLoadingState());
    const familyId = await findMyFamilyId();
    if (!familyId) {
      window.location.hash = '#/onboarding';
      return;
    }
    setFamilyId(familyId);
  }

  setChromeVisible(Boolean(route.showChrome));
  if (route.showChrome) {
    renderAppNav(routeName || 'dashboard');
  }

  const node = await route.view({ navigate, params });
  mount(root, node);
  if (moveFocus) focusMainHeading();
}

export function navigate(routeName, ...params) {
  window.location.hash = `#/${[routeName, ...params].join('/')}`;
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
