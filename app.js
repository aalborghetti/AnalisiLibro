/**
 * Generatore Schede Didattiche - Logica Client-Side (GitHub Pages & Locale)
 * Parser Markdown universale, selezione esercizi, anteprima, supporto DSA/BES e stampa PDF
 */

// Stato dell'applicazione
const DEFAULT_BOOK_TITLE = "Schede Didattiche di Lettura";
const BOOK_STORAGE_KEY = 'ANALISI_LIBRO_LAST_BOOK';
const LOCAL_EDITS_STORAGE_KEY = 'ANALISI_LIBRO_LOCAL_EDITS';
let BLOCKS_DATA = [];
let currentBlockId = null;
const selectedState = {}; // nome file -> Set degli ID degli esercizi selezionati
let globalBookTitle = DEFAULT_BOOK_TITLE;
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

function isDatiLibro(filename) {
  return String(filename || '').toLowerCase() === 'dati_libro.md';
}

// Ordinamento naturale: blocco_2 prima di blocco_10
function compareFilenames(a, b) {
  return a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' });
}

// Tipologia, etichetta e descrizione di un esercizio a partire dal titolo della sezione
function classifySection(title) {
  const titleLower = title.toLowerCase();
  if (titleLower.includes("vero o falso") || titleLower.includes("v/f")) {
    return { type: "vf", typeLabel: "Vero o Falso", desc: "Verifica dell'attenzione ai dettagli narrativi e correzione delle affermazioni false." };
  }
  if (titleLower.includes("comprensione")) {
    return { type: "comprensione", typeLabel: "Comprensione del Testo", desc: "Domande a risposta aperta su motivazioni, impliciti e relazioni causa-effetto." };
  }
  if (titleLower.includes("analisi") || titleLower.includes("personagg")) {
    return { type: "analisi", typeLabel: "Analisi Personaggi", desc: "Riflessione psicologica sui conflitti interiori e sulle scelte etiche dei protagonisti." };
  }
  if (titleLower.includes("scrittura") || titleLower.includes("officina") || titleLower.includes("immedesimazione") || titleLower.includes("empatia")) {
    return { type: "scrittura", typeLabel: "Officina di Scrittura", desc: "Traccia di immedesimazione personale in prima persona, pagina di diario o lettera." };
  }
  if (titleLower.includes("lessic") || titleLower.includes("linguaggio") || titleLower.includes("parole")) {
    return { type: "lessico", typeLabel: "Laboratorio Lessicale", desc: "Abbinamento di vocaboli complessi e modi di dire d'autore al significato contestuale." };
  }
  if (titleLower.includes("speciale") || titleLower.includes("schemi") || titleLower.includes("estemporane") || titleLower.includes("compito di realtà") || titleLower.includes("rilievo")) {
    return { type: "speciale", typeLabel: "Attività Speciale", desc: "Esperienza laboratoriale creativa, mappa visiva, indagine o rilievo grafico." };
  }
  return { type: "comprensione", typeLabel: "Comprensione del Testo", desc: "Domande a risposta aperta su motivazioni, impliciti e relazioni causa-effetto." };
}

// Un esercizio può appartenere a un gruppo (es. "## 1. Comprensione del Testo" diviso in A/B):
// il titolo del gruppo viene stampato una sola volta anche se si selezionano entrambe le parti
function makeExercise(id, cls, title, bodyMd, groupHeadingMd = '') {
  const fullMd = groupHeadingMd ? `${groupHeadingMd}\n\n${bodyMd}` : bodyMd;
  return {
    id: id,
    type: cls.type,
    typeLabel: cls.typeLabel,
    title: title,
    desc: cls.desc,
    group: groupHeadingMd || null,
    rawMarkdown: fullMd,
    rawMarkdownBody: bodyMd,
    contentHtml: markdownToHtml(fullMd),
    contentHtmlBody: markdownToHtml(bodyMd)
  };
}

// Divide una sezione nelle sue sottosezioni "### A. ...", "### B. ..." (almeno due), altrimenti null
function splitLetteredSubsections(sectionChunk, baseId) {
  const subRegex = /^###\s+([A-Z]\.\s+[^\n]+)$/gm;
  const subs = [];
  let match;
  while ((match = subRegex.exec(sectionChunk)) !== null) {
    subs.push({ title: match[1].trim(), start: match.index });
  }
  if (subs.length < 2) return null;

  const groupHeadingMd = sectionChunk.substring(0, subs[0].start).trim();
  return subs.map((sub, j) => {
    const end = (j + 1 < subs.length) ? subs[j + 1].start : sectionChunk.length;
    const bodyMd = sectionChunk.substring(sub.start, end).trim();
    return makeExercise(
      `${baseId}_${String.fromCharCode(97 + j)}`,
      classifySection(sub.title),
      sub.title.replace(/^[A-Z]\.\s*/, ''),
      bodyMd,
      groupHeadingMd
    );
  });
}

// Unisce gli esercizi selezionati (HTML o Markdown) mostrando una sola volta il titolo di gruppo
function joinSelectedExercises(exercises, format) {
  let lastGroup = null;
  return exercises.map((ex, idx) => {
    const sameGroup = ex.group && ex.group === lastGroup;
    lastGroup = ex.group;
    if (format === 'html') {
      return sameGroup ? ex.contentHtmlBody : ex.contentHtml;
    }
    const separator = idx === 0 ? '' : (sameGroup ? '\n\n' : '\n\n---\n\n');
    return separator + (sameGroup ? ex.rawMarkdownBody : ex.rawMarkdown);
  }).join(format === 'html' ? '\n' : '');
}

// 1. Markdown Parser per Schede Didattiche
function parseWorksheetMarkdown(filename, rawMd) {
  rawMd = String(rawMd || '').replace(/\r\n?/g, '\n');
  let blockTitle = "";
  let welcomeNote = "";
  const safeFileId = makeSafeId(filename);

  // Separa i contenuti dello studente dalla guida docente (al primo titolo della guida)
  let studentMd = rawMd;
  let teacherGuideMd = "";
  const teacherSplitRegex = /^#{1,3}\s*(?:[0-9]+\.\s*)?(?:GUIDA\s+E\s+RIASSUNTO\s+PER\s+IL\s+DOCENTE|Riassunto\s+per\s+il\s+docente|Guida\s+per\s+il\s+docente)/im;
  const teacherMatch = teacherSplitRegex.exec(rawMd);
  if (teacherMatch) {
    studentMd = rawMd.slice(0, teacherMatch.index);
    teacherGuideMd = rawMd.slice(teacherMatch.index + teacherMatch[0].length);
  }

  // Ricava il titolo del blocco da "### Unità Didattica X (Blocco X): ..." o dal primo H1
  const blockMatch = rawMd.match(/^###\s+(?:Unità\s+Didattica\s+[0-9]+\s*(?:\(\s*Blocco\s+[0-9]+\s*\))?\s*:?\s*|Blocco\s+[0-9]+\s*:?\s*|[^\n]+:\s*)(.+)$/m) || rawMd.match(/^#\s+(.+)$/m);
  if (blockMatch) {
    blockTitle = blockMatch[1].replace(/\*/g, '').trim();
  } else {
    blockTitle = filename.replace(/\.md$/, '');
  }

  // Numero reale del blocco (dal titolo o dal nome del file)
  const numMatch = rawMd.match(/^###\s+(?:Unità\s+Didattica|[^\n]*Blocco)\s+([0-9]+)/mi) || String(filename).match(/([0-9]+)/);
  const blockNumber = numMatch ? parseInt(numMatch[1], 10) : null;

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
    const cls = classifySection(current.title);

    // Comprensione: "### A. Domande aperte" e "### B. Vero o Falso" diventano esercizi selezionabili separatamente
    if (cls.type === "comprensione") {
      const subExercises = splitLetteredSubsections(sectionChunk, `${safeFileId}_sec_${i}`);
      if (subExercises) {
        exercises.push(...subExercises);
        continue;
      }
    }

    // Retrocompatibilità: Sezione combinata Analisi del Personaggio + Scrittura Creativa nello stesso H2
    const analSplitRegex = /(?:###\s+B\.\s+|####\s+(?:Spazio\s+)?Scrittura)/i;
    if (cls.type === "analisi" && analSplitRegex.test(sectionChunk)) {
      const parts = sectionChunk.split(analSplitRegex);
      if (parts.length > 1) {
        exercises.push(makeExercise(
          `${safeFileId}_sec_${i}_a`,
          { type: "analisi", typeLabel: "Analisi Personaggi", desc: "Riflessione sui conflitti interiori e sulle scelte etiche." },
          "Analisi del Personaggio e Riflessione",
          parts[0]
        ));
        exercises.push(makeExercise(
          `${safeFileId}_sec_${i}_b`,
          { type: "scrittura", typeLabel: "Officina di Scrittura", desc: "Traccia di immedesimazione personale o monologo interiore." },
          "Spunto di Scrittura Creativa ed Empatia",
          "### Scrittura Creativa ed Empatia\n" + parts[1]
        ));
        continue;
      }
    }

    exercises.push(makeExercise(
      `${safeFileId}_sec_${i}`,
      cls,
      current.title.replace(/^[0-9]+\.\s*/, ''),
      sectionChunk
    ));
  }

  return {
    filename: filename,
    blockNumber: blockNumber,
    title: blockTitle,
    welcomeNote: welcomeNote,
    teacherGuideMd: teacherGuideMd,
    exercises: exercises,
    rawMarkdown: rawMd
  };
}

// Sanitizzazione dell'HTML generato dal Markdown (i file .md possono provenire da AI o da terzi):
// mantiene solo tag e attributi di formattazione, rimuove script, gestori di eventi e URL "javascript:"
const SANITIZE_ALLOWED_TAGS = new Set(['DIV', 'SPAN', 'P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SUB', 'SUP', 'SMALL', 'MARK', 'CODE', 'PRE', 'BLOCKQUOTE', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'A']);
const SANITIZE_DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);
const SANITIZE_ALLOWED_ATTRS = new Set(['class', 'style', 'colspan', 'rowspan', 'title', 'href']);

function sanitizeHtml(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const walk = (parent) => {
    Array.from(parent.children).forEach(el => {
      const tag = el.tagName.toUpperCase();
      if (SANITIZE_DROPPED_TAGS.has(tag)) {
        el.remove();
        return;
      }
      walk(el);
      if (!SANITIZE_ALLOWED_TAGS.has(tag)) {
        el.replaceWith(...el.childNodes);
        return;
      }
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        if (!SANITIZE_ALLOWED_ATTRS.has(name)) {
          el.removeAttribute(attr.name);
        } else if (name === 'href' && /^\s*(?:javascript|data|vbscript):/i.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
    });
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

// Formattatore Markdown -> HTML con filtri di pulizia e conteggio righe reale
function markdownToHtml(md, wrapperClass = 'doc-section') {
  let h = String(md || '').replace(/\r\n?/g, '\n');
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

  // Righe di quaderno per risposta scritta: righe consecutive (anche rientrate) formano un unico blocco
  // con il numero esatto di righe presenti nel Markdown; i trattini bassi dentro una frase restano testo
  h = h.replace(/(?:^[ \t]*_{5,}[ \t]*(?:\n|$))+/gm, (match) => {
    const count = (match.match(/_{5,}/g) || []).length;
    const linesHtml = '<div class="write-line"></div>'.repeat(Math.max(1, count));
    return `\n\n<div class="write-lines">${linesHtml}</div>\n\n`;
  });

  // Tabelle Markdown
  h = h.replace(/((?:^[ \t]*\|.+\|[ \t]*(?:\n|$))+)/gm, function(tableBlock) {
    const rawLines = tableBlock.trim().split(/\n/).map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
    if (rawLines.length === 0) return tableBlock;

    const blockTextLower = tableBlock.toLowerCase();
    const isMatchingTable = blockTextLower.includes('corrispondenza') || blockTextLower.includes('abbinamento');

    let theadHtml = '';
    let tbodyHtml = '';
    let isFirst = true;

    rawLines.forEach(line => {
      if (/^\|[\s:|-]+\|$/.test(line)) return;

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
              formatted = formatted.replace(/(?:<strong>)?\[(?:\s|&nbsp;)*\](?:<\/strong>)?/g, '<span class="matching-box">[ &nbsp;&nbsp; ]</span>');
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

  return sanitizeHtml(`<div class="${wrapperClass}">${finalBlocks.join('\n')}</div>`);
}

// 2. Caricamento e Parsing dei Dataset (in memoria)

// Titolo del libro: da dati_libro.md, altrimenti dal sottotitolo "## *Titolo* di Autore" della prima scheda
function extractBookTitle(worksheets) {
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
// "originalsArray" indica le versioni da usare per "Ripristina Iniziale" (es. quelle pubblicate sul sito)
function loadRawWorksheets(worksheetsArray, originalsArray = null) {
  RAW_FILES_CACHE.clear();
  ORIGINAL_FILES_CACHE.clear();
  Object.keys(selectedState).forEach(key => delete selectedState[key]);
  BLOCKS_DATA = [];
  currentBlockId = null;

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
}

// Ricostruisce i blocchi dalla cache dei file conservando le selezioni degli esercizi già noti;
// gli esercizi nuovi (es. aggiunti nell'editor) vengono selezionati di default
function rebuildBlocksFromCache(focusFilename = null) {
  const previousBlocks = new Map(BLOCKS_DATA.map(b => [b.filename, b]));
  const currentBlock = BLOCKS_DATA.find(b => b.id === currentBlockId);
  const targetFilename = focusFilename || (currentBlock ? currentBlock.filename : null);

  const worksheets = getAllRawWorksheets();
  globalBookTitle = extractBookTitle(worksheets);

  BLOCKS_DATA = worksheets
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
    if (!BLOCKS_DATA.some(b => b.filename === key)) delete selectedState[key];
  });

  if (BLOCKS_DATA.length === 0) {
    currentBlockId = null;
    showEmptyState();
    return;
  }

  const focused = BLOCKS_DATA.find(b => b.filename === targetFilename);
  currentBlockId = focused ? focused.id : BLOCKS_DATA[0].id;

  const dropzone = document.getElementById('dropzone-banner');
  if (dropzone) dropzone.style.display = 'none';
  const hero = document.getElementById('block-hero');
  if (hero) hero.style.display = 'flex';
  const toolbar = document.getElementById('selection-toolbar');
  if (toolbar) toolbar.style.display = 'flex';
  const grid = document.getElementById('exercises-grid');
  if (grid) grid.style.display = 'flex';

  document.getElementById('app-book-title').textContent = globalBookTitle;
  document.getElementById('app-book-subtitle').textContent = `Caricate ${BLOCKS_DATA.length} unità didattiche (${worksheets.length} file elaborati)`;
  document.getElementById('blocks-count-badge').textContent = `${BLOCKS_DATA.length} Unità`;

  renderSidebar();
  renderActiveBlock();
}

// Salva l'insieme di file nel browser; "locallyEdited" indica modifiche non presenti sul sito
function saveBookToStorage(locallyEdited) {
  try {
    localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(getAllRawWorksheets()));
    if (locallyEdited) {
      localStorage.setItem(LOCAL_EDITS_STORAGE_KEY, '1');
    } else {
      localStorage.removeItem(LOCAL_EDITS_STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Storage quota superata o disattivata", err);
  }
}

function readBookFromStorage() {
  try {
    const saved = localStorage.getItem(BOOK_STORAGE_KEY);
    if (!saved) return null;
    const data = JSON.parse(saved);
    if (!Array.isArray(data) || data.length === 0) return null;
    return { worksheets: data, locallyEdited: localStorage.getItem(LOCAL_EDITS_STORAGE_KEY) === '1' };
  } catch (err) {
    console.warn("Storage non accessibile", err);
    return null;
  }
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
  if (list) list.innerHTML = '<div style="padding: 1.5rem 1rem; color: #94a3b8; font-size: 0.85rem; text-align: center;">Nessuna scheda ancora.<br>Segui i passaggi della guida per crearle.</div>';
  document.getElementById('app-book-title').textContent = "Generatore Schede Didattiche & PDF";
  document.getElementById('app-book-subtitle').textContent = "Segui i 4 passaggi per creare le schede del tuo libro";
  document.getElementById('blocks-count-badge').textContent = "0 Unità";
  const closeBtn = document.getElementById('start-guide-close');
  if (closeBtn) closeBtn.style.display = 'none';
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

// 3. Lettura silenziosa delle schede pubblicate (schede_esercizi/) senza generare decine di 404
async function fetchServerWorksheets() {
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

// 4. Gestione File e Cartelle Locali (File API & FileReader)

// File di documentazione del repository da non trattare come schede
const NON_WORKSHEET_FILES = new Set(['readme.md', 'prompt.md', 'contesto_didattico.md', 'security.md', 'changelog.md', 'license.md']);

// Filtra la selezione: se ci sono file "blocco_XX..." tiene solo quelli e dati_libro.md,
// altrimenti tutti i .md tranne la documentazione; scarta i nomi duplicati (sottocartelle)
function selectWorksheetFiles(files) {
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
    showNotificationToast(`ℹ️ Ignorati ${ignored} file .md non riconosciuti come schede o con nome duplicato.`);
  }
  return unique;
}

function handleFolderSelect(fileList) {
  if (!fileList || fileList.length === 0) return;
  const files = selectWorksheetFiles(Array.from(fileList));
  if (files.length === 0) {
    alert("Nessun file Markdown (.md) di schede trovato nella selezione.");
    return;
  }
  processMdFiles(files);
}

function processMdFiles(files) {
  const worksheets = [];
  let readCount = 0;

  const finish = () => {
    worksheets.sort((a, b) => compareFilenames(a.filename, b.filename));
    loadRawWorksheets(worksheets);
    saveBookToStorage(false);
  };

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      worksheets.push({
        filename: file.name,
        markdown: e.target.result
      });
      readCount++;
      if (readCount === files.length) finish();
    };
    reader.onerror = function() {
      readCount++;
      if (readCount === files.length) finish();
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

// Selezione corrente di un blocco (tutti gli esercizi se non ancora definita)
function getSelection(block) {
  if (!selectedState[block.filename]) {
    selectedState[block.filename] = new Set(block.exercises.map(ex => ex.id));
  }
  return selectedState[block.filename];
}

function getSelectedExercises(block) {
  const selection = getSelection(block);
  return block.exercises.filter(ex => selection.has(ex.id));
}

function renderSidebar() {
  const container = document.getElementById('blocks-list');
  container.innerHTML = '';

  BLOCKS_DATA.forEach(block => {
    const selectedCount = getSelection(block).size;
    const totalCount = block.exercises.length;
    const isActive = block.id === currentBlockId;

    const el = document.createElement('div');
    el.className = `block-item ${isActive ? 'active' : ''}`;
    el.onclick = () => selectBlock(block.id);

    el.innerHTML = `
      <div class="block-item-top">
        <span class="block-badge">BLOCCO ${block.blockNumber ?? block.id}</span>
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

  const selection = getSelection(block);
  block.exercises.forEach(ex => {
    const isSelected = selection.has(ex.id);
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
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return;
  const set = getSelection(block);
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
  selectedState[block.filename] = new Set(block.exercises.map(e => e.id));
  renderActiveBlock();
  renderSidebar();
}

function deselectAll() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return;
  selectedState[block.filename] = new Set();
  renderActiveBlock();
  renderSidebar();
}

// Filtro rapido per alunni con BES / verifiche semplificate (Comprensione, V/F e Lessico)
function selectEssentialBes() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) return;
  const essentialTypes = new Set(['comprensione', 'vf', 'lessico']);
  selectedState[block.filename] = new Set(
    block.exercises.filter(e => essentialTypes.has(e.type)).map(e => e.id)
  );
  renderActiveBlock();
  renderSidebar();
  showNotificationToast("🎯 Attivata Selezione Essenziale (BES): Comprensione, V/F e Lessico.");
}

function updateSelectionBadge() {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  const count = block ? getSelection(block).size : 0;
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
  const selectedExercises = getSelectedExercises(block);

  let exercisesHtml = '';
  if (selectedExercises.length === 0) {
    exercisesHtml = `
      <div style="text-align: center; padding: 3rem; color: #64748b;">
        <h3>Nessun esercizio selezionato per questo blocco.</h3>
        <p>Torna indietro e seleziona almeno un'attività da includere nella scheda.</p>
      </div>
    `;
  } else {
    exercisesHtml = joinSelectedExercises(selectedExercises, 'html');
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

// Dall'anteprima il DOCX eredita l'impostazione Alta Leggibilità (DSA) attiva
function exportCurrentPreviewDocx() {
  const opts = { dsa: isDsaMode };
  if (currentPreviewType === 'teacher') {
    exportTeacherDocx(opts);
  } else if (currentPreviewType === 'full') {
    exportFullBookDocx(opts);
  } else {
    exportStudentDocx(opts);
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
  // Come nel DOCX, le unità senza esercizi selezionati non vengono incluse nel fascicolo
  const blocksWithSelection = BLOCKS_DATA.filter(block => getSelectedExercises(block).length > 0);
  if (blocksWithSelection.length === 0) {
    showNotificationToast("Nessun esercizio selezionato in nessuna unità.");
    return;
  }
  currentPreviewType = 'full';
  const modalTitle = document.querySelector('#preview-modal .modal-title');
  if (modalTitle) modalTitle.textContent = `Fascicolo Completo Studenti (${blocksWithSelection.length} Unità Didattiche)`;

  const fullHtml = blocksWithSelection.map((block, idx) => {
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
      const files = selectWorksheetFiles(await getFilesFromDataTransferItems(e.dataTransfer.items));
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
      const aim = document.getElementById('ai-import-modal');
      if (aim && aim.classList.contains('open')) {
        closeAiImportModal();
      }
    }
  });

  const aiImportModal = document.getElementById('ai-import-modal');
  if (aiImportModal) {
    aiImportModal.addEventListener('click', (e) => {
      if (e.target === aiImportModal) {
        closeAiImportModal();
      }
    });
  }

  // Guida rapida: precaricamento di prompt e contesto (la copia negli appunti deve avvenire
  // subito dopo il clic, senza attendere una richiesta di rete)
  ensurePromptAndContextLoaded();

  // 1. Schede pubblicate sul sito (schede_esercizi/) e copia salvata nel browser
  const serverWorksheets = await fetchServerWorksheets();
  const stored = readBookFromStorage();

  // 2. Le modifiche locali (editor / importazione AI) non vengono mai sovrascritte senza chiedere
  if (stored && stored.locallyEdited && serverWorksheets.length > 0) {
    const keepLocal = confirm(
      "Nel browser sono presenti modifiche alle schede (editor o importazione AI) che non sono pubblicate sul sito.\n\n" +
      "OK = ripristina le tue modifiche locali\n" +
      "Annulla = carica le schede pubblicate sul sito (le modifiche locali verranno scartate)"
    );
    if (keepLocal) {
      loadRawWorksheets(stored.worksheets, serverWorksheets);
      showNotificationToast("↩️ Modifiche locali ripristinate. \"Ripristina Iniziale\" riporta alla versione del sito.");
    } else {
      loadRawWorksheets(serverWorksheets);
      saveBookToStorage(false);
    }
    return;
  }

  if (serverWorksheets.length > 0) {
    loadRawWorksheets(serverWorksheets);
    saveBookToStorage(false);
    return;
  }

  if (stored) {
    loadRawWorksheets(stored.worksheets);
    return;
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

  const keys = Array.from(RAW_FILES_CACHE.keys()).sort(compareFilenames);

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

function applyEditorChanges() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea || !editorCurrentFile) return;

  const content = textarea.value;
  RAW_FILES_CACHE.set(editorCurrentFile, content);
  rebuildBlocksFromCache(isDatiLibro(editorCurrentFile) ? null : editorCurrentFile);
  saveBookToStorage(true);

  setEditorDirty(false);
  showNotificationToast(`✅ File "${editorCurrentFile}" salvato e applicato con successo!`);
}

function getAllRawWorksheets() {
  const list = [];
  RAW_FILES_CACHE.forEach((markdown, filename) => {
    list.push({ filename, markdown });
  });
  list.sort((a, b) => compareFilenames(a.filename, b.filename));
  return list;
}

function downloadCurrentEditorFile() {
  const textarea = document.getElementById('editor-textarea');
  if (!textarea || !editorCurrentFile) return;
  const content = textarea.value;
  downloadMarkdownFile(editorCurrentFile, content);
  showNotificationToast(`⬇️ Download completato per "${editorCurrentFile}"`);
}

// Scarica tutti i file in un unico .zip (cartella schede_esercizi/ con manifest.json pronta da pubblicare)
async function downloadAllMarkdownFiles() {
  if (isEditorDirty) {
    applyEditorChanges();
  }
  const allFiles = getAllRawWorksheets();
  if (allFiles.length === 0) {
    showNotificationToast("Nessun file Markdown presente da scaricare.");
    return;
  }

  if (typeof JSZip === 'undefined') {
    allFiles.forEach((file, idx) => {
      setTimeout(() => {
        downloadMarkdownFile(file.filename, file.markdown);
      }, idx * 250);
    });
    showNotificationToast(`📦 Avviato il download di ${allFiles.length} file Markdown!`);
    return;
  }

  try {
    const zip = new JSZip();
    const folder = zip.folder('schede_esercizi');
    allFiles.forEach(file => folder.file(file.filename, file.markdown));
    folder.file('manifest.json', JSON.stringify(allFiles.map(file => file.filename), null, 2) + '\n');
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'schede_esercizi.zip');
    showNotificationToast(`📦 Scaricato schede_esercizi.zip con ${allFiles.length} file e manifest.json!`);
  } catch (err) {
    console.error(err);
    showNotificationToast("Errore durante la creazione dell'archivio .zip.");
  }
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

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, href) => {
    if (/^\s*(?:javascript|data|vbscript):/i.test(href)) return label;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; font-weight: 600; text-decoration: underline;">${label}</a>`;
  });

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
      showNotificationToast('📋 Prompt operativo copiato negli appunti! Incollalo nella chat del taccuino NotebookLM.');
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

  // Si copia sempre il file integrale (il prompt non contiene blocchi di codice da estrarre)
  const msg = isPrompt
    ? '🤖 Prompt operativo per NotebookLM copiato negli appunti!'
    : `📋 Testo di "${filename}" copiato negli appunti!`;
  copyTextToClipboard(fullText, msg, filename);
}

// Copia negli appunti con ripiego per i browser senza Clipboard API
function copyTextToClipboard(text, successMsg, fallbackFilename) {
  const onFail = () => fallbackCopyText(text, fallbackFilename, successMsg);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showNotificationToast(successMsg)).catch(onFail);
  } else {
    onFail();
  }
}

function fallbackCopyText(text, filename, successMsg = '📋 Testo copiato negli appunti!') {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (_) {}
  showNotificationToast(copied ? successMsg : `Impossibile copiare automaticamente. Scarica il file "${filename}".`);
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

// Copia di riserva di prompt.md (usata quando l'app è aperta da file://): mantenerla identica al file
function getFallbackPromptText() {
  return `Applica rigorosamente la metodologia pedagogica definita nella fonte \`contesto_didattico.md\` al testo integrale del romanzo caricato come fonte del taccuino.

Il tuo compito è generare il materiale didattico in formato **Markdown puro**, rispettando al millimetro i marcatori strutturali richiesti dal parser dell'applicazione web di stampa.

---

### PIANO DI ESECUZIONE PROGRESSIVA (ANTI-TRONCAMENTO)
Per garantire la massima qualità ed evitare tagli dovuti ai limiti di lunghezza delle risposte:
1. **In questa prima risposta**, genera **esclusivamente**:
   - Il file \`dati_libro.md\` della **FASE 1** (metadati e Piano delle Unità Didattiche).
   - Il file \`blocco_01_esercizi.md\` con la scheda didattica completa del **Blocco 1**.
2. Al termine del Blocco 1 **FERMATI** e attendi il mio comando *"Procedi con il Blocco successivo"*. A ogni comando genera **un solo** file \`blocco_XX_esercizi.md\`, rispettando il Piano delle Unità Didattiche.

---

### DELIMITAZIONE DEI FILE (OBBLIGATORIA)
L'applicazione web separa automaticamente i file incollati grazie a due righe speciali, da scrivere ciascuna da sola su una riga:
- **Prima di ogni file:** \`[[FILE: nome_del_file.md]]\` (es. \`[[FILE: dati_libro.md]]\`, \`[[FILE: blocco_01_esercizi.md]]\`).
- **Alla fine di ogni file:** \`[[FINE]]\`.
- Numera i blocchi sempre con due cifre (\`blocco_01\`, \`blocco_02\`, … \`blocco_10\`).
- Eventuali commenti o domande rivolti a me vanno scritti solo dopo l'ultima riga \`[[FINE]]\`.

---

### FASE 1: Metadati e Piano delle Unità Didattiche (\`dati_libro.md\`)

Genera il file con questa esatta struttura:

[[FILE: dati_libro.md]]
# Dati del Libro
- **Titolo:** [Titolo completo del romanzo]
- **Autore:** [Nome e cognome dell'autore]
- **Anno di pubblicazione:** [Anno di prima edizione]
- **Editore:** [Casa editrice]
- **Genere:** [Genere letterario]
- **Ambientazione:** [Luogo ed epoca della vicenda]
- **Target scolastico:** Scuola secondaria di primo grado (11-13 anni)
- **Unità didattiche:** [Numero complessivo di blocchi previsti]

## Piano delle Unità Didattiche
- **Blocco 1** — Capitoli: [capitoli inclusi] · Nucleo tematico: [tema pedagogico] · Attività speciale: [tipologia dal catalogo]
- **Blocco 2** — Capitoli: [capitoli inclusi] · Nucleo tematico: [tema pedagogico] · Attività speciale: [tipologia dal catalogo]

[[FINE]]

Nel Piano elenca tutti i blocchi del romanzo e assegna a ciascuno l'attività speciale della Sezione 5 secondo la regola di rotazione di \`contesto_didattico.md\` (tutte le sei tipologie prima di ripeterne una, mai la stessa tipologia in due blocchi consecutivi). Nei blocchi successivi rispetta sempre questa assegnazione.

---

### FASE 2: Template Obbligatorio per Ciascuna Scheda (\`blocco_XX_esercizi.md\`)

**Regole di compilazione** (da applicare, non da trascrivere nella scheda):
- **Sezione 1.A:** esattamente 5 domande numerate da 1 a 5, ciascuna con la stessa struttura della domanda 1 e seguita da 3 righe di scrittura.
- **Sezione 1.B:** esattamente 5 affermazioni (2 vere e 3 false, oppure 3 vere e 2 false).
- **Sezione 2:** esattamente 2 domande numerate (1 e 2), ciascuna seguita da 3 righe di scrittura.
- **Sezione 4:** 5 termini realmente presenti nei capitoli del blocco, con le definizioni A-E in ordine mescolato.
- **Sezione 5:** l'attività speciale assegnata a questo blocco nel Piano delle Unità Didattiche.
- Sostituisci tutti i segnaposto tra parentesi quadre, tranne le caselle \`[ ]\` e \`[   ]\` e il riquadro \`[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]\`.

Genera ciascuna scheda seguendo **esattamente** questi titoli, segnaposto e livelli di intestazione (\`#\`, \`##\`, \`###\`):

[[FILE: blocco_XX_esercizi.md]]
# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE
## *[Titolo del Romanzo]* di [Autore]
### Unità Didattica [X] (Blocco [X]): *[Capitolo Iniziale]* – *[Capitolo Finale]*

---

> ### 🌊 [Titolo evocativo per l'introduzione]
> [Breve citazione dal testo o messaggio motivazionale di benvenuto nei capitoli del blocco]

---

## 1. Comprensione del Testo

### A. Domande a risposta aperta
*Rispondi in modo completo, motivando le tue risposte con riferimenti precisi al testo.*

1. **[Titolo breve della domanda]:** [Testo della domanda inferenziale/causa-effetto]

   _________________________________________________________________________________________  
   _________________________________________________________________________________________  
   _________________________________________________________________________________________  

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

1. **[Titolo breve dell'analisi]:** [Domanda approfondita su conflitti interiori, scelte etiche o evoluzione del personaggio]

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
| 1. **[Termine 1]** | [   ] | A. [Definizione mescolata] |
| 2. **[Termine 2]** | [   ] | B. [Definizione mescolata] |
| 3. **[Termine 3]** | [   ] | C. [Definizione mescolata] |
| 4. **[Termine 4]** | [   ] | D. [Definizione mescolata] |
| 5. **[Termine 5]** | [   ] | E. [Definizione mescolata] |

## 5. Attività Speciale "Fuori dagli Schemi"

**[Titolo dell'attività speciale assegnata a questo blocco nel Piano delle Unità Didattiche]**  
[Spiegazione chiara della sfida laboratoriale, mappa, indagine o dibattito. Se l'attività prevede una parte grafica o uno schema, inserisci la riga seguente:]

[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]

---

### GUIDA E RIASSUNTO PER IL DOCENTE

#### Riassunto sintetico dei capitoli
[Sinossi puntuale degli eventi del blocco e coordinate tematiche]

#### Soluzioni ed elementi chiave di correzione
- **1.A Domande aperte:** [Risposta modello per ciascuna delle 5 domande]
- **1.B Vero o Falso:** [Es. 1. V; 2. F (correzione...); 3. V; 4. F (correzione...); 5. F (correzione...)]
- **2. Analisi dei Personaggi:** [Elementi chiave della riflessione attesa per ciascuna delle 2 domande]
- **3. Officina di Scrittura:** [Criteri di valutazione della produzione scritta]
- **4. Laboratorio Lessicale:** [Combinazione corretta mescolata, es. 1-C, 2-E, 3-A, 4-B, 5-D]
- **5. Attività Speciale:** [Indicazioni pratiche di conduzione in classe e criteri di valutazione]

[[FINE]]

---

### VINCOLI TECNICI TASSATIVI PER IL PARSER WEB:
1. **ZERO blocchi di codice:** non racchiudere mai la scheda o parti di essa tra tripli apici inversi. Scrivi direttamente in Markdown normale.
2. **ZERO ASCII-art:** non disegnare mai scatole o cornici con caratteri testuali (\`+---+\`, \`| |\`, \`===\`).
3. **ZERO HTML:** non usare tag HTML né entità come \`&nbsp;\`.
4. **Marcatori esatti:** usa sempre righe di soli trattini bassi \`_________________________________________________________________________________________\` (ciascuna su una riga propria) per le righe di scrittura, \`[   ]\` nella colonna Abbinamento del lessico, \`[SPAZIO PER IL TUO DISEGNO / RILIEVO GRAFICO]\` per i riquadri da disegno, \`### GUIDA E RIASSUNTO PER IL DOCENTE\` per separare la guida insegnante e le righe \`[[FILE: ...]]\` / \`[[FINE]]\` per delimitare ogni file.

Inizia ora con il file \`dati_libro.md\` (Fase 1) e la scheda del **Blocco 1**.
`;
}

// Copia di riserva di contesto_didattico.md (usata quando l'app è aperta da file://): mantenerla identica al file
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
- Proponi **5 domande aperte** per ogni blocco.
- **VIETATO porre domande puramente nozionistiche o mnemoniche** su dettagli irrilevanti (es. *NO: "Di che colore è il cappello del protagonista a pagina 12?"*).
- **OBBLIGATORIO porre domande su motivazioni, impliciti e relazioni causa-effetto** (es. *SÌ: "Per quale motivo il protagonista decide di nascondere la verità all'amico? Quali rischi comporta questa scelta?"*).

### C. Criteri per il "Vero o Falso"
- Formula affermazioni sottili che verifichino la reale comprensione degli snodi narrativi e non la semplice lettura superficiale.
- Bilancia equamente affermazioni vere e false (es. 2 Vere e 3 False, oppure 3 Vere e 2 False) e richiedi sempre agli studenti di correggere e motivare quelle false.

### D. Analisi Psicologica e Scrittura Immedesimativa
- **Analisi dei Personaggi (2 domande):** Concentrati sulle contraddizioni, sulle paure nascoste, sul cambiamento del carattere e sui dilemmi etici.
- **Officina di Scrittura:** Proponi tracce di scrittura creativa in prima persona che allenino l'empatia e il decentramento del punto di vista (es. pagina di diario segreto, lettera mai spedita, monologo interiore prima di una scelta difficile, messaggio di scuse o difesa).

### E. Selezione Lessicale
- Scegli 5 vocaboli o locuzioni d'autore realmente presenti nei capitoli del blocco: privilegia parole ricercate, metaforiche, settoriali o desuete ma ricche di valore espressivo.
- Formula definizioni contestuali chiare e **mescola sempre l'ordine delle definizioni (A-E)** rispetto all'ordine dei termini (1-5), così che la soluzione non sia mai sequenziale (vieta rigorosamente sequenze banali come 1-A, 2-B, 3-C, 4-D, 5-E).

---

## 4. Repertorio delle Attività Speciali "Fuori dagli Schemi" (Rotazione Obbligatoria)
Per la Sezione 5 di ogni scheda, progetta un'attività laboratoriale sempre diversa tra un blocco e l'altro, scegliendo a rotazione dal seguente catalogo metodologico.

**Regola di rotazione:** assegna le attività a tutti i blocchi fin dal Piano delle Unità Didattiche (Fase 1), così che la rotazione resti coerente anche quando i blocchi vengono generati in risposte successive. Usa tutte le sei tipologie prima di ripeterne una e non assegnare mai la stessa tipologia a due blocchi consecutivi (con più di sei blocchi, ricomincia il ciclo variando il taglio dell'attività).

1. **Mappa Topografica o Tattica:** Ricostruzione grafica dei luoghi dell'azione, del percorso dei personaggi o della pianta di un edificio chiave con legenda degli eventi.
2. **Processo in Aula / Dibattito (Debate):** Divisione in due collegi (Accusa/Difesa o Pro/Contro) su una scelta controversa compiuta da un personaggio, con raccolta delle prove dal testo.
3. **Dossier Investigativo / Caccia all'Indizio:** Raccolta e incrocio di indizi, sospettati, moventi o incongruenze disseminati dall'autore nei capitoli.
4. **Redazione Giornalistica d'Epoca:** Scrittura di un articolo di cronaca, un titolo di prima pagina o un'intervista impossibile ai testimoni dell'evento narrato.
5. **Taccuino Naturalistico / Storico / Tecnico:** Approfondimento interdisciplinare (scienze, storia, geografia, tecnica) legato a un elemento reale presente nei capitoli (es. una bussola, una specie animale, un evento storico), accompagnato da un rilievo grafico.
6. **Codice Segreto, Stemma o Simbologia:** Ideazione di un emblema araldico, decifrazione di un messaggio in codice o rappresentazione visiva di una metafora centrale del blocco.

---

## 5. Criteri per la Guida Docente e le Chiavi di Correzione
Nella sezione finale riservata all'insegnante, garantisci sempre:
- **Inquadramento rapido:** Riassunto denso ed esaustivo degli avvenimenti del blocco, utile al docente per rinfrescare i dettagli prima della lezione in classe.
- **Risposte Modello complete:** Non limitarti a indicazioni generiche; fornisci la risposta articolata attesa per ciascuna domanda aperta, l'elenco esatto V/F con la correzione completa delle affermazioni false, i criteri di valutazione della produzione scritta, la stringa di abbinamento del lessico (es. \`1-D, 2-A, 3-E, 4-B, 5-C\`) e i criteri di osservazione per valutare l'attività speciale.
`;
}

// ============================================================
// 10. Modulo Esportazione DOCX (Word & Google Documenti)
// ============================================================

const DOCX_PAGE_BREAK = '<<<PAGE_BREAK>>>';
const DOCX_TEXT_WIDTH = 9638; // Larghezza utile A4 con margini di 2 cm (in twip)

function xmlEscape(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Converte le entità HTML usate nei Markdown e uniforma le caselle di abbinamento "[ ]"
function normalizeDocxText(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[(?:\s| )*\]/g, '[    ]');
}

// Proprietà del run nell'ordine richiesto dallo schema OOXML (rFonts, b, i, color, sz, shd)
function buildRunProps({ bold = false, italic = false, code = false, color = null, size = null } = {}, opts = {}) {
  let rPr = '';
  if (code) rPr += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>';
  if (bold) rPr += '<w:b/>';
  if (italic && !opts.dsa) rPr += '<w:i/>'; // Alta leggibilità: nessun corsivo
  if (color) rPr += `<w:color w:val="${color}"/>`;
  if (size) rPr += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
  if (code) rPr += '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>';
  return rPr ? `<w:rPr>${rPr}</w:rPr>` : '';
}

// Proprietà del paragrafo nell'ordine richiesto dallo schema OOXML (keepNext, pBdr, shd, spacing, ind, jc)
function buildParaProps({ keepNext = false, border = null, shade = null, before = null, after = null, indLeft = null, indRight = null, jc = null } = {}) {
  let pPr = '';
  if (keepNext) pPr += '<w:keepNext/>';
  if (border) pPr += `<w:pBdr>${border}</w:pBdr>`;
  if (shade) pPr += `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>`;
  if (before !== null || after !== null) {
    pPr += `<w:spacing${before !== null ? ` w:before="${before}"` : ''}${after !== null ? ` w:after="${after}"` : ''}/>`;
  }
  if (indLeft !== null || indRight !== null) {
    pPr += `<w:ind${indLeft !== null ? ` w:left="${indLeft}"` : ''}${indRight !== null ? ` w:right="${indRight}"` : ''}/>`;
  }
  if (jc) pPr += `<w:jc w:val="${jc}"/>`;
  return pPr ? `<w:pPr>${pPr}</w:pPr>` : '';
}

function parseMarkdownRunsToDocx(text, base = {}, opts = {}) {
  const normalized = normalizeDocxText(text);
  let runsXml = "";
  const tokens = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'normal', text: normalized.substring(lastIndex, match.index) });
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
  if (lastIndex < normalized.length) {
    tokens.push({ type: 'normal', text: normalized.substring(lastIndex) });
  }

  for (const t of tokens) {
    if (!t.text) continue;
    const props = {
      ...base,
      bold: base.bold || t.type === 'bold',
      italic: base.italic || t.type === 'italic',
      code: t.type === 'code'
    };
    runsXml += `<w:r>${buildRunProps(props, opts)}<w:t xml:space="preserve">${xmlEscape(t.text)}</w:t></w:r>`;
  }
  return runsXml;
}

// Paragrafo vuoto dopo ogni tabella: evita che Word unisca tabelle consecutive
const DOCX_SPACER_PARAGRAPH = '<w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr></w:p>';

// Riquadro a cella singola (intestazione studente, spazio disegno)
function buildDocxBox(innerParagraphsXml, { fill = 'F8FAFC', borderColor = 'CBD5E1', borderSize = 6, minHeight = null } = {}) {
  const border = side => `<w:${side} w:val="single" w:sz="${borderSize}" w:space="0" w:color="${borderColor}"/>`;
  return `<w:tbl>` +
    `<w:tblPr><w:tblW w:w="${DOCX_TEXT_WIDTH}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right'].map(border).join('')}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="120" w:type="dxa"/><w:left w:w="180" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="${DOCX_TEXT_WIDTH}"/></w:tblGrid>` +
    `<w:tr>${minHeight ? `<w:trPr><w:trHeight w:val="${minHeight}" w:hRule="atLeast"/></w:trPr>` : ''}` +
    `<w:tc><w:tcPr><w:tcW w:w="${DOCX_TEXT_WIDTH}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:vAlign w:val="center"/></w:tcPr>${innerParagraphsXml}</w:tc>` +
    `</w:tr></w:tbl>${DOCX_SPACER_PARAGRAPH}`;
}

// Larghezze delle colonne: Vero/Falso e Abbinamento hanno proporzioni dedicate
function computeDocxColumnWidths(headerCells) {
  const n = Math.max(1, headerCells.length);
  const h = headerCells.map(c => c.replace(/\*/g, '').trim().toLowerCase());
  if (n === 3 && h[1].includes('abbinamento')) return [3000, 1600, 5038];
  if (n === 3 && h[1] === 'v' && h[2] === 'f') return [7838, 900, 900];
  const base = Math.floor(DOCX_TEXT_WIDTH / n);
  const widths = Array(n).fill(base);
  widths[n - 1] += DOCX_TEXT_WIDTH - base * n;
  return widths;
}

function buildDocxTable(rows, opts = {}) {
  const colWidths = computeDocxColumnWidths(rows[0]);
  const border = side => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>`;
  let xml = `<w:tbl>` +
    `<w:tblPr><w:tblW w:w="${DOCX_TEXT_WIDTH}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
    `<w:tblGrid>${colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;

  rows.forEach((cells, rIdx) => {
    const isHeader = rIdx === 0;
    xml += `<w:tr>${isHeader ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}`;
    colWidths.forEach((width, cIdx) => {
      const cellText = cells[cIdx] || '';
      const isCheckbox = /^\[(?:\s|&nbsp;| )*\]$/.test(cellText);
      const runs = parseMarkdownRunsToDocx(cellText, { bold: isHeader }, opts);
      xml += `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>` +
        `<w:p>${buildParaProps({ after: 40, jc: (isHeader || isCheckbox) ? 'center' : null })}${runs}</w:p></w:tc>`;
    });
    xml += `</w:tr>`;
  });
  return xml + `</w:tbl>${DOCX_SPACER_PARAGRAPH}`;
}

function markdownToWordXml(md, opts = {}) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const elements = [];
  const headingStyles = {
    1: { size: 32, color: '1E3A8A', before: 160, after: 100, jc: 'center' },
    2: { size: 26, color: '1E3A8A', before: 200, after: 80 },
    3: { size: 23, color: '334155', before: 160, after: 80 },
    4: { size: 22, color: '475569', before: 120, after: 60 }
  };
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    // Interruzione di pagina tra le unità del fascicolo
    if (line === DOCX_PAGE_BREAK) {
      elements.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      i++;
      continue;
    }

    // Titoli (# ... ####), con grassetto/corsivo interni interpretati
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const style = headingStyles[headingMatch[1].length];
      elements.push(`<w:p>${buildParaProps({ keepNext: true, before: style.before, after: style.after, jc: style.jc || null })}${parseMarkdownRunsToDocx(headingMatch[2].trim(), { bold: true, size: style.size, color: style.color }, opts)}</w:p>`);
      i++;
      continue;
    }

    // Box Intestazione Studente
    if (line.includes('Nome e Cognome') && (line.includes('Classe') || line.includes('Data'))) {
      const fields = `<w:p>${buildParaProps({ after: 40 })}` +
        `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Nome e Cognome: </w:t></w:r><w:r><w:t xml:space="preserve">______________________________   </w:t></w:r>` +
        `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Classe: </w:t></w:r><w:r><w:t xml:space="preserve">_________   </w:t></w:r>` +
        `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Data: </w:t></w:r><w:r><w:t>_________</w:t></w:r></w:p>`;
      elements.push(buildDocxBox(fields));
      i++;
      continue;
    }

    // Citazione (righe consecutive "> ..." in un unico riquadro)
    if (line.startsWith('>')) {
      const quoteRuns = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const quoteLine = lines[i].trim().replace(/^>\s*/, '').replace(/^#{1,4}\s*/, '');
        if (quoteLine) quoteRuns.push(parseMarkdownRunsToDocx(quoteLine, { italic: true, color: '475569' }, opts));
        i++;
      }
      const border = '<w:left w:val="single" w:sz="18" w:space="12" w:color="2563EB"/>';
      elements.push(`<w:p>${buildParaProps({ border, shade: 'F8FAFC', before: 120, after: 160, indLeft: 400, indRight: 400 })}${quoteRuns.join('<w:r><w:br/></w:r>')}</w:p>`);
      continue;
    }

    // Box grafico / disegno
    if (line.includes('[SPAZIO PER') || line.includes('SPAZIO RISERVATO AL DISEGNO') || line.includes('Spazio riservato al disegno')) {
      const label = `<w:p>${buildParaProps({ jc: 'center' })}<w:r>${buildRunProps({ italic: true, color: '64748B' }, opts)}<w:t>✏️ Spazio riservato al disegno / rilievo grafico</w:t></w:r></w:p>`;
      elements.push(buildDocxBox(label, { borderColor: '94A3B8', borderSize: 8, minHeight: 2800 }));
      i++;
      continue;
    }

    // Righe di scrittura / compilazione manuale
    if (/^_{5,}$/.test(line) || /^\.{15,}$/.test(line)) {
      // "between": Word unisce i paragrafi consecutivi con lo stesso bordo, senza di esso si vedrebbe una sola riga
      const border = '<w:bottom w:val="dotted" w:sz="6" w:space="2" w:color="94A3B8"/><w:between w:val="dotted" w:sz="6" w:space="2" w:color="94A3B8"/>';
      elements.push(`<w:p>${buildParaProps({ border, before: opts.dsa ? 120 : 60, after: opts.dsa ? 240 : 160 })}</w:p>`);
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
      const rows = tableLines
        .filter(tl => !/^[|\s:-]+$/.test(tl))
        .map(tl => tl.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
      if (rows.length > 0) {
        elements.push(buildDocxTable(rows, opts));
      }
      continue;
    }

    // Separatore ---
    if (/^-{3,}$/.test(line)) {
      const border = '<w:bottom w:val="single" w:sz="6" w:space="8" w:color="E2E8F0"/>';
      elements.push(`<w:p>${buildParaProps({ border, before: 120, after: 160 })}</w:p>`);
      i++;
      continue;
    }

    // Elenco puntato (- o *)
    if (/^[-*]\s+/.test(line)) {
      const itemText = line.replace(/^[-*]\s+/, '');
      elements.push(`<w:p>${buildParaProps({ after: 60, indLeft: 400 })}<w:r><w:t xml:space="preserve">• </w:t></w:r>${parseMarkdownRunsToDocx(itemText, {}, opts)}</w:p>`);
      i++;
      continue;
    }

    // Paragrafo standard
    elements.push(`<w:p>${buildParaProps({ after: 100 })}${parseMarkdownRunsToDocx(line, {}, opts)}</w:p>`);
    i++;
  }

  return elements.join('\n');
}

async function buildDocxZipBlob(bodyXmlElements, opts = {}) {
  if (typeof JSZip === 'undefined') {
    throw new Error("Libreria JSZip non disponibile.");
  }
  const zip = new JSZip();

  // Alta leggibilità (DSA): font sans-serif maggiorato (12,5 pt) e interlinea ampia
  const font = opts.dsa ? 'Verdana' : 'Calibri';
  const fontSize = opts.dsa ? 25 : 22;
  const lineSpacing = opts.dsa ? 360 : 276;

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
        <w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>
        <w:color w:val="1E293B"/>
        <w:sz w:val="${fontSize}"/>
        <w:szCs w:val="${fontSize}"/>
        <w:lang w:val="it-IT"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="140" w:line="${lineSpacing}" w:lineRule="auto"/>
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
  // La revoca immediata può interrompere il download in Firefox/Safari
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

// Markdown della scheda studente di un blocco (solo esercizi selezionati)
function buildStudentDocxMarkdown(block, headingLevel = 2) {
  let md = `${'#'.repeat(headingLevel)} *${globalBookTitle}* — ${block.title}\n`;
  md += `**Nome e Cognome dello studente:** ________________________________________  **Classe:** ____________  **Data:** ____________\n\n`;
  if (block.welcomeNote) {
    md += block.welcomeNote.split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
  }
  md += joinSelectedExercises(getSelectedExercises(block), 'md');
  return md;
}

function docxFileName(base, suffix, opts = {}) {
  const safeName = String(base || 'Scheda').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `${safeName || 'Scheda'}_${suffix}${opts.dsa ? '_DSA' : ''}.docx`;
}

async function exportStudentDocx(opts = {}) {
  const block = BLOCKS_DATA.find(b => b.id === currentBlockId);
  if (!block) {
    showNotificationToast("Nessun blocco didattico selezionato.");
    return;
  }
  if (getSelectedExercises(block).length === 0) {
    showNotificationToast("Nessun esercizio selezionato da esportare.");
    return;
  }

  let md = `# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE\n`;
  md += buildStudentDocxMarkdown(block, 2);
  md += `\n\n---\n*Scuola Secondaria di Primo Grado — Scheda di Lavoro Individuale o di Coppia*\n`;

  try {
    showNotificationToast("⏳ Generazione file DOCX in corso...");
    const xml = markdownToWordXml(md, opts);
    const blob = await buildDocxZipBlob(xml, opts);
    const fileName = docxFileName(block.title, 'Studenti', opts);
    downloadBlob(blob, fileName);
    showNotificationToast(`📄 File "${fileName}" scaricato! Pronto per Google Drive e Word.`);
  } catch (err) {
    console.error(err);
    showNotificationToast("Errore durante la generazione del file DOCX.");
  }
}

async function exportTeacherDocx(opts = {}) {
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
    const xml = markdownToWordXml(md, opts);
    const blob = await buildDocxZipBlob(xml, opts);
    const fileName = docxFileName(block.title, 'Guida_Docente', opts);
    downloadBlob(blob, fileName);
    showNotificationToast(`📄 File "${fileName}" scaricato! Pronto per Google Drive e Word.`);
  } catch (err) {
    console.error(err);
    showNotificationToast("Errore durante la generazione del file DOCX.");
  }
}

async function exportFullBookDocx(opts = {}) {
  if (!BLOCKS_DATA || BLOCKS_DATA.length === 0) {
    showNotificationToast("Nessun blocco didattico caricato.");
    return;
  }
  const blocksWithSelection = BLOCKS_DATA.filter(block => getSelectedExercises(block).length > 0);
  if (blocksWithSelection.length === 0) {
    showNotificationToast("Nessun esercizio selezionato in nessuna unità.");
    return;
  }

  let md = `# FASCICOLO DIDATTICO COMPLETO\n`;
  md += `## *${globalBookTitle}*\n\n`;

  // Ogni unità didattica inizia su una nuova pagina
  blocksWithSelection.forEach(block => {
    md += `\n\n${DOCX_PAGE_BREAK}\n\n`;
    md += buildStudentDocxMarkdown(block, 1);
  });

  try {
    showNotificationToast("⏳ Generazione fascicolo completo DOCX...");
    const xml = markdownToWordXml(md, opts);
    const blob = await buildDocxZipBlob(xml, opts);
    const fileName = docxFileName(globalBookTitle || 'Fascicolo_Didattico', 'Fascicolo_Completo_Studenti', opts);
    downloadBlob(blob, fileName);
    showNotificationToast(`📄 File "${fileName}" scaricato!`);
  } catch (err) {
    console.error(err);
    showNotificationToast("Errore durante la generazione del fascicolo DOCX.");
  }
}

// ============================================================
// 11. Modulo Importazione Risposta AI
// ============================================================

function openAiImportModal() {
  const modal = document.getElementById('ai-import-modal');
  if (!modal) return;
  modal.classList.add('open');
  const textarea = document.getElementById('ai-import-textarea');
  if (textarea) setTimeout(() => textarea.focus(), 50);
}

function closeAiImportModal() {
  const modal = document.getElementById('ai-import-modal');
  if (modal) modal.classList.remove('open');
}

function sanitizeImportedFilename(name) {
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

function nextFreeBlockNumber() {
  const numbers = BLOCKS_DATA.map(b => b.blockNumber || 0);
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

// Divide il testo incollato nei singoli file:
// 1) marcatori "[[FILE: nome.md]]" ... "[[FINE]]" richiesti dal prompt;
// 2) in assenza di marcatori, i titoli "# Dati del Libro" e "# SCHEDA DIDATTICA ..."
function splitAiResponse(text) {
  const clean = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/^[ \t]*```[a-zA-Z]*[ \t]*$/gm, '');
  const files = [];

  const boundaryRegex = /^[ \t]*\\?\[\\?\[\s*(FILE\s*:\s*([^\]\n]+?)|FINE)\s*\\?\]\\?\][ \t]*$/gim;
  const boundaries = [...clean.matchAll(boundaryRegex)];
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

function importAiResponse() {
  const textarea = document.getElementById('ai-import-textarea');
  if (!textarea) return;
  const files = splitAiResponse(textarea.value);
  if (files.length === 0) {
    alert("Nessun file riconosciuto.\n\nVerifica che il testo contenga i marcatori [[FILE: nome.md]] oppure i titoli \"# Dati del Libro\" / \"# SCHEDA DIDATTICA\".");
    return;
  }

  const overwritten = files.filter(f => RAW_FILES_CACHE.has(f.filename)).map(f => f.filename);
  if (overwritten.length > 0 && !confirm(`I seguenti file esistono già e verranno sovrascritti:\n\n${overwritten.join('\n')}\n\nContinuare?`)) {
    return;
  }

  let focusFilename = null;
  files.forEach(f => {
    RAW_FILES_CACHE.set(f.filename, f.markdown);
    if (!ORIGINAL_FILES_CACHE.has(f.filename)) {
      ORIGINAL_FILES_CACHE.set(f.filename, f.markdown);
    }
    if (!isDatiLibro(f.filename)) focusFilename = f.filename;
  });

  rebuildBlocksFromCache(focusFilename);
  saveBookToStorage(true);
  textarea.value = '';
  closeAiImportModal();
  showNotificationToast(`📥 Importati ${files.length} file: ${files.map(f => f.filename).join(', ')}`);
}

// ============================================================
// 12. Guida Rapida di Avvio (procedura in 4 passi con NotebookLM ed esempio)
// ============================================================

const NEXT_BLOCK_COMMAND = 'Procedi con il Blocco successivo';

// Il libro e contesto_didattico.md sono fonti del taccuino NotebookLM; in chat si incolla solo il prompt
function copyStartInstructions() {
  copyTextToClipboard(promptRawCache || getFallbackPromptText(), '📋 Istruzioni copiate! Incollale nella chat del taccuino NotebookLM e invia.', 'prompt.md');
}

function downloadStartContext() {
  downloadMarkdownFile('contesto_didattico.md', contextRawCache || getFallbackContextText());
  showNotificationToast('⬇️ Linee guida scaricate: aggiungi il file "contesto_didattico.md" come fonte del taccuino.');
}

function copyNextBlockCommand() {
  copyTextToClipboard(NEXT_BLOCK_COMMAND, `📋 Copiato «${NEXT_BLOCK_COMMAND}»: incollalo nella chat del taccuino e invia.`, 'comando.txt');
}

function openStartGuide() {
  const guide = document.getElementById('dropzone-banner');
  if (!guide) return;
  guide.style.display = 'block';
  const closeBtn = document.getElementById('start-guide-close');
  if (closeBtn) closeBtn.style.display = BLOCKS_DATA.length > 0 ? '' : 'none';
  guide.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideStartGuide() {
  if (BLOCKS_DATA.length === 0) return; // senza schede la guida è la schermata iniziale
  const guide = document.getElementById('dropzone-banner');
  if (guide) guide.style.display = 'none';
}

// Carica le schede dimostrative (Pinocchio, capitoli I-VII) da esempio/esempio_pinocchio.js:
// un file script funziona anche aprendo l'app direttamente dal disco (file://)
function loadExampleBook() {
  if (RAW_FILES_CACHE.size > 0 && !confirm("L'esempio sostituisce le schede aperte in questo momento.\n\nOK = carica l'esempio\nAnnulla = mantieni le schede attuali")) {
    return;
  }

  const apply = () => {
    if (!Array.isArray(window.ESEMPIO_LIBRO) || window.ESEMPIO_LIBRO.length === 0) {
      showNotificationToast("Impossibile caricare l'esempio.");
      return;
    }
    loadRawWorksheets(window.ESEMPIO_LIBRO.map(item => ({ ...item })));
    saveBookToStorage(false);
    showNotificationToast("✨ Esempio caricato: esplora le schede, l'anteprima e la guida docente. Il pulsante «?» riapre la guida.");
  };

  if (window.ESEMPIO_LIBRO) {
    apply();
    return;
  }
  const script = document.createElement('script');
  script.src = 'esempio/esempio_pinocchio.js';
  script.onload = apply;
  script.onerror = () => showNotificationToast("Impossibile caricare l'esempio.");
  document.head.appendChild(script);
}
