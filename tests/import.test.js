import { ROOT, sampleFromPrompt, downloads, resetBrowserStorage } from './browser-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { state, RAW_FILES_CACHE } from '../js/state.js';
import { getAllRawWorksheets, getSelectedExercises, importWorksheetFiles, loadRawWorksheets, mergeWorksheetsIntoBook, splitMarkedFiles } from '../js/book.js';
import { toggleExercise } from '../js/ui.js';
import { bookIdReady, openWorkZip, saveWorkFile } from '../js/storage.js';

const zipName = fs.readdirSync(path.join(ROOT, 'schede')).find(name => name.toLowerCase().endsWith('.zip'));
const openSampleBook = async () => {
  resetBrowserStorage();
  await openWorkZip(fs.readFileSync(path.join(ROOT, 'schede', zipName)), zipName);
};

test('schede importate senza libro aperto: diventano il libro', async () => {
  resetBrowserStorage();
  loadRawWorksheets([]);
  assert.equal(await importWorksheetFiles(splitMarkedFiles(sampleFromPrompt())), true);
  assert.equal(state.globalBookTitle, 'Il barone rampante di Italo Calvino');
  assert.equal(state.BLOCKS_DATA.length, 1);
});

test('una nuova scheda si aggiunge al libro aperto senza perdere i blocchi già presenti', async () => {
  await openSampleBook();
  const bookId = state.currentBookId;
  const before = state.BLOCKS_DATA.length;
  const lastBlock = getAllRawWorksheets().filter(f => f.filename.startsWith('blocco')).pop();
  const newName = `blocco_${String(before + 1).padStart(2, '0')}_esercizi.md`;

  assert.equal(await mergeWorksheetsIntoBook([{ filename: newName, markdown: lastBlock.markdown }]), true);
  assert.equal(state.BLOCKS_DATA.length, before + 1, 'blocco aggiunto');
  assert.ok(RAW_FILES_CACHE.has('blocco_01_esercizi.md'), 'i blocchi precedenti restano');
  assert.equal(state.currentBookId, bookId, 'stesso libro');
});

test('le scelte degli esercizi restano dopo la riapertura e nel file di lavoro', async () => {
  await openSampleBook();
  const bookId = state.currentBookId;
  const first = state.BLOCKS_DATA[0];
  toggleExercise(first.exercises[0].id);
  toggleExercise(first.exercises[1].id);
  const expected = getSelectedExercises(first).map(e => e.id);
  assert.equal(expected.length, first.exercises.length - 2);

  // riapertura dello stesso libro (come al riavvio dell'app)
  loadRawWorksheets(getAllRawWorksheets(), null, { bookId });
  await bookIdReady;
  assert.deepEqual(getSelectedExercises(state.BLOCKS_DATA[0]).map(e => e.id), expected, 'scelte ripristinate');

  // le scelte viaggiano anche nel file di lavoro
  downloads.length = 0;
  await saveWorkFile();
  const workFile = Buffer.from(await downloads[0].arrayBuffer());
  resetBrowserStorage();
  assert.equal(await openWorkZip(workFile, 'lavoro.zip'), true);
  assert.deepEqual(getSelectedExercises(state.BLOCKS_DATA[0]).map(e => e.id), expected, 'scelte dal file di lavoro');
});
