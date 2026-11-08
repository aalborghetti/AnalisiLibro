import { sampleFromPrompt, readText } from './browser-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorksheetMarkdown, joinSelectedExercises } from '../js/markdown.js';
import { splitMarkedFiles } from '../js/book.js';
import { compareFilenames } from '../js/state.js';
import { selectWorksheetFiles, expandImportedFile } from '../js/book.js';

const response = sampleFromPrompt();

test('un file con le righe [[FILE]] / [[FINE]] viene diviso nei file indicati', () => {
  const files = splitMarkedFiles(response);
  assert.deepEqual(files.map(f => f.filename), ['dati_libro.md', 'blocco_01_esercizi.md']);
  assert.ok(!files[0].markdown.includes('Ecco il materiale'), 'testo prima del primo file escluso');
  assert.ok(!files[1].markdown.includes('Dimmi quando'), 'testo dopo [[FINE]] escluso');
});

test('senza marcatori la risposta viene divisa sui titoli', () => {
  const files = splitMarkedFiles(response.replace(/^\[\[.*\]\]$/gm, ''));
  assert.deepEqual(files.map(f => f.filename), ['dati_libro.md', 'blocco_01_esercizi.md']);
});

test('file .md importati: divisi solo se contengono più schede o le righe [[FILE]]', () => {
  // la prima risposta dell'AI salvata in un unico file diventa dati_libro.md + blocco_01_esercizi.md
  assert.deepEqual(expandImportedFile('risposta_1.md', response).map(f => f.filename), ['dati_libro.md', 'blocco_01_esercizi.md']);

  // un file con una sola scheda e la sua riga [[FILE]] prende il nome indicato, senza le righe speciali
  const sheet = splitMarkedFiles(response)[1].markdown;
  const marked = expandImportedFile('scheda.md', `[[FILE: blocco_01_esercizi.md]]\n${sheet}\n[[FINE]]`);
  assert.deepEqual(marked.map(f => f.filename), ['blocco_01_esercizi.md']);
  assert.ok(!marked[0].markdown.includes('[['));

  // una scheda senza righe speciali mantiene il nome del file salvato dal docente
  assert.deepEqual(expandImportedFile('blocco_01_esercizi.md', sheet).map(f => f.filename), ['blocco_01_esercizi.md']);
});

test('il template di prompt.md produce i 6 esercizi attesi', () => {
  const sheet = splitMarkedFiles(response)[1].markdown;
  const block = parseWorksheetMarkdown('blocco_01_esercizi.md', sheet);
  assert.equal(block.title, 'Capitolo I – Capitolo III');
  assert.equal(block.blockNumber, 1);
  assert.deepEqual(block.exercises.map(e => e.type), ['comprensione', 'vf', 'analisi', 'scrittura', 'lessico', 'speciale']);
  assert.ok(block.teacherGuideMd.includes('Riassunto sintetico'));
  assert.ok(!block.exercises.some(e => e.rawMarkdown.includes('GUIDA E RIASSUNTO')), 'la guida docente non finisce negli esercizi');
  assert.ok(block.welcomeNote.length > 0);
});

test('impaginazione per quaderno e supporto retrocompatibile righe di scrittura / caselle', () => {
  const block = parseWorksheetMarkdown('blocco_01_esercizi.md', splitMarkedFiles(response)[1].markdown);
  // Il nuovo template per quaderno produce domande pulite senza righe di compilazione
  assert.match(block.exercises[0].contentHtml, /<div class="doc-question"><p[^>]*>1\. <strong>/);
  assert.ok(!block.exercises[0].contentHtml.includes('write-lines'), 'nessuna riga di scrittura per quaderno');
  const lexicon = block.exercises.find(e => e.type === 'lessico').contentHtml;
  assert.equal((lexicon.match(/<td class="col-match">/g) || []).length, 5);
  assert.ok(lexicon.includes('class="vf-table table-matching"'), 'tabella lessico con cornice e stile vf-table');
  const vfHtml = block.exercises.find(e => e.type === 'vf').contentHtml;
  assert.ok(vfHtml.includes('class="vf-table"'), 'tabella vero o falso con classe vf-table');

  // Retrocompatibilità: schede pregresse con righe di scrittura e [ ] continuano a essere riconosciute
  const legacySample = parseWorksheetMarkdown('legacy.md',
    `## 1. Comprensione del Testo\n\n### A. Domande a risposta aperta\n\n1. **Domanda:** Testo\n\n_____\n_____\n_____\n\n## 4. Laboratorio Lessicale\n| Termine | Abbinamento | Definizione |\n| :--- | :---: | :--- |\n| A | [ ] | Def A |\n| B | [ ] | Def B |`);
  assert.match(legacySample.exercises[0].contentHtml,
    /<div class="doc-question">[\s\S]*?<div class="write-lines">(<div class="write-line"><\/div>){3}<\/div><\/div>/);
  const legacyLex = legacySample.exercises.find(e => e.type === 'lessico').contentHtml;
  assert.equal((legacyLex.match(/matching-box/g) || []).length, 2);
});

test('il titolo di sezione comune compare una sola volta per sezioni divise in sottosezioni A/B', () => {
  const legacy = parseWorksheetMarkdown('legacy_ab.md',
    `## 1. Comprensione del Testo\n\n### A. Domande a risposta aperta\n\n1. **Domanda 1:** Testo\n\n### B. Vero o Falso\n\n| V | F |\n|---|---|\n| | |`);
  const both = joinSelectedExercises(legacy.exercises.slice(0, 2), 'md');
  assert.equal((both.match(/## 1\. Comprensione del Testo/g) || []).length, 1);
  assert.ok(joinSelectedExercises([legacy.exercises[1]], 'md').startsWith('## 1. Comprensione del Testo'));
});

test('la sezione Vero o Falso separata ha la propria intestazione Sezione 2', () => {
  const block = parseWorksheetMarkdown('blocco_01_esercizi.md', splitMarkedFiles(response)[1].markdown);
  assert.equal(block.exercises[1].type, 'vf');
  assert.match(block.exercises[1].title, /Vero o Falso/i);
  assert.ok(joinSelectedExercises([block.exercises[1]], 'md').startsWith('## 2. Vero o Falso'));
});

test('la scheda di esempio di Pinocchio rispetta le 6 sezioni e la struttura ufficiale', () => {
  const text = readText('esempio_scheda_pinocchio.md');
  const files = splitMarkedFiles(text);
  assert.equal(files.length, 1);
  const block = parseWorksheetMarkdown(files[0].filename, files[0].markdown);
  assert.equal(block.blockNumber, 1);
  assert.equal(block.exercises.length, 6);
  assert.deepEqual(block.exercises.map(e => e.type), ['comprensione', 'vf', 'analisi', 'scrittura', 'lessico', 'speciale']);
  assert.ok(block.welcomeNote.length > 0);
  assert.ok(block.teacherGuideMd.length > 0);
});

test('ordinamento naturale e filtro dei file di una cartella', () => {
  assert.deepEqual(['blocco_10.md', 'blocco_2.md', 'blocco_1.md'].sort(compareFilenames), ['blocco_1.md', 'blocco_2.md', 'blocco_10.md']);
  const picked = selectWorksheetFiles(['README.md', 'prompt.md', 'dati_libro.md', 'blocco_01_esercizi.md', 'note.txt'].map(name => ({ name })));
  assert.deepEqual(picked.map(f => f.name), ['dati_libro.md', 'blocco_01_esercizi.md']);
});
