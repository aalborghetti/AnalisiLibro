/**
 * Ambiente browser minimo per eseguire i moduli di js/ in Node (senza dipendenze):
 * document, localStorage, URL e JSZip. Va importato PRIMA dei moduli dell'app.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createElement(tagName = 'div') {
  const classes = new Set();
  let html = '';
  const el = {
    tagName: tagName.toUpperCase(),
    style: {},
    dataset: {},
    value: '',
    textContent: '',
    children: [],
    attributes: {},
    classList: {
      add: (...names) => names.forEach(n => classes.add(n)),
      remove: (...names) => names.forEach(n => classes.delete(n)),
      toggle: (name, force) => {
        const on = force === undefined ? !classes.has(name) : !!force;
        if (on) classes.add(name); else classes.delete(name);
        return on;
      },
      contains: name => classes.has(name)
    },
    get innerHTML() { return html; },
    set innerHTML(value) { html = String(value); },
    content: { children: [] }, // <template>: la sanitizzazione non ha nodi da visitare in Node
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    append(...nodes) { this.children.push(...nodes); },
    removeChild() {},
    remove() {},
    querySelector: () => createElement(),
    querySelectorAll: () => [],
    addEventListener() {},
    focus() {},
    click() {},
    scrollIntoView() {}
  };
  return el;
}

const elementsById = new Map();
const storage = new Map();
export const downloads = [];

globalThis.window = globalThis;
if (typeof globalThis.addEventListener !== 'function') globalThis.addEventListener = () => {};
globalThis.location = { protocol: 'https:', hostname: 'aalborghetti.github.io', pathname: '/AnalisiLibro/' };
if (!globalThis.navigator) globalThis.navigator = {}; // da Node 21 esiste già (sola lettura)
globalThis.localStorage = {
  getItem: key => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear()
};
globalThis.document = {
  body: createElement('body'),
  head: createElement('head'),
  documentElement: createElement('html'),
  activeElement: null,
  getElementById(id) {
    if (!elementsById.has(id)) elementsById.set(id, createElement());
    return elementsById.get(id);
  },
  createElement,
  querySelector: () => createElement(),
  querySelectorAll: () => [],
  addEventListener() {},
  contains: () => false
};
globalThis.URL.createObjectURL = (blob) => {
  downloads.push(blob);
  return 'blob:test';
};
globalThis.URL.revokeObjectURL = () => {};

// jszip.min.js è uno script classico (UMD): eseguito nel contesto globale definisce window.JSZip
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'jszip.min.js'), 'utf8'));

export function resetBrowserStorage() {
  storage.clear();
  downloads.length = 0;
}

export function readText(...parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
}

// Scheda di prova costruita dal template di prompt.md (con i segnaposto compilati)
export function sampleFromPrompt() {
  const prompt = readText('prompt.md');
  const datiStart = prompt.search(/^\[\[FILE: dati_libro\.md\]\]$/m);
  const dati = prompt.slice(datiStart, prompt.indexOf('[[FINE]]', datiStart) + '[[FINE]]'.length)
    .replace('[Titolo completo del romanzo]', 'Il barone rampante')
    .replace("[Nome e cognome dell'autore]", 'Italo Calvino');
  const tplStart = prompt.search(/^\[\[FILE: blocco_XX_esercizi\.md\]\]$/m);
  const sheet = prompt.slice(tplStart, prompt.indexOf('[[FINE]]', tplStart) + '[[FINE]]'.length)
    .replace('[[FILE: blocco_XX_esercizi.md]]', '[[FILE: blocco\\_01\\_esercizi.md]]')
    .replace('*[Titolo del Romanzo]* di [Autore]', '*Il barone rampante* di Italo Calvino')
    .replace('Unità Didattica [X] (Blocco [X]): *[Capitolo Iniziale]* – *[Capitolo Finale]*',
      'Unità Didattica 1 (Blocco 1): *Capitolo I* – *Capitolo III*');
  return `Ecco il materiale richiesto!\n\n${dati}\n\n${sheet}\n\nDimmi quando vuoi procedere con il Blocco 2.`;
}
