/**
 * Interfaccia principale: barra dei blocchi, esercizi, avvisi e download
 */

import { escapeHtml, selectedState, state } from './state.js';
import { getSelection } from './book.js';
import { markSelectionChanged } from './versions.js';
import { showDialog } from './dialogs.js';

export function showEmptyState() {
  const dropzone = document.getElementById('dropzone-banner');
  if (dropzone) dropzone.style.display = 'block';
  const hero = document.getElementById('block-hero');
  if (hero) hero.style.display = 'none';
  const toolbar = document.getElementById('selection-toolbar');
  if (toolbar) toolbar.style.display = 'none';
  const grid = document.getElementById('exercises-grid');
  if (grid) grid.style.display = 'none';
  const list = document.getElementById('blocks-list');
  if (list) list.innerHTML = '<div style="padding: 1.5rem 1rem; color: #94a3b8; font-size: 0.85rem; text-align: center;">Nessuna scheda ancora.<br>Segui i passaggi della guida per crearle.</div>';
  document.getElementById('app-book-title').textContent = "Generatore Schede Didattiche & PDF";
  document.getElementById('app-book-subtitle').textContent = "Segui i 4 passaggi per creare le schede del tuo libro";
  document.getElementById('blocks-count-badge').textContent = "0 Unità";
  const closeBtn = document.getElementById('start-guide-close');
  if (closeBtn) closeBtn.style.display = 'none';
}

export let toastTimer = null;

// Avviso in basso a destra: quelli informativi spariscono da soli, quelli "persistent"
// (avvertimenti, errori, esiti da leggere con calma) restano finché non vengono chiusi
export function showNotificationToast(msg, { type = 'info', persistent = false } = {}) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    const text = document.createElement('span');
    text.className = 'app-toast-text';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'app-toast-close';
    close.setAttribute('aria-label', 'Chiudi avviso');
    close.textContent = '✕';
    close.addEventListener('click', hideNotificationToast);
    toast.append(text, close);
    document.body.appendChild(toast);
  }
  toast.querySelector('.app-toast-text').textContent = msg;
  toast.classList.remove('info', 'warning', 'error');
  toast.classList.add(type, 'show');
  toast.classList.toggle('persistent', persistent);
  clearTimeout(toastTimer);
  if (!persistent) {
    toastTimer = setTimeout(hideNotificationToast, 4000);
  }
}

export function hideNotificationToast() {
  const toast = document.getElementById('app-toast');
  if (toast) toast.classList.remove('show', 'persistent');
}

export function renderSidebar() {
  const container = document.getElementById('blocks-list');
  container.innerHTML = '';

  state.BLOCKS_DATA.forEach(block => {
    const selectedCount = getSelection(block).size;
    const totalCount = block.exercises.length;
    const isActive = block.id === state.currentBlockId;

    // Voce selezionabile anche da tastiera (Tab, Invio, Spazio); titolo completo al passaggio del mouse
    const el = document.createElement('div');
    el.className = `block-item ${isActive ? 'active' : ''}`;
    el.dataset.blockId = block.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-current', isActive ? 'true' : 'false');
    el.title = `Blocco ${block.blockNumber ?? block.id}: ${block.title}`;
    el.onclick = () => selectBlock(block.id);
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectBlock(block.id);
      }
    };

    el.innerHTML = `
      <div class="block-item-top">
        <span class="block-badge">BLOCCO ${block.blockNumber ?? block.id}</span>
        <span class="selection-counter">${selectedCount}/${totalCount} scelti</span>
      </div>
      <div class="block-title">${escapeHtml(block.title)}</div>
    `;
    container.appendChild(el);
  });
}

export function selectBlock(id) {
  const keyboardFocus = document.activeElement && document.activeElement.classList.contains('block-item');
  state.currentBlockId = id;
  renderSidebar();
  renderActiveBlock();
  if (keyboardFocus) {
    document.querySelector(`.block-item[data-block-id="${id}"]`)?.focus();
  }

  if (window.innerWidth <= 900) {
    setTimeout(() => {
      const activeEl = document.querySelector('.block-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 50);
  }
}

export function renderActiveBlock() {
  const block = state.BLOCKS_DATA.find(b => b.id === state.currentBlockId);
  if (!block) return;

  document.getElementById('hero-title').textContent = block.title;
  document.getElementById('hero-meta').innerHTML = `
    <span>📑 <strong>Blocco ${block.blockNumber ?? block.id}</strong> · ${block.exercises.length} esercizi disponibili</span>
  `;
  document.getElementById('hero-summary').textContent = block.welcomeNote || "Seleziona gli esercizi che intendi includere nella scheda di lavoro per gli studenti.";

  updateSelectionBadge();

  const grid = document.getElementById('exercises-grid');
  grid.innerHTML = '';

  if (block.exercises.length === 0) {
    grid.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Nessun esercizio rilevato in questo file.</div>`;
    return;
  }

  const selection = getSelection(block);
  block.exercises.forEach(ex => {
    const isSelected = selection.has(ex.id);
    const card = document.createElement('div');
    card.className = `exercise-card ${isSelected ? 'selected' : ''}`;

    let tagClass = 'tag-comprensione';
    if (ex.type === 'vf') tagClass = 'tag-vf';
    if (ex.type === 'analisi') tagClass = 'tag-analisi';
    if (ex.type === 'scrittura') tagClass = 'tag-scrittura';
    if (ex.type === 'lessico') tagClass = 'tag-lessico';
    if (ex.type === 'speciale') tagClass = 'tag-speciale';

    card.innerHTML = `
      <div class="exercise-checkbox-wrapper">
        <input type="checkbox" class="custom-checkbox" data-ex-id="${escapeHtml(ex.id)}" aria-label="Includi nella scheda: ${escapeHtml(ex.typeLabel)} – ${escapeHtml(ex.title)}" ${isSelected ? 'checked' : ''}>
      </div>
      <div class="exercise-body">
        <div class="exercise-header">
          <span class="exercise-tag ${tagClass}">${escapeHtml(ex.typeLabel)}</span>
        </div>
        <div class="exercise-title">${escapeHtml(ex.title)}</div>
        <div class="exercise-desc">${escapeHtml(ex.desc)}</div>
      </div>
    `;

    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => toggleExercise(ex.id));
    card.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        toggleExercise(ex.id);
      }
    });

    grid.appendChild(card);
  });
}

export function toggleExercise(exerciseId) {
  const block = state.BLOCKS_DATA.find(b => b.id === state.currentBlockId);
  if (!block) return;
  const set = getSelection(block);
  if (set.has(exerciseId)) {
    set.delete(exerciseId);
  } else {
    set.add(exerciseId);
  }
  const hadFocus = document.activeElement && document.activeElement.classList.contains('custom-checkbox');
  markSelectionChanged();
  renderActiveBlock();
  renderSidebar();
  if (hadFocus) {
    Array.from(document.querySelectorAll('.custom-checkbox')).find(cb => cb.dataset.exId === exerciseId)?.focus();
  }
}

// Le azioni rapide di selezione valgono per il blocco aperto o per tutto il libro: con più blocchi
// lo chiedono al docente (se "scope" è già indicato non viene fatta nessuna domanda)
async function askSelectionScope({ title, message, scope, defaultScope = 'book' }) {
  if (scope) return scope;
  if (state.BLOCKS_DATA.length <= 1) return 'block';
  return showDialog({
    title,
    message: `${message} A quali blocchi vuoi applicarlo?`,
    buttons: [
      { label: 'Annulla', value: null },
      { label: 'Solo questo blocco', value: 'block', style: defaultScope === 'block' ? 'primary' : 'secondary' },
      { label: 'Tutti i blocchi', value: 'book', style: defaultScope === 'book' ? 'primary' : 'secondary' }
    ],
    cancelValue: null
  });
}

// Applica la scelta degli esercizi ("pickIds" restituisce gli ID da selezionare) ai blocchi indicati
function applySelectionToBlocks(scope, pickIds) {
  const current = state.BLOCKS_DATA.find(b => b.id === state.currentBlockId);
  const targets = scope === 'book' ? state.BLOCKS_DATA : [current];
  targets.forEach(block => {
    selectedState[block.filename] = new Set(pickIds(block));
  });
  markSelectionChanged();
  renderActiveBlock();
  renderSidebar();
}

export async function selectAll(scope = null) {
  if (!state.BLOCKS_DATA.some(b => b.id === state.currentBlockId)) return;
  scope = await askSelectionScope({ title: '✅ Seleziona tutti', message: 'Vengono scelti tutti gli esercizi.', scope });
  if (!scope) return;
  applySelectionToBlocks(scope, block => block.exercises.map(e => e.id));
  if (state.BLOCKS_DATA.length > 1) {
    showNotificationToast(scope === 'book' ? '✅ Tutti gli esercizi scelti in tutti i blocchi.' : '✅ Tutti gli esercizi scelti in questo blocco.');
  }
}

export async function deselectAll(scope = null) {
  if (!state.BLOCKS_DATA.some(b => b.id === state.currentBlockId)) return;
  scope = await askSelectionScope({ title: '⬜ Deseleziona tutti', message: 'Vengono tolti tutti gli esercizi.', scope, defaultScope: 'block' });
  if (!scope) return;
  applySelectionToBlocks(scope, () => []);
  if (state.BLOCKS_DATA.length > 1) {
    showNotificationToast(scope === 'book' ? '⬜ Nessun esercizio scelto in tutti i blocchi.' : '⬜ Nessun esercizio scelto in questo blocco.');
  }
}

// Filtro rapido per alunni con BES / verifiche semplificate (Comprensione, V/F e Lessico)
export async function selectEssentialBes(scope = null) {
  if (!state.BLOCKS_DATA.some(b => b.id === state.currentBlockId)) return;
  scope = await askSelectionScope({
    title: '🎯 Selezione Essenziale (BES)',
    message: 'Vengono scelti solo le domande aperte, il Vero/Falso e il Laboratorio Lessicale.',
    scope
  });
  if (!scope) return;
  const essentialTypes = new Set(['comprensione', 'vf', 'lessico']);
  applySelectionToBlocks(scope, block => block.exercises.filter(e => essentialTypes.has(e.type)).map(e => e.id));
  showNotificationToast(scope === 'book'
    ? "🎯 Selezione Essenziale (BES) applicata a tutti i blocchi: Comprensione, V/F e Lessico."
    : "🎯 Selezione Essenziale (BES) applicata a questo blocco: Comprensione, V/F e Lessico.");
}

export function updateSelectionBadge() {
  const block = state.BLOCKS_DATA.find(b => b.id === state.currentBlockId);
  const count = block ? getSelection(block).size : 0;
  const total = block ? block.exercises.length : 0;
  document.getElementById('selected-badge').textContent = `${count} di ${total} selezionati`;
}

export function downloadMarkdownFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Copia negli appunti con ripiego per i browser senza Clipboard API
export function copyTextToClipboard(text, successMsg, fallbackFilename) {
  const onFail = () => fallbackCopyText(text, fallbackFilename, successMsg);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showNotificationToast(successMsg)).catch(onFail);
  } else {
    onFail();
  }
}

export function fallbackCopyText(text, filename, successMsg = '📋 Testo copiato negli appunti!') {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (_) {}
  showNotificationToast(copied ? successMsg : `Impossibile copiare automaticamente. Scarica il file "${filename}".`);
  document.body.removeChild(ta);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // La revoca immediata può interrompere il download in Firefox/Safari
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
