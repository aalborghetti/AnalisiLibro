/**
 * Stampa o scarica: anteprima, alta leggibilità (DSA), PDF e Word
 */

import { escapeHtml, state } from './state.js';
import { joinSelectedExercises, markdownToHtml } from './markdown.js';
import { getSelectedExercises } from './book.js';
import { showNotificationToast } from './ui.js';
import { exportOutputDocx } from './docx.js';

// Un "output" è { scope: 'block' | 'book', audience: 'student' | 'teacher' }; il formato si sceglie a parte

export const EXPORT_PREFS_STORAGE_KEY = 'ANALISI_LIBRO_EXPORT_PREFS';
export let exportChoice = { scope: 'block', audience: 'student', format: 'pdf' };
export let currentOutput = { scope: 'block', audience: 'student' }; // documento mostrato nell'anteprima

// Scelte della finestra "Stampa o scarica" e preferenza DSA ricordate tra le sessioni
export function loadExportPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(EXPORT_PREFS_STORAGE_KEY) || '{}');
    if (prefs.scope === 'block' || prefs.scope === 'book') exportChoice.scope = prefs.scope;
    if (prefs.audience === 'student' || prefs.audience === 'teacher') exportChoice.audience = prefs.audience;
    if (prefs.format === 'pdf' || prefs.format === 'word') exportChoice.format = prefs.format;
    setDsaMode(prefs.dsa === true, false);
  } catch (_) {}
}

export function saveExportPrefs() {
  try {
    localStorage.setItem(EXPORT_PREFS_STORAGE_KEY, JSON.stringify({ ...exportChoice, dsa: state.isDsaMode }));
  } catch (_) {}
}

export function setDsaMode(enabled, remember = true) {
  state.isDsaMode = !!enabled;
  const modalBody = document.getElementById('modal-content');
  if (modalBody) modalBody.classList.toggle('dsa-mode', state.isDsaMode);
  const btn = document.getElementById('btn-dsa-toggle');
  if (btn) {
    btn.classList.toggle('active', state.isDsaMode);
    btn.textContent = state.isDsaMode ? '🔤 Alta Leggibilità (DSA): ON' : '🔤 Alta Leggibilità (DSA): OFF';
  }
  const checkbox = document.getElementById('export-dsa');
  if (checkbox) checkbox.checked = state.isDsaMode;
  if (remember) saveExportPrefs();
  updateExportSummary();
}

export function toggleDsaMode() {
  setDsaMode(!state.isDsaMode);
  showNotificationToast(
    state.isDsaMode
      ? "🔤 Alta leggibilità (DSA) attivata: carattere più grande, niente corsivo e righe più ampie."
      : "🔤 Impaginazione standard ripristinata."
  );
}

export function getCurrentBlock() {
  return state.BLOCKS_DATA.find(b => b.id === state.currentBlockId) || null;
}

export function hasTeacherGuide(block) {
  return !!(block.teacherGuideMd && block.teacherGuideMd.trim());
}

// Blocchi inclusi in un output: per gli studenti quelli con esercizi scelti, per il docente quelli con la guida
export function getOutputBlocks(output) {
  const candidates = output.scope === 'book' ? state.BLOCKS_DATA : [getCurrentBlock()].filter(Boolean);
  return candidates.filter(block => output.audience === 'teacher' ? hasTeacherGuide(block) : getSelectedExercises(block).length > 0);
}

// Messaggio di errore se l'output non contiene nulla da stampare, altrimenti null
export function validateOutput(output) {
  if (state.BLOCKS_DATA.length === 0) return "Non ci sono ancora schede: segui la guida per crearle o apri un libro salvato.";
  if (getOutputBlocks(output).length > 0) return null;
  if (output.audience === 'teacher') {
    return output.scope === 'book'
      ? "Nessuna scheda del libro contiene la guida per il docente."
      : "Questa scheda non contiene la guida per il docente.";
  }
  return output.scope === 'book'
    ? "Non hai scelto nessun esercizio: spunta almeno un esercizio in una delle unità."
    : "Non hai scelto nessun esercizio per questa unità: spunta almeno un esercizio.";
}

export function describeOutput(output) {
  const blocks = getOutputBlocks(output);
  const what = output.audience === 'teacher' ? 'Guida per il docente' : 'Scheda per gli studenti';
  if (output.scope === 'book') {
    return `${what} — tutto il libro (${blocks.length} unità)`;
  }
  const block = getCurrentBlock();
  return block ? `${what} — Blocco ${block.blockNumber ?? block.id}: ${block.title}` : what;
}

export function buildStudentBlockHtml(block) {
  const selectedExercises = getSelectedExercises(block);
  const exercisesHtml = selectedExercises.length > 0
    ? joinSelectedExercises(selectedExercises, 'html')
    : `
      <div style="text-align: center; padding: 3rem; color: #64748b;">
        <h3>Nessun esercizio selezionato per questo blocco.</h3>
        <p>Torna indietro e seleziona almeno un'attività da includere nella scheda.</p>
      </div>
    `;

  return `
    <div class="student-doc-header">
      <div class="doc-title">SCHEDA DIDATTICA DI LETTURA</div>
      <div class="doc-subtitle">${escapeHtml(state.globalBookTitle)} — ${escapeHtml(block.title)}</div>
      <div class="student-fields">
        <div class="student-field-line"><strong>Nome e Cognome:</strong> ____________________________________</div>
        <div class="student-field-line"><strong>Classe:</strong> ____________</div>
        <div class="student-field-line"><strong>Data:</strong> ____________</div>
      </div>
    </div>

    ${block.welcomeNote ? `<div class="doc-welcome">${escapeHtml(block.welcomeNote).replace(/\n/g, '<br>')}</div>` : ''}

    <div class="doc-content">
      ${exercisesHtml}
    </div>

    <div style="margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 0.8rem; color: #777; text-align: center; font-family: sans-serif;">
      Scuola Secondaria di Primo Grado — Scheda di Lavoro Individuale / Coppie
    </div>
  `;
}

export function buildTeacherBlockHtml(block) {
  return `
    <div class="student-doc-header">
      <div class="doc-title">GUIDA PER IL DOCENTE & SOLUZIONI</div>
      <div class="doc-subtitle">${escapeHtml(state.globalBookTitle)} — ${escapeHtml(block.title)}</div>
    </div>
    <div class="teacher-guide-doc">
      ${markdownToHtml(block.teacherGuideMd, 'teacher-guide-section')}
    </div>
    <div style="margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 0.8rem; color: #777; text-align: center; font-family: sans-serif;">
      Documento Riservato al Docente — Sinossi e Chiavi di Correzione Complete
    </div>
  `;
}

// Ogni unità inizia su una nuova pagina
export function buildOutputHtml(output) {
  const buildBlock = output.audience === 'teacher' ? buildTeacherBlockHtml : buildStudentBlockHtml;
  return getOutputBlocks(output).map((block, idx) => {
    const blockHtml = buildBlock(block);
    return idx === 0 ? blockHtml : `<div class="page-break-block">${blockHtml}</div>`;
  }).join('\n');
}

export function openOutputPreview(output) {
  const error = validateOutput(output);
  if (error) {
    showNotificationToast(`⚠️ ${error}`, { type: 'warning', persistent: true });
    return false;
  }
  currentOutput = { scope: output.scope, audience: output.audience };
  const modalTitle = document.querySelector('#preview-modal .modal-title');
  if (modalTitle) modalTitle.textContent = `Anteprima: ${describeOutput(currentOutput)}`;
  const modalContent = document.getElementById('modal-content');
  modalContent.innerHTML = buildOutputHtml(currentOutput);
  modalContent.classList.toggle('dsa-mode', state.isDsaMode);
  modalContent.scrollTop = 0;
  document.getElementById('preview-modal').classList.add('open');
  return true;
}

export function printOutput(output) {
  if (openOutputPreview(output)) {
    setTimeout(() => { window.print(); }, 350);
  }
}

// Pulsante «Scarica Word» dell'anteprima: esporta lo stesso documento mostrato
export function exportCurrentPreviewDocx() {
  return exportOutputDocx(currentOutput);
}

export function closePrintPreview() {
  document.getElementById('preview-modal').classList.remove('open');
}

// Finestra "Stampa o scarica"
export function openExportDialog() {
  if (state.BLOCKS_DATA.length === 0) {
    showNotificationToast("⚠️ Non ci sono ancora schede: segui la guida per crearle o apri un libro salvato.", { type: 'warning', persistent: true });
    return;
  }
  renderExportChoices();
  document.getElementById('export-modal').classList.add('open');
}

export function closeExportDialog() {
  document.getElementById('export-modal').classList.remove('open');
}

export function setExportChoice(key, value) {
  exportChoice[key] = value;
  saveExportPrefs();
  renderExportChoices();
}

export function renderExportChoices() {
  document.querySelectorAll('#export-modal .choice-btn').forEach(btn => {
    const active = exportChoice[btn.dataset.key] === btn.dataset.value;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });

  const block = getCurrentBlock();
  const descBlock = document.getElementById('export-desc-block');
  if (descBlock) descBlock.textContent = block ? `Blocco ${block.blockNumber ?? block.id}: ${block.title}` : '';
  const descBook = document.getElementById('export-desc-book');
  if (descBook) descBook.textContent = `${state.BLOCKS_DATA.length} unità, ognuna su una nuova pagina`;

  const checkbox = document.getElementById('export-dsa');
  if (checkbox) checkbox.checked = state.isDsaMode;
  updateExportSummary();
}

export function updateExportSummary() {
  const summary = document.getElementById('export-summary');
  if (!summary) return;
  const goBtn = document.getElementById('export-go-btn');
  const previewBtn = document.getElementById('export-preview-btn');
  const hint = document.getElementById('export-print-hint');
  const isPdf = exportChoice.format === 'pdf';

  if (goBtn) goBtn.textContent = isPdf ? '🖨️ Stampa / Salva PDF' : '📄 Scarica Word';
  if (hint) hint.style.display = isPdf ? '' : 'none';

  const error = validateOutput(exportChoice);
  summary.classList.toggle('warning', !!error);
  if (goBtn) goBtn.disabled = !!error;
  if (previewBtn) previewBtn.disabled = !!error;
  if (error) {
    summary.textContent = `⚠️ ${error}`;
    return;
  }

  const blocks = getOutputBlocks(exportChoice);
  let text = describeOutput(exportChoice);
  if (exportChoice.audience === 'student') {
    const count = blocks.reduce((sum, b) => sum + getSelectedExercises(b).length, 0);
    text += ` · ${count} ${count === 1 ? 'esercizio scelto' : 'esercizi scelti'}`;
  }
  if (exportChoice.scope === 'book' && blocks.length < state.BLOCKS_DATA.length) {
    const skipped = state.BLOCKS_DATA.length - blocks.length;
    text += exportChoice.audience === 'teacher'
      ? ` · ${skipped} senza guida docente (saltate)`
      : ` · ${skipped} senza esercizi scelti (saltate)`;
  }
  text += isPdf ? ' · stampa o PDF' : ' · file Word';
  if (state.isDsaMode) text += ' · alta leggibilità';
  summary.textContent = text;
}

export function runExport(action) {
  const output = { scope: exportChoice.scope, audience: exportChoice.audience };
  if (validateOutput(output)) {
    updateExportSummary();
    return;
  }
  closeExportDialog();
  if (action === 'preview') {
    openOutputPreview(output);
  } else if (exportChoice.format === 'pdf') {
    printOutput(output);
  } else {
    exportOutputDocx(output);
  }
}

window.addEventListener('beforeprint', () => {
  document.documentElement.classList.add('is-printing');
  document.body.classList.add('is-printing');
  const modalContent = document.getElementById('modal-content');
  if ((!modalContent || !modalContent.innerHTML.trim()) && state.BLOCKS_DATA.length > 0) {
    openOutputPreview(currentOutput);
  }
});

window.addEventListener('afterprint', () => {
  document.documentElement.classList.remove('is-printing');
  document.body.classList.remove('is-printing');
});
