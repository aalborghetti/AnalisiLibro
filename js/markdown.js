/**
 * Parser delle schede Markdown, sanitizzazione e conversione in HTML
 */

import { makeSafeId } from './state.js';

// Tipologia, etichetta e descrizione di un esercizio a partire dal titolo della sezione
export function classifySection(title) {
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
export function makeExercise(id, cls, title, bodyMd, groupHeadingMd = '') {
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
export function splitLetteredSubsections(sectionChunk, baseId) {
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
export function joinSelectedExercises(exercises, format) {
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

export function parseWorksheetMarkdown(filename, rawMd) {
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
export const SANITIZE_ALLOWED_TAGS = new Set(['DIV', 'SPAN', 'P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SUB', 'SUP', 'SMALL', 'MARK', 'CODE', 'PRE', 'BLOCKQUOTE', 'HR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'A']);
export const SANITIZE_DROPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON']);
export const SANITIZE_ALLOWED_ATTRS = new Set(['class', 'style', 'colspan', 'rowspan', 'title', 'href']);

export function sanitizeHtml(html) {
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
export function markdownToHtml(md, wrapperClass = 'doc-section') {
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
