/**
 * Generatore Schede Didattiche - Logica Client-Side (GitHub Pages & Locale)
 * Parser Markdown universale, selezione esercizi, anteprima e stampa PDF
 */

// Stato dell'applicazione
let BLOCKS_DATA = [];
let currentBlockId = null;
const selectedState = {};
let globalBookTitle = "Schede Didattiche di Lettura";
let globalBookAuthor = "";

// Cache dei file Markdown raw (in memoria)
const RAW_FILES_CACHE = new Map();
const ORIGINAL_FILES_CACHE = new Map();
let editorCurrentFile = null;
let isEditorDirty = false;
let editorViewMode = 'split'; // 'editor' | 'split' | 'preview'
let editorPreviewDebounceTimer = null;

// 1. Markdown Parser per Schede Didattiche
function parseWorksheetMarkdown(filename, rawMd) {
  const lines = rawMd.split('\n');
  let bookTitle = "";
  let blockTitle = "";
  let welcomeNote = "";
  
  // Separa i contenuti dello studente dalla guida docente
  let studentMd = rawMd;
  let teacherGuideMd = "";
  const teacherSplitRegex = /#{1,3}\s*(?:[0-9]+\.\s*)?(?:GUIDA\s+E\s+RIASSUNTO\s+PER\s+IL\s+DOCENTE|Riassunto\s+per\s+il\s+docente|Guida\s+per\s+il\s+docente)/i;
  const teacherParts = rawMd.split(teacherSplitRegex);
  if (teacherParts.length > 1) {
    studentMd = teacherParts[0];
    teacherGuideMd = teacherParts[1];
  }

  // Titolo del libro gestito centralmente da dati_libro.md
  bookTitle = globalBookTitle;

  // Ricava il titolo del blocco da "### Titolo..." o dal primo H1
  const blockMatch = rawMd.match(/^###\s+(?:Unità\s+Didattica\s+[0-9]+|Blocco\s+[0-9]+|[^\n]+:\s*)(.+)$/m) || rawMd.match(/^#\s+(.+)$/m);
  if (blockMatch) {
    blockTitle = blockMatch[1].replace(/\*/g, '').trim();
  } else {
    blockTitle = filename.replace(/\.md$/, '');
  }

  // Citazione introduttiva ("> ...")
  const quoteMatch = rawMd.match(/^>\s+([\s\S]*?)(?=\n\s*\n\s*---|\n\s*#{2,3})/m);
  if (quoteMatch) {
    welcomeNote = quoteMatch[1].replace(/^>\s*/gm, '').replace(/###\s*/g, '').trim();
  }

  // Suddivisione esercizi in sezioni
  const exercises = [];
  const sectionRegex = /^#{2,3}\s+([0-9]+\.\s+[^#\n]+)/gm;
  let match;
  const sectionIndices = [];
  
  while ((match = sectionRegex.exec(studentMd)) !== null) {
    sectionIndices.push({
      title: match[1].trim(),
      start: match.index
    });
  }

  for (let i = 0; i < sectionIndices.length; i++) {
    const current = sectionIndices[i];
    const nextStart = (i + 1 < sectionIndices.length) ? sectionIndices[i + 1].start : studentMd.length;
    const sectionChunk = studentMd.substring(current.start, nextStart).trim();
    
    const titleLower = current.title.toLowerCase();
    let type = "comprensione";
    let typeLabel = "Comprensione del Testo";
    let defaultSelected = true;

    if (titleLower.includes("vero o falso") || titleLower.includes("v/f")) {
      type = "vf";
      typeLabel = "Vero o Falso";
    } else if (titleLower.includes("comprensione")) {
      type = "comprensione";
      typeLabel = "Comprensione del Testo";
      defaultSelected = true;
    } else if (titleLower.includes("analisi") || titleLower.includes("personagg")) {
      type = "analisi";
      typeLabel = "Analisi Personaggi";
      defaultSelected = true;
    } else if (titleLower.includes("scrittura") || titleLower.includes("officina") || titleLower.includes("immedesimazione") || titleLower.includes("empatia")) {
      type = "scrittura";
      typeLabel = "Officina di Scrittura";
      defaultSelected = true;
    } else if (titleLower.includes("lessico") || titleLower.includes("linguaggio") || titleLower.includes("parole")) {
      type = "lessico";
      typeLabel = "Laboratorio Lessicale";
      defaultSelected = true;
    } else if (titleLower.includes("speciale") || titleLower.includes("schemi") || titleLower.includes("estemporane") || titleLower.includes("compito di realtà")) {
      type = "speciale";
      typeLabel = "Attività Speciale";
      defaultSelected = true;
    }

    // Sezione combinata Analisi del Personaggio + Scrittura Creativa
    const analSplitRegex = /(?:###\s+B\.\s+|####\s+(?:Spazio\s+)?Scrittura)/i;
    if (type === "analisi" && analSplitRegex.test(sectionChunk)) {
      const parts = sectionChunk.split(analSplitRegex);
      if (parts.length > 1) {
        exercises.push({
          id: `${filename}_sec_${i}_a`,
          type: "analisi",
          typeLabel: "Analisi Personaggi",
          title: "Analisi del Personaggio e Riflessione",
          desc: "Riflessione sui conflitti interiori e sulle scelte etiche.",
          defaultSelected: true,
          contentHtml: markdownToHtml(parts[0])
        });
        exercises.push({
          id: `${filename}_sec_${i}_b`,
          type: "scrittura",
          typeLabel: "Officina di Scrittura",
          title: "Spunto di Scrittura Creativa ed Empatia",
          desc: "Traccia di immedesimazione personale o monologo interiore.",
          defaultSelected: true,
          contentHtml: markdownToHtml("### Scrittura Creativa ed Empatia\n" + parts[1])
        });
        continue;
      }
    }

    exercises.push({
      id: `${filename}_sec_${i}`,
      type: type,
      typeLabel: typeLabel,
      title: current.title.replace(/^[0-9]+\.\s*/, ''),
      desc: "Esercizio tratto dalla scheda didattica del blocco.",
      defaultSelected: defaultSelected,
      contentHtml: markdownToHtml(sectionChunk)
    });
  }

  let chaptersInfo = "";
  const capMatch = blockTitle.match(/:\s*(.+)$/);
  if (capMatch) {
    chaptersInfo = capMatch[1];
  }

  return {
    filename: filename,
    bookTitle: bookTitle,
    title: blockTitle,
    chapters: chaptersInfo || filename.replace(/\.md$/, ''),
    welcomeNote: welcomeNote,
    teacherGuideMd: teacherGuideMd,
    exercises: exercises,
    rawMarkdown: rawMd
  };
}

// Formattatore Markdown -> HTML con filtri di pulizia
function markdownToHtml(md, wrapperClass = 'doc-section') {
  let h = md;
  // Pulizia artefatti: blocchi ```, righe di ===, +---+, e ---
  h = h.replace(/^[ \t]*```[a-zA-Z]*[ \t]*$/gm, '');
  h = h.replace(/^[ \t]*={5,}[ \t]*$/gm, '');
  h = h.replace(/^[ \t]*\+[-+]+\+[ \t]*$/gm, '');
  h = h.replace(/^[ \t]*-{3,}[ \t]*$/gm, '');
  // Riquadri grafici per spazi disegno
  h = h.replace(/(?:^[ \t]*\|[ \t]*)?\[\s*SPAZIO PER (?:IL TUO )?(?:RILIEVO GRAFICO|DISEGNO)[^\]]*\](?:[ \t]*\|)?/gmi, '<div class="drawing-box"><div class="drawing-box-label">✏️ Spazio riservato al disegno / rilievo grafico</div></div>');
  h = h.replace(/^[ \t]*\|[ \t]*\|[ \t]*$/gm, '');

  // Titoli
  h = h.replace(/^#{1,2}\s+(.+)$/gm, '<div class="doc-section-title">$1</div>');
  h = h.replace(/^###\s+(.+)$/gm, '<h3 style="font-size: 1.05rem; font-weight:700; margin: 1rem 0 0.5rem; font-family:sans-serif;">$1</h3>');
  h = h.replace(/^####\s+(.+)$/gm, '<h4 style="font-size: 0.95rem; font-weight:700; margin: 0.8rem 0 0.4rem; font-family:sans-serif;">$1</h4>');
  // Grassetto e corsivo
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Frecce e simboli
  h = h.replace(/\$\\rightarrow\$/g, '→');
  h = h.replace(/\\rightarrow/g, '→');
  h = h.replace(/-->/g, '→');
  h = h.replace(/\$\\leftarrow\$/g, '←');
  h = h.replace(/\\leftarrow/g, '←');
  h = h.replace(/<--/g, '←');
  // Righe di quaderno per risposta scritta
  h = h.replace(/(?:_{5,}\s*)+/g, '<div class="write-lines"><div class="write-line"></div><div class="write-line"></div></div>');
  
  // Tabelle Markdown
  h = h.replace(/((?:^[ \t]*\|.+\|[ \t]*(?:\r?\n|$))+)/gm, function(tableBlock) {
    const rawLines = tableBlock.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
    if (rawLines.length === 0) return tableBlock;

    const blockTextLower = tableBlock.toLowerCase();
    const isMatchingTable = blockTextLower.includes('corrispondenza') || blockTextLower.includes('[') || blockTextLower.includes('abbinamento');

    let theadHtml = '';
    let tbodyHtml = '';
    let isFirst = true;

    rawLines.forEach(line => {
      if (line.includes('---')) return;

      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) return;

      if (isFirst) {
        isFirst = false;
        const ths = cells.map((cellText, idx) => {
          let cls = '';
          if (isMatchingTable) {
            if (idx === 0) cls = ' class="col-term"';
            else if (idx === 1) cls = ' class="col-match"';
            else if (idx === 2) cls = ' class="col-def"';
          }
          return `<th${cls}>${cellText}</th>`;
        }).join('');
        theadHtml = `<thead><tr>${ths}</tr></thead>`;
      } else {
        const tds = cells.map((cellText, idx) => {
          let cls = '';
          let formatted = cellText;
          if (isMatchingTable) {
            if (idx === 0) cls = ' class="col-term"';
            else if (idx === 1) {
              cls = ' class="col-match"';
              formatted = formatted.replace(/(?:<strong>)?\[\s*(&nbsp;)?\s*\](?:<\/strong>)?/g, '<span class="matching-box">[ &nbsp;&nbsp; ]</span>');
            } else if (idx === 2) cls = ' class="col-def"';
          }
          return `<td${cls}>${formatted}</td>`;
        }).join('');
        tbodyHtml += `<tr>${tds}</tr>`;
      }
    });

    const tableClass = isMatchingTable ? 'table-matching' : 'vf-table';
    return `<div class="table-responsive"><table class="${tableClass}">${theadHtml}<tbody>${tbodyHtml}</tbody></table></div>`;
  });

  // Liste puntate
  h = h.replace(/^[ \t]*[-*]\s+\[\s*([xX\s]?)\s*\]\s+(.+)$/gm, '<div style="margin: 0.35rem 0; padding-left: 0.5rem;"><strong>[ $1 ]</strong> $2</div>');
  h = h.replace(/^[ \t]*[-*]\s+(.+)$/gm, '<li style="margin-left: 1.25rem; margin-bottom: 0.25rem;">$1</li>');

  // Paragrafi
  const rawParagraphs = h.split(/\n\s*\n/);
  const cleanP = rawParagraphs.map(p => {
    p = p.trim();
    if (!p || p.startsWith('<div') || p.startsWith('<table') || p.startsWith('<h3')) return p;
    return `<p style="margin-bottom: 0.65rem;">${p.replace(/\n/g, '<br>')}</p>`;
  });

  return `<div class="${wrapperClass}">${cleanP.join('\n')}</div>`;
}

// 2. Caricamento e Parsing dei Dataset (in memoria)
function loadRawWorksheets(worksheetsArray) {
  if (!worksheetsArray || worksheetsArray.length === 0) {
    showEmptyState();
    return;
  }

  // Popola la cache dei file raw in memoria
  RAW_FILES_CACHE.clear();
  worksheetsArray.forEach(item => {
    RAW_FILES_CACHE.set(item.filename, item.markdown);
    if (!ORIGINAL_FILES_CACHE.has(item.filename)) {
      ORIGINAL_FILES_CACHE.set(item.filename, item.markdown);
    }
  });

  // 1. Recupero diretto dei metadati da 'dati_libro.md'
  const datiLibroItem = worksheetsArray.find(item => item.filename && item.filename.toLowerCase() === 'dati_libro.md');
  if (datiLibroItem) {
    const tMatch = datiLibroItem.markdown.match(/\*{0,2}Titolo\*{0,2}:\*{0,2}\s*(.+)$/mi);
    const aMatch = datiLibroItem.markdown.match(/\*{0,2}Autore\*{0,2}:\*{0,2}\s*(.+)$/mi);
    const t = tMatch ? tMatch[1].replace(/\*/g, '').trim() : '';
    const a = aMatch ? aMatch[1].replace(/\*/g, '').trim() : '';
    if (t) {
      globalBookTitle = a ? `${t} di ${a}` : t;
    }
  } else {
    globalBookTitle = "Schede Didattiche di Lettura";
  }

  BLOCKS_DATA = [];
  // Escludi dati_libro.md dai blocchi didattici degli esercizi
  const exerciseSheets = worksheetsArray.filter(item => !item.filename || item.filename.toLowerCase() !== 'dati_libro.md');

  if (exerciseSheets.length === 0) {
    showEmptyState();
    return;
  }

  exerciseSheets.forEach((item, index) => {
    const parsed = parseWorksheetMarkdown(item.filename, item.markdown);
    parsed.id = index + 1;
    BLOCKS_DATA.push(parsed);

    // Seleziona di default TUTTI gli esercizi per ogni blocco (o preserva se già esistente)
    if (!selectedState[parsed.id] || selectedState[parsed.id].size === 0) {
      selectedState[parsed.id] = new Set(
        parsed.exercises.map(ex => ex.id)
      );
    }
  });

  // Mostra i componenti principali e nascondi il banner dropzone
  const dropzone = document.getElementById('dropzone-banner');
  if (dropzone) dropzone.style.display = 'none';
  const hero = document.getElementById('block-hero');
  if (hero) hero.style.display = 'flex';
  const toolbar = document.getElementById('selection-toolbar');
  if (toolbar) toolbar.style.display = 'flex';
  const grid = document.getElementById('exercises-grid');
  if (grid) grid.style.display = 'flex';

  // Aggiorna l'intestazione
  document.getElementById('app-book-title').textContent = globalBookTitle;
  document.getElementById('app-book-subtitle').textContent = `Caricate ${BLOCKS_DATA.length} unità didattiche (${exerciseSheets.length} file elaborati)`;
  document.getElementById('blocks-count-badge').textContent = `${BLOCKS_DATA.length} Unità`;

  // Seleziona il blocco attivo
  if (!currentBlockId || !BLOCKS_DATA.some(b => b.id === currentBlockId)) {
    currentBlockId = BLOCKS_DATA[0].id;
  }
  renderSidebar();
  renderActiveBlock();
}

function showEmptyState() {
  const dropzone = document.getElementById('dropzone-banner');
  if (dropzone) dropzone.style.display = 'block';
  const hero = document.getElementById('block-hero');
  if (hero) hero.style.display = 'none';
  const toolbar = document.getElementById('selection-toolbar');
  if (toolbar) toolbar.style.display = 'none';
  const grid = document.getElementById('exercises-grid');
  if (grid) grid.style.display = 'none';
  const list = document.getElementById('blocks-list');
  if (list) list.innerHTML = '<div style="padding: 1.5rem 1rem; color: #94a3b8; font-size: 0.85rem; text-align: center;">Nessun blocco caricato.<br>Carica la cartella <code>schede_esercizi/</code>.</div>';
  document.getElementById('app-book-title').textContent = "Generatore Schede Didattiche & PDF";
  document.getElementById('app-book-subtitle').innerHTML = "Carica la cartella <code>schede_esercizi/</code> per iniziare";
  document.getElementById('blocks-count-badge').textContent = "0 Unità";
}

// Notifiche Toast
function showNotificationToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'app-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// 3. Caricamento Silenzioso all'Avvio (schede_esercizi/)
async function tryAutoLoadFromServer() {
  try {
    let fileList = [];

    // Prova prima a recuperare la lista dei file da manifest.json
    try {
      const manifestRes = await fetch('schede_esercizi/manifest.json');
      if (manifestRes.ok) {
        const manifestData = await manifestRes.json();
        if (Array.isArray(manifestData)) {
          fileList = manifestData;
        } else if (manifestData.files && Array.isArray(manifestData.files)) {
          fileList = manifestData.files;
        }
      }
    } catch (_) {}

    // Fallback su probing automatico
    if (!fileList || fileList.length === 0) {
      fileList = ['dati_libro.md'];
      for (let i = 1; i <= 30; i++) {
        fileList.push(`blocco_${String(i).padStart(2, '0')}_esercizi.md`);
      }
    }

    // Scarica i file presenti in parallelo
    const fetchPromises = fileList.map(async (filename) => {
      try {
        const res = await fetch(`schede_esercizi/${filename}`);
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
    const worksheets = results.filter(Boolean);

    if (worksheets.length > 0) {
      worksheets.sort((a, b) => a.filename.localeCompare(b.filename));
      loadRawWorksheets(worksheets);
      try {
        localStorage.setItem('ANALISI_LIBRO_LAST_BOOK', JSON.stringify(worksheets));
      } catch (_) {}
      return true;
    }
  } catch (_) {}

  return false;
}

// 4. Gestione File e Cartelle Locali (File API & FileReader)
function handleFolderSelect(fileList) {
  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.md'));
  if (files.length === 0) {
    alert("Nessun file Markdown (.md) trovato nella selezione.");
    return;
  }
  processMdFiles(files);
}

function processMdFiles(files) {
  const worksheets = [];
  let readCount = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      worksheets.push({
        filename: file.name,
        markdown: e.target.result
      });
      readCount++;
      if (readCount === files.length) {
        worksheets.sort((a, b) => a.filename.localeCompare(b.filename));
        loadRawWorksheets(worksheets);
        try {
          localStorage.setItem('ANALISI_LIBRO_LAST_BOOK', JSON.stringify(worksheets));
        } catch (err) {
          console.warn("Storage quota superata o disattivata", err);
        }
      }
    };
    reader.onerror = function() {
      readCount++;
      if (readCount === files.length) {
        worksheets.sort((a, b) => a.filename.localeCompare(b.filename));
        loadRawWorksheets(worksheets);
      }
    };
    reader.readAsText(file, 'utf-8');
  });
}

// Supporto Drag & Drop ricorsivo per intere cartelle
async function getFilesFromDataTransferItems(items) {
  const fileEntries = [];
  const queue = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry();
      if (entry) queue.push(entry);
    } else if (item.getAsFile) {
      const f = item.getAsFile();
      if (f && f.name.toLowerCase().endsWith('.md')) fileEntries.push(f);
    }
  }

  while (queue.length > 0) {
    const entry = queue.shift();
    if (entry.isFile) {
      if (entry.name.toLowerCase().endsWith('.md')) {
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

// 4. UI Rendering
function renderSidebar() {
  const container = document.getElementById('blocks-list');
  container.innerHTML = '';

  BLOCKS_DATA.forEach(block => {
    const selectedCount = selectedState[block.id] ? selectedState[block.id].size : 0;
    const totalCount = block.exercises.length;
    const isActive = block.id === currentBlockId;

    const el = document.createElement('div');
    el.className = `block-item ${isActive ? 'active' : ''}`;
    el.onclick = () => selectBlock(block.id);

    el.innerHTML = `
      <div class="block-item-top">
        <span class="block-badge">BLOCCO ${block.id}</span>
        <span class="selection-counter">${selectedCount}/${totalCount} scelti</span>
      </div>
      <div class="block-title">${block.title}</div>
      <div class="block-chapters">📁 ${block.filename}</div>
    `;
    container.appendChild(el);
  });
}

function selectBlock(id) {
  currentBlockId = id;
  renderSidebar();
  renderActiveBlock();
  
  // Su dispositivi mobili, centra dolcemente il blocco attivo nella barra orizzontale
  if (window.innerWidth <= 900) {
    setTimeout(() => {
      const activeEl = document.querySelector('.block-item.active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 50);
  }
}

function renderActiveBlock() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return;

  document.getElementById('hero-title').textContent = block.title;
  document.getElementById('hero-meta').innerHTML = `
    <span>📖 <strong>File:</strong> ${block.filename}</span>
    <span>📑 <strong>Esercizi disponibili:</strong> ${block.exercises.length}</span>
  `;
  document.getElementById('hero-summary').textContent = block.welcomeNote || "Seleziona gli esercizi che intendi includere nella scheda di lavoro per gli studenti.";

  updateSelectionBadge();

  const grid = document.getElementById('exercises-grid');
  grid.innerHTML = '';

  if (block.exercises.length === 0) {
    grid.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Nessun esercizio rilevato in questo file.</div>`;
    return;
  }

  block.exercises.forEach(ex => {
    const isSelected = selectedState[block.id].has(ex.id);
    const card = document.createElement('div');
    card.className = `exercise-card ${isSelected ? 'selected' : ''}`;
    card.onclick = (e) => {
      if (e.target.tagName.toLowerCase() !== 'input') {
        toggleExercise(ex.id);
      }
    };

    let tagClass = 'tag-comprensione';
    if (ex.type === 'vf') tagClass = 'tag-vf';
    if (ex.type === 'analisi') tagClass = 'tag-analisi';
    if (ex.type === 'scrittura') tagClass = 'tag-scrittura';
    if (ex.type === 'lessico') tagClass = 'tag-lessico';
    if (ex.type === 'speciale') tagClass = 'tag-speciale';

    card.innerHTML = `
      <div class="exercise-checkbox-wrapper">
        <input type="checkbox" class="custom-checkbox" ${isSelected ? 'checked' : ''} onchange="toggleExercise('${ex.id}')">
      </div>
      <div class="exercise-body">
        <div class="exercise-header">
          <span class="exercise-tag ${tagClass}">${ex.typeLabel}</span>
        </div>
        <div class="exercise-title">${ex.title}</div>
        <div class="exercise-desc">${ex.desc}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function toggleExercise(exerciseId) {
  const set = selectedState[currentBlockId];
  if (set.has(exerciseId)) {
    set.delete(exerciseId);
  } else {
    set.add(exerciseId);
  }
  renderActiveBlock();
  renderSidebar();
}

function selectAll() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return;
  selectedState[block.id] = new Set(block.exercises.map(e => e.id));
  renderActiveBlock();
  renderSidebar();
}

function deselectAll() {
  selectedState[currentBlockId] = new Set();
  renderActiveBlock();
  renderSidebar();
}

function selectRecommended() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return;
  selectedState[block.id] = new Set(
    block.exercises.filter(e => e.defaultSelected).map(e => e.id)
  );
  renderActiveBlock();
  renderSidebar();
}

function updateSelectionBadge() {
  const count = selectedState[currentBlockId] ? selectedState[currentBlockId].size : 0;
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  const total = block ? block.exercises.length : 0;
  document.getElementById('selected-badge').textContent = `${count} di ${total} selezionati`;
}

// 5. Generazione Anteprima e Stampa PDF
function buildPrintableHtml() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return "<p>Nessun blocco selezionato.</p>";

  const selectedExercises = block.exercises.filter(ex => selectedState[block.id].has(ex.id));

  let exercisesHtml = '';
  if (selectedExercises.length === 0) {
    exercisesHtml = `
      <div style="text-align: center; padding: 3rem; color: #64748b;">
        <h3>Nessun esercizio selezionato per questo blocco.</h3>
        <p>Torna indietro e seleziona almeno un'attività da includere nella scheda.</p>
      </div>
    `;
  } else {
    exercisesHtml = selectedExercises.map(ex => ex.contentHtml).join('\n');
  }

  return `
    <div class="student-doc-header">
      <div class="doc-title">SCHEDA DIDATTICA DI LETTURA</div>
      <div class="doc-subtitle">${globalBookTitle} — ${block.title}</div>
      <div class="student-fields">
        <div class="student-field-line"><strong>Nome e Cognome:</strong> ____________________________________</div>
        <div class="student-field-line"><strong>Classe:</strong> ____________</div>
        <div class="student-field-line"><strong>Data:</strong> ____________</div>
      </div>
    </div>

    ${block.welcomeNote ? `<div class="doc-welcome">${block.welcomeNote.replace(/\n/g, '<br>')}</div>` : ''}

    <div class="doc-content">
      ${exercisesHtml}
    </div>

    <div style="margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 0.8rem; color: #777; text-align: center; font-family: sans-serif;">
      Scuola Secondaria di Primo Grado — Scheda di Lavoro Individuale / Coppie
    </div>
  `;
}

function openPrintPreview() {
  const modalTitle = document.querySelector('#preview-modal .modal-title');
  if (modalTitle) modalTitle.textContent = "Anteprima Scheda Studente (Solo Esercizi Selezionati)";
  document.getElementById('modal-content').innerHTML = buildPrintableHtml();
  document.getElementById('preview-modal').classList.add('open');
}

function closePrintPreview() {
  document.getElementById('preview-modal').classList.remove('open');
}

function printStudentSheet() {
  openPrintPreview();
  setTimeout(() => { window.print(); }, 350);
}

function buildTeacherGuideHtml() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return "<p>Nessun blocco selezionato.</p>";
  if (!block.teacherGuideMd) {
    return `
      <div style="text-align: center; padding: 3rem; color: #64748b;">
        <h3>Nessuna guida per il docente trovata in questo blocco.</h3>
      </div>
    `;
  }
  return `
    <div class="student-doc-header">
      <div class="doc-title">GUIDA PER IL DOCENTE & SOLUZIONI</div>
      <div class="doc-subtitle">${globalBookTitle} — ${block.title}</div>
    </div>
    <div class="teacher-guide-doc">
      ${markdownToHtml(block.teacherGuideMd, 'teacher-guide-section')}
    </div>
    <div style="margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #ccc; font-size: 0.8rem; color: #777; text-align: center; font-family: sans-serif;">
      Documento Riservato al Docente — Sinossi e Chiavi di Correzione Complete
    </div>
  `;
}

function openTeacherPreview() {
  const modalTitle = document.querySelector('#preview-modal .modal-title');
  if (modalTitle) modalTitle.textContent = "Anteprima Guida Docente & Soluzioni";
  document.getElementById('modal-content').innerHTML = buildTeacherGuideHtml();
  document.getElementById('preview-modal').classList.add('open');
}

function printTeacherGuide() {
  openTeacherPreview();
  setTimeout(() => { window.print(); }, 350);
}

// Assicura che prima della stampa il layout sia sbloccato e il contenuto sia pronto
window.addEventListener('beforeprint', () => {
  document.documentElement.classList.add('is-printing');
  document.body.classList.add('is-printing');
  const modalContent = document.getElementById('modal-content');
  if (!modalContent || !modalContent.innerHTML.trim()) {
    openPrintPreview();
  }
});

window.addEventListener('afterprint', () => {
  document.documentElement.classList.remove('is-printing');
  document.body.classList.remove('is-printing');
});

// 6. Inizializzazione e Listener Drag & Drop
window.addEventListener('DOMContentLoaded', async () => {
  // Setup Drag & Drop
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    const dz = document.getElementById('dropzone-banner');
    if (dz) dz.classList.add('dragover');
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    const dz = document.getElementById('dropzone-banner');
    if (dz && (!e.relatedTarget || e.relatedTarget === document.documentElement)) {
      dz.classList.remove('dragover');
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const dz = document.getElementById('dropzone-banner');
    if (dz) dz.classList.remove('dragover');

    if (e.dataTransfer && e.dataTransfer.items) {
      const files = await getFilesFromDataTransferItems(e.dataTransfer.items);
      if (files.length > 0) {
        processMdFiles(files);
        return;
      }
    }

    if (e.dataTransfer && e.dataTransfer.files) {
      handleFolderSelect(e.dataTransfer.files);
    }
  });

  // Listener e scorciatoie per l'Editor Markdown
  const editorModal = document.getElementById('editor-modal');
  if (editorModal) {
    editorModal.addEventListener('click', (e) => {
      if (e.target === editorModal) {
        closeMdEditor();
      }
    });
  }

  const editorTextarea = document.getElementById('editor-textarea');
  if (editorTextarea) {
    editorTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        const val = editorTextarea.value;
        editorTextarea.value = val.substring(0, start) + "  " + val.substring(end);
        editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
        handleEditorInput();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        applyEditorChanges();
      }
    });
  }

  const helpModal = document.getElementById('help-modal');
  if (helpModal) {
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        closeHelpModal();
      }
    });
  }

  const pcModal = document.getElementById('prompt-context-modal');
  if (pcModal) {
    pcModal.addEventListener('click', (e) => {
      if (e.target === pcModal) {
        closePromptContextModal();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const em = document.getElementById('editor-modal');
      if (em && em.classList.contains('open')) {
        closeMdEditor();
      }
      const hm = document.getElementById('help-modal');
      if (hm && hm.classList.contains('open')) {
        closeHelpModal();
      }
      const pcm = document.getElementById('prompt-context-modal');
      if (pcm && pcm.classList.contains('open')) {
        closePromptContextModal();
      }
    }
  });

  // 1. Tenta il caricamento automatico silenzioso dal server/repository (Netlify/Web)
  const loadedFromServer = await tryAutoLoadFromServer();
  if (loadedFromServer) return;

  // 2. Se non caricato dal server, tenta il ripristino da localStorage
  try {
    const saved = localStorage.getItem('ANALISI_LIBRO_LAST_BOOK');
    if (saved) {
      const data = JSON.parse(saved);
      if (Array.isArray(data) && data.length > 0) {
        loadRawWorksheets(data);
        return;
      }
    }
  } catch (err) {
    console.warn("Storage non accessibile", err);
  }

  // 3. Se non carica o è in locale senza file, mostra la schermata di caricamento come prima (nessun errore)
  showEmptyState();
});

// ============================================================
// 7. Modulo Editor Markdown Diretto Client-Side
// ============================================================

function openMdEditor(targetBlockIdOrFilename = null) {
  // Se la cache è vuota ma ci sono dati caricati in BLOCKS_DATA, sincronizziamo
  if (RAW_FILES_CACHE.size === 0 && BLOCKS_DATA.length > 0) {
    BLOCKS_DATA.forEach(b => {
      if (b.filename && b.rawMarkdown) {
        RAW_FILES_CACHE.set(b.filename, b.rawMarkdown);
        if (!ORIGINAL_FILES_CACHE.has(b.filename)) {
          ORIGINAL_FILES_CACHE.set(b.filename, b.rawMarkdown);
        }
      }
    });
  }

  // Se è ancora vuoto, inizializza con un template per il primo blocco
  if (RAW_FILES_CACHE.size === 0) {
    const initialName = 'blocco_01_esercizi.md';
    const initialTemplate = getStarterWorksheetTemplate(1);
    RAW_FILES_CACHE.set(initialName, initialTemplate);
    ORIGINAL_FILES_CACHE.set(initialName, initialTemplate);
  }

  // Determina quale file aprire inizialmente
  let targetFile = null;
  if (typeof targetBlockIdOrFilename === 'number' || (targetBlockIdOrFilename !== null && !isNaN(targetBlockIdOrFilename))) {
    const b = BLOCKS_DATA.find(x => x.id === Number(targetBlockIdOrFilename));
    if (b) targetFile = b.filename;
  } else if (typeof targetBlockIdOrFilename === 'string' && RAW_FILES_CACHE.has(targetBlockIdOrFilename)) {
    targetFile = targetBlockIdOrFilename;
  }

  if (!targetFile && currentBlockId) {
    const b = BLOCKS_DATA.find(x => x.id === currentBlockId);
    if (b) targetFile = b.filename;
  }

  if (!targetFile) {
    const keys = Array.from(RAW_FILES_CACHE.keys()).sort();
    const firstBlock = keys.find(k => k.toLowerCase() !== 'dati_libro.md') || keys[0];
    targetFile = firstBlock;
  }

  populateEditorFileSelect();
  loadEditorFile(targetFile, true);

  // Impostazione modalità di default in base a larghezza schermo
  if (window.innerWidth < 1024) {
    setEditorViewMode('editor');
  } else {
    setEditorViewMode('split');
  }

  document.getElementById('editor-modal').classList.add('open');
}

function closeMdEditor() {
  if (isEditorDirty) {
    const confirmClose = confirm("Ci sono modifiche non applicate. Sei sicuro di voler chiudere l'editor? Le modifiche andranno perse.");
    if (!confirmClose) return;
  }
  document.getElementById('editor-modal').classList.remove('open');
}

function populateEditorFileSelect() {
  const select = document.getElementById('editor-file-select');
  if (!select) return;
  select.innerHTML = '';

  const keys = Array.from(RAW_FILES_CACHE.keys()).sort((a, b) => a.localeCompare(b));

  // Metadati libro (se presente)
  const datiLibro = keys.find(k => k.toLowerCase() === 'dati_libro.md');
  if (datiLibro) {
    const opt = document.createElement('option');
    opt.value = datiLibro;
    opt.textContent = `📖 ${datiLibro} (Metadati Libro)`;
    select.appendChild(opt);
  }

  // Blocchi didattici di esercizi
  const blocks = keys.filter(k => k.toLowerCase() !== 'dati_libro.md');
  blocks.forEach(filename => {
    const opt = document.createElement('option');
    opt.value = filename;
    opt.textContent = `📑 ${filename}`;
    select.appendChild(opt);
  });

  // Opzione per creare un nuovo file
  const newOpt = document.createElement('option');
  newOpt.value = '__NEW_FILE__';
  newOpt.textContent = '➕ Nuovo File .md...';
  select.appendChild(newOpt);
}

function loadEditorFile(filename, force = false) {
  if (!force && isEditorDirty) {
    const discard = confirm(`Ci sono modifiche non applicate in "${editorCurrentFile}". Vuoi scartarle e passare a "${filename}"?`);
    if (!discard) {
      document.getElementById('editor-file-select').value = editorCurrentFile;
      return;
    }
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

function handleEditorFileSelectChange(selectedVal) {
  if (selectedVal === '__NEW_FILE__') {
    const nextNum = BLOCKS_DATA.length + 1;
    const defaultName = `blocco_${String(nextNum).padStart(2, '0')}_esercizi.md`;
    const newName = prompt("Inserisci il nome del nuovo file Markdown (.md):", defaultName);
    if (!newName || !newName.trim()) {
      document.getElementById('editor-file-select').value = editorCurrentFile;
      return;
    }

    const cleanName = newName.trim().endsWith('.md') ? newName.trim() : `${newName.trim()}.md`;
    if (RAW_FILES_CACHE.has(cleanName)) {
      alert(`Esiste già un file con nome "${cleanName}".`);
      loadEditorFile(cleanName);
      return;
    }

    const starterTemplate = getStarterWorksheetTemplate(nextNum);
    RAW_FILES_CACHE.set(cleanName, starterTemplate);
    if (!ORIGINAL_FILES_CACHE.has(cleanName)) {
      ORIGINAL_FILES_CACHE.set(cleanName, starterTemplate);
    }

    populateEditorFileSelect();
    loadEditorFile(cleanName, true);
    setEditorDirty(true);
    showNotificationToast(`Nuovo file "${cleanName}" creato nel modello standard.`);
  } else {
    loadEditorFile(selectedVal);
  }
}

function handleEditorInput() {
  setEditorDirty(true);
  updateEditorStats();
  clearTimeout(editorPreviewDebounceTimer);
  editorPreviewDebounceTimer = setTimeout(renderEditorLivePreview, 150);
}

function setEditorDirty(dirty) {
  isEditorDirty = dirty;
  const badge = document.getElementById('editor-dirty-badge');
  if (badge) {
    badge.style.display = dirty ? 'inline-flex' : 'none';
  }
}

function updateEditorStats() {
  const textarea = document.getElementById('editor-textarea');
  const statsEl = document.getElementById('editor-stats');
  if (!textarea || !statsEl) return;

  const val = textarea.value;
  const chars = val.length;
  const lines = val ? val.split('\n').length : 0;
  statsEl.textContent = `${lines} righe · ${chars.toLocaleString('it-IT')} caratteri`;
}

function renderEditorLivePreview() {
  const textarea = document.getElementById('editor-textarea');
  const preview = document.getElementById('editor-preview-content');
  if (!textarea || !preview) return;

  const content = textarea.value;
  if (!content.trim()) {
    preview.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 3rem;">L\'anteprima apparirà qui mentre modifichi il testo...</div>';
    return;
  }

  // Se è dati_libro.md, rendering dei metadati
  if (editorCurrentFile && editorCurrentFile.toLowerCase() === 'dati_libro.md') {
    preview.innerHTML = `
      <div class="student-doc-header">
        <div class="doc-title">DATI GENERALI DEL LIBRO</div>
      </div>
      ${markdownToHtml(content, 'doc-section')}
    `;
    return;
  }

  // Per le schede esercizi: separa contenuti studente da guida docente
  const teacherSplitRegex = /#{1,3}\s*(?:[0-9]+\.\s*)?(?:GUIDA\s+E\s+RIASSUNTO\s+PER\s+IL\s+DOCENTE|Riassunto\s+per\s+il\s+docente|Guida\s+per\s+il\s+docente)/i;
  const parts = content.split(teacherSplitRegex);

  if (parts.length > 1) {
    preview.innerHTML = `
      <div class="student-doc-header">
        <div class="doc-title">SCHEDA DIDATTICA (ANTEPRIMA LIVE)</div>
        <div class="doc-subtitle">${globalBookTitle}</div>
      </div>
      <div class="doc-content">
        ${markdownToHtml(parts[0], 'doc-section')}
      </div>
      <div style="margin: 2.5rem 0 1.25rem; padding: 0.65rem 1rem; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; color: #166534; font-weight: 700; font-family: sans-serif; font-size: 0.85rem;">
        📘 SEZIONE RISERVATA: GUIDA PER IL DOCENTE & SOLUZIONI
      </div>
      <div class="teacher-guide-doc">
        ${markdownToHtml(parts[1], 'teacher-guide-section')}
      </div>
    `;
  } else {
    preview.innerHTML = `
      <div class="student-doc-header">
        <div class="doc-title">SCHEDA DIDATTICA (ANTEPRIMA LIVE)</div>
        <div class="doc-subtitle">${globalBookTitle}</div>
      </div>
      <div class="doc-content">
        ${markdownToHtml(content, 'doc-section')}
      </div>
    `;
  }
}

function setEditorViewMode(mode) {
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

function insertEditorSnippet(type) {
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
      replacement = `\n\n| Affermazione | V | F |\n| :--- | :---: | :---: |\n| 1. ${selectedText || 'Prima affermazione da verificare'} | [ ] | [ ] |\n| 2. Seconda affermazione da verificare | [ ] | [ ] |\n`;
      cursorOffset = replacement.length;
      break;
    case 'match_table':
      replacement = `\n\n| Termine o Concetto | Abbinamento | Significato Contestuale |\n| :--- | :---: | :--- |\n| 1. ${selectedText || 'Primo elemento'} | [ &nbsp;&nbsp; ] | A. Definizione corrispondente |\n| 2. Secondo elemento | [ &nbsp;&nbsp; ] | B. Definizione corrispondente |\n`;
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
      replacement = `\n\n---\n\n### GUIDA E RIASSUNTO PER IL DOCENTE\n\n#### Riassunto sintetico dei capitoli\nSintesi degli eventi del blocco per il docente...\n\n#### Soluzioni ed elementi chiave di correzione\n- **1. Domande aperte**: Riferimenti ai passaggi chiave del testo.\n- **2. Vero o Falso**: 1. V; 2. F.\n- **3. Laboratorio lessicale**: 1-A; 2-B.\n`;
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

function applyEditorChanges() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea || !editorCurrentFile) return;

  const content = textarea.value;
  RAW_FILES_CACHE.set(editorCurrentFile, content);

  if (editorCurrentFile.toLowerCase() === 'dati_libro.md') {
    applyDatiLibroUpdate(content);
  } else {
    applyBlockUpdate(editorCurrentFile, content);
  }

  // Persisti nel localStorage
  try {
    localStorage.setItem('ANALISI_LIBRO_LAST_BOOK', JSON.stringify(getAllRawWorksheets()));
  } catch (err) {
    console.warn("Impossibile salvare in localStorage:", err);
  }

  setEditorDirty(false);
  showNotificationToast(`✅ File "${editorCurrentFile}" salvato e applicato con successo!`);
}

function applyDatiLibroUpdate(markdown) {
  const tMatch = markdown.match(/\*{0,2}Titolo\*{0,2}:\*{0,2}\s*(.+)$/mi);
  const aMatch = markdown.match(/\*{0,2}Autore\*{0,2}:\*{0,2}\s*(.+)$/mi);
  const t = tMatch ? tMatch[1].replace(/\*/g, '').trim() : '';
  const a = aMatch ? aMatch[1].replace(/\*/g, '').trim() : '';
  if (t) {
    globalBookTitle = a ? `${t} di ${a}` : t;
  }
  document.getElementById('app-book-title').textContent = globalBookTitle;
  BLOCKS_DATA.forEach(b => {
    b.bookTitle = globalBookTitle;
  });
  renderSidebar();
  renderActiveBlock();
}

function applyBlockUpdate(filename, markdown) {
  const parsed = parseWorksheetMarkdown(filename, markdown);
  const existingIdx = BLOCKS_DATA.findIndex(b => b.filename.toLowerCase() === filename.toLowerCase());

  if (existingIdx !== -1) {
    const existing = BLOCKS_DATA[existingIdx];
    parsed.id = existing.id;
    parsed.rawMarkdown = markdown;
    BLOCKS_DATA[existingIdx] = parsed;

    // Preserva selezione esistente e aggiungi eventuali nuovi esercizi
    const currentSet = selectedState[parsed.id] || new Set();
    const newSet = new Set();
    parsed.exercises.forEach(ex => {
      if (currentSet.has(ex.id) || currentSet.size === 0 || ex.defaultSelected) {
        newSet.add(ex.id);
      }
    });
    selectedState[parsed.id] = newSet;
  } else {
    const newId = BLOCKS_DATA.length + 1;
    parsed.id = newId;
    parsed.rawMarkdown = markdown;
    BLOCKS_DATA.push(parsed);
    selectedState[newId] = new Set(parsed.exercises.map(ex => ex.id));
    currentBlockId = newId;
  }

  // Rendi visibile l'interfaccia se era in empty state
  const dropzone = document.getElementById('dropzone-banner');
  if (dropzone) dropzone.style.display = 'none';
  const hero = document.getElementById('block-hero');
  if (hero) hero.style.display = 'flex';
  const toolbar = document.getElementById('selection-toolbar');
  if (toolbar) toolbar.style.display = 'flex';
  const grid = document.getElementById('exercises-grid');
  if (grid) grid.style.display = 'flex';

  const totalFiles = Array.from(RAW_FILES_CACHE.keys()).filter(f => f.toLowerCase() !== 'dati_libro.md').length;
  document.getElementById('app-book-subtitle').textContent = `Caricate ${BLOCKS_DATA.length} unità didattiche (${totalFiles} file elaborati)`;
  document.getElementById('blocks-count-badge').textContent = `${BLOCKS_DATA.length} Unità`;

  renderSidebar();
  if (currentBlockId === parsed.id) {
    renderActiveBlock();
  }
}

function getAllRawWorksheets() {
  const list = [];
  RAW_FILES_CACHE.forEach((markdown, filename) => {
    list.push({ filename, markdown });
  });
  list.sort((a, b) => a.filename.localeCompare(b.filename));
  return list;
}

function downloadCurrentEditorFile() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea || !editorCurrentFile) return;
  const content = textarea.value;
  downloadMarkdownFile(editorCurrentFile, content);
  showNotificationToast(`⬇️ Download completato per "${editorCurrentFile}"`);
}

function downloadMarkdownFile(filename, content) {
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

async function saveDirectToFileSystem() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea || !editorCurrentFile) return;
  const content = textarea.value;
  const filename = editorCurrentFile;

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'File Markdown (*.md)',
          accept: {
            'text/markdown': ['.md'],
            'text/plain': ['.txt']
          }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      applyEditorChanges();
      showNotificationToast(`💾 File "${filename}" salvato direttamente su disco!`);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn("showSaveFilePicker errore:", err);
    }
  }

  downloadCurrentEditorFile();
}

function revertEditorCurrentFile() {
  if (!editorCurrentFile || !ORIGINAL_FILES_CACHE.has(editorCurrentFile)) {
    showNotificationToast("Nessuna versione originale registrata per questo file.");
    return;
  }
  if (!confirm(`Vuoi davvero ripristinare "${editorCurrentFile}" al contenuto iniziale caricato? Tutte le modifiche andranno perse.`)) {
    return;
  }
  const original = ORIGINAL_FILES_CACHE.get(editorCurrentFile);
  const textarea = document.getElementById('editor-textarea');
  if (textarea) textarea.value = original;
  setEditorDirty(false);
  updateEditorStats();
  renderEditorLivePreview();
  applyEditorChanges();
  showNotificationToast(`↩️ "${editorCurrentFile}" ripristinato alla versione iniziale.`);
}

function getStarterWorksheetTemplate(blockNumber = 1) {
  return `# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE
## *${globalBookTitle}*
### Unità Didattica ${blockNumber} (Blocco ${blockNumber}): *Capitolo A* – *Capitolo B*

---

**Nome e Cognome dello studente:** ________________________________________  
**Classe:** ____________________  **Data:** ____________________  

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

2. **Seconda domanda sui dettagli:**  
   Formula qui una seconda domanda sui personaggi o sullo sviluppo degli eventi.
   
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

---

### B. Vero o Falso? (Attenzione ai dettagli)
*Indica se l'affermazione è Vera [V] o Falsa [F]. Se è Falsa, correggila brevemente.*

| Affermazione | V | F |
| :--- | :---: | :---: |
| 1. Prima affermazione da verificare | [ ] | [ ] |
| 2. Seconda affermazione da verificare | [ ] | [ ] |

---

## 2. Analisi dei Personaggi e Riflessione
*Rifletti sulle scelte, sui sentimenti e sui comportamenti dei protagonisti.*

1. **Analisi delle motivazioni:**  
   Quali motivi spingono i personaggi a compiere determinate scelte?
   
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

---

## 3. Officina di Scrittura Creativa ed Empatia
*Mettiti nei panni di uno dei personaggi.*

Immagina di essere uno dei protagonisti e descrivi la situazione dal tuo punto di vista.

_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  

---

## 4. Laboratorio Lessicale e Modi di Dire
*Associa ciascuna espressione al suo significato appropriato nel testo.*

| Termine o Modo di Dire | Abbinamento | Significato Contestuale |
| :--- | :---: | :--- |
| 1. Primo termine | [ &nbsp;&nbsp; ] | A. Definizione corrispondente |
| 2. Secondo termine | [ &nbsp;&nbsp; ] | B. Definizione corrispondente |

---

## 5. Attività Speciale o Rilievo Grafico
*Rappresenta graficamente una scena significativa.*

[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]

---

### GUIDA E RIASSUNTO PER IL DOCENTE

#### Riassunto sintetico dei capitoli
Sintesi narrativa degli eventi chiave di questa unità per il docente...

#### Soluzioni ed elementi chiave di correzione
- **1. Domande aperte**: Riferimenti ai passaggi chiave del testo.
- **2. Vero o Falso**: 1. V; 2. F.
- **3. Laboratorio lessicale**: 1-A; 2-B.
`;
}

// ============================================================
// 8. Modulo Istruzioni & Help (README.md)
// ============================================================

let readmeContentCache = null;

async function openHelpModal() {
  const modal = document.getElementById('help-modal');
  const contentEl = document.getElementById('help-content');
  if (!modal || !contentEl) return;

  modal.classList.add('open');

  if (readmeContentCache) {
    contentEl.innerHTML = renderReadmeMarkdown(readmeContentCache);
    return;
  }

  try {
    const res = await fetch('README.md');
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 0) {
        readmeContentCache = text;
        contentEl.innerHTML = renderReadmeMarkdown(text);
        return;
      }
    }
  } catch (err) {
    console.warn("Impossibile caricare README.md tramite fetch:", err);
  }

  // Fallback se fetch non è supportato (es. protocollo file://)
  contentEl.innerHTML = `
    <div style="padding: 2.5rem 1rem; text-align: center;">
      <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📖</div>
      <h3 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem;">
        Manuale d'Uso & Istruzioni
      </h3>
      <p style="color: #64748b; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
        Impossibile caricare direttamente il manuale dal protocollo locale. Avvia il server web locale o consulta il file README.md.
      </p>
    </div>
  `;
}

function closeHelpModal() {
  const modal = document.getElementById('help-modal');
  if (modal) modal.classList.remove('open');
}

function renderReadmeMarkdown(md) {
  let html = md;

  // Protezione blocchi di codice (supporta ``` o ````)
  const codeBlocks = [];
  html = html.replace(/(````|```)([a-zA-Z]*)\r?\n([\s\S]*?)\1/g, (match, fence, lang, code) => {
    const placeholder = `%%%CODE_BLOCK_${codeBlocks.length}%%%`;
    const cleanCode = code.trim();
    const langDisplay = lang ? lang.toUpperCase() : 'PROMPT / CODICE';
    codeBlocks.push(
      `<div style="background: #0f172a; border-radius: 8px; margin: 1.2rem 0; overflow: hidden; border: 1px solid #334155; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);">
        <div style="background: #1e293b; padding: 0.45rem 1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155;">
          <span style="font-size: 0.72rem; font-weight: 700; color: #94a3b8; letter-spacing: 0.05em; font-family: monospace;">${escapeHtml(langDisplay)}</span>
          <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.65rem; background: #334155; color: #f8fafc; border: 1px solid #475569; cursor: pointer;" onclick="copyCodeSnippet(this)" data-code="${encodeURIComponent(cleanCode)}">📋 Copia Blocco</button>
        </div>
        <div style="padding: 1rem 1.25rem; overflow-x: auto; font-family: monospace; font-size: 0.85rem; line-height: 1.5; color: #f1f5f9;">
          <pre style="margin: 0; white-space: pre-wrap; word-break: break-word;"><code>${escapeHtml(cleanCode)}</code></pre>
        </div>
      </div>`
    );
    return placeholder;
  });

  // Codice inline `...`
  html = html.replace(/`([^`]+)`/g, (m, c) => `<code style="background: #f1f5f9; color: #0f172a; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.86em; font-family: monospace; border: 1px solid #e2e8f0;">${escapeHtml(c)}</code>`);

  // GitHub alerts > [!TIP], > [!NOTE], etc.
  html = html.replace(/^>\s+\[!(TIP|NOTE|IMPORTANT|WARNING|CAUTION)\]\s*\r?\n([\s\S]*?)(?=\r?\n\s*\r?\n|\r?\n\s*#{1,3}|$)/gm, (m, type, body) => {
    const cleanBody = body.replace(/^>\s*/gm, '').trim();
    let borderCol = '#2563eb';
    let bgCol = '#eff6ff';
    let textCol = '#1e3a8a';
    let icon = '💡';
    if (type === 'TIP') { icon = '💡'; borderCol = '#10b981'; bgCol = '#ecfdf5'; textCol = '#065f46'; }
    if (type === 'IMPORTANT' || type === 'WARNING') { icon = '⚠️'; borderCol = '#f59e0b'; bgCol = '#fffbeb'; textCol = '#92400e'; }
    return `<div style="margin: 1.2rem 0; padding: 0.85rem 1.15rem; border-left: 4px solid ${borderCol}; background: ${bgCol}; border-radius: 0 8px 8px 0; color: ${textCol}; font-size: 0.92rem; line-height: 1.55;"><strong>${icon} ${type}:</strong> ${cleanBody}</div>`;
  });

  // Citazioni / Blockquote generiche > ...
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote style="margin: 0.75rem 0; padding: 0.6rem 1rem; border-left: 3px solid #cbd5e1; color: #475569; font-style: italic; background: #f8fafc; border-radius: 0 6px 6px 0;">$1</blockquote>');

  // Titoli
  html = html.replace(/^#\s+(.+)$/gm, '<h1 style="font-size: 1.5rem; font-weight: 800; margin: 1.6rem 0 0.8rem; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.45rem;">$1</h1>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 style="font-size: 1.25rem; font-weight: 700; margin: 1.4rem 0 0.65rem; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.35rem;">$1</h2>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 style="font-size: 1.05rem; font-weight: 700; margin: 1.15rem 0 0.45rem; color: #334155;">$1</h3>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 style="font-size: 0.95rem; font-weight: 700; margin: 0.9rem 0 0.35rem; color: #475569;">$1</h4>');

  // Separatori ---
  html = html.replace(/^[ \t]*-{3,}[ \t]*$/gm, '<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;">');

  // Grassetto e corsivo
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Link markdown [testo](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: underline;">$1</a>');

  // Liste
  html = html.replace(/^[ \t]*[-*]\s+(.+)$/gm, '<li style="margin-left: 1.4rem; margin-bottom: 0.35rem; color: #334155;">$1</li>');
  html = html.replace(/^[ \t]*([0-9]+)\.\s+(.+)$/gm, '<li style="margin-left: 1.4rem; margin-bottom: 0.35rem; color: #334155;">$2</li>');

  // Paragrafi
  const parts = html.split(/\r?\n\s*\r?\n/);
  const cleanParts = parts.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<div') || p.startsWith('<hr') || p.startsWith('<blockquote') || p.startsWith('<li') || p.startsWith('%%%CODE_BLOCK_')) {
      return p;
    }
    return `<p style="margin-bottom: 0.85rem; line-height: 1.65; color: #334155;">${p.replace(/\r?\n/g, '<br>')}</p>`;
  });

  let rendered = cleanParts.join('\n');

  // Ripristina i blocchi di codice
  codeBlocks.forEach((blockHtml, idx) => {
    rendered = rendered.replace(`%%%CODE_BLOCK_${idx}%%%`, blockHtml);
  });

  return `<div class="readme-rendered">${rendered}</div>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// 9. Modulo Visualizzazione e Download: Prompt & Contesto
// ============================================================

let currentPromptContextTab = 'prompt'; // 'prompt' | 'context'
let promptRawCache = null;
let contextRawCache = null;

async function openPromptContextModal(initialTab = 'prompt') {
  const modal = document.getElementById('prompt-context-modal');
  if (!modal) return;
  modal.classList.add('open');
  await ensurePromptAndContextLoaded();
  switchPromptContextTab(initialTab);
}

function closePromptContextModal() {
  const modal = document.getElementById('prompt-context-modal');
  if (modal) modal.classList.remove('open');
}

async function ensurePromptAndContextLoaded() {
  if (!promptRawCache) {
    try {
      const res = await fetch('prompt.md');
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) promptRawCache = text;
      }
    } catch (_) {}
  }
  if (!contextRawCache) {
    try {
      const res = await fetch('contesto_didattico.md');
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) contextRawCache = text;
      }
    } catch (_) {}
  }
}

function switchPromptContextTab(tab) {
  currentPromptContextTab = tab;

  // Aggiorna classi bottoni di selezione tab
  document.getElementById('btn-tab-prompt')?.classList.toggle('active', tab === 'prompt');
  document.getElementById('btn-tab-context')?.classList.toggle('active', tab === 'context');

  const subtitle = document.getElementById('prompt-context-subtitle');
  const content = document.getElementById('prompt-context-content');
  if (!content) return;

  if (tab === 'prompt') {
    if (subtitle) {
      subtitle.textContent = "Prompt chiavi in mano da fornire all'Agente AI per avviare l'elaborazione autonoma del libro.";
    }
    const raw = promptRawCache || getFallbackPromptText();
    content.innerHTML = renderReadmeMarkdown(raw);
  } else {
    if (subtitle) {
      subtitle.textContent = "Modello pedagogico, ruolo del docente, criteri didattici e regole per la generazione delle schede.";
    }
    const raw = contextRawCache || getFallbackContextText();
    content.innerHTML = renderReadmeMarkdown(raw);
  }

  content.scrollTop = 0;
}

function copyCodeSnippet(btn) {
  const encoded = btn.getAttribute('data-code');
  if (!encoded) return;
  const code = decodeURIComponent(encoded);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      showNotificationToast('📋 Prompt operativo copiato negli appunti! Incollalo in Gemini / NotebookLM.');
    }).catch(() => {
      fallbackCopyText(code, 'prompt_ai.txt');
    });
  } else {
    fallbackCopyText(code, 'prompt_ai.txt');
  }
}

function copyCurrentPromptContextText() {
  const isPrompt = currentPromptContextTab === 'prompt';
  const fullText = isPrompt
    ? (promptRawCache || getFallbackPromptText())
    : (contextRawCache || getFallbackContextText());
  const filename = isPrompt ? 'prompt.md' : 'contesto_didattico.md';

  // Se siamo nella scheda Prompt, estrai il prompt operativo per Gemini
  let textToCopy = fullText;
  if (isPrompt) {
    const match = fullText.match(/(?:````|```)(?:markdown)?\r?\n([\s\S]*?)(?:````|```)/);
    if (match && match[1]) {
      textToCopy = match[1].trim();
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      const msg = isPrompt
        ? '🤖 Prompt operativo per Gemini/NotebookLM copiato negli appunti!'
        : `📋 Testo di "${filename}" copiato negli appunti!`;
      showNotificationToast(msg);
    }).catch(() => {
      fallbackCopyText(textToCopy, filename);
    });
  } else {
    fallbackCopyText(textToCopy, filename);
  }
}

function fallbackCopyText(text, filename) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showNotificationToast(`📋 Testo copiato negli appunti!`);
  } catch (_) {
    showNotificationToast(`Impossibile copiare automaticamente. Scarica il file "${filename}".`);
  }
  document.body.removeChild(ta);
}

function downloadCurrentPromptContextFile() {
  const isPrompt = currentPromptContextTab === 'prompt';
  const filename = isPrompt ? 'prompt.md' : 'contesto_didattico.md';
  const text = isPrompt
    ? (promptRawCache || getFallbackPromptText())
    : (contextRawCache || getFallbackContextText());

  downloadMarkdownFile(filename, text);
  showNotificationToast(`⬇️ Download completato per "${filename}"`);
}

function downloadBothPromptAndContext() {
  const promptText = promptRawCache || getFallbackPromptText();
  const contextText = contextRawCache || getFallbackContextText();

  downloadMarkdownFile('prompt.md', promptText);
  setTimeout(() => {
    downloadMarkdownFile('contesto_didattico.md', contextText);
    showNotificationToast("📦 Download avviato per prompt.md e contesto_didattico.md!");
  }, 300);
}

function getFallbackPromptText() {
  return `Sei un docente esperto e appassionato di lettere della scuola secondaria di primo grado (studenti di 11-13 anni).
Fai riferimento alle fonti caricate in questo taccuino: il testo integrale del romanzo e il file \`contesto_didattico.md\`.

Il tuo obiettivo è analizzare l'intero libro e creare il percorso didattico completo, composto dalla scheda anagrafica dei metadati e dalle schede di lettura per ciascun blocco narrativo del romanzo, impaginate in Markdown puro e pronte per l'applicazione web di stampa.

Procedi con il seguente piano operativo:

### FASE 1: Metadati del Libro & Mappatura dei Blocchi
1. Genera il blocco anagrafico \`dati_libro.md\` nel formato esatto:
   # Dati del Libro
   - **Titolo:** [Titolo completo del romanzo]
   - **Autore:** [Nome e cognome dell'autore]
   - **Anno di pubblicazione:** [Anno di prima edizione]
   - **Editore:** [Casa editrice]
   - **Genere:** [Genere letterario]
   - **Ambientazione:** [Luogo ed epoca della vicenda]
   - **Target scolastico:** Scuola secondaria di primo grado (11-13 anni)
   - **Unità didattiche:** [Numero complessivo di blocchi proposti]

2. Mappa l'intera opera in unità didattiche equilibrate (circa 1.500 - 3.500 parole o 2-4 capitoli per blocco), elencando per ciascun blocco:
   - Numero unità (es. Blocco 1, Blocco 2...)
   - Capitoli inclusi con titoli esatti
   - Sintesi del nucleo tematico pedagogico

---

### FASE 2: Generazione delle Schede Didattiche (Markdown Standard)
Per ciascun blocco narrativo (cominciando dal Blocco 1), genera il codice Markdown completo rispettando rigorosamente la seguente struttura pedagogica e tipografica:

1. **Intestazione:**
   - Titolo: \`# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE\`
   - Sottotitolo libro: \`## *[Titolo del Romanzo]* di [Autore]\`
   - Sottotitolo unità: \`### Unità Didattica X (Blocco X): *Capitolo A* – *Capitolo B*\`
   - Campi compilabili studente: \`**Nome e Cognome dello studente:** ________________________________________\`  
     \`**Classe:** ____________________  **Data:** ____________________\`
   - Citazione accogliente e motivante: \`> ### 🌊 Titolo Citazione...\`

2. **1. Comprensione del Testo:**
   - **A. Domande a risposta aperta:** 4 o 5 quesiti non mnemonici su cause-effetto, scelte etiche ed emozioni dei personaggi, seguiti da righe di risposta \`_________________________________________________________________________________________\`.
   - **B. Vero o Falso? (Attenzione ai dettagli):** tabella Markdown standard a 3 colonne (\`| Affermazione | V | F |\`) con 5 affermazioni sottili e righe per motivare/correggere i falsi.

3. **2. Analisi dei Personaggi e Riflessione:**
   - **A. Analisi del Personaggio:** approfondimento psicologico sui conflitti interiori e sull'evoluzione morale.
   - **B. Officina di Scrittura Creativa ed Empatia:** consegna di scrittura in prima persona (*"Mettiti nei panni di...", pagina di diario o lettera*).

4. **3. Laboratorio Lessicale e Modi di Dire:**
   - Tabella di corrispondenza (\`| Termine | Abbinamento | Significato Contestuale |\`) con 5 vocaboli complessi o d'autore usati nei capitoli e caselle \`[ &nbsp;&nbsp; ]\`.

5. **4. Attività Speciale "Fuori dagli Schemi":**
   - Esperienza laboratoriale originale: compito di realtà, mappa visiva, indagine o dibattito. Se prevede un disegno/schema, usa esattamente la dicitura \`[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]\`.

6. **5. Guida per il Docente & Soluzioni:**
   - Inserisci un separatore \`---\` seguito dall'intestazione \`### GUIDA E RIASSUNTO PER IL DOCENTE\`.
   - Sinossi narrativa puntuale dei capitoli del blocco.
   - Chiavi di correzione e risposte modello complete per tutte le domande aperte, il Vero/Falso e il lessico.

---

### Vincoli Tipografici Fondamentali:
- **NON** racchiudere le schede in blocchi di codice da programmatore (nessun blocco con triplo backtick o apice inverso).
- **NON** usare ASCII-art, cornici o box simulati con caratteri (\`+---+\`, \`| |\`).
- Usa le tabelle pipe standard Markdown con allineamento \`:---\` e \`:---:\`.

Avvia ora l'elaborazione della **Fase 1** (Metadati e Mappatura) e genera subito la scheda didattica completa del **Blocco 1**.\n`;
}

function getFallbackContextText() {
  return `# Contesto Didattico, Ruolo e Modello di Ragionamento

## 1. Ruolo e Obiettivo Didattico
Agisci come un **esperto e appassionato insegnante di lettere della scuola secondaria di primo grado** (studenti di 11-13 anni).
Il tuo obiettivo è analizzare le opere letterarie caricate come fonte in **Google NotebookLM** o **Gemini** (in formato EPUB, PDF, Google Doc o testo) e creare percorsi di lettura completi: schede didattiche, esercizi di comprensione profonda, laboratori lessicali, sfide creative ed esperienze di scrittura immedesimativa calibrate su ciascun blocco narrativo del romanzo.

---

## 2. Modello di Ragionamento dell'Agente (Come deve pensare l'AI)

Quando analizzi il testo ed elabori le attività didattiche, adotta rigorosamente questo approccio mentale:

### A. Analisi Critica Preventiva
- **Non fermarti alla superficie della trama:** Prima di scrivere le domande, individua i temi portanti del capitolo (es. il rito di passaggio, l'amicizia tra pari, la lealtà, la paura del fallimento, il confronto con gli adulti, il rapporto con la natura).
- **Mappa le relazioni causa-effetto:** Concentrati sui momenti di svolta (*incidente scatenante, climax, colpi di scena*) e sulle scelte morali compiute dai protagonisti.

### B. Calibrazione Pedagogica (Target 11-13 anni)
- **Tono accogliente e stimolante:** Il linguaggio delle consegne deve essere diretto, incoraggiante e coinvolgente, evitando sia l'infantilismo sia il gergo accademico astratto.
- **Evita le domande puramente mnemoniche:** Non porre quesiti nozionistici sterili. Privilegia motivazioni, emozioni e conseguenze.
- **Rigore sul testo:** Nel "Vero o Falso", formula affermazioni sottili che verifichino l'attenzione reale ai dettagli significativi della narrazione.

### C. Creatività e Rottura della Routine (Esercizio Estemporaneo)
- Per l'attività "Fuori dagli schemi", evita la ripetitività: ogni blocco deve proporre un'esperienza didattica originale.

### D. Autonomia Operativa e Gestione del Contesto
- **Elaborazione progressiva a blocchi:** Analizza e genera una scheda per volta per mantenere altissima la precisione.
- **Doppio livello (Studente e Docente):** Ogni scheda deve essere fruibile dagli studenti (layout pulito per la stampa) e contemporaneamente fornire al docente la guida sintetica con le chiavi di correzione complete.

---

## 3. Flusso di Lavoro Online (Gemini Notebook / NotebookLM)

1. **Caricamento Fonti nel Taccuino:**
   - Carica il testo integrale del romanzo (formato **EPUB**, **PDF**, **Google Doc** o **TXT**) come fonte primaria.
   - Carica questo file \`contesto_didattico.md\` come seconda fonte per impostare il modello di ragionamento pedagogico.

2. **Mappatura in Blocchi Logici:**
   - Grazie alla finestra di contesto estesa di Gemini, l'AI analizza la struttura del libro e propone una suddivisione in unità didattiche coerenti (circa 1.500 - 3.500 parole per blocco, pari a 2-4 capitoli).

3. **Generazione dei Metadati del Romanzo (\`dati_libro.md\`):**
   - L'AI crea innanzitutto la scheda anagrafica del libro con titolo, autore, anno, editore, genere, ambientazione e numero totale di blocchi.

4. **Generazione Progressiva delle Schede:**
   - L'AI genera ciascuna scheda didattica (Blocco 1, Blocco 2, ecc.) fornendo il testo Markdown completo conforme agli standard tipografici del progetto.

5. **Visualizzazione, Modifica e Stampa Web:**
   - Apri l'applicazione web (su Netlify o in locale).
   - Incolla direttamente il testo generato da Gemini nell'editor integrato del sito (tramite il pulsante \`✏️ Modifica Markdown di questa unità\` o \`➕ Nuovo File .md\`), visualizza l'anteprima di stampa in tempo reale, salvalo o scaricalo sul tuo computer.

---

## 4. Struttura Obbligatoria delle Schede Didattiche

Ogni scheda in Markdown deve contenere:
1. **Intestazione Studente** con campi per nome, classe, data e citazione introduttiva motivante.
2. **Comprensione del Testo** (domande aperte e Vero/Falso motivato).
3. **Analisi e Riflessione** (analisi personaggio e officina di scrittura creativa/empatica).
4. **Laboratorio di Lessico** (parole complesse d'autore e tabella abbinamento con \`[ &nbsp;&nbsp; ]\`).
5. **Attività Speciale "Fuori dagli Schemi"** (mappa, dibattito, indagine, compito di realtà e spazio disegno).
6. **Guida e Riassunto per il Docente** (sinossi narrativa e soluzioni complete).

---

## 5. Vincoli Tipografici per la Stampa PDF
- **NON** usare blocchi di codice (\`\`\`) per le schede studenti.
- **NON** usare ASCII-art o box simulati (\`+---+\`).
- Usa tabelle pipe standard e sequenze di trattini bassi per le righe di risposta.
`;
}
