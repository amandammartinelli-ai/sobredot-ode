import { mount, focusMainHeading } from '../utils/dom.js';
import { renderAppNav } from '../components/appNav.js';
import { isAuthenticated } from '../services/authService.js';
import { findMyFamilyId } from '../services/familyService.js';
import { setFamilyId } from '../state/appState.js';
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
 *
 * `load`: função que devolve a Promise de import() da vista — nunca um
 * import estático no topo do ficheiro. Isto divide o bundle por rota
 * (Etapa 5, "Desempenho": o ficheiro único ultrapassava 800 KB) — cada
 * ecrã só é transferido quando o utilizador de facto o visita. As rotas
 * "public" (boas-vindas/login/registo) continuam a carregar primeiro,
 * por serem sempre o ponto de entrada.
 */
const routes = {
  '': { load: () => import('../views/welcome/welcomeView.js').then((m) => m.renderWelcomeView), access: 'public', showChrome: false },
  welcome: { load: () => import('../views/welcome/welcomeView.js').then((m) => m.renderWelcomeView), access: 'public', showChrome: false },
  login: { load: () => import('../views/auth/loginView.js').then((m) => m.renderLoginView), access: 'public', showChrome: false },
  signup: { load: () => import('../views/auth/signupView.js').then((m) => m.renderSignupView), access: 'public', showChrome: false },
  'reset-password': {
    load: () => import('../views/auth/resetPasswordView.js').then((m) => m.renderResetPasswordView),
    access: 'public',
    showChrome: false,
  },
  onboarding: {
    load: () => import('../views/onboarding/onboardingView.js').then((m) => m.renderOnboardingView),
    access: 'auth',
    showChrome: false,
  },
  dashboard: {
    load: () => import('../views/dashboard/dashboardView.js').then((m) => m.renderDashboardView),
    access: 'family',
    showChrome: true,
  },
  crianca: {
    load: () => import('../views/children/childProfileView.js').then((m) => m.renderChildProfileView),
    access: 'family',
    showChrome: true,
  },
  registar: {
    load: () => import('../views/register/registerView.js').then((m) => m.renderRegisterView),
    access: 'family',
    showChrome: true,
  },
  falar: {
    load: () => import('../views/speak/speakView.js').then((m) => m.renderSpeakView),
    access: 'family',
    showChrome: true,
  },
  timeline: {
    load: () => import('../views/timeline/timelineView.js').then((m) => m.renderTimelineView),
    access: 'family',
    showChrome: true,
  },
  documents: {
    load: () => import('../views/documents/documentsView.js').then((m) => m.renderDocumentsView),
    access: 'family',
    showChrome: true,
  },
  documento: {
    load: () => import('../views/documents/documentDetailView.js').then((m) => m.renderDocumentDetailView),
    access: 'family',
    showChrome: true,
  },
  insights: {
    load: () => import('../views/insights/insightsView.js').then((m) => m.renderInsightsView),
    access: 'family',
    showChrome: true,
  },
  reports: {
    load: () => import('../views/reports/reportsView.js').then((m) => m.renderReportsView),
    access: 'family',
    showChrome: true,
  },
  'relatorio-partilhado': {
    load: () => import('../views/reports/sharedReportView.js').then((m) => m.renderSharedReportView),
    access: 'public',
    showChrome: false,
  },
  'biblioteca-ode': {
    load: () => import('../views/library/odeLibraryView.js').then((m) => m.renderOdeLibraryView),
    access: 'family',
    showChrome: true,
  },
  colaborador: {
    load: () => import('../views/collaborator/collaboratorView.js').then((m) => m.renderCollaboratorView),
    access: 'auth',
    showChrome: false,
  },
  family: {
    load: () => import('../views/family/familyView.js').then((m) => m.renderFamilyView),
    access: 'family',
    showChrome: true,
  },
  'aceitar-convite': {
    load: () => import('../views/family/acceptInviteView.js').then((m) => m.renderAcceptInviteView),
    access: 'public',
    showChrome: false,
  },
  profile: {
    load: () => import('../views/profile/profileView.js').then((m) => m.renderProfileView),
    access: 'family',
    showChrome: true,
  },
  admin: {
    // Nunca na navegação principal (ver src/components/appNav.js) — só
    // acessível por link direto, à semelhança de "colaborador". Exige só
    // sessão iniciada, não família: um administrador técnico pode nunca
    // ter uma família própria. A verificação real de admin é sempre do
    // lado do servidor — ver docs/admin-dashboard.md.
    load: () => import('../views/admin/adminView.js').then((m) => m.renderAdminView),
    access: 'auth',
    showChrome: false,
  },
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

  // Estado de carregamento visível enquanto o código da vista (e, para
  // rotas "family", a resolução da família) ainda não chegou — evita um
  // ecrã em branco percetível em ligações lentas (ver docs/accessibility.md).
  mount(root, createLoadingState());

  if (route.access === 'family') {
    const familyId = await findMyFamilyId();
    if (!familyId) {
      window.location.hash = '#/onboarding';
      return;
    }
    setFamilyId(familyId);
  }

  const view = await route.load();

  setChromeVisible(Boolean(route.showChrome));
  if (route.showChrome) {
    renderAppNav(routeName || 'dashboard');
  }

  const node = await view({ navigate, params });
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
