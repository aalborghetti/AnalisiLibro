/**
 * Generatore Schede Didattiche - Logica Client-Side (GitHub Pages & Locale)
 * Parser Markdown universale, selezione esercizi, anteprima, supporto DSA/BES e stampa PDF
 */

// Stato dell'applicazione
let BLOCKS_DATA = [];
let currentBlockId = null;
const selectedState = {};
let globalBookTitle = "Schede Didattiche di Lettura";
let globalBookAuthor = "";
let isDsaMode = false;

// Cache dei file Markdown raw (in memoria)
const RAW_FILES_CACHE = new Map();
const ORIGINAL_FILES_CACHE = new Map();
let editorCurrentFile = null;
let isEditorDirty = false;
let editorViewMode = 'split'; // 'editor' | 'split' | 'preview'
let editorPreviewDebounceTimer = null;

// Sanitizza il nome file per creare ID DOM sicuri (anche con apostrofi o spazi)
function makeSafeId(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '_');
}

// 1. Markdown Parser per Schede Didattiche
function parseWorksheetMarkdown(filename, rawMd) {
  let bookTitle = globalBookTitle;
  let blockTitle = "";
  let welcomeNote = "";
  const safeFileId = makeSafeId(filename);
  
  // Separa i contenuti dello studente dalla guida docente
  let studentMd = rawMd;
  let teacherGuideMd = "";
  const teacherSplitRegex = /#{1,3}\s*(?:[0-9]+\.\s*)?(?:GUIDA\s+E\s+RIASSUNTO\s+PER\s+IL\s+DOCENTE|Riassunto\s+per\s+il\s+docente|Guida\s+per\s+il\s+docente)/i;
  const teacherParts = rawMd.split(teacherSplitRegex);
  if (teacherParts.length > 1) {
    studentMd = teacherParts[0];
    teacherGuideMd = teacherParts[1];
  }

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
    let desc = "Quesiti di comprensione profonda, relazioni causa-effetto e vero/falso.";
    let defaultSelected = true;

    if (titleLower.includes("vero o falso") || titleLower.includes("v/f")) {
      type = "vf";
      typeLabel = "Vero o Falso";
      desc = "Verifica dell'attenzione ai dettagli narrativi e correzione delle affermazioni false.";
    } else if (titleLower.includes("comprensione")) {
      type = "comprensione";
      typeLabel = "Comprensione del Testo";
      desc = "Domande a risposta aperta sugli snodi narrativi e verifica Vero/Falso.";
    } else if (titleLower.includes("analisi") || titleLower.includes("personagg")) {
      type = "analisi";
      typeLabel = "Analisi Personaggi";
      desc = "Riflessione psicologica sui conflitti interiori e sulle scelte etiche dei protagonisti.";
    } else if (titleLower.includes("scrittura") || titleLower.includes("officina") || titleLower.includes("immedesimazione") || titleLower.includes("empatia")) {
      type = "scrittura";
      typeLabel = "Officina di Scrittura";
      desc = "Traccia di immedesimazione personale in prima persona, pagina di diario o lettera.";
    } else if (titleLower.includes("lessico") || titleLower.includes("linguaggio") || titleLower.includes("parole")) {
      type = "lessico";
      typeLabel = "Laboratorio Lessicale";
      desc = "Abbinamento di vocaboli complessi e modi di dire d'autore al significato contestuale.";
    } else if (titleLower.includes("speciale") || titleLower.includes("schemi") || titleLower.includes("estemporane") || titleLower.includes("compito di realtà") || titleLower.includes("rilievo")) {
      type = "speciale";
      typeLabel = "Attività Speciale";
      desc = "Esperienza laboratoriale creativa, mappa visiva, indagine o rilievo grafico.";
    }

    // Retrocompatibilità: Sezione combinata Analisi del Personaggio + Scrittura Creativa nello stesso H2
    const analSplitRegex = /(?:###\s+B\.\s+|####\s+(?:Spazio\s+)?Scrittura)/i;
    if (type === "analisi" && analSplitRegex.test(sectionChunk)) {
      const parts = sectionChunk.split(analSplitRegex);
      if (parts.length > 1) {
        exercises.push({
          id: `${safeFileId}_sec_${i}_a`,
          type: "analisi",
          typeLabel: "Analisi Personaggi",
          title: "Analisi del Personaggio e Riflessione",
          desc: "Riflessione sui conflitti interiori e sulle scelte etiche.",
          defaultSelected: true,
          contentHtml: markdownToHtml(parts[0]),
          rawMarkdown: parts[0]
        });
        exercises.push({
          id: `${safeFileId}_sec_${i}_b`,
          type: "scrittura",
          typeLabel: "Officina di Scrittura",
          title: "Spunto di Scrittura Creativa ed Empatia",
          desc: "Traccia di immedesimazione personale o monologo interiore.",
          defaultSelected: true,
          contentHtml: markdownToHtml("### Scrittura Creativa ed Empatia\n" + parts[1]),
          rawMarkdown: "### Scrittura Creativa ed Empatia\n" + parts[1]
        });
        continue;
      }
    }

    exercises.push({
      id: `${safeFileId}_sec_${i}`,
      type: type,
      typeLabel: typeLabel,
      title: current.title.replace(/^[0-9]+\.\s*/, ''),
      desc: desc,
      defaultSelected: defaultSelected,
      contentHtml: markdownToHtml(sectionChunk),
      rawMarkdown: sectionChunk
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

// Formattatore Markdown -> HTML con filtri di pulizia e conteggio righe reale
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

  // Righe di quaderno per risposta scritta: rispetta il numero esatto di righe '_' presenti nel Markdown
  h = h.replace(/((?:_{5,}[ \t]*\r?\n?)+)/g, (match) => {
    const count = (match.match(/_{5,}/g) || []).length;
    const linesHtml = '<div class="write-line"></div>'.repeat(Math.max(1, count));
    return `\n\n<div class="write-lines">${linesHtml}</div>\n\n`;
  });
  
  // Tabelle Markdown
  h = h.replace(/((?:^[ \t]*\|.+\|[ \t]*(?:\r?\n|$))+)/gm, function(tableBlock) {
    const rawLines = tableBlock.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
    if (rawLines.length === 0) return tableBlock;

    const blockTextLower = tableBlock.toLowerCase();
    const isMatchingTable = blockTextLower.includes('corrispondenza') || blockTextLower.includes('abbinamento');

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

  // Paragrafi e raggruppamento domande numerate (.doc-question) per evitare salti pagina tra domanda e righe
  const rawParagraphs = h.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const finalBlocks = [];

  for (let i = 0; i < rawParagraphs.length; i++) {
    let p = rawParagraphs[i];
    const isBlockTag = p.startsWith('<div') || p.startsWith('<table') || p.startsWith('<h3') || p.startsWith('<h4');
    const isNumberedQuestion = /^[0-9]+\.\s+/.test(p);

    if (!isBlockTag) {
      p = `<p style="margin-bottom: 0.5rem;">${p.replace(/\n/g, '<br>')}</p>`;
    }

    // Se è una domanda numerata ed è seguita da .write-lines, avvolgile insieme in .doc-question
    if (isNumberedQuestion && i + 1 < rawParagraphs.length && rawParagraphs[i + 1].startsWith('<div class="write-lines">')) {
      finalBlocks.push(`<div class="doc-question">${p}\n${rawParagraphs[i + 1]}</div>`);
      i++; // Salta il blocco .write-lines già incluso
    } else if (isNumberedQuestion) {
      finalBlocks.push(`<div class="doc-question">${p}</div>`);
    } else {
      finalBlocks.push(p);
    }
  }

  return `<div class="${wrapperClass}">${finalBlocks.join('\n')}</div>`;
}

// 2. Caricamento e Parsing dei Dataset (in memoria)
function loadRawWorksheets(worksheetsArray) {
  if (!worksheetsArray || worksheetsArray.length === 0) {
    showEmptyState();
    return;
  }

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
  const exerciseSheets = worksheetsArray.filter(item => !item.filename || item.filename.toLowerCase() !== 'dati_libro.md');

  if (exerciseSheets.length === 0) {
    showEmptyState();
    return;
  }

  exerciseSheets.forEach((item, index) => {
    const parsed = parseWorksheetMarkdown(item.filename, item.markdown);
    parsed.id = index + 1;
    BLOCKS_DATA.push(parsed);

    if (!selectedState[parsed.id] || selectedState[parsed.id].size === 0) {
      selectedState[parsed.id] = new Set(
        parsed.exercises.map(ex => ex.id)
      );
    }
  });

  const dropzone = document.getElementById('dropzone-banner');
  if (dropzone) dropzone.style.display = 'none';
  const hero = document.getElementById('block-hero');
  if (hero) hero.style.display = 'flex';
  const toolbar = document.getElementById('selection-toolbar');
  if (toolbar) toolbar.style.display = 'flex';
  const grid = document.getElementById('exercises-grid');
  if (grid) grid.style.display = 'flex';

  document.getElementById('app-book-title').textContent = globalBookTitle;
  document.getElementById('app-book-subtitle').textContent = `Caricate ${BLOCKS_DATA.length} unità didattiche (${exerciseSheets.length} file elaborati)`;
  document.getElementById('blocks-count-badge').textContent = `${BLOCKS_DATA.length} Unità`;

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

// 3. Caricamento Silenzioso all'Avvio (schede_esercizi/) senza generare decine di 404
async function tryAutoLoadFromServer() {
  if (window.location.protocol === 'file:') return false;

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

    const worksheets = [];

    if (fileList.length > 0) {
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
      worksheets.push(...results.filter(Boolean));
    } else {
      // 2. Fallback sequenziale intelligente: si ferma subito al primo 404 evitando 30 chiamate a vuoto
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
      <div class="block-title">${escapeHtml(block.title)}</div>
      <div class="block-chapters">📁 ${escapeHtml(block.filename)}</div>
    `;
    container.appendChild(el);
  });
}

function selectBlock(id) {
  currentBlockId = id;
  renderSidebar();
  renderActiveBlock();
  
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
    <span>📖 <strong>File:</strong> ${escapeHtml(block.filename)}</span>
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

    let tagClass = 'tag-comprensione';
    if (ex.type === 'vf') tagClass = 'tag-vf';
    if (ex.type === 'analisi') tagClass = 'tag-analisi';
    if (ex.type === 'scrittura') tagClass = 'tag-scrittura';
    if (ex.type === 'lessico') tagClass = 'tag-lessico';
    if (ex.type === 'speciale') tagClass = 'tag-speciale';

    card.innerHTML = `
      <div class="exercise-checkbox-wrapper">
        <input type="checkbox" class="custom-checkbox" ${isSelected ? 'checked' : ''}>
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

function toggleExercise(exerciseId) {
  const set = selectedState[currentBlockId];
  if (!set) return;
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

// Filtro rapido per alunni con BES / verifiche semplificate (Comprensione, V/F e Lessico)
function selectEssentialBes() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return;
  const essentialTypes = new Set(['comprensione', 'vf', 'lessico']);
  selectedState[block.id] = new Set(
    block.exercises.filter(e => essentialTypes.has(e.type)).map(e => e.id)
  );
  renderActiveBlock();
  renderSidebar();
  showNotificationToast("🎯 Attivata Selezione Essenziale (BES): Comprensione, V/F e Lessico.");
}

function updateSelectionBadge() {
  const count = selectedState[currentBlockId] ? selectedState[currentBlockId].size : 0;
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  const total = block ? block.exercises.length : 0;
  document.getElementById('selected-badge').textContent = `${count} di ${total} selezionati`;
}

// 5. Generazione Anteprima, Modalità Alta Leggibilità (DSA) e Stampa PDF
function toggleDsaMode() {
  isDsaMode = !isDsaMode;
  const modalBody = document.getElementById('modal-content');
  const btn = document.getElementById('btn-dsa-toggle');

  if (modalBody) {
    modalBody.classList.toggle('dsa-mode', isDsaMode);
  }
  if (btn) {
    btn.classList.toggle('active', isDsaMode);
    btn.textContent = isDsaMode ? '🔤 Alta Leggibilità (DSA): ON' : '🔤 Alta Leggibilità (DSA): OFF';
  }
  showNotificationToast(
    isDsaMode
      ? "🔤 Modalità Alta Leggibilità (DSA) attivata: font sans-serif maggiorato, zero corsivi e righe ampliate."
      : "🔤 Modalità tipografica standard ripristinata."
  );
}

function buildSingleBlockPrintableHtml(block) {
  const selectedExercises = block.exercises.filter(ex => selectedState[block.id] && selectedState[block.id].has(ex.id));

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
      <div class="doc-subtitle">${escapeHtml(globalBookTitle)} — ${escapeHtml(block.title)}</div>
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

function buildPrintableHtml() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return "<p>Nessun blocco selezionato.</p>";
  return buildSingleBlockPrintableHtml(block);
}

let currentPreviewType = 'student'; // 'student' | 'teacher' | 'full'

function exportCurrentPreviewDocx() {
  if (currentPreviewType === 'teacher') {
    exportTeacherDocx();
  } else if (currentPreviewType === 'full') {
    exportFullBookDocx();
  } else {
    exportStudentDocx();
  }
}

function openPrintPreview() {
  currentPreviewType = 'student';
  const modalTitle = document.querySelector('#preview-modal .modal-title');
  if (modalTitle) modalTitle.textContent = "Anteprima Scheda Studente (Solo Esercizi Selezionati)";
  const modalContent = document.getElementById('modal-content');
  modalContent.innerHTML = buildPrintableHtml();
  modalContent.classList.toggle('dsa-mode', isDsaMode);
  document.getElementById('preview-modal').classList.add('open');
}

function openFullBookPreview() {
  if (!BLOCKS_DATA || BLOCKS_DATA.length === 0) {
    showNotificationToast("Nessun blocco didattico caricato.");
    return;
  }
  currentPreviewType = 'full';
  const modalTitle = document.querySelector('#preview-modal .modal-title');
  if (modalTitle) modalTitle.textContent = `Fascicolo Completo Studenti (${BLOCKS_DATA.length} Unità Didattiche)`;

  const fullHtml = BLOCKS_DATA.map((block, idx) => {
    const blockHtml = buildSingleBlockPrintableHtml(block);
    return idx === 0 ? blockHtml : `<div class="page-break-block">${blockHtml}</div>`;
  }).join('\n');

  const modalContent = document.getElementById('modal-content');
  modalContent.innerHTML = fullHtml;
  modalContent.classList.toggle('dsa-mode', isDsaMode);
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
      <div class="doc-subtitle">${escapeHtml(globalBookTitle)} — ${escapeHtml(block.title)}</div>
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
  currentPreviewType = 'teacher';
  const modalTitle = document.querySelector('#preview-modal .modal-title');
  if (modalTitle) modalTitle.textContent = "Anteprima Guida Docente & Soluzioni";
  const modalContent = document.getElementById('modal-content');
  modalContent.innerHTML = buildTeacherGuideHtml();
  modalContent.classList.toggle('dsa-mode', isDsaMode);
  document.getElementById('preview-modal').classList.add('open');
}

function printTeacherGuide() {
  openTeacherPreview();
  setTimeout(() => { window.print(); }, 350);
}

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

  // 1. Tenta il caricamento automatico silenzioso dal server/repository
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

  // 3. Stato vuoto iniziale
  showEmptyState();
});

// ============================================================
// 7. Modulo Editor Markdown Diretto Client-Side
// ============================================================

function openMdEditor(targetBlockIdOrFilename = null) {
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

  if (RAW_FILES_CACHE.size === 0) {
    const initialName = 'blocco_01_esercizi.md';
    const initialTemplate = getStarterWorksheetTemplate(1);
    RAW_FILES_CACHE.set(initialName, initialTemplate);
    ORIGINAL_FILES_CACHE.set(initialName, initialTemplate);
  }

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

  const datiLibro = keys.find(k => k.toLowerCase() === 'dati_libro.md');
  if (datiLibro) {
    const opt = document.createElement('option');
    opt.value = datiLibro;
    opt.textContent = `📖 ${datiLibro} (Metadati Libro)`;
    select.appendChild(opt);
  }

  const blocks = keys.filter(k => k.toLowerCase() !== 'dati_libro.md');
  blocks.forEach(filename => {
    const opt = document.createElement('option');
    opt.value = filename;
    opt.textContent = `📑 ${filename}`;
    select.appendChild(opt);
  });

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

// Live preview fedele alla scheda di stampa (senza doppia intestazione)
function renderEditorLivePreview() {
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
      <div class="doc-subtitle">${escapeHtml(globalBookTitle)} — ${escapeHtml(parsed.title)}</div>
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
      replacement = `\n\n| Affermazione | V | F |\n| :--- | :---: | :---: |\n| 1. ${selectedText || 'Prima affermazione da verificare'} | [ ] | [ ] |\n| 2. Seconda affermazione da verificare | [ ] | [ ] |\n\n**Correzione delle affermazioni false:**  \n_________________________________________________________________________________________  \n_________________________________________________________________________________________  \n`;
      cursorOffset = replacement.length;
      break;
    case 'match_table':
      replacement = `\n\n| Termine o Modo di Dire | Abbinamento | Significato Contestuale |\n| :--- | :---: | :--- |\n| 1. ${selectedText || 'Primo elemento'} | [ &nbsp;&nbsp; ] | A. Definizione mescolata |\n| 2. Secondo elemento | [ &nbsp;&nbsp; ] | B. Definizione mescolata |\n`;
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

function downloadAllMarkdownFiles() {
  if (isEditorDirty) {
    applyEditorChanges();
  }
  const allFiles = getAllRawWorksheets();
  if (allFiles.length === 0) {
    showNotificationToast("Nessun file Markdown presente da scaricare.");
    return;
  }
  allFiles.forEach((file, idx) => {
    setTimeout(() => {
      downloadMarkdownFile(file.filename, file.markdown);
    }, idx * 250);
  });
  showNotificationToast(`📦 Avviato il download di ${allFiles.length} file Markdown!`);
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
| 1. Primo termine | [ &nbsp;&nbsp; ] | A. Definizione corrispondente al secondo termine |
| 2. Secondo termine | [ &nbsp;&nbsp; ] | B. Definizione corrispondente al primo termine |

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

  contentEl.innerHTML = `
    <div style="padding: 2.5rem 1rem; text-align: center;">
      <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📖</div>
      <h3 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem;">
        Manuale d'Uso & Istruzioni
      </h3>
      <p style="color: #64748b; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
        Impossibile caricare direttamente il manuale dal protocollo locale. Avvia un server web locale o consulta il file README.md.
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

  html = html.replace(/`([^`]+)`/g, (m, c) => `<code style="background: #f1f5f9; color: #0f172a; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.86em; font-family: monospace; border: 1px solid #e2e8f0;">${escapeHtml(c)}</code>`);

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

  html = html.replace(/^>\s+(.+)$/gm, '<blockquote style="margin: 0.75rem 0; padding: 0.6rem 1rem; border-left: 3px solid #cbd5e1; color: #475569; font-style: italic; background: #f8fafc; border-radius: 0 6px 6px 0;">$1</blockquote>');

  html = html.replace(/^#\s+(.+)$/gm, '<h1 style="font-size: 1.5rem; font-weight: 800; margin: 1.6rem 0 0.8rem; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.45rem;">$1</h1>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 style="font-size: 1.25rem; font-weight: 700; margin: 1.4rem 0 0.65rem; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.35rem;">$1</h2>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 style="font-size: 1.05rem; font-weight: 700; margin: 1.15rem 0 0.45rem; color: #334155;">$1</h3>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 style="font-size: 0.95rem; font-weight: 700; margin: 0.9rem 0 0.35rem; color: #475569;">$1</h4>');

  html = html.replace(/^[ \t]*-{3,}[ \t]*$/gm, '<hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;">');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: underline;">$1</a>');

  html = html.replace(/^[ \t]*[-*]\s+(.+)$/gm, '<li style="margin-left: 1.4rem; margin-bottom: 0.35rem; color: #334155;">$1</li>');
  html = html.replace(/^[ \t]*([0-9]+)\.\s+(.+)$/gm, '<li style="margin-left: 1.4rem; margin-bottom: 0.35rem; color: #334155;">$2</li>');

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

  codeBlocks.forEach((blockHtml, idx) => {
    rendered = rendered.replace(`%%%CODE_BLOCK_${idx}%%%`, blockHtml);
  });

  return `<div class="readme-rendered">${rendered}</div>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// 9. Modulo Visualizzazione e Download: Prompt & Contesto
// ============================================================

let currentPromptContextTab = 'prompt';
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

  document.getElementById('btn-tab-prompt')?.classList.toggle('active', tab === 'prompt');
  document.getElementById('btn-tab-context')?.classList.toggle('active', tab === 'context');

  const subtitle = document.getElementById('prompt-context-subtitle');
  const content = document.getElementById('prompt-context-content');
  if (!content) return;

  if (tab === 'prompt') {
    if (subtitle) {
      subtitle.textContent = "Prompt chiavi in mano da fornire all'Agente AI per avviare l'elaborazione progressiva del libro.";
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
  return `Applica rigorosamente la metodologia pedagogica definita nella fonte \`contesto_didattico.md\` al testo integrale del romanzo caricato nel taccuino.

Il tuo compito è generare il materiale didattico in formato **Markdown puro**, rispettando al millimetro i marcatori strutturali richiesti dal parser dell'applicazione web di stampa.

---

### PIANO DI ESECUZIONE PROGRESSIVA (ANTI-TRONCAMENTO)
Per garantire la massima qualità ed evitare tagli dovuti ai limiti di lunghezza delle risposte:
1. **In questa prima risposta**, genera **esclusivamente**:
   - La **FASE 1** completa (il file \`dati_libro.md\` e la **Mappatura generale di tutti i blocchi** del romanzo).
   - La scheda didattica completa del solo **Blocco 1**.
2. Al termine del Blocco 1 **FERMATI** e attendi il mio comando *"Procedi con il Blocco successivo"* per generare i blocchi seguenti uno alla volta.

---

### FASE 1: Metadati (\`dati_libro.md\`) e Mappatura Blocchi

Genera per primo il blocco anagrafico con questa esatta struttura:

# Dati del Libro
- **Titolo:** [Titolo completo del romanzo]
- **Autore:** [Nome e cognome dell'autore]
- **Anno di pubblicazione:** [Anno di prima edizione]
- **Editore:** [Casa editrice]
- **Genere:** [Genere letterario]
- **Ambientazione:** [Luogo ed epoca della vicenda]
- **Target scolastico:** Scuola secondaria di primo grado (11-13 anni)
- **Unità didattiche:** [Numero complessivo di blocchi previsti]

Subito dopo, elenca il **Piano delle Unità Didattiche** (Blocco 1, Blocco 2, ecc.) indicando per ciascuno i capitoli inclusi e il nucleo tematico pedagogico.

---

### FASE 2: Template Obbligatorio per Ciascuna Scheda (\`blocco_XX_esercizi.md\`)

Genera ciascuna scheda didattica seguendo **esattamente** questi titoli, segnaposto e livelli di intestazione (\`#\`, \`##\`, \`###\`):

# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE
## *[Titolo del Romanzo]* di [Autore]
### Unità Didattica [X] (Blocco [X]): *[Capitolo Iniziale]* – *[Capitolo Finale]*

---

**Nome e Cognome dello studente:** ________________________________________  
**Classe:** ____________________  **Data:** ____________________  

---

> ### 🌊 [Titolo evocativo per l'introduzione]
> [Breve citazione dal testo o messaggio motivazionale di benvenuto nei capitoli del blocco]

---

## 1. Comprensione del Testo

### A. Domande a risposta aperta
*Rispondi in modo completo, motivando le tue risposte con riferimenti precisi al testo.*

1. **[Titolo breve 1ª domanda]:** [Testo della domanda inferenziale/causa-effetto]

   _________________________________________________________________________________________  
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

*(Prosegui con le domande 2, 3, 4 e 5, inserendo sempre 3 righe di trattini bassi sotto ciascuna domanda)*

### B. Vero o Falso? (Attenzione ai dettagli)
*Indica se l'affermazione è Vera [V] o Falsa [F]. Correggi e motiva le affermazioni false sulle righe sottostanti.*

| Affermazione | V | F |
| :--- | :---: | :---: |
| 1. [Prima affermazione] | [ ] | [ ] |
| 2. [Seconda affermazione] | [ ] | [ ] |
| 3. [Terza affermazione] | [ ] | [ ] |
| 4. [Quarta affermazione] | [ ] | [ ] |
| 5. [Quinta affermazione] | [ ] | [ ] |

**Correzione delle affermazioni false:**  
_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  

## 2. Analisi dei Personaggi e Riflessione

1. **[Titolo breve analisi]:** [Domanda approfondita su conflitti interiori, scelte etiche o evoluzione del personaggio]

   _________________________________________________________________________________________  
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

## 3. Officina di Scrittura Creativa ed Empatia

*Mettiti nei panni di uno dei protagonisti.*

[Consegna creativa in prima persona: pagina di diario, lettera o monologo interiore]

_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  
_________________________________________________________________________________________  

## 4. Laboratorio Lessicale e Modi di Dire

*Associa ciascun vocabolo o espressione d'autore al suo significato nel contesto del racconto.*

| Termine o Modo di Dire | Abbinamento | Significato Contestuale |
| :--- | :---: | :--- |
| 1. **[Termine 1]** | [ &nbsp;&nbsp; ] | A. [Definizione mescolata] |
| 2. **[Termine 2]** | [ &nbsp;&nbsp; ] | B. [Definizione mescolata] |
| 3. **[Termine 3]** | [ &nbsp;&nbsp; ] | C. [Definizione mescolata] |
| 4. **[Termine 4]** | [ &nbsp;&nbsp; ] | D. [Definizione mescolata] |
| 5. **[Termine 5]** | [ &nbsp;&nbsp; ] | E. [Definizione mescolata] |

## 5. Attività Speciale "Fuori dagli Schemi"

**[Titolo dell'attività speciale scelta a rotazione dal catalogo di \`contesto_didattico.md\`]**  
[Spiegazione chiara della sfida laboratoriale, mappa, indagine o dibattito. Se l'attività prevede una parte grafica o uno schema, inserisci la riga seguente:]

[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]

---

### GUIDA E RIASSUNTO PER IL DOCENTE

#### Riassunto sintetico dei capitoli
[Sinossi puntuale degli eventi del blocco e coordinate tematiche]

#### Soluzioni ed elementi chiave di correzione
- **1.A Domande aperte:** [Risposte modello per ciascun quesito 1-5]
- **1.B Vero o Falso:** [Es. 1. V; 2. F (correzione...); 3. V; 4. F (correzione...); 5. F (correzione...)]
- **2. Analisi dei Personaggi:** [Elementi chiave della riflessione attesa]
- **4. Laboratorio Lessicale:** [Combinazione corretta mescolata, es. 1-C, 2-E, 3-A, 4-B, 5-D]
- **5. Attività Speciale:** [Indicazioni pratiche di conduzione in classe e criteri di valutazione]

---

### VINCOLI TECNICI TASSATIVI PER IL PARSER WEB:
1. **ZERO blocchi di codice (\` \`\`\` \`):** Non racchiudere mai la scheda o parti di essa dentro blocchi con triplo apice inverso. Scrivi direttamente in Markdown normale.
2. **ZERO ASCII-art:** Non disegnare mai scatole o cornici con caratteri testuali (\`+---+\`, \`| |\`, \`===\`).
3. **Marcatori esatti:** Usa sempre \`_________________________________________________________________________________________\` per le righe di scrittura, \`[ &nbsp;&nbsp; ]\` nella colonna centrale del lessico, \`[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]\` per i riquadri da disegno e \`### GUIDA E RIASSUNTO PER IL DOCENTE\` per separare la guida insegnante.

Inizia ora con la **Fase 1** completa e la scheda del **Blocco 1**.\n`;
}

function getFallbackContextText() {
  return `# Metodologia Pedagogica e Linee Guida di Progettazione Didattica

## 1. Identità e Ruolo
Agisci come un esperto e appassionato **docente di Lettere della Scuola Secondaria di Primo Grado** (studenti di 11-13 anni). Il tuo compito è progettare percorsi di lettura profonda, inclusivi e coinvolgenti a partire dal testo integrale dell'opera letteraria fornita come fonte.

---

## 2. Metodo di Analisi Preventiva del Testo
Prima di elaborare qualsiasi scheda didattica, analizza il testo secondo questi tre livelli:
1. **Suddivisione in Unità Logiche (Blocchi):** Raggruppa i capitoli in blocchi narrativi coerenti (circa 1.500–3.500 parole o 2–4 capitoli per blocco), rispettando gli archi di tensione, i cambi di ambientazione o gli snodi chiave della trama.
2. **Nuclei Tematici Fondanti:** Individua il tema formativo profondo di ciascun blocco (es. crescita personale, gestione della paura, lealtà nel gruppo dei pari, conflitto con il mondo adulto, giustizia, pregiudizio, rapporto con l'ambiente).
3. **Catene Causa-Effetto:** Mappa gli incidenti scatenanti, i conflitti interiori e le conseguenze morali o pratiche delle decisioni prese dai personaggi.

---

## 3. Calibrazione Didattica e Qualità dei Quesiti (Target 11-13 anni & BES/DSA)

### A. Tono e Accessibilità Cognitiva
- Usa consegne dirette, chiare, incoraggianti e prive di ambiguità, adatte anche ad alunni con Bisogni Educativi Speciali (BES) o Disturbi Specifici dell'Apprendimento (DSA).
- Evita sia il linguaggio infantile sia il tecnicismo accademico astratto: guida i ragazzi a ragionare sul testo come piccoli investigatori e critici letterari.

### B. Domande di Comprensione (Inferenziali vs Mnemoniche)
- **VIETATO porre domande puramente nozionistiche o mnemoniche** su dettagli irrilevanti (es. *NO: "Di che colore è il cappello del protagonista a pagina 12?"*).
- **OBBLIGATORIO porre domande su motivazioni, impliciti e relazioni causa-effetto** (es. *SÌ: "Per quale motivo il protagonista decide di nascondere la verità all'amico? Quali rischi comporta questa scelta?"*).

### C. Criteri per il "Vero o Falso"
- Formula affermazioni sottili che verifichino la reale comprensione degli snodi narrativi e non la semplice lettura superficiale.
- Bilancia equamente affermazioni vere e false (es. 2 Vere e 3 False, oppure 3 Vere e 2 False) e richiedi sempre agli studenti di correggere e motivare quelle false.

### D. Analisi Psicologica e Scrittura Immedesimativa
- **Analisi dei Personaggi:** Concentrati sulle contraddizioni, sulle paure nascoste, sul cambiamento del carattere e sui dilemmi etici.
- **Officina di Scrittura:** Proponi tracce di scrittura creativa in prima persona che allenino l'empatia e il decentramento del punto di vista (es. pagina di diario segreto, lettera mai spedita, monologo interiore prima di una scelta difficile, messaggio di scuse o difesa).

### E. Selezione Lessicale
- Scegli 5 vocaboli o locuzioni d'autore realmente presenti nei capitoli del blocco: privilegia parole ricercate, metaforiche, settoriali o desuete ma ricche di valore espressivo.
- Formula definizioni contestuali chiare e **mescola sempre l'ordine delle definizioni (A-E)** rispetto all'ordine dei termini (1-5), così che la soluzione non sia mai sequenziale (vieta rigorosamente sequenze banali come 1-A, 2-B, 3-C, 4-D, 5-E).

---

## 4. Repertorio delle Attività Speciali "Fuori dagli Schemi" (Rotazione Obbligatoria)
Per la Sezione 5 di ogni scheda, progetta un'attività laboratoriale sempre diversa tra un blocco e l'altro, scegliendo a rotazione dal seguente catalogo metodologico:

1. **Mappa Topografica o Tattica:** Ricostruzione grafica dei luoghi dell'azione, del percorso dei personaggi o della pianta di un edificio chiave con legenda degli eventi.
2. **Processo in Aula / Dibattito (Debate):** Divisione in due collegi (Accusa/Difesa o Pro/Contro) su una scelta controversa compiuta da un personaggio, con raccolta delle prove dal testo.
3. **Dossier Investigativo / Caccia all'Indizio:** Raccolta e incrocio di indizi, sospettati, moventi o incongruenze disseminati dall'autore nei capitoli.
4. **Redazione Giornalistica d'Epoca:** Scrittura di un articolo di cronaca, un titolo di prima pagina o un'intervista impossibile ai testimoni dell'evento narrato.
5. **Taccuino Naturalistico / Storico / Tecnico:** Approfondimento interdisciplinare (scienze, storia, geografia, tecnica) legato a un elemento reale presente nei capitoli, accompagnato da un rilievo grafico.
6. **Codice Segreto, Stemma o Simbologia:** Ideazione di un emblema araldico, decifrazione di un messaggio in codice o rappresentazione visiva di una metafora centrale del blocco.

---

## 5. Criteri per la Guida Docente e le Chiavi di Correzione
Nella sezione finale riservata all'insegnante, garantisci sempre:
- **Inquadramento rapido:** Riassunto denso ed esaustivo degli avvenimenti del blocco, utile al docente per rinfrescare i dettagli prima della lezione in classe.
- **Risposte Modello complete:** Fornisci la risposta articolata attesa per ciascuna domanda aperta, l'elenco esatto V/F con la correzione completa delle affermazioni false, la stringa di abbinamento del lessico (es. \`1-D, 2-A, 3-E, 4-B, 5-C\`) e i criteri di osservazione per valutare l'attività speciale.\n`;
}

// ============================================================
// 10. Modulo Esportazione DOCX (Word & Google Documenti)
// ============================================================

function xmlEscape(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseMarkdownRunsToDocx(text) {
  let runsXml = "";
  const tokens = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'normal', text: text.substring(lastIndex, match.index) });
    }
    const full = match[0];
    if (full.startsWith('**') && full.endsWith('**')) {
      tokens.push({ type: 'bold', text: full.slice(2, -2) });
    } else if (full.startsWith('*') && full.endsWith('*')) {
      tokens.push({ type: 'italic', text: full.slice(1, -1) });
    } else if (full.startsWith('`') && full.endsWith('`')) {
      tokens.push({ type: 'code', text: full.slice(1, -1) });
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: 'normal', text: text.substring(lastIndex) });
  }

  for (const t of tokens) {
    if (!t.text) continue;
    let rPr = "";
    if (t.type === 'bold') rPr = "<w:b/>";
    else if (t.type === 'italic') rPr = "<w:i/>";
    else if (t.type === 'code') rPr = '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>';
    runsXml += `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlEscape(t.text)}</w:t></w:r>`;
  }
  return runsXml;
}

function markdownToWordXml(md) {
  const lines = md.split(/\r?\n/);
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      i++;
      continue;
    }

    // Header 1 (# ...)
    if (line.startsWith('# ')) {
      elements.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="160" w:after="100"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${xmlEscape(line.slice(2).trim())}</w:t></w:r></w:p>`);
      i++;
      continue;
    }

    // Header 2 (## ...)
    if (line.startsWith('## ')) {
      elements.push(`<w:p><w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="1E3A8A"/></w:rPr><w:t>${xmlEscape(line.slice(3).trim())}</w:t></w:r></w:p>`);
      i++;
      continue;
    }

    // Header 3 (### ...)
    if (line.startsWith('### ')) {
      elements.push(`<w:p><w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="334155"/></w:rPr><w:t>${xmlEscape(line.slice(4).trim())}</w:t></w:r></w:p>`);
      i++;
      continue;
    }

    // Header 4 (#### ...)
    if (line.startsWith('#### ')) {
      elements.push(`<w:p><w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="475569"/></w:rPr><w:t>${xmlEscape(line.slice(5).trim())}</w:t></w:r></w:p>`);
      i++;
      continue;
    }

    // Box Intestazione Studente
    if (line.includes('Nome e Cognome') && (line.includes('Classe') || line.includes('Data'))) {
      elements.push(`
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="9638" w:type="dxa"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            </w:tblBorders>
            <w:tblCellMar>
              <w:top w:w="120" w:type="dxa"/>
              <w:left w:w="180" w:type="dxa"/>
              <w:bottom w:w="120" w:type="dxa"/>
              <w:right w:w="180" w:type="dxa"/>
            </w:tblCellMar>
          </w:tblPr>
          <w:tr>
            <w:tc>
              <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
              <w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Nome e Cognome: </w:t></w:r><w:r><w:t>_____________________________________   </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Classe: </w:t></w:r><w:r><w:t>_________   </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Data: </w:t></w:r><w:r><w:t>_________</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
      `);
      i++;
      continue;
    }

    // Citazione (> ...)
    if (line.startsWith('>')) {
      const cleanQuote = line.replace(/^>\s*/, '').replace(/###\s*/, '');
      elements.push(`
        <w:p>
          <w:pPr>
            <w:ind w:left="400" w:right="400"/>
            <w:pBdr><w:left w:val="single" w:sz="18" w:space="12" w:color="2563EB"/></w:pBdr>
            <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
            <w:spacing w:before="120" w:after="160"/>
          </w:pPr>
          <w:r><w:rPr><w:i/><w:color w:val="475569"/></w:rPr><w:t xml:space="preserve">${xmlEscape(cleanQuote)}</w:t></w:r>
        </w:p>
      `);
      i++;
      continue;
    }

    // Box grafico / disegno
    if (line.includes('[SPAZIO PER') || line.includes('SPAZIO RISERVATO AL DISEGNO') || line.includes('Spazio riservato al disegno')) {
      elements.push(`
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="9638" w:type="dxa"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
              <w:left w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
              <w:bottom w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
              <w:right w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
            </w:tblBorders>
          </w:tblPr>
          <w:tr>
            <w:trPr><w:trHeight w:val="2800" w:hRule="atLeast"/></w:trPr>
            <w:tc>
              <w:tcPr>
                <w:tcW w:w="9638" w:type="dxa"/>
                <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
                <w:vAlign w:val="center"/>
              </w:tcPr>
              <w:p>
                <w:pPr><w:jc w:val="center"/></w:pPr>
                <w:r><w:rPr><w:color w:val="64748B"/><w:i/></w:rPr><w:t>✏️ Spazio riservato al disegno / rilievo grafico</w:t></w:r>
              </w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
      `);
      i++;
      continue;
    }

    // Righe di scrittura / compilazione manuale
    if (/^[_\.]{15,}$/.test(line)) {
      elements.push(`<w:p><w:pPr><w:pBdr><w:bottom w:val="dotted" w:sz="6" w:space="2" w:color="94A3B8"/></w:pBdr><w:spacing w:before="60" w:after="160"/></w:pPr><w:r><w:t></w:t></w:r></w:p>`);
      i++;
      continue;
    }

    // Tabelle Markdown (| ...)
    if (line.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const rows = tableLines.filter(tl => !/^[\|\s\-:]+$/.test(tl));
        let tblXml = `
          <w:tbl>
            <w:tblPr>
              <w:tblW w:w="9638" w:type="dxa"/>
              <w:tblBorders>
                <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
              </w:tblBorders>
              <w:tblCellMar>
                <w:top w:w="100" w:type="dxa"/>
                <w:left w:w="140" w:type="dxa"/>
                <w:bottom w:w="100" w:type="dxa"/>
                <w:right w:w="140" w:type="dxa"/>
              </w:tblCellMar>
            </w:tblPr>
        `;

        rows.forEach((rowStr, rIdx) => {
          const rawCells = rowStr.replace(/^\|/, '').replace(/\|$/, '').split('|');
          const isHeader = rIdx === 0;
          tblXml += `<w:tr>`;
          rawCells.forEach(cell => {
            const cellText = cell.trim();
            const bg = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>` : ``;
            const align = isHeader ? `<w:jc w:val="center"/>` : ``;
            const contentRuns = isHeader
              ? `<w:r><w:rPr><w:b/></w:rPr><w:t>${xmlEscape(cellText)}</w:t></w:r>`
              : parseMarkdownRunsToDocx(cellText);

            tblXml += `
              <w:tc>
                <w:tcPr>${bg}<w:vAlign w:val="center"/></w:tcPr>
                <w:p><w:pPr>${align}<w:spacing w:after="40"/></w:pPr>${contentRuns}</w:p>
              </w:tc>
            `;
          });
          tblXml += `</w:tr>`;
        });
        tblXml += `</w:tbl>`;
        elements.push(tblXml);
      }
      continue;
    }

    // Separatore ---
    if (/^-{3,}$/.test(line)) {
      elements.push(`<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="8" w:color="E2E8F0"/></w:pBdr><w:spacing w:before="120" w:after="160"/></w:pPr><w:r><w:t></w:t></w:r></w:p>`);
      i++;
      continue;
    }

    // Elenco puntato (- o *)
    if (/^[\-\*]\s+/.test(line)) {
      const itemText = line.replace(/^[\-\*]\s+/, '');
      elements.push(`<w:p><w:pPr><w:ind w:left="400"/><w:spacing w:after="60"/></w:pPr><w:r><w:t>• </w:t></w:r>${parseMarkdownRunsToDocx(itemText)}</w:p>`);
      i++;
      continue;
    }

    // Paragrafo standard
    elements.push(`<w:p><w:pPr><w:spacing w:after="100"/></w:pPr>${parseMarkdownRunsToDocx(line)}</w:p>`);
    i++;
  }

  return elements.join('\n');
}

async function buildDocxZipBlob(bodyXmlElements) {
  if (typeof JSZip === 'undefined') {
    throw new Error("Libreria JSZip non disponibile.");
  }
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`);

  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  const wordFolder = zip.folder('word');
  wordFolder.folder('_rels').file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`);

  wordFolder.file('settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`);

  wordFolder.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="1E293B"/>
        <w:lang w:val="it-IT"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="140" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXmlElements}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  wordFolder.file('document.xml', documentXml);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportStudentDocx() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) {
    showNotificationToast("Nessun blocco didattico selezionato.");
    return;
  }
  const selectedExercises = block.exercises.filter(ex => selectedState[block.id] && selectedState[block.id].has(ex.id));
  if (selectedExercises.length === 0) {
    showNotificationToast("Nessun esercizio selezionato da esportare.");
    return;
  }

  let md = `# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE\n`;
  md += `## *${globalBookTitle}* — ${block.title}\n`;
  md += `**Nome e Cognome dello studente:** ________________________________________  **Classe:** ____________  **Data:** ____________\n\n`;
  if (block.welcomeNote) {
    md += `> ### 🌊 Citazione\n> ${block.welcomeNote}\n\n`;
  }
  md += selectedExercises.map(ex => ex.rawMarkdown || '').join('\n\n---\n\n');
  md += `\n\n---\n*Scuola Secondaria di Primo Grado — Scheda di Lavoro Individuale o di Coppia*\n`;

  try {
    showNotificationToast("⏳ Generazione file DOCX in corso...");
    const xml = markdownToWordXml(md);
    const blob = await buildDocxZipBlob(xml);
    const safeName = (block.title || 'Scheda_Studenti').replace(/[^a-zA-Z0-9_\-]/g, '_');
    downloadBlob(blob, `${safeName}_Studenti.docx`);
    showNotificationToast(`📄 File "${safeName}_Studenti.docx" scaricato! Pronto per Google Drive e Word.`);
  } catch (err) {
    console.error(err);
    showNotificationToast("Errore durante la generazione del file DOCX.");
  }
}

async function exportTeacherDocx() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) {
    showNotificationToast("Nessun blocco didattico selezionato.");
    return;
  }
  if (!block.teacherGuideMd || !block.teacherGuideMd.trim()) {
    showNotificationToast("Nessuna guida per il docente presente in questa unità.");
    return;
  }

  let md = `# GUIDA E SOLUZIONI PER IL DOCENTE\n`;
  md += `## *${globalBookTitle}* — ${block.title}\n\n`;
  md += block.teacherGuideMd.trim();

  try {
    showNotificationToast("⏳ Generazione file DOCX in corso...");
    const xml = markdownToWordXml(md);
    const blob = await buildDocxZipBlob(xml);
    const safeName = (block.title || 'Guida_Docente').replace(/[^a-zA-Z0-9_\-]/g, '_');
    downloadBlob(blob, `${safeName}_Guida_Docente.docx`);
    showNotificationToast(`📄 File "${safeName}_Guida_Docente.docx" scaricato! Pronto per Google Drive e Word.`);
  } catch (err) {
    console.error(err);
    showNotificationToast("Errore durante la generazione del file DOCX.");
  }
}

async function exportFullBookDocx() {
  if (!BLOCKS_DATA || BLOCKS_DATA.length === 0) {
    showNotificationToast("Nessun blocco didattico caricato.");
    return;
  }

  let md = `# FASCICOLO DIDATTICO COMPLETO\n`;
  md += `## *${globalBookTitle}*\n\n`;

  BLOCKS_DATA.forEach((block, idx) => {
    const selectedExercises = block.exercises.filter(ex => selectedState[block.id] && selectedState[block.id].has(ex.id));
    if (selectedExercises.length === 0) return;

    if (idx > 0) md += `\n\n---\n\n`;
    md += `# ${block.title}\n`;
    md += `**Nome e Cognome dello studente:** ________________________________________  **Classe:** ____________  **Data:** ____________\n\n`;
    if (block.welcomeNote) {
      md += `> ### 🌊 Citazione\n> ${block.welcomeNote}\n\n`;
    }
    md += selectedExercises.map(ex => ex.rawMarkdown || '').join('\n\n---\n\n');
  });

  try {
    showNotificationToast("⏳ Generazione fascicolo completo DOCX...");
    const xml = markdownToWordXml(md);
    const blob = await buildDocxZipBlob(xml);
    const safeName = (globalBookTitle || 'Fascicolo_Didattico').replace(/[^a-zA-Z0-9_\-]/g, '_');
    downloadBlob(blob, `${safeName}_Fascicolo_Completo_Studenti.docx`);
    showNotificationToast(`📄 File "${safeName}_Fascicolo_Completo_Studenti.docx" scaricato!`);
  } catch (err) {
    console.error(err);
    showNotificationToast("Errore durante la generazione del fascicolo DOCX.");
  }
}