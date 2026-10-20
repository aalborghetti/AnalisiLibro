/**
 * Stato condiviso dell'applicazione, costanti e funzioni di utilità
 */

// Stato dell'applicazione
export const DEFAULT_BOOK_TITLE = "Schede Didattiche di Lettura";
export const BOOK_STORAGE_KEY = 'ANALISI_LIBRO_LAST_BOOK';
export const LOCAL_EDITS_STORAGE_KEY = 'ANALISI_LIBRO_LOCAL_EDITS';
export const selectedState = {}; // nome file -> Set degli ID degli esercizi selezionati
// Cache dei file Markdown raw (in memoria)
export const RAW_FILES_CACHE = new Map();
export const ORIGINAL_FILES_CACHE = new Map();
// Sanitizza il nome file per creare ID DOM sicuri (anche con apostrofi o spazi)
export function makeSafeId(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function isDatiLibro(filename) {
  return String(filename || '').toLowerCase() === 'dati_libro.md';
}

// Ordinamento naturale: blocco_2 prima di blocco_10
export function compareFilenames(a, b) {
  return a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' });
}

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Valori modificati da più moduli: un modulo ES non può riassegnare una variabile importata
export const state = {
  BLOCKS_DATA: [],
  currentBlockId: null,
  globalBookTitle: DEFAULT_BOOK_TITLE,
  isDsaMode: false,
  activeVersionName: '',
  saveInfo: { savedAt: null, fileSavedAt: null },
  currentBookId: null
};
