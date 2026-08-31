import { describe, it, expect } from 'vitest';
import { h, mount, clear } from '../../src/utils/dom.js';

describe('dom utils', () => {
  it('creates an element with attributes and text children', () => {
    const el = h('button', { class: 'btn', type: 'button' }, ['Registar']);
    expect(el.tagName).toBe('BUTTON');
    expect(el.className).toBe('btn');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.textContent).toBe('Registar');
  });

  it('attaches event listeners from onX props', () => {
    let clicked = false;
    const el = h('button', { onClick: () => (clicked = true) });
    el.click();
    expect(clicked).toBe(true);
  });

  it('mount replaces existing content', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>antigo</p>';
    mount(root, h('p', {}, ['novo']));
    expect(root.children.length).toBe(1);
    expect(root.textContent).toBe('novo');
  });

  it('mount accepts an array of nodes', () => {
    const root = document.createElement('div');
    mount(root, [h('span', {}, ['a']), h('span', {}, ['b'])]);
    expect(root.children.length).toBe(2);
  });

  it('clear empties a node', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>algo</p><p>mais</p>';
    clear(root);
    expect(root.children.length).toBe(0);
  });
});
