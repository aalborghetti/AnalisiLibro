/**
 * Versioni salvate delle scelte degli esercizi
 */

import { selectedState, state } from './state.js';
import { getSelection } from './book.js';
import { renderActiveBlock, renderSidebar, showNotificationToast } from './ui.js';
import { askText, showDialog } from './dialogs.js';

export const VERSIONS_STORAGE_KEY = 'ANALISI_LIBRO_VERSIONS';
export function readAllVersions() {
  try {
    return JSON.parse(localStorage.getItem(VERSIONS_STORAGE_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

// Le versioni sono legate all'identificativo del libro: { id libro: { nome versione: { file: [ID esercizi] } } }.
// Le versioni salvate prima dell'introduzione dell'identificativo erano legate al titolo e vengono lette ancora
export function getBookVersions() {
  const all = readAllVersions();
  return (state.currentBookId && all[state.currentBookId]) || all[state.globalBookTitle] || {};
}

export function setBookVersions(versions) {
  const all = readAllVersions();
  const key = state.currentBookId || state.globalBookTitle;
  if (state.currentBookId) delete all[state.globalBookTitle];
  if (Object.keys(versions).length > 0) {
    all[key] = versions;
  } else {
    delete all[key];
  }
  try {
    localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Impossibile salvare le versioni", err);
  }
}

export function renderVersionsBar() {
  const select = document.getElementById('version-select');
  if (!select) return;
  const names = Object.keys(getBookVersions()).sort((a, b) => a.localeCompare(b, 'it'));
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = names.length > 0 ? '— scegli una versione —' : '— nessuna versione salvata —';
  select.appendChild(placeholder);
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });
  if (!names.includes(state.activeVersionName)) state.activeVersionName = '';
  select.value = state.activeVersionName;
  select.disabled = names.length === 0;
  const deleteBtn = document.getElementById('btn-delete-version');
  if (deleteBtn) deleteBtn.style.display = state.activeVersionName ? '' : 'none';
}

// Una modifica manuale della selezione "stacca" la versione applicata; le scelte vengono salvate
export function markSelectionChanged() {
  if (state.activeVersionName) {
    state.activeVersionName = '';
    renderVersionsBar();
  }
  saveSelections();
}

// --- Scelte degli esercizi di ogni libro, salvate nel browser: { id libro: { file: [ID esercizi] } } ---

const SELECTIONS_STORAGE_KEY = 'ANALISI_LIBRO_SELECTIONS';

function readAllSelections() {
  try {
    return JSON.parse(localStorage.getItem(SELECTIONS_STORAGE_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

export function saveSelections() {
  if (!state.currentBookId || state.BLOCKS_DATA.length === 0) return;
  const all = readAllSelections();
  all[state.currentBookId] = Object.fromEntries(
    state.BLOCKS_DATA.map(block => [block.filename, Array.from(selectedState[block.filename] || [])])
  );
  try {
    localStorage.setItem(SELECTIONS_STORAGE_KEY, JSON.stringify(all));
  } catch (_) {}
}

// Ripristina le scelte salvate (o quelle indicate, es. da un file di lavoro) per i blocchi presenti
export function restoreSelections(saved = null) {
  const data = saved || readAllSelections()[state.currentBookId];
  if (!data || state.BLOCKS_DATA.length === 0) return false;
  state.BLOCKS_DATA.forEach(block => {
    const ids = data[block.filename];
    if (Array.isArray(ids)) {
      const known = new Set(block.exercises.map(ex => ex.id));
      selectedState[block.filename] = new Set(ids.filter(id => known.has(id)));
    }
  });
  renderSidebar();
  renderActiveBlock();
  return true;
}

// Eliminando un libro dall'archivio si eliminano anche le sue scelte e versioni
export function deleteBookData(bookId) {
  const selections = readAllSelections();
  delete selections[bookId];
  const versions = readAllVersions();
  delete versions[bookId];
  try {
    localStorage.setItem(SELECTIONS_STORAGE_KEY, JSON.stringify(selections));
    localStorage.setItem(VERSIONS_STORAGE_KEY, JSON.stringify(versions));
  } catch (_) {}
}

export async function saveSelectionVersion() {
  if (state.BLOCKS_DATA.length === 0) return;
  const name = await askText({
    title: '💾 Salva le scelte come versione',
    message: 'Gli esercizi scelti in tutti i blocchi verranno salvati con questo nome, per poterli richiamare con un clic (per esempio per una classe o per un alunno).',
    value: state.activeVersionName,
    placeholder: 'es. 2B completa, Versione BES',
    okLabel: '💾 Salva versione'
  });
  if (!name) return;

  const versions = getBookVersions();
  if (versions[name] && name !== state.activeVersionName) {
    const replace = await showDialog({
      title: 'Versione già esistente',
      message: `Esiste già una versione chiamata «${name}». Vuoi sostituirla con le scelte attuali?`,
      buttons: [
        { label: 'Mantieni quella esistente', value: false },
        { label: 'Sostituisci', value: true, style: 'danger' }
      ],
      cancelValue: false
    });
    if (!replace) return;
  }

  versions[name] = Object.fromEntries(state.BLOCKS_DATA.map(block => [block.filename, Array.from(getSelection(block))]));
  setBookVersions(versions);
  state.activeVersionName = name;
  renderVersionsBar();
  showNotificationToast(`📌 Versione «${name}» salvata: la ritrovi nel menu «Versione».`);
}

export function applySelectionVersion(name) {
  if (!name) {
    state.activeVersionName = '';
    renderVersionsBar();
    return;
  }
  const version = getBookVersions()[name];
  if (!version) return;

  let blocksWithoutVersion = 0;
  state.BLOCKS_DATA.forEach(block => {
    const ids = version[block.filename];
    if (Array.isArray(ids)) {
      const known = new Set(block.exercises.map(ex => ex.id));
      selectedState[block.filename] = new Set(ids.filter(id => known.has(id)));
    } else {
      selectedState[block.filename] = new Set(block.exercises.map(ex => ex.id));
      blocksWithoutVersion++;
    }
  });

  state.activeVersionName = name;
  saveSelections();
  renderSidebar();
  renderActiveBlock();
  renderVersionsBar();
  if (blocksWithoutVersion > 0) {
    showNotificationToast(`📌 Versione «${name}» applicata. ${blocksWithoutVersion} blocchi aggiunti dopo il salvataggio della versione hanno tutti gli esercizi selezionati.`, { type: 'warning', persistent: true });
  } else {
    showNotificationToast(`📌 Versione «${name}» applicata a tutti i blocchi.`);
  }
}

export async function deleteSelectionVersion() {
  const name = state.activeVersionName;
  if (!name) return;
  const confirmed = await showDialog({
    title: 'Eliminare la versione?',
    message: `La versione «${name}» verrà eliminata. Le scelte attuali degli esercizi non cambiano.`,
    buttons: [
      { label: 'Annulla', value: false },
      { label: '🗑️ Elimina versione', value: true, style: 'danger' }
    ],
    cancelValue: false
  });
  if (!confirmed) return;
  const versions = getBookVersions();
  delete versions[name];
  setBookVersions(versions);
  state.activeVersionName = '';
  renderVersionsBar();
  showNotificationToast(`🗑️ Versione «${name}» eliminata.`);
}
