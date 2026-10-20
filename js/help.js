/**
 * Guida rapida, guida per docenti, manuale tecnico e istruzioni per l'AI
 */

import { escapeHtml, state } from './state.js';
import { copyTextToClipboard, downloadMarkdownFile, fallbackCopyText, showNotificationToast } from './ui.js';

export const HELP_DOCUMENTS = {
  guida: { file: 'GUIDA_DOCENTI.md', name: 'la guida per docenti' },
  readme: { file: 'README.md', name: 'il manuale tecnico' }
};
export const helpContentCache = {};

export async function openHelpModal(doc = 'guida') {
  const modal = document.getElementById('help-modal');
  const contentEl = document.getElementById('help-content');
  const documentInfo = HELP_DOCUMENTS[doc] || HELP_DOCUMENTS.guida;
  if (!modal || !contentEl) return;

  modal.classList.add('open');
  document.getElementById('btn-help-guida')?.classList.toggle('active', doc !== 'readme');
  document.getElementById('btn-help-readme')?.classList.toggle('active', doc === 'readme');
  contentEl.scrollTop = 0;

  if (!helpContentCache[doc]) {
    contentEl.innerHTML = '<div style="text-align: center; padding: 3rem; color: #64748b;">Caricamento in corso...</div>';
    try {
      const res = await fetch(documentInfo.file);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) helpContentCache[doc] = text;
      }
    } catch (err) {
      console.warn(`Impossibile caricare ${documentInfo.file}:`, err);
    }
  }

  if (helpContentCache[doc]) {
    contentEl.innerHTML = renderReadmeMarkdown(helpContentCache[doc]);
    return;
  }

  contentEl.innerHTML = `
    <div style="padding: 2.5rem 1rem; text-align: center;">
      <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">📖</div>
      <h3 style="font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem;">
        Guida non disponibile
      </h3>
      <p style="color: #64748b; margin-bottom: 1.5rem; max-width: 500px; margin-left: auto; margin-right: auto;">
        Non è stato possibile aprire ${documentInfo.name} (${documentInfo.file}). Se hai aperto l'app direttamente dal computer, usa la versione online del sito oppure apri il file con un editor di testo.
      </p>
    </div>
  `;
}

export function closeHelpModal() {
  const modal = document.getElementById('help-modal');
  if (modal) modal.classList.remove('open');
}

export function renderReadmeMarkdown(md) {
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

export let currentPromptContextTab = 'prompt';
export let promptRawCache = null;
export let contextRawCache = null;

export async function openPromptContextModal(initialTab = 'prompt') {
  const modal = document.getElementById('prompt-context-modal');
  if (!modal) return;
  modal.classList.add('open');
  await ensurePromptAndContextLoaded();
  switchPromptContextTab(initialTab);
}

export function closePromptContextModal() {
  const modal = document.getElementById('prompt-context-modal');
  if (modal) modal.classList.remove('open');
}

export async function ensurePromptAndContextLoaded() {
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

// Testo di prompt.md o contesto_didattico.md caricato all'avvio; null (con avviso) se non disponibile
export function getAiText(kind) {
  const text = kind === 'prompt' ? promptRawCache : contextRawCache;
  if (!text) {
    showNotificationToast("❌ Non è stato possibile caricare le istruzioni per l'AI. Controlla la connessione e ricarica la pagina.", { type: 'error', persistent: true });
    ensurePromptAndContextLoaded();
  }
  return text;
}

export function switchPromptContextTab(tab) {
  currentPromptContextTab = tab;

  document.getElementById('btn-tab-prompt')?.classList.toggle('active', tab === 'prompt');
  document.getElementById('btn-tab-context')?.classList.toggle('active', tab === 'context');

  const subtitle = document.getElementById('prompt-context-subtitle');
  const content = document.getElementById('prompt-context-content');
  if (!content) return;

  if (tab === 'prompt') {
    if (subtitle) {
      subtitle.textContent = "Il testo da copiare e incollare nella chat del taccuino NotebookLM per far preparare le schede.";
    }
    content.innerHTML = promptRawCache
      ? renderReadmeMarkdown(promptRawCache)
      : '<p style="padding: 2rem; color: #b91c1c;">Le istruzioni non sono disponibili: controlla la connessione e ricarica la pagina.</p>';
  } else {
    if (subtitle) {
      subtitle.textContent = "Le regole didattiche che l'AI deve seguire: da aggiungere come fonte del taccuino NotebookLM.";
    }
    content.innerHTML = contextRawCache
      ? renderReadmeMarkdown(contextRawCache)
      : '<p style="padding: 2rem; color: #b91c1c;">Le linee guida non sono disponibili: controlla la connessione e ricarica la pagina.</p>';
  }

  content.scrollTop = 0;
}

export function copyCodeSnippet(btn) {
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

export function copyCurrentPromptContextText() {
  const isPrompt = currentPromptContextTab === 'prompt';
  const fullText = getAiText(isPrompt ? 'prompt' : 'context');
  if (!fullText) return;
  const filename = isPrompt ? 'prompt.md' : 'contesto_didattico.md';

  // Si copia sempre il file integrale (il prompt non contiene blocchi di codice da estrarre)
  const msg = isPrompt
    ? '🤖 Prompt operativo per NotebookLM copiato negli appunti!'
    : `📋 Testo di "${filename}" copiato negli appunti!`;
  copyTextToClipboard(fullText, msg, filename);
}

export function downloadCurrentPromptContextFile() {
  const isPrompt = currentPromptContextTab === 'prompt';
  const filename = isPrompt ? 'prompt.md' : 'contesto_didattico.md';
  const text = getAiText(isPrompt ? 'prompt' : 'context');
  if (!text) return;

  downloadMarkdownFile(filename, text);
  showNotificationToast(`⬇️ Download completato per "${filename}"`);
}

export function downloadBothPromptAndContext() {
  const promptText = getAiText('prompt');
  const contextText = promptText && getAiText('context');
  if (!promptText || !contextText) return;

  downloadMarkdownFile('prompt.md', promptText);
  setTimeout(() => {
    downloadMarkdownFile('contesto_didattico.md', contextText);
    showNotificationToast("📦 Download avviato per prompt.md e contesto_didattico.md!");
  }, 300);
}

export const NEXT_BLOCK_COMMAND = 'Procedi con il Blocco successivo';

// Il libro e contesto_didattico.md sono fonti del taccuino NotebookLM; in chat si incolla solo il prompt
export function copyStartInstructions() {
  const text = getAiText('prompt');
  if (text) copyTextToClipboard(text, '📋 Istruzioni copiate! Incollale nella chat del taccuino NotebookLM e invia.', 'prompt.md');
}

export function downloadStartContext() {
  const text = getAiText('context');
  if (!text) return;
  downloadMarkdownFile('contesto_didattico.md', text);
  showNotificationToast('⬇️ Linee guida scaricate: aggiungi il file "contesto_didattico.md" come fonte del taccuino.');
}

export function copyNextBlockCommand() {
  copyTextToClipboard(NEXT_BLOCK_COMMAND, `📋 Copiato «${NEXT_BLOCK_COMMAND}»: incollalo nella chat del taccuino e invia.`, 'comando.txt');
}

export function openStartGuide() {
  const guide = document.getElementById('dropzone-banner');
  if (!guide) return;
  guide.style.display = 'block';
  const closeBtn = document.getElementById('start-guide-close');
  if (closeBtn) closeBtn.style.display = state.BLOCKS_DATA.length > 0 ? '' : 'none';
  guide.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function hideStartGuide() {
  if (state.BLOCKS_DATA.length === 0) return; // senza schede la guida è la schermata iniziale
  const guide = document.getElementById('dropzone-banner');
  if (guide) guide.style.display = 'none';
}
