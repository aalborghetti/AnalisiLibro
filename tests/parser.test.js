import { sampleFromPrompt } from './browser-env.js';
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

test('righe di scrittura raggruppate con la domanda e caselle di abbinamento riconosciute', () => {
  const block = parseWorksheetMarkdown('blocco_01_esercizi.md', splitMarkedFiles(response)[1].markdown);
  assert.match(block.exercises[0].contentHtml,
    /<div class="doc-question">[\s\S]*?<div class="write-lines">(<div class="write-line"><\/div>){3}<\/div><\/div>/);
  const lexicon = block.exercises.find(e => e.type === 'lessico').contentHtml;
  assert.equal((lexicon.match(/matching-box/g) || []).length, 5);
});

test('il titolo di sezione comune compare una sola volta', () => {
  const block = parseWorksheetMarkdown('blocco_01_esercizi.md', splitMarkedFiles(response)[1].markdown);
  const both = joinSelectedExercises(block.exercises.slice(0, 2), 'md');
  assert.equal((both.match(/## 1\. Comprensione del Testo/g) || []).length, 1);
  assert.ok(joinSelectedExercises([block.exercises[1]], 'md').startsWith('## 1. Comprensione del Testo'));
});

test('ordinamento naturale e filtro dei file di una cartella', () => {
  assert.deepEqual(['blocco_10.md', 'blocco_2.md', 'blocco_1.md'].sort(compareFilenames), ['blocco_1.md', 'blocco_2.md', 'blocco_10.md']);
  const picked = selectWorksheetFiles(['README.md', 'prompt.md', 'dati_libro.md', 'blocco_01_esercizi.md', 'note.txt'].map(name => ({ name })));
  assert.deepEqual(picked.map(f => f.name), ['dati_libro.md', 'blocco_01_esercizi.md']);
});
