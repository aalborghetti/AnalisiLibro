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
    exercises: exercises
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
    return `<table class="${tableClass}">${theadHtml}<tbody>${tbodyHtml}</tbody></table>`;
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

    // Seleziona di default TUTTI gli esercizi per ogni blocco
    selectedState[parsed.id] = new Set(
      parsed.exercises.map(ex => ex.id)
    );
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

  // Seleziona il primo blocco
  currentBlockId = BLOCKS_DATA[0].id;
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

// 3. Gestione File e Cartelle (File API & FileReader)
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

// 6. Inizializzazione e Listener Drag & Drop
window.addEventListener('DOMContentLoaded', () => {
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

  // Ripristino eventuale ultimo libro da localStorage
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

  showEmptyState();
});
