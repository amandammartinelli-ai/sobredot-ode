/**
 * Serviço de autenticação — MODO DEMONSTRAÇÃO APENAS.
 *
 * Isto NÃO é autenticação real e não deve ser confundido com segurança.
 * Não existe palavra-passe, servidor, token ou verificação de identidade.
 * Serve apenas para simular, na interface, a existência de uma sessão,
 * de forma claramente identificada como demonstração. A ligação ao Firebase
 * Authentication ficará para uma etapa futura.
 */
import { mockDemoUser } from '../data/mock/user.js';
import { readJSON, writeJSON, remove } from './storageService.js';

const SESSION_KEY = 'demoSession';

export function getCurrentUser() {
  return readJSON(SESSION_KEY, null);
}

export function isAuthenticated() {
  return getCurrentUser() !== null;
}

/**
 * "Entra" no modo de demonstração. Não valida credenciais nenhumas.
 */
export function enterDemoMode() {
  const session = {
    ...mockDemoUser,
    demoMode: true,
    startedAt: new Date().toISOString(),
  };
  writeJSON(SESSION_KEY, session);
  return session;
}

export function exitDemoMode() {
  remove(SESSION_KEY);
}
