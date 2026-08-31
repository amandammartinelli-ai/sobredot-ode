/**
 * Pequenos utilitários de DOM para manter as vistas e componentes sem
 * dependências externas e sem HTML montado por concatenação de strings.
 */

/**
 * Cria um elemento DOM.
 * @param {string} tag
 * @param {object} [attrs]
 * @param {Array<Node|string>} [children]
 */
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === 'class') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dKey, dValue]) => {
        el.dataset[dKey] = dValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      el.innerHTML = value;
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, value);
    }
  });

  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child === undefined || child === null || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });

  return el;
}

export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function clear(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

export function mount(root, node) {
  clear(root);
  if (Array.isArray(node)) {
    root.append(...node);
  } else {
    root.append(node);
  }
}

/**
 * Anuncia uma mensagem à região "aria-live" global, para leitores de ecrã,
 * sem depender de alertas visuais intrusivos.
 */
export function announce(message) {
  const region = document.getElementById('aria-live-region');
  if (!region) return;
  region.textContent = '';
  // Força o leitor de ecrã a registar a mudança mesmo com o mesmo texto.
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/**
 * Move o foco para o cabeçalho principal ao mudar de rota, essencial para
 * navegação por teclado e leitores de ecrã em aplicações de página única.
 */
export function focusMainHeading() {
  const main = document.getElementById('main-content');
  if (main) {
    main.focus();
  }
}
