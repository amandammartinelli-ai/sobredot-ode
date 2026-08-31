import { h, mount } from '../utils/dom.js';
import { t } from '../i18n/index.js';

/**
 * Aviso persistente "Dados de demonstração", sempre visível, nunca escondido
 * em letras pequenas ou atrás de um clique — ver docs/threat-model.md.
 */
export function renderDemoBanner() {
  const root = document.getElementById('demo-banner-root');
  if (!root) return;

  const banner = h('p', { class: 'demo-banner' }, [t('demo.banner')]);
  mount(root, banner);
}
