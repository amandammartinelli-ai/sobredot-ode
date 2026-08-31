import { h, clear } from '../utils/dom.js';

/**
 * Diálogo de confirmação acessível e modal simples (foco preso enquanto
 * aberto, fecho com Escape, sem dependências externas).
 */
export function openConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  const root = document.getElementById('dialog-root');
  if (!root) return;

  const previouslyFocused = document.activeElement;

  function close() {
    clear(root);
    document.removeEventListener('keydown', handleKeydown);
    if (previouslyFocused instanceof HTMLElement) {
      previouslyFocused.focus();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      close();
      onCancel?.();
    }
  }

  const confirmButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--primary',
      onClick: () => {
        close();
        onConfirm?.();
      },
    },
    [confirmLabel]
  );

  const cancelButton = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--secondary',
      onClick: () => {
        close();
        onCancel?.();
      },
    },
    [cancelLabel]
  );

  const dialog = h(
    'div',
    {
      class: 'dialog-backdrop',
      onClick: (event) => {
        if (event.target === event.currentTarget) {
          close();
          onCancel?.();
        }
      },
    },
    [
      h(
        'div',
        {
          class: 'dialog',
          role: 'alertdialog',
          'aria-modal': 'true',
          'aria-labelledby': 'confirm-dialog-title',
          'aria-describedby': 'confirm-dialog-body',
        },
        [
          h('h2', { id: 'confirm-dialog-title' }, [title]),
          h('p', { id: 'confirm-dialog-body' }, [body]),
          h('div', { class: 'dialog__actions' }, [cancelButton, confirmButton]),
        ]
      ),
    ]
  );

  clear(root);
  root.append(dialog);
  document.addEventListener('keydown', handleKeydown);
  confirmButton.focus();
}
