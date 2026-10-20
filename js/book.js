/**
 * Libro aperto: caricamento dei file, blocchi, selezione degli esercizi
 */

import { DEFAULT_BOOK_TITLE, ORIGINAL_FILES_CACHE, RAW_FILES_CACHE, compareFilenames, isDatiLibro, selectedState, state } from './state.js';
import { parseWorksheetMarkdown } from './markdown.js';
import { renderActiveBlock, renderSidebar, showEmptyState, showNotificationToast } from './ui.js';
import { showDialog } from './dialogs.js';
import { renderVersionsBar, saveSelections } from './versions.js';
import { editorFileLabel } from './editor.js';
import { openWorkZip, renderSaveStatus, saveBookToStorage, setCurrentBook } from './storage.js';

// Titolo del libro: da dati_libro.md, altrimenti dal sottotitolo "## *Titolo* di Autore" della prima scheda
export function extractBookTitle(worksheets) {
  const datiLibroItem = worksheets.find(item => isDatiLibro(item.filename));
  if (datiLibroItem) {
    const tMatch = datiLibroItem.markdown.match(/\*{0,2}Titolo\*{0,2}:\*{0,2}\s*(.+)$/mi);
    const aMatch = datiLibroItem.markdown.match(/\*{0,2}Autore\*{0,2}:\*{0,2}\s*(.+)$/mi);
    const t = tMatch ? tMatch[1].replace(/\*/g, '').trim() : '';
    const a = aMatch ? aMatch[1].replace(/\*/g, '').trim() : '';
    if (t) {
      return a ? `${t} di ${a}` : t;
    }
  }

  for (const item of worksheets) {
    if (isDatiLibro(item.filename)) continue;
    const h2 = item.markdown.match(/^##\s+(?![0-9]+\.)(.+)$/m);
    if (h2) {
      const t = h2[1].replace(/\*/g, '').trim();
      if (t && !t.startsWith('[')) return t;
    }
  }
  return DEFAULT_BOOK_TITLE;
}

// Sostituisce completamente l'insieme di file caricato (nuova cartella, sito, localStorage).
// "originalsArray" indica le versioni da usare per "Annulla tutte le modifiche" (es. quelle pubblicate sul sito);
// "bookId" è l'identificativo del libro se già noto (archivio, file di lavoro), altrimenti viene cercato o creato;
// "newBook" forza un nuovo identificativo (il docente ha scelto di aprire le schede come un libro nuovo)
export function loadRawWorksheets(worksheetsArray, originalsArray = null, { bookId = null, newBook = false } = {}) {
  RAW_FILES_CACHE.clear();
  ORIGINAL_FILES_CACHE.clear();
  Object.keys(selectedState).forEach(key => delete selectedState[key]);
  state.BLOCKS_DATA = [];
  state.currentBlockId = null;
  state.activeVersionName = '';
  state.currentBookId = null; // le scelte del libro precedente non vanno salvate sul nuovo

  (worksheetsArray || []).forEach(item => {
    RAW_FILES_CACHE.set(item.filename, item.markdown);
    ORIGINAL_FILES_CACHE.set(item.filename, item.markdown);
  });
  (originalsArray || []).forEach(item => {
    if (RAW_FILES_CACHE.has(item.filename)) {
      ORIGINAL_FILES_CACHE.set(item.filename, item.markdown);
    }
  });

  rebuildBlocksFromCache();
  setCurrentBook(bookId, { forceNew: newBook });
}

// Ricostruisce i blocchi dalla cache dei file conservando le selezioni degli esercizi già noti;
// gli esercizi nuovi (es. aggiunti nell'editor) vengono selezionati di default
export function rebuildBlocksFromCache(focusFilename = null) {
  const previousBlocks = new Map(state.BLOCKS_DATA.map(b => [b.filename, b]));
  const currentBlock = state.BLOCKS_DATA.find(b => b.id === state.currentBlockId);
  const targetFilename = focusFilename || (currentBlock ? currentBlock.filename : null);

  const worksheets = getAllRawWorksheets();
  state.globalBookTitle = extractBookTitle(worksheets);

  state.BLOCKS_DATA = worksheets
    .filter(item => !isDatiLibro(item.filename))
    .map((item, index) => {
      const parsed = parseWorksheetMarkdown(item.filename, item.markdown);
      parsed.id = index + 1;

      const previous = previousBlocks.get(item.filename);
      const previousSelection = selectedState[item.filename];
      if (previous && previousSelection) {
        const knownIds = new Set(previous.exercises.map(ex => ex.id));
        selectedState[item.filename] = new Set(
          parsed.exercises.filter(ex => !knownIds.has(ex.id) || previousSelection.has(ex.id)).map(ex => ex.id)
        );
      } else {
        selectedState[item.filename] = new Set(parsed.exercises.map(ex => ex.id));
      }
      return parsed;
    });

  Object.keys(selectedState).forEach(key => {
    if (!state.BLOCKS_DATA.some(b => b.filename === key)) delete selectedState[key];
  });

  if (state.BLOCKS_DATA.length === 0) {
    state.currentBlockId = null;
    showEmptyState();
    renderSaveStatus();
    return;
  }

  const focused = state.BLOCKS_DATA.find(b => b.filename === targetFilename);
  state.currentBlockId = focused ? focused.id : state.BLOCKS_DATA[0].id;

  const dropzone = document.getElementById('dropzone-banner');
  if (dropzone) dropzone.style.display = 'none';
  const hero = document.getElementById('block-hero');
  if (hero) hero.style.display = 'flex';
  const toolbar = document.getElementById('selection-toolbar');
  if (toolbar) toolbar.style.display = 'flex';
  const grid = document.getElementById('exercises-grid');
  if (grid) grid.style.display = 'flex';

  document.getElementById('app-book-title').textContent = state.globalBookTitle;
  document.getElementById('app-book-subtitle').textContent = `${state.BLOCKS_DATA.length} unità didattiche`;
  document.getElementById('blocks-count-badge').textContent = `${state.BLOCKS_DATA.length} Unità`;

  renderSidebar();
  renderActiveBlock();
  renderVersionsBar();
  renderSaveStatus();
  saveSelections();
}

export async function fetchServerWorksheets() {
  if (window.location.protocol === 'file:') return [];

  const worksheets = [];
  try {
    let fileList = [];

    // 1. Prova prima a recuperare la lista dei file da manifest.json
    try {
      const manifestRes = await fetch('schede_esercizi/manifest.json');
      if (manifestRes.ok) {
        const manifestData = await manifestRes.json();
        if (Array.isArray(manifestData)) {
          fileList = manifestData;
        } else if (manifestData && Array.isArray(manifestData.files)) {
          fileList = manifestData.files;
        }
      }
    } catch (_) {}

    if (fileList.length > 0) {
      const fetchPromises = fileList.map(async (filename) => {
        try {
          const res = await fetch(`schede_esercizi/${encodeURIComponent(filename)}`);
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().length > 0) {
              return { filename, markdown: text };
            }
          }
        } catch (_) {}
        return null;
      });
      const results = await Promise.all(fetchPromises);
      worksheets.push(...results.filter(Boolean));
    } else {
      // 2. Fallback sequenziale: si ferma al primo blocco mancante (massimo 30 blocchi)
      try {
        const datiRes = await fetch('schede_esercizi/dati_libro.md');
        if (datiRes.ok) {
          const text = await datiRes.text();
          if (text && text.trim().length > 0) {
            worksheets.push({ filename: 'dati_libro.md', markdown: text });
          }
        }
      } catch (_) {}

      for (let i = 1; i <= 30; i++) {
        const filename = `blocco_${String(i).padStart(2, '0')}_esercizi.md`;
        try {
          const res = await fetch(`schede_esercizi/${filename}`);
          if (!res.ok) break; // Interrompe immediatamente il ciclo al primo blocco non trovato
          const text = await res.text();
          if (text && text.trim().length > 0) {
            worksheets.push({ filename, markdown: text });
          } else {
            break;
          }
        } catch (_) {
          break;
        }
      }
    }
  } catch (_) {}

  worksheets.sort((a, b) => compareFilenames(a.filename, b.filename));
  return worksheets;
}

// File di documentazione del repository da non trattare come schede
export const NON_WORKSHEET_FILES = new Set(['readme.md', 'prompt.md', 'contesto_didattico.md', 'security.md', 'changelog.md', 'license.md']);

// Filtra la selezione: se ci sono file "blocco_XX..." tiene solo quelli e dati_libro.md,
// altrimenti tutti i .md tranne la documentazione; scarta i nomi duplicati (sottocartelle)
export function selectWorksheetFiles(files) {
  const mdFiles = files.filter(f => f.name.toLowerCase().endsWith('.md'));
  const isBlockFile = f => /^blocco_?[0-9]+.*\.md$/i.test(f.name);
  const candidates = mdFiles.some(isBlockFile)
    ? mdFiles.filter(f => isBlockFile(f) || isDatiLibro(f.name))
    : mdFiles.filter(f => !NON_WORKSHEET_FILES.has(f.name.toLowerCase()));

  const seen = new Set();
  const unique = candidates.filter(f => {
    const key = f.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const ignored = mdFiles.length - unique.length;
  if (ignored > 0 && unique.length > 0) {
    showNotificationToast(`ℹ️ ${ignored} file non sono stati caricati perché non sono schede (es. README) o hanno un nome ripetuto.`, { type: 'warning', persistent: true });
  }
  return unique;
}

// Gestisce i file scelti o trascinati: un file di lavoro .zip oppure schede .md (anche da una cartella)
export function handleFolderSelect(fileList) {
  if (!fileList || fileList.length === 0) return;
  const all = Array.from(fileList);
  const zips = all.filter(f => f.name.toLowerCase().endsWith('.zip'));
  if (zips.length > 0) {
    if (zips.length > 1) {
      showNotificationToast(`ℹ️ Hai scelto ${zips.length} file .zip: viene aperto solo «${zips[0].name}».`, { type: 'warning', persistent: true });
    }
    openWorkZip(zips[0], zips[0].name);
    return;
  }
  const files = selectWorksheetFiles(all);
  if (files.length === 0) {
    showDialog({
      title: 'Nessuna scheda trovata',
      message: 'Tra i file scelti non ci sono schede. Apri il file di lavoro (.zip) creato con «💾 Salva lavoro», oppure i file delle schede (.md).'
    });
    return;
  }
  processMdFiles(files);
}

// Legge i file .md scelti o trascinati e li importa (vedi importWorksheetFiles)
export function processMdFiles(files) {
  const readers = files.map(file => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(expandImportedFile(file.name, e.target.result));
    reader.onerror = () => resolve([]);
    reader.readAsText(file, 'utf-8');
  }));
  return Promise.all(readers).then(results => importWorksheetFiles(results.flat()));
}

export function sanitizeImportedFilename(name) {
  let clean = String(name || '')
    .replace(/\\_/g, '_')           // underscore "escapati" dal Markdown dell'AI
    .replace(/[`*]/g, '')
    .trim()
    .replace(/^.*[\\/]/, '')
    .replace(/[^\w.\-]/g, '_');
  if (!clean || clean === '.md') return '';
  if (!/\.md$/i.test(clean)) clean += '.md';
  return clean;
}

// Righe "[[FILE: nome.md]]" e "[[FINE]]" che il prompt chiede all'AI per delimitare i file
const FILE_MARKER_REGEX = /^[ \t]*\\?\[\\?\[\s*(FILE\s*:\s*([^\]\n]+?)|FINE)\s*\\?\]\\?\][ \t]*$/gim;

// Divide un testo che contiene più file:
// 1) righe "[[FILE: nome.md]]" ... "[[FINE]]" richieste dal prompt;
// 2) in loro assenza, i titoli "# Dati del Libro" e "# SCHEDA DIDATTICA ..."
export function splitMarkedFiles(text) {
  const clean = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/^[ \t]*```[a-zA-Z]*[ \t]*$/gm, '');
  const files = [];

  const boundaries = [...clean.matchAll(FILE_MARKER_REGEX)];
  if (boundaries.some(b => b[2])) {
    boundaries.forEach((b, idx) => {
      if (!b[2]) return; // [[FINE]] chiude soltanto il file precedente
      const start = b.index + b[0].length;
      const end = idx + 1 < boundaries.length ? boundaries[idx + 1].index : clean.length;
      const filename = sanitizeImportedFilename(b[2]);
      const body = clean.slice(start, end).trim();
      if (filename && body) files.push({ filename, markdown: body + '\n' });
    });
    return files;
  }

  const headRegex = /^#\s+(?:Dati\s+del\s+Libro|SCHEDA\s+DIDATTICA)[^\n]*$/gim;
  const heads = [...clean.matchAll(headRegex)];
  let nextBlock = nextFreeBlockNumber();
  heads.forEach((head, idx) => {
    const end = idx + 1 < heads.length ? heads[idx + 1].index : clean.length;
    const body = clean.slice(head.index, end).trim();
    if (/^#\s+Dati\s+del\s+Libro/i.test(head[0])) {
      files.push({ filename: 'dati_libro.md', markdown: body + '\n' });
    } else {
      const numMatch = body.match(/^###\s+(?:Unità\s+Didattica|[^\n]*Blocco)\s+([0-9]+)/mi);
      const blockNumber = numMatch ? parseInt(numMatch[1], 10) : nextBlock++;
      files.push({ filename: `blocco_${String(blockNumber).padStart(2, '0')}_esercizi.md`, markdown: body + '\n' });
    }
  });
  return files;
}

// Un file .md importato resta un file solo, a meno che contenga le righe [[FILE: …]] o più schede
// (es. la prima risposta dell'AI, con dati del libro e Blocco 1, salvata in un unico file)
export function expandImportedFile(filename, text) {
  const hasMarkers = [...String(text || '').matchAll(FILE_MARKER_REGEX)].some(m => m[2]);
  const parts = splitMarkedFiles(text);
  if (hasMarkers || parts.length > 1) return parts;
  const markdown = String(text || '').replace(/\r\n?/g, '\n').replace(FILE_MARKER_REGEX, '').trim() + '\n';
  return [{ filename, markdown }];
}

// Schede importate da file: con un libro aperto il docente sceglie se aggiungerle o aprirle come nuovo libro
export async function importWorksheetFiles(worksheets) {
  const byName = new Map();
  worksheets.forEach(item => byName.set(item.filename, item)); // a parità di nome vale l'ultimo file
  const files = [...byName.values()].sort((a, b) => compareFilenames(a.filename, b.filename));
  if (files.length === 0) {
    await showDialog({
      title: 'Nessuna scheda trovata',
      message: 'I file scelti non contengono schede. Importa i file .md salvati dalle risposte dell\'AI (es. dati_libro.md, blocco_01_esercizi.md) oppure il file di lavoro .zip creato con «💾 Salva lavoro».'
    });
    return false;
  }

  if (RAW_FILES_CACHE.size > 0) {
    const incomingTitle = extractBookTitle(files);
    const sameBook = incomingTitle === DEFAULT_BOOK_TITLE || incomingTitle === state.globalBookTitle;
    const choice = await showDialog({
      title: 'Dove vuoi importare le schede?',
      message: sameBook
        ? `Le schede scelte sembrano del libro aperto («${state.globalBookTitle}»). Vuoi aggiungerle a questo libro o aprirle come un libro nuovo?`
        : `Le schede scelte sembrano di un altro libro («${incomingTitle}»), diverso da quello aperto («${state.globalBookTitle}»). Come vuoi aprirle?`,
      buttons: [
        { label: 'Annulla', value: null },
        { label: '📖 Apri come nuovo libro', value: 'new', style: sameBook ? 'secondary' : 'primary' },
        { label: '➕ Aggiungi al libro aperto', value: 'add', style: sameBook ? 'primary' : 'secondary' }
      ],
      cancelValue: null
    });
    if (!choice) return false;
    if (choice === 'add') {
      if (!(await mergeWorksheetsIntoBook(files))) return false;
      const added = files.map(f => editorFileLabel(f.filename)).join(', ');
      showNotificationToast(`➕ Aggiunte ${files.length} schede a «${state.globalBookTitle}»: ${added}. Ricorda di chiedere all'AI il blocco successivo e di salvare il lavoro.`, { persistent: true });
      return true;
    }
    loadRawWorksheets(files, null, { newBook: true });
  } else {
    loadRawWorksheets(files);
  }
  saveBookToStorage(false, { fromFile: true });
  showNotificationToast(`📂 Aperte ${state.BLOCKS_DATA.length} unità didattiche.`);
  return true;
}

// Aggiunge (o sostituisce, dopo conferma) schede nel libro aperto; false se il docente annulla
export async function mergeWorksheetsIntoBook(files) {
  const replaced = files.filter(f => RAW_FILES_CACHE.has(f.filename));
  if (replaced.length > 0) {
    const labels = replaced.map(f => `• ${editorFileLabel(f.filename)}`).join('\n');
    const confirmed = await showDialog({
      title: 'Alcune schede esistono già',
      message: `Queste schede sono già presenti e verranno sostituite dalla nuova versione:\n${labels}`,
      buttons: [
        { label: 'Annulla', value: false },
        { label: 'Sostituisci', value: true, style: 'primary' }
      ],
      cancelValue: false
    });
    if (!confirmed) return false;
  }

  // Primo contenuto di un nuovo libro: nessun file di lavoro ancora salvato e nuovo identificativo
  const isNewBook = RAW_FILES_CACHE.size === 0;
  if (isNewBook) state.saveInfo = { savedAt: null, fileSavedAt: null };

  let focusFilename = null;
  files.forEach(f => {
    RAW_FILES_CACHE.set(f.filename, f.markdown);
    if (!ORIGINAL_FILES_CACHE.has(f.filename)) {
      ORIGINAL_FILES_CACHE.set(f.filename, f.markdown);
    }
    if (!isDatiLibro(f.filename)) focusFilename = f.filename;
  });

  rebuildBlocksFromCache(focusFilename);
  if (isNewBook) setCurrentBook(null);
  saveBookToStorage(true);
  return true;
}

export async function getFilesFromDataTransferItems(items) {
  const fileEntries = [];
  const queue = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry();
      if (entry) queue.push(entry);
    } else if (item.getAsFile) {
      const f = item.getAsFile();
      if (f && /\.(md|zip)$/i.test(f.name)) fileEntries.push(f);
    }
  }

  while (queue.length > 0) {
    const entry = queue.shift();
    if (entry.isFile) {
      if (/\.(md|zip)$/i.test(entry.name)) {
        await new Promise((resolve) => {
          entry.file(f => {
            fileEntries.push(f);
            resolve();
          }, () => resolve());
        });
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise((resolve) => {
        dirReader.readEntries(entries => resolve(entries), () => resolve([]));
      });
      for (const child of entries) {
        queue.push(child);
      }
    }
  }

  return fileEntries;
}

// Selezione corrente di un blocco (tutti gli esercizi se non ancora definita)
export function getSelection(block) {
  if (!selectedState[block.filename]) {
    selectedState[block.filename] = new Set(block.exercises.map(ex => ex.id));
  }
  return selectedState[block.filename];
}

export function getSelectedExercises(block) {
  const selection = getSelection(block);
  return block.exercises.filter(ex => selection.has(ex.id));
}

export function getAllRawWorksheets() {
  const list = [];
  RAW_FILES_CACHE.forEach((markdown, filename) => {
    list.push({ filename, markdown });
  });
  list.sort((a, b) => compareFilenames(a.filename, b.filename));
  return list;
}

export function nextFreeBlockNumber() {
  const numbers = state.BLOCKS_DATA.map(b => b.blockNumber || 0);
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
