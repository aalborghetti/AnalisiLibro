/**
 * Visualizzazione anteprima completa delle schede e dei dati del libro
 */

import { RAW_FILES_CACHE, compareFilenames, escapeHtml, isDatiLibro, state } from './state.js';
import { markdownToHtml, parseWorksheetMarkdown } from './markdown.js';
import { downloadMarkdownFile, showNotificationToast } from './ui.js';

let editorCurrentFile = null;

export function openMdEditor(targetBlockIdOrFilename = null) {
  if (RAW_FILES_CACHE.size === 0 && state.BLOCKS_DATA.length > 0) {
    state.BLOCKS_DATA.forEach(b => {
      if (b.filename && b.rawMarkdown) {
        RAW_FILES_CACHE.set(b.filename, b.rawMarkdown);
      }
    });
  }

  if (RAW_FILES_CACHE.size === 0 && state.BLOCKS_DATA.length === 0) {
    showNotificationToast("Apri prima un libro o trascina le schede per visualizzarne l'anteprima.", { type: 'warning' });
    return;
  }

  let targetFile = null;
  if (typeof targetBlockIdOrFilename === 'number' || (targetBlockIdOrFilename !== null && !isNaN(targetBlockIdOrFilename))) {
    const b = state.BLOCKS_DATA.find(x => x.id === Number(targetBlockIdOrFilename));
    if (b) targetFile = b.filename;
  } else if (typeof targetBlockIdOrFilename === 'string' && RAW_FILES_CACHE.has(targetBlockIdOrFilename)) {
    targetFile = targetBlockIdOrFilename;
  }

  if (!targetFile && state.currentBlockId) {
    const b = state.BLOCKS_DATA.find(x => x.id === state.currentBlockId);
    if (b) targetFile = b.filename;
  }

  if (!targetFile) {
    const keys = Array.from(RAW_FILES_CACHE.keys()).sort(compareFilenames);
    const firstBlock = keys.find(k => k.toLowerCase() !== 'dati_libro.md') || keys[0];
    targetFile = firstBlock;
  }

  populateEditorFileSelect();
  loadEditorFile(targetFile);

  document.getElementById('editor-modal').classList.add('open');
}

export function closeMdEditor() {
  document.getElementById('editor-modal').classList.remove('open');
}

// Nome leggibile di una scheda: "Dati del libro" o "Blocco N: titolo"
export function editorFileLabel(filename) {
  if (!filename) return '';
  if (isDatiLibro(filename)) return 'Dati del libro';
  const block = state.BLOCKS_DATA.find(b => b.filename === filename);
  if (block) return `Blocco ${block.blockNumber ?? block.id}: ${block.title}`;
  return filename.replace(/\.md$/i, '');
}

function populateEditorFileSelect() {
  const select = document.getElementById('editor-file-select');
  if (!select) return;

  select.innerHTML = '';

  const keys = Array.from(RAW_FILES_CACHE.keys()).sort(compareFilenames);

  const datiLibro = keys.find(k => k.toLowerCase() === 'dati_libro.md');
  if (datiLibro) {
    const opt = document.createElement('option');
    opt.value = datiLibro;
    opt.textContent = '📖 Dati del libro';
    select.appendChild(opt);
  }

  const blocks = keys.filter(k => k.toLowerCase() !== 'dati_libro.md');
  blocks.forEach(filename => {
    const opt = document.createElement('option');
    opt.value = filename;
    opt.textContent = `📑 ${editorFileLabel(filename)}`;
    opt.title = filename;
    select.appendChild(opt);
  });
}

function loadEditorFile(filename) {
  editorCurrentFile = filename;
  const select = document.getElementById('editor-file-select');
  if (select) select.value = filename;

  renderEditorLivePreview();
}

export function handleEditorFileSelectChange(selectedVal) {
  loadEditorFile(selectedVal);
}

// Anteprima fedele della scheda
function renderEditorLivePreview() {
  const preview = document.getElementById('editor-preview-content');
  if (!preview) return;

  const content = (editorCurrentFile && RAW_FILES_CACHE.get(editorCurrentFile)) || '';
  if (!content.trim()) {
    preview.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 3rem;">Nessun contenuto disponibile per questa scheda.</div>';
    return;
  }

  if (editorCurrentFile && editorCurrentFile.toLowerCase() === 'dati_libro.md') {
    preview.innerHTML = `
      <div class="student-doc-header">
        <div class="doc-title">DATI GENERALI DEL LIBRO</div>
      </div>
      ${markdownToHtml(content, 'doc-section')}
    `;
    return;
  }

  const parsed = parseWorksheetMarkdown(editorCurrentFile || 'scheda.md', content);
  const exercisesHtml = parsed.exercises.length > 0
    ? parsed.exercises.map(ex => ex.contentHtml).join('\n')
    : markdownToHtml(content, 'doc-section');

  const teacherHtml = parsed.teacherGuideMd
    ? `
      <div style="margin: 2.5rem 0 1.25rem; padding: 0.65rem 1rem; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; color: #166534; font-weight: 700; font-family: sans-serif; font-size: 0.85rem;">
        📘 SEZIONE RISERVATA: GUIDA PER IL DOCENTE & SOLUZIONI
      </div>
      <div class="teacher-guide-doc">
        ${markdownToHtml(parsed.teacherGuideMd, 'teacher-guide-section')}
      </div>
    `
    : '';

  preview.innerHTML = `
    <div class="student-doc-header">
      <div class="doc-title">SCHEDA DIDATTICA (ANTEPRIMA)</div>
      <div class="doc-subtitle">${escapeHtml(state.globalBookTitle)} — ${escapeHtml(parsed.title)}</div>
    </div>
    ${parsed.welcomeNote ? `<div class="doc-welcome">${escapeHtml(parsed.welcomeNote).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="doc-content">
      ${exercisesHtml}
    </div>
    ${teacherHtml}
  `;
}

export function downloadCurrentEditorFile() {
  if (!editorCurrentFile) return;
  const content = RAW_FILES_CACHE.get(editorCurrentFile) || '';
  downloadMarkdownFile(editorCurrentFile, content);
}
