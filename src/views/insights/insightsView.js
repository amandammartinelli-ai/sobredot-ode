import { h } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';

export function renderInsightsView() {
  return h('div', { class: 'container view' }, [
    h('header', { class: 'view__header' }, [
      h('h1', {}, [t('insights.title')]),
      h('p', { class: 'view__lead' }, [t('insights.subtitle')]),
    ]),
    h('div', { class: 'notice notice--info' }, [
      h('h2', { style: 'font-size:var(--font-size-md); margin-bottom:var(--space-2)' }, [t('insights.notActiveTitle')]),
      h('p', { style: 'margin:0' }, [t('insights.notActiveBody')]),
    ]),
  ]);
}
