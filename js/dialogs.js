/**
 * Finestre di dialogo dell'app e accessibilità delle finestre
 */

export let dialogFinish = null;

// Finestra di dialogo dell'app al posto di alert/confirm del browser: ogni pulsante dice cosa succede.
// Restituisce il "value" del pulsante scelto, oppure cancelValue (Esc o clic fuori dalla finestra)
export function showDialog({ title, message = '', buttons = [{ label: 'OK', value: true, style: 'primary' }], cancelValue = null, input = null }) {
  return new Promise(resolve => {
    const modal = document.getElementById('dialog-modal');
    if (!modal) {
      resolve(cancelValue);
      return;
    }
    if (dialogFinish) dialogFinish(dialogFinish.cancelValue);

    document.getElementById('dialog-title').textContent = title || '';
    document.getElementById('dialog-message').textContent = message;
    const inputEl = document.getElementById('dialog-input');
    inputEl.style.display = input ? '' : 'none';
    inputEl.value = input ? (input.value || '') : '';
    inputEl.placeholder = input ? (input.placeholder || '') : '';

    const finish = (value) => {
      modal.classList.remove('open');
      dialogFinish = null;
      resolve(input ? (value === cancelValue ? null : { value, text: inputEl.value.trim() }) : value);
    };
    finish.cancelValue = cancelValue;
    dialogFinish = finish;

    const container = document.getElementById('dialog-buttons');
    container.innerHTML = '';
    let defaultBtn = null;
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${b.style === 'primary' ? 'btn-primary' : b.style === 'danger' ? 'btn-danger' : 'btn-secondary'}`;
      btn.textContent = b.label;
      btn.addEventListener('click', () => finish(b.value));
      container.appendChild(btn);
      if (b.style === 'primary' || (!defaultBtn && b.style === 'danger')) defaultBtn = btn;
    });
    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter' && defaultBtn) {
        e.preventDefault();
        defaultBtn.click();
      }
    };

    modal.classList.add('open');
    setTimeout(() => (input ? inputEl : (defaultBtn || container.lastChild))?.focus(), 30);
  });
}

// Accessibilità delle finestre: all'apertura il focus entra nella finestra, Tab resta al suo interno,
// alla chiusura il focus torna dove si trovava prima (funziona per tutte le .modal-overlay)
export const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export const openModalsStack = [];

export function getVisibleFocusables(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => el.offsetParent !== null);
}

export function initModalAccessibility() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(({ target: modal }) => {
      const isOpen = modal.classList.contains('open');
      const index = openModalsStack.findIndex(entry => entry.modal === modal);
      if (isOpen && index === -1) {
        openModalsStack.push({ modal, returnFocus: document.activeElement });
        setTimeout(() => {
          if (modal.classList.contains('open') && !modal.contains(document.activeElement)) {
            getVisibleFocusables(modal)[0]?.focus();
          }
        }, 60);
      } else if (!isOpen && index !== -1) {
        const [entry] = openModalsStack.splice(index, 1);
        if (entry.returnFocus && document.contains(entry.returnFocus) && typeof entry.returnFocus.focus === 'function') {
          entry.returnFocus.focus();
        }
      }
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(modal => observer.observe(modal, { attributes: true, attributeFilter: ['class'] }));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || openModalsStack.length === 0) return;
    const top = openModalsStack[openModalsStack.length - 1].modal;
    const items = getVisibleFocusables(top);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!top.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

export function cancelDialog() {
  if (dialogFinish) dialogFinish(dialogFinish.cancelValue);
}

export function isDialogOpen() {
  return !!dialogFinish;
}

// Chiede un testo (es. il nome di una versione); restituisce la stringa o null se annullato
export async function askText({ title, message, value = '', placeholder = '', okLabel = 'OK' }) {
  const result = await showDialog({
    title,
    message,
    input: { value, placeholder },
    buttons: [
      { label: 'Annulla', value: false },
      { label: okLabel, value: true, style: 'primary' }
    ],
    cancelValue: false
  });
  return result && result.value && result.text ? result.text : null;
}
