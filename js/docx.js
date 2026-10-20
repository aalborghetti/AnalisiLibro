/**
 * Esportazione in Word (.docx) generata nel browser
 */

import { state } from './state.js';
import { joinSelectedExercises } from './markdown.js';
import { getSelectedExercises } from './book.js';
import { downloadBlob, showNotificationToast } from './ui.js';
import { getOutputBlocks, validateOutput } from './output.js';

export const DOCX_PAGE_BREAK = '<<<PAGE_BREAK>>>';
export const DOCX_TEXT_WIDTH = 9638; // Larghezza utile A4 con margini di 2 cm (in twip)

export function xmlEscape(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Converte le entità HTML usate nei Markdown e uniforma le caselle di abbinamento "[ ]"
export function normalizeDocxText(text) {
  return String(text || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[(?:\s| )*\]/g, '[    ]');
}

// Proprietà del run nell'ordine richiesto dallo schema OOXML (rFonts, b, i, color, sz, shd)
export function buildRunProps({ bold = false, italic = false, code = false, color = null, size = null } = {}, opts = {}) {
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
export function buildParaProps({ keepNext = false, border = null, shade = null, before = null, after = null, indLeft = null, indRight = null, jc = null } = {}) {
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

export function parseMarkdownRunsToDocx(text, base = {}, opts = {}) {
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
export const DOCX_SPACER_PARAGRAPH = '<w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr></w:p>';

// Riquadro a cella singola (intestazione studente, spazio disegno)
export function buildDocxBox(innerParagraphsXml, { fill = 'F8FAFC', borderColor = 'CBD5E1', borderSize = 6, minHeight = null } = {}) {
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
export function computeDocxColumnWidths(headerCells) {
  const n = Math.max(1, headerCells.length);
  const h = headerCells.map(c => c.replace(/\*/g, '').trim().toLowerCase());
  if (n === 3 && h[1].includes('abbinamento')) return [3000, 1600, 5038];
  if (n === 3 && h[1] === 'v' && h[2] === 'f') return [7838, 900, 900];
  const base = Math.floor(DOCX_TEXT_WIDTH / n);
  const widths = Array(n).fill(base);
  widths[n - 1] += DOCX_TEXT_WIDTH - base * n;
  return widths;
}

export function buildDocxTable(rows, opts = {}) {
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

export function markdownToWordXml(md, opts = {}) {
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

export async function buildDocxZipBlob(bodyXmlElements, opts = {}) {
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

// Markdown della scheda studente di un blocco (solo esercizi selezionati)
export function buildStudentDocxMarkdown(block, headingLevel = 2) {
  let md = `${'#'.repeat(headingLevel)} *${state.globalBookTitle}* — ${block.title}\n`;
  md += `**Nome e Cognome dello studente:** ________________________________________  **Classe:** ____________  **Data:** ____________\n\n`;
  if (block.welcomeNote) {
    md += block.welcomeNote.split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
  }
  md += joinSelectedExercises(getSelectedExercises(block), 'md');
  return md;
}

export function buildTeacherDocxMarkdown(block, headingLevel = 2) {
  return `${'#'.repeat(headingLevel)} *${state.globalBookTitle}* — ${block.title}\n\n${block.teacherGuideMd.trim()}\n`;
}

export function docxFileName(base, suffix, opts = {}) {
  const safeName = String(base || 'Scheda').replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `${safeName || 'Scheda'}_${suffix}${opts.dsa ? '_DSA' : ''}.docx`;
}

// Esporta in Word lo stesso documento dell'anteprima: unità o libro intero, studenti o docente.
// Nel libro intero ogni unità inizia su una nuova pagina
export async function exportOutputDocx(output, opts = { dsa: state.isDsaMode }) {
  const error = validateOutput(output);
  if (error) {
    showNotificationToast(`⚠️ ${error}`, { type: 'warning', persistent: true });
    return;
  }
  const blocks = getOutputBlocks(output);
  const isTeacher = output.audience === 'teacher';
  const isBook = output.scope === 'book';

  let md;
  if (isBook) {
    md = `# ${isTeacher ? 'GUIDA DOCENTE E SOLUZIONI' : 'FASCICOLO DIDATTICO COMPLETO'}\n## *${state.globalBookTitle}*\n\n`;
    blocks.forEach(block => {
      md += `\n\n${DOCX_PAGE_BREAK}\n\n`;
      md += isTeacher ? buildTeacherDocxMarkdown(block, 1) : buildStudentDocxMarkdown(block, 1);
    });
  } else if (isTeacher) {
    md = `# GUIDA E SOLUZIONI PER IL DOCENTE\n` + buildTeacherDocxMarkdown(blocks[0], 2);
  } else {
    md = `# SCHEDA DIDATTICA DI LETTURA E COMPRENSIONE\n` + buildStudentDocxMarkdown(blocks[0], 2);
    md += `\n\n---\n*Scuola Secondaria di Primo Grado — Scheda di Lavoro Individuale o di Coppia*\n`;
  }

  const fileName = isBook
    ? docxFileName(state.globalBookTitle || 'Fascicolo_Didattico', isTeacher ? 'Guida_Docente_Completa' : 'Fascicolo_Studenti', opts)
    : docxFileName(blocks[0].title, isTeacher ? 'Guida_Docente' : 'Studenti', opts);

  try {
    showNotificationToast("⏳ Preparazione del file Word in corso...");
    const xml = markdownToWordXml(md, opts);
    const blob = await buildDocxZipBlob(xml, opts);
    downloadBlob(blob, fileName);
    showNotificationToast(`📄 Scaricato «${fileName}»: aprilo con Word o caricalo su Google Drive.`);
  } catch (err) {
    console.error(err);
    showNotificationToast("❌ Non è stato possibile creare il file Word. Riprova; se il problema persiste usa «Stampa o PDF».", { type: 'error', persistent: true });
  }
}
