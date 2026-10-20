/**
 * Editor del testo delle schede con anteprima
 */

import { ORIGINAL_FILES_CACHE, RAW_FILES_CACHE, compareFilenames, escapeHtml, isDatiLibro, state } from './state.js';
import { markdownToHtml, parseWorksheetMarkdown } from './markdown.js';
import { nextFreeBlockNumber, rebuildBlocksFromCache } from './book.js';
import { downloadMarkdownFile, showNotificationToast } from './ui.js';
import { askText, showDialog } from './dialogs.js';
import { saveBookToStorage } from './storage.js';

export let editorCurrentFile = null;
export let isEditorDirty = false;
export let editorViewMode = 'split'; // 'editor' | 'split' | 'preview'
export let editorPreviewDebounceTimer = null;

export function openMdEditor(targetBlockIdOrFilename = null) {
  if (RAW_FILES_CACHE.size === 0 && state.BLOCKS_DATA.length > 0) {
    state.BLOCKS_DATA.forEach(b => {
      if (b.filename && b.rawMarkdown) {
        RAW_FILES_CACHE.set(b.filename, b.rawMarkdown);
        if (!ORIGINAL_FILES_CACHE.has(b.filename)) {
          ORIGINAL_FILES_CACHE.set(b.filename, b.rawMarkdown);
        }
      }
    });
  }

  if (RAW_FILES_CACHE.size === 0) {
    const initialName = 'blocco_01_esercizi.md';
    const initialTemplate = getStarterWorksheetTemplate(1);
    RAW_FILES_CACHE.set(initialName, initialTemplate);
    ORIGINAL_FILES_CACHE.set(initialName, initialTemplate);
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
  loadEditorFile(targetFile, true);

  if (window.innerWidth < 1024) {
    setEditorViewMode('editor');
  } else {
    setEditorViewMode('split');
  }

  document.getElementById('editor-modal').classList.add('open');
}

export async function closeMdEditor() {
  if (isEditorDirty) {
    const choice = await showDialog({
      title: 'Modifiche non salvate',
      message: `Hai modificato «${editorFileLabel(editorCurrentFile)}» senza salvare. Che cosa vuoi fare?`,
      buttons: [
        { label: 'Continua a modificare', value: 'stay' },
        { label: 'Esci senza salvare', value: 'discard', style: 'danger' },
        { label: '✅ Salva ed esci', value: 'save', style: 'primary' }
      ],
      cancelValue: 'stay'
    });
    if (choice === 'stay') return;
    if (choice === 'save') {
      applyEditorChanges();
    } else {
      setEditorDirty(false);
    }
  }
  document.getElementById('editor-modal').classList.remove('open');
}

// Nome leggibile di una scheda nell'editor: "Dati del libro" o "Blocco N: titolo"
export function editorFileLabel(filename) {
  if (!filename) return '';
  if (isDatiLibro(filename)) return 'Dati del libro';
  const block = state.BLOCKS_DATA.find(b => b.filename === filename);
  if (block) return `Blocco ${block.blockNumber ?? block.id}: ${block.title}`;
  return filename.replace(/\.md$/i, '');
}

export function populateEditorFileSelect() {
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

  const newOpt = document.createElement('option');
  newOpt.value = '__NEW_FILE__';
  newOpt.textContent = '➕ Nuova scheda…';
  select.appendChild(newOpt);
}

export async function loadEditorFile(filename, force = false) {
  if (!force && isEditorDirty) {
    const choice = await showDialog({
      title: 'Modifiche non salvate',
      message: `Hai modificato «${editorFileLabel(editorCurrentFile)}» senza salvare. Che cosa vuoi fare prima di aprire «${editorFileLabel(filename)}»?`,
      buttons: [
        { label: 'Resta su questa scheda', value: 'stay' },
        { label: 'Cambia senza salvare', value: 'discard', style: 'danger' },
        { label: '✅ Salva e cambia', value: 'save', style: 'primary' }
      ],
      cancelValue: 'stay'
    });
    if (choice === 'stay') {
      document.getElementById('editor-file-select').value = editorCurrentFile;
      return;
    }
    if (choice === 'save') applyEditorChanges();
  }

  editorCurrentFile = filename;
  const select = document.getElementById('editor-file-select');
  if (select) select.value = filename;

  const content = RAW_FILES_CACHE.get(filename) || '';
  const textarea = document.getElementById('editor-textarea');
  if (textarea) {
    textarea.value = content;
    textarea.scrollTop = 0;
  }

  setEditorDirty(false);
  updateEditorStats();
  renderEditorLivePreview();
}

export async function handleEditorFileSelectChange(selectedVal) {
  if (selectedVal !== '__NEW_FILE__') {
    loadEditorFile(selectedVal);
    return;
  }

  const select = document.getElementById('editor-file-select');
  const nextNum = nextFreeBlockNumber();
  const answer = await askText({
    title: '➕ Nuova scheda',
    message: 'Numero del blocco della nuova scheda. Verrà creata partendo dal modello standard, che potrai poi modificare.',
    value: String(nextNum),
    placeholder: 'es. 3',
    okLabel: 'Crea la scheda'
  });
  const number = answer ? parseInt(answer, 10) : NaN;
  if (!Number.isInteger(number) || number < 1) {
    if (answer) showNotificationToast('⚠️ Scrivi un numero di blocco valido, ad esempio 3.', { type: 'warning', persistent: true });
    select.value = editorCurrentFile;
    return;
  }

  const cleanName = `blocco_${String(number).padStart(2, '0')}_esercizi.md`;
  if (RAW_FILES_CACHE.has(cleanName)) {
    showNotificationToast(`ℹ️ Il Blocco ${number} esiste già: lo apro per modificarlo.`);
    populateEditorFileSelect();
    loadEditorFile(cleanName);
    return;
  }

  const starterTemplate = getStarterWorksheetTemplate(number);
  RAW_FILES_CACHE.set(cleanName, starterTemplate);
  if (!ORIGINAL_FILES_CACHE.has(cleanName)) {
    ORIGINAL_FILES_CACHE.set(cleanName, starterTemplate);
  }

  populateEditorFileSelect();
  await loadEditorFile(cleanName, true);
  setEditorDirty(true);
  showNotificationToast(`➕ Creata la scheda del Blocco ${number} dal modello standard: completala e premi «Salva modifiche».`);
}

export function handleEditorInput() {
  setEditorDirty(true);
  updateEditorStats();
  clearTimeout(editorPreviewDebounceTimer);
  editorPreviewDebounceTimer = setTimeout(renderEditorLivePreview, 150);
}

export function setEditorDirty(dirty) {
  isEditorDirty = dirty;
  const badge = document.getElementById('editor-dirty-badge');
  if (badge) {
    badge.style.display = dirty ? 'inline-flex' : 'none';
  }
}

export function updateEditorStats() {
  const textarea = document.getElementById('editor-textarea');
  const statsEl = document.getElementById('editor-stats');
  if (!textarea || !statsEl) return;

  const val = textarea.value;
  const chars = val.length;
  const lines = val ? val.split('\n').length : 0;
  statsEl.textContent = `${lines} righe · ${chars.toLocaleString('it-IT')} caratteri`;
}

// Live preview fedele alla scheda di stampa (senza doppia intestazione)
export function renderEditorLivePreview() {
  const textarea = document.getElementById('editor-textarea');
  const preview = document.getElementById('editor-preview-content');
  if (!textarea || !preview) return;

  const content = textarea.value;
  if (!content.trim()) {
    preview.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 3rem;">L\'anteprima apparirà qui mentre modifichi il testo...</div>';
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
      <div class="doc-title">SCHEDA DIDATTICA (ANTEPRIMA LIVE)</div>
      <div class="doc-subtitle">${escapeHtml(state.globalBookTitle)} — ${escapeHtml(parsed.title)}</div>
      <div class="student-fields">
        <div class="student-field-line"><strong>Nome e Cognome:</strong> ____________________________________</div>
        <div class="student-field-line"><strong>Classe:</strong> ____________</div>
        <div class="student-field-line"><strong>Data:</strong> ____________</div>
      </div>
    </div>
    ${parsed.welcomeNote ? `<div class="doc-welcome">${escapeHtml(parsed.welcomeNote).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="doc-content">
      ${exercisesHtml}
    </div>
    ${teacherHtml}
  `;
}

export function setEditorViewMode(mode) {
  editorViewMode = mode;
  document.querySelectorAll('.editor-view-switcher .view-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-view-${mode}`)?.classList.add('active');

  const win = document.querySelector('.modal-window.editor-window');
  if (win) {
    win.classList.remove('mode-editor', 'mode-split', 'mode-preview');
    win.classList.add(`mode-${mode}`);
  }

  if (mode === 'preview' || mode === 'split') {
    renderEditorLivePreview();
  }
}

export function insertEditorSnippet(type) {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  const selectedText = val.substring(start, end);

  let replacement = '';
  let cursorOffset = 0;

  switch (type) {
    case 'bold':
      replacement = `**${selectedText || 'testo in grassetto'}**`;
      cursorOffset = selectedText ? replacement.length : 2;
      break;
    case 'italic':
      replacement = `*${selectedText || 'testo in corsivo'}*`;
      cursorOffset = selectedText ? replacement.length : 1;
      break;
    case 'h2':
      replacement = `\n\n## ${selectedText || 'Titolo Sezione'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'h3':
      replacement = `\n\n### ${selectedText || 'Sottotitolo'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'quote':
      replacement = `\n\n> ### 🌊 Titolo Citazione\n> ${selectedText || 'Inserisci qui la citazione o la frase introduttiva...'}\n`;
      cursorOffset = replacement.length;
      break;
    case 'vf_table':
      replacement = `\n\n| Affermazione | V | F |\n| :--- | :---: | :---: |\n| 1. ${selectedText || 'Prima affermazione da verificare'} | [ ] | [ ] |\n| 2. Seconda affermazione da verificare | [ ] | [ ] |\n\n**Correzione delle affermazioni false:**  \n_________________________________________________________________________________________  \n_________________________________________________________________________________________  \n`;
      cursorOffset = replacement.length;
      break;
    case 'match_table':
      replacement = `\n\n| Termine o Modo di Dire | Abbinamento | Significato Contestuale |\n| :--- | :---: | :--- |\n| 1. ${selectedText || 'Primo elemento'} | [   ] | A. Definizione mescolata |\n| 2. Secondo elemento | [   ] | B. Definizione mescolata |\n`;
      cursorOffset = replacement.length;
      break;
    case 'lines':
      replacement = `\n\n_________________________________________________________________________________________  \n_________________________________________________________________________________________  \n`;
      cursorOffset = replacement.length;
      break;
    case 'drawing':
      replacement = `\n\n[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]\n\n`;
      cursorOffset = replacement.length;
      break;
    case 'teacher_guide':
      replacement = `\n\n---\n\n### GUIDA E RIASSUNTO PER IL DOCENTE\n\n#### Riassunto sintetico dei capitoli\nSintesi degli eventi del blocco per il docente...\n\n#### Soluzioni ed elementi chiave di correzione\n- **1. Domande aperte**: Riferimenti ai passaggi chiave del testo.\n- **2. Vero o Falso**: 1. V; 2. F (correzione...).\n- **4. Laboratorio lessicale**: 1-B; 2-A.\n`;
      cursorOffset = replacement.length;
      break;
    default:
      return;
  }

  textarea.value = val.substring(0, start) + replacement + val.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + (selectedText ? replacement.length : cursorOffset);
  textarea.focus();
  handleEditorInput();
}

export function applyEditorChanges() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea || !editorCurrentFile) return;

  const content = textarea.value;
  RAW_FILES_CACHE.set(editorCurrentFile, content);
  rebuildBlocksFromCache(isDatiLibro(editorCurrentFile) ? null : editorCurrentFile);
  saveBookToStorage(true);

  setEditorDirty(false);
  showNotificationToast(`✅ Modifiche salvate: «${editorFileLabel(editorCurrentFile)}».`);
}

export function downloadCurrentEditorFile() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea || !editorCurrentFile) return;
  const content = textarea.value;
  downloadMarkdownFile(editorCurrentFile, content);
  showNotificationToast(`⬇️ Scaricata la scheda «${editorFileLabel(editorCurrentFile)}» (${editorCurrentFile}).`);
}

export async function revertEditorCurrentFile() {
  if (!editorCurrentFile || !ORIGINAL_FILES_CACHE.has(editorCurrentFile)) {
    showNotificationToast("ℹ️ Per questa scheda non c'è una versione iniziale a cui tornare.");
    return;
  }
  const confirmed = await showDialog({
    title: 'Annullare tutte le modifiche?',
    message: `«${editorFileLabel(editorCurrentFile)}» tornerà com'era quando è stata caricata. Tutte le modifiche fatte da allora andranno perse.`,
    buttons: [
      { label: 'Mantieni le modifiche', value: false },
      { label: '↩️ Annulla le modifiche', value: true, style: 'danger' }
    ],
    cancelValue: false
  });
  if (!confirmed) return;
  const original = ORIGINAL_FILES_CACHE.get(editorCurrentFile);
  const textarea = document.getElementById('editor-textarea');
  if (textarea) textarea.value = original;
  setEditorDirty(false);
  updateEditorStats();
  renderEditorLivePreview();
  applyEditorChanges();
  showNotificationToast(`↩️ «${editorFileLabel(editorCurrentFile)}» è tornata alla versione iniziale.`);
}

export function getStarterWorksheetTemplate(blockNumber = 1) {
  return `# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE
## *${state.globalBookTitle}*
### Unità Didattica ${blockNumber} (Blocco ${blockNumber}): *Capitolo A* – *Capitolo B*

---

> ### 🌊 Benvenuto nell'Unità ${blockNumber}!
> Inserisci qui una frase motivazionale o una citazione per accompagnare la lettura di questi capitoli.

---

## 1. Comprensione del Testo

### A. Domande a risposta aperta
*Rispondi in modo chiaro, argomentando le tue risposte con riferimenti al testo.*

1. **Prima domanda sul testo:**  
   Formula qui una domanda aperta di comprensione o inferenza.

   _________________________________________________________________________________________  
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

2. **Seconda domanda sui dettagli:**  
   Formula qui una seconda domanda sui personaggi o sullo sviluppo degli eventi.

   _________________________________________________________________________________________  
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

---

### B. Vero o Falso? (Attenzione ai dettagli)
*Indica se l'affermazione è Vera [V] o Falsa [F]. Se è Falsa, correggila brevemente sulle righe sottostanti.*

| Affermazione | V | F |
| :--- | :---: | :---: |
| 1. Prima affermazione da verificare | [ ] | [ ] |
| 2. Seconda affermazione da verificare | [ ] | [ ] |

**Correzione delle affermazioni false:**  
_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  

---

## 2. Analisi dei Personaggi e Riflessione
*Rifletti sulle scelte, sui sentimenti e sui comportamenti dei protagonisti.*

1. **Analisi delle motivazioni:**  
   Quali motivi spingono i personaggi a compiere determinate scelte?

   _________________________________________________________________________________________  
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

---

## 3. Officina di Scrittura Creativa ed Empatia
*Mettiti nei panni di uno dei personaggi.*

Immagina di essere uno dei protagonisti e descrivi la situazione dal tuo punto di vista in una pagina di diario o lettera.

_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  

---

## 4. Laboratorio Lessicale e Modi di Dire
*Associa ciascuna espressione al suo significato appropriato nel testo.*

| Termine o Modo di Dire | Abbinamento | Significato Contestuale |
| :--- | :---: | :--- |
| 1. Primo termine | [   ] | A. Definizione corrispondente al secondo termine |
| 2. Secondo termine | [   ] | B. Definizione corrispondente al primo termine |

---

## 5. Attività Speciale "Fuori dagli Schemi"
*Rappresenta graficamente una scena significativa o una mappa del luogo.*

[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]

---

### GUIDA E RIASSUNTO PER IL DOCENTE

#### Riassunto sintetico dei capitoli
Sintesi narrativa degli eventi chiave di questa unità per il docente...

#### Soluzioni ed elementi chiave di correzione
- **1.A Domande aperte**: Riferimenti ai passaggi chiave del testo.
- **1.B Vero o Falso**: 1. V; 2. F (correzione modello...).
- **4. Laboratorio lessicale**: 1-B; 2-A.
`;
}
