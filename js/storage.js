/**
 * Salvataggio: browser, file di lavoro, I miei libri, schede pronte
 */

import { BOOK_STORAGE_KEY, LOCAL_EDITS_STORAGE_KEY, RAW_FILES_CACHE, compareFilenames, selectedState, state } from './state.js';
import { getAllRawWorksheets, loadRawWorksheets, selectWorksheetFiles } from './book.js';
import { downloadBlob, showNotificationToast } from './ui.js';
import { showDialog } from './dialogs.js';
import { deleteBookData, getBookVersions, renderVersionsBar, restoreSelections, saveSelections, setBookVersions } from './versions.js';

// Salva l'insieme di file nel browser (ultimo libro + archivio «I miei libri");
// "locallyEdited" indica modifiche non presenti sul sito, "fromFile" che il contenuto coincide con un file
export function saveBookToStorage(locallyEdited, { fromFile = false } = {}) {
  try {
    localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(getAllRawWorksheets()));
    if (locallyEdited) {
      localStorage.setItem(LOCAL_EDITS_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(LOCAL_EDITS_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Storage quota superata o disattivata", err);
    showNotificationToast("⚠️ Il browser non ha più spazio per salvare le schede: usa «💾 Salva lavoro» per non perdere le modifiche.", { type: 'warning', persistent: true });
  }
  state.saveInfo.savedAt = Date.now();
  if (fromFile) state.saveInfo.fileSavedAt = state.saveInfo.savedAt;
  writeSaveInfo();
  libraryPutCurrentBook(locallyEdited);
  renderSaveStatus();
}

export function readBookFromStorage() {
  try {
    const saved = localStorage.getItem(BOOK_STORAGE_KEY);
    if (!saved) return null;
    const data = JSON.parse(saved);
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      worksheets: data,
      locallyEdited: localStorage.getItem(LOCAL_EDITS_STORAGE_KEY) === '1',
      bookId: localStorage.getItem(BOOK_ID_STORAGE_KEY)
    };
  } catch (err) {
    console.warn("Storage non accessibile", err);
    return null;
  }
}

export const SAVE_INFO_STORAGE_KEY = 'ANALISI_LIBRO_SAVE_INFO';
export function readSaveInfo() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_INFO_STORAGE_KEY) || '{}');
    state.saveInfo = { savedAt: data.savedAt || null, fileSavedAt: data.fileSavedAt || null };
  } catch (_) {}
}

export function writeSaveInfo() {
  try {
    localStorage.setItem(SAVE_INFO_STORAGE_KEY, JSON.stringify(state.saveInfo));
  } catch (_) {}
}

export function isLocallyEdited() {
  try {
    return localStorage.getItem(LOCAL_EDITS_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function formatSaveTime(timestamp) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString()) return `oggi alle ${time}`;
  return `il ${date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} alle ${time}`;
}

// Riga sotto il titolo: quando è stato salvato nel browser e se manca un file di lavoro aggiornato
export function renderSaveStatus() {
  const el = document.getElementById('app-save-status');
  if (!el) return;
  if (RAW_FILES_CACHE.size === 0 || !state.saveInfo.savedAt) {
    el.textContent = '';
    el.classList.remove('warn');
    return;
  }
  const fileUpToDate = state.saveInfo.fileSavedAt && state.saveInfo.fileSavedAt >= state.saveInfo.savedAt;
  el.textContent = `💾 Salvato in questo browser ${formatSaveTime(state.saveInfo.savedAt)}` +
    (fileUpToDate ? ' · copia di sicurezza aggiornata' : ' · ultime modifiche non ancora salvate in un file');
  el.classList.toggle('warn', !fileUpToDate);
  el.title = fileUpToDate ? '' : "Usa «💾 Salva lavoro» per conservare una copia in un file: il salvataggio nel browser si perde se si cancellano i dati di navigazione o si cambia computer.";
}

// --- I miei libri: archivio dei libri nel browser (IndexedDB) ---

export const LIBRARY_DB_NAME = 'analisi-libro';
export const LIBRARY_STORE = 'books';
export let libraryDbPromise = null;

export function openLibraryDb() {
  if (!libraryDbPromise) {
    libraryDbPromise = new Promise(resolve => {
      try {
        const request = indexedDB.open(LIBRARY_DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  }
  return libraryDbPromise;
}

// Esegue un'operazione sull'archivio; restituisce null se l'archivio non è disponibile
export async function libraryRequest(mode, operation) {
  const db = await openLibraryDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(LIBRARY_STORE, mode);
      const request = operation(tx.objectStore(LIBRARY_STORE));
      tx.oncomplete = () => resolve(request ? request.result ?? true : true);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

// --- Identificativo stabile del libro aperto: non cambia se cambia il titolo in dati_libro.md ---

export const BOOK_ID_STORAGE_KEY = 'ANALISI_LIBRO_BOOK_ID';
export let bookIdReady = Promise.resolve();

export function newBookId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return `libro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Usa l'identificativo indicato; altrimenti quello di un libro dell'archivio con lo stesso titolo
// (riaprendo la stessa cartella non si crea un doppione), altrimenti uno nuovo
// Un libro dell'archivio viene riconosciuto come lo stesso solo se il titolo coincide e i file aperti
// comprendono tutti quelli già salvati: un'importazione parziale non sovrascrive mai un libro più completo
export async function assignBookId(preferredId, { forceNew = false } = {}) {
  let id = preferredId || null;
  if (!id && !forceNew) {
    const books = await libraryListBooks();
    const openFiles = new Set(RAW_FILES_CACHE.keys());
    const sameBook = books && books.find(book =>
      book.title === state.globalBookTitle && (book.worksheets || []).every(item => openFiles.has(item.filename)));
    id = sameBook ? sameBook.id : null;
  }
  if (!id) id = newBookId();
  state.currentBookId = id;
  try {
    localStorage.setItem(BOOK_ID_STORAGE_KEY, id);
  } catch (_) {}
  renderVersionsBar();
  restoreSelections();
  return id;
}

export function setCurrentBook(preferredId, options = {}) {
  state.currentBookId = preferredId || null;
  bookIdReady = assignBookId(preferredId, options);
  return bookIdReady;
}

export async function libraryPutCurrentBook(locallyEdited) {
  if (RAW_FILES_CACHE.size === 0) return;
  await bookIdReady;
  if (!state.currentBookId) await setCurrentBook(null);
  await libraryRequest('readwrite', store => store.put({
    id: state.currentBookId,
    title: state.globalBookTitle,
    worksheets: getAllRawWorksheets(),
    blocks: state.BLOCKS_DATA.length,
    savedAt: state.saveInfo.savedAt,
    fileSavedAt: state.saveInfo.fileSavedAt,
    locallyEdited: !!locallyEdited
  }));
}

export async function libraryListBooks() {
  const books = await libraryRequest('readonly', store => store.getAll());
  return Array.isArray(books) ? books.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)) : null;
}

export async function openLibraryModal(focusSection = null) {
  const modal = document.getElementById('library-modal');
  if (!modal) return;
  modal.classList.add('open');
  renderLibraryList();
  renderRepositoryList();
  if (focusSection === 'repository') {
    setTimeout(() => document.getElementById('library-repository-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
}

export function closeLibraryModal() {
  const modal = document.getElementById('library-modal');
  if (modal) modal.classList.remove('open');
}

export function libraryMessage(container, text) {
  container.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'library-empty';
  p.textContent = text;
  container.appendChild(p);
}

export function libraryItem(titleText, metaText, actions, isCurrent = false) {
  const row = document.createElement('div');
  row.className = `library-item${isCurrent ? ' current' : ''}`;
  const info = document.createElement('div');
  info.className = 'library-item-info';
  const title = document.createElement('strong');
  title.textContent = titleText;
  const meta = document.createElement('span');
  meta.textContent = metaText;
  info.append(title, meta);
  const buttons = document.createElement('div');
  buttons.className = 'library-item-actions';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-sm ${a.primary ? 'btn-primary' : 'btn-secondary'}`;
    btn.textContent = a.label;
    btn.disabled = !!a.disabled;
    btn.addEventListener('click', a.onClick);
    buttons.appendChild(btn);
  });
  row.append(info, buttons);
  return row;
}

export async function renderLibraryList() {
  const container = document.getElementById('library-list');
  if (!container) return;
  libraryMessage(container, 'Caricamento…');
  const books = await libraryListBooks();
  if (books === null) {
    libraryMessage(container, "Questo browser non permette di salvare i libri (succede ad esempio nella navigazione privata). Usa «💾 Salva lavoro» per conservare il lavoro in un file.");
    return;
  }
  if (books.length === 0) {
    libraryMessage(container, 'Nessun libro salvato: i libri compariranno qui appena crei o apri delle schede.');
    return;
  }
  container.innerHTML = '';
  await bookIdReady;
  const currentId = RAW_FILES_CACHE.size > 0 ? state.currentBookId : null;
  books.forEach(book => {
    const isCurrent = book.id === currentId;
    const meta = `${book.blocks || 0} unità · salvato ${book.savedAt ? formatSaveTime(book.savedAt) : '—'}${isCurrent ? ' · aperto ora' : ''}`;
    container.appendChild(libraryItem(book.title, meta, [
      { label: isCurrent ? 'Aperto' : '📖 Apri', primary: !isCurrent, disabled: isCurrent, onClick: () => openLibraryBook(book.id) },
      { label: '🗑️ Elimina', onClick: () => deleteLibraryBook(book) }
    ], isCurrent));
  });
}

export async function openLibraryBook(id) {
  const books = await libraryListBooks();
  const book = books && books.find(b => b.id === id);
  if (!book) return;
  loadRawWorksheets(book.worksheets, null, { bookId: book.id });
  try {
    localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(getAllRawWorksheets()));
    if (book.locallyEdited) {
      localStorage.setItem(LOCAL_EDITS_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(LOCAL_EDITS_STORAGE_KEY);
    }
  } catch (_) {}
  state.saveInfo = { savedAt: book.savedAt || Date.now(), fileSavedAt: book.fileSavedAt || null };
  writeSaveInfo();
  renderSaveStatus();
  closeLibraryModal();
  showNotificationToast(`📖 Aperto «${book.title}».`);
}

export async function deleteLibraryBook(book) {
  const confirmed = await showDialog({
    title: 'Eliminare il libro dal browser?',
    message: `«${book.title}» verrà eliminato dai libri salvati in questo browser. Le copie salvate in un file con «💾 Salva lavoro» non vengono toccate.`,
    buttons: [
      { label: 'Annulla', value: false },
      { label: '🗑️ Elimina', value: true, style: 'danger' }
    ],
    cancelValue: false
  });
  if (!confirmed) return;
  await libraryRequest('readwrite', store => store.delete(book.id));
  deleteBookData(book.id);
  renderLibraryList();
  showNotificationToast(`🗑️ «${book.title}» eliminato dal browser.`);
}

// --- File di lavoro (.zip): un unico file per libro, con schede e versioni salvate ---

export async function saveWorkFile() {
  if (RAW_FILES_CACHE.size === 0) {
    showNotificationToast("⚠️ Non c'è ancora nessuna scheda da salvare.", { type: 'warning', persistent: true });
    return;
  }
  if (typeof JSZip === 'undefined') {
    showNotificationToast("❌ Salvataggio non disponibile: libreria JSZip non caricata.", { type: 'error', persistent: true });
    return;
  }

  try {
    const files = getAllRawWorksheets();
    const zip = new JSZip();
    const folder = zip.folder('schede_esercizi');
    files.forEach(file => folder.file(file.filename, file.markdown));
    folder.file('manifest.json', JSON.stringify(files.map(file => file.filename), null, 2) + '\n');
    await bookIdReady;
    zip.file('libro.json', JSON.stringify({ id: state.currentBookId, titolo: state.globalBookTitle }, null, 2) + '\n');
    const selections = Object.fromEntries(state.BLOCKS_DATA.map(block => [block.filename, Array.from(selectedState[block.filename] || [])]));
    zip.file('selezioni.json', JSON.stringify({ libro: state.globalBookTitle, selezioni: selections }, null, 2) + '\n');
    const versions = getBookVersions();
    if (Object.keys(versions).length > 0) {
      zip.file('versioni.json', JSON.stringify({ libro: state.globalBookTitle, versioni: versions }, null, 2) + '\n');
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const safeTitle = String(state.globalBookTitle).replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'Schede';
    const fileName = `${safeTitle}_lavoro.zip`;
    downloadBlob(blob, fileName);

    state.saveInfo.fileSavedAt = Date.now();
    if (!state.saveInfo.savedAt) state.saveInfo.savedAt = state.saveInfo.fileSavedAt;
    writeSaveInfo();
    libraryPutCurrentBook(isLocallyEdited());
    renderSaveStatus();
    showNotificationToast(`💾 Lavoro salvato nel file «${fileName}» (di solito nella cartella Download). Conservalo: potrai riaprirlo da «📚 I miei libri».`, { persistent: true });
  } catch (err) {
    console.error(err);
    showNotificationToast("❌ Non è stato possibile creare il file di lavoro.", { type: 'error', persistent: true });
  }
}

// Apre un file di lavoro .zip (anche le cartelle schede_esercizi/ compresse a mano)
export async function openWorkZip(fileOrBlob, sourceName) {
  if (typeof JSZip === 'undefined') {
    showNotificationToast("❌ Apertura non disponibile: libreria JSZip non caricata.", { type: 'error', persistent: true });
    return false;
  }
  try {
    const zip = await JSZip.loadAsync(fileOrBlob);
    const entries = Object.values(zip.files).filter(entry => !entry.dir && !/(^|\/)__MACOSX\//.test(entry.name));
    const mdEntries = entries
      .filter(entry => /\.md$/i.test(entry.name))
      .map(entry => ({ name: entry.name.split('/').pop(), entry }));
    const chosen = selectWorksheetFiles(mdEntries);
    if (chosen.length === 0) {
      await showDialog({
        title: 'Nessuna scheda trovata',
        message: `Il file «${sourceName}» non contiene schede. Per salvare e riaprire il lavoro usa sempre il file creato con «💾 Salva lavoro».`
      });
      return false;
    }

    const worksheets = await Promise.all(chosen.map(async f => ({ filename: f.name, markdown: await f.entry.async('string') })));
    worksheets.sort((a, b) => compareFilenames(a.filename, b.filename));

    let bookId = null;
    const bookEntry = entries.find(entry => /(^|\/)libro\.json$/i.test(entry.name));
    if (bookEntry) {
      try {
        const data = JSON.parse(await bookEntry.async('string'));
        if (data && typeof data.id === 'string' && data.id.trim()) bookId = data.id.trim();
      } catch (_) {}
    }
    loadRawWorksheets(worksheets, null, { bookId });
    await bookIdReady;

    const versionsEntry = entries.find(entry => /(^|\/)versioni\.json$/i.test(entry.name));
    if (versionsEntry) {
      try {
        const data = JSON.parse(await versionsEntry.async('string'));
        if (data && data.versioni && typeof data.versioni === 'object') {
          setBookVersions({ ...getBookVersions(), ...data.versioni });
          renderVersionsBar();
        }
      } catch (_) {}
    }

    const selectionsEntry = entries.find(entry => /(^|\/)selezioni\.json$/i.test(entry.name));
    if (selectionsEntry) {
      try {
        const data = JSON.parse(await selectionsEntry.async('string'));
        if (data && data.selezioni && typeof data.selezioni === 'object') {
          restoreSelections(data.selezioni);
          saveSelections();
        }
      } catch (_) {}
    }

    saveBookToStorage(false, { fromFile: true });
    showNotificationToast(`📂 Aperto «${sourceName}»: ${state.BLOCKS_DATA.length} unità.`);
    return true;
  } catch (err) {
    console.error(err);
    showNotificationToast(`❌ Impossibile aprire «${sourceName}»: non sembra un file di lavoro valido.`, { type: 'error', persistent: true });
    return false;
  }
}

// --- Schede pronte: file .zip pubblicati nella cartella schede/ del repository ---

export const REPOSITORY_FOLDER = 'schede';
export let repositoryListCache = null;

// Sito GitHub Pages: <utente>.github.io/<repository>/ oppure sito utente <utente>.github.io
export function detectGithubRepository() {
  const hostMatch = window.location.hostname.toLowerCase().match(/^([a-z0-9-]+)\.github\.io$/);
  if (!hostMatch) return null;
  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
  const isProjectSite = firstSegment && !/\.[a-z0-9]+$/i.test(firstSegment);
  return { owner: hostMatch[1], name: isProjectSite ? firstSegment : `${hostMatch[1]}.github.io` };
}

// Elenco degli zip: da schede/elenco.json se presente, altrimenti dall'API pubblica di GitHub
export async function fetchRepositoryZips() {
  if (window.location.protocol === 'file:') return { files: [], unavailable: true };

  try {
    const res = await fetch(`${REPOSITORY_FOLDER}/elenco.json`, { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.files) ? data.files : []);
      return { files: list.filter(name => typeof name === 'string' && /\.zip$/i.test(name)).map(name => ({ name, size: null })) };
    }
  } catch (_) {}

  const repo = detectGithubRepository();
  if (!repo) return { files: [], unavailable: true };
  try {
    const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${REPOSITORY_FOLDER}`, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (res.status === 404) return { files: [] };
    if (!res.ok) return { files: [], unavailable: true };
    const items = await res.json();
    return {
      files: (Array.isArray(items) ? items : [])
        .filter(item => item.type === 'file' && /\.zip$/i.test(item.name))
        .map(item => ({ name: item.name, size: item.size }))
    };
  } catch (_) {
    return { files: [], unavailable: true };
  }
}

export function prettyZipName(name) {
  return name.replace(/\.zip$/i, '').replace(/_lavoro$/i, '').replace(/[_-]+/g, ' ').trim();
}

export async function renderRepositoryList() {
  const container = document.getElementById('repository-list');
  if (!container) return;
  libraryMessage(container, 'Caricamento…');
  if (!repositoryListCache) repositoryListCache = await fetchRepositoryZips();
  const { files, unavailable } = repositoryListCache;

  if (files.length === 0) {
    libraryMessage(container, unavailable
      ? "L'elenco delle schede pronte è disponibile solo nella versione online del sito."
      : "Non ci sono ancora schede pronte. Per pubblicarne una: salva il lavoro con «💾 Salva lavoro» e carica il file .zip nella cartella «schede» del repository.");
    return;
  }
  container.innerHTML = '';
  files.sort((a, b) => compareFilenames(a.name, b.name)).forEach(file => {
    const meta = file.size ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : file.name;
    container.appendChild(libraryItem(prettyZipName(file.name), meta, [
      { label: '📖 Apri', primary: true, onClick: () => openRepositoryZip(file.name) }
    ]));
  });
}

export async function openRepositoryZip(name) {
  try {
    showNotificationToast(`⏳ Apertura di «${prettyZipName(name)}»...`);
    const res = await fetch(`${REPOSITORY_FOLDER}/${encodeURIComponent(name)}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (await openWorkZip(blob, name)) closeLibraryModal();
  } catch (err) {
    console.error(err);
    showNotificationToast(`❌ Impossibile scaricare «${name}» dal sito. Riprova tra qualche minuto.`, { type: 'error', persistent: true });
  }
}
