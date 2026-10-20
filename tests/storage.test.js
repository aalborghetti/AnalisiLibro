import { ROOT, downloads, resetBrowserStorage } from './browser-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { state, RAW_FILES_CACHE } from '../js/state.js';
import { getSelectedExercises, rebuildBlocksFromCache } from '../js/book.js';
import { selectEssentialBes, selectAll, toggleExercise } from '../js/ui.js';
import { applySelectionVersion, getBookVersions, setBookVersions } from '../js/versions.js';
import { openWorkZip, saveWorkFile, detectGithubRepository, prettyZipName } from '../js/storage.js';
import { getOutputBlocks, validateOutput, buildOutputHtml } from '../js/output.js';

const zipNames = fs.readdirSync(path.join(ROOT, 'schede')).filter(name => name.toLowerCase().endsWith('.zip'));

for (const name of zipNames) {
  test(`scheda pronta «${name}»: si apre e ogni blocco è completo`, async () => {
    resetBrowserStorage();
    assert.equal(await openWorkZip(fs.readFileSync(path.join(ROOT, 'schede', name)), name), true);
    assert.ok(state.BLOCKS_DATA.length > 0, 'almeno un blocco');
    assert.notEqual(state.globalBookTitle, 'Schede Didattiche di Lettura', 'titolo letto da dati_libro.md');
    for (const block of state.BLOCKS_DATA) {
      assert.ok(block.exercises.length >= 5, `Blocco ${block.blockNumber}: esercizi`);
      assert.ok(block.teacherGuideMd.trim().length > 0, `Blocco ${block.blockNumber}: guida docente`);
      assert.ok(block.title.length <= 120, `Blocco ${block.blockNumber}: titolo troppo lungo («${block.title}»)`);
    }
  });
}

test('file di lavoro: identificativo del libro e versioni sopravvivono al salvataggio', async () => {
  resetBrowserStorage();
  const name = zipNames[0];
  await openWorkZip(fs.readFileSync(path.join(ROOT, 'schede', name)), name);
  const bookId = state.currentBookId;
  assert.ok(bookId, 'identificativo assegnato');

  await selectEssentialBes('block');
  const counts = state.BLOCKS_DATA.map(b => getSelectedExercises(b).length);
  setBookVersions({ 'Versione BES': Object.fromEntries(state.BLOCKS_DATA.map(b => [b.filename, getSelectedExercises(b).map(e => e.id)])) });
  selectAll();
  applySelectionVersion('Versione BES');
  assert.deepEqual(state.BLOCKS_DATA.map(b => getSelectedExercises(b).length), counts, 'versione riapplicata');
  toggleExercise(state.BLOCKS_DATA[0].exercises[0].id);
  assert.equal(state.activeVersionName, '', 'una modifica manuale stacca la versione');

  downloads.length = 0;
  await saveWorkFile();
  assert.equal(downloads.length, 1);
  const workFile = Buffer.from(await downloads[0].arrayBuffer());
  const zip = await window.JSZip.loadAsync(workFile);
  assert.ok(zip.file('libro.json') && zip.file('versioni.json') && zip.file('schede_esercizi/manifest.json'));

  resetBrowserStorage();
  state.currentBookId = null;
  assert.equal(await openWorkZip(workFile, 'lavoro.zip'), true);
  assert.equal(state.currentBookId, bookId, 'stesso identificativo dopo la riapertura');
  assert.ok(getBookVersions()['Versione BES'], 'versioni ripristinate');
});

test('cambiare il titolo in dati_libro.md non cambia identificativo né versioni', async () => {
  resetBrowserStorage();
  const name = zipNames[0];
  await openWorkZip(fs.readFileSync(path.join(ROOT, 'schede', name)), name);
  const bookId = state.currentBookId;
  setBookVersions({ 'Classe 2B': { [state.BLOCKS_DATA[0].filename]: [] } });

  const dati = RAW_FILES_CACHE.get('dati_libro.md');
  RAW_FILES_CACHE.set('dati_libro.md', dati.replace(/(\*\*Titolo:\*\*\s*)(.+)/, '$1Titolo cambiato'));
  rebuildBlocksFromCache();
  assert.match(state.globalBookTitle, /^Titolo cambiato/);
  assert.equal(state.currentBookId, bookId);
  assert.ok(getBookVersions()['Classe 2B'], 'versione ancora disponibile');
});

test('Stampa o scarica: unità senza esercizi saltate, ogni unità su una nuova pagina', async () => {
  resetBrowserStorage();
  const name = zipNames[0];
  await openWorkZip(fs.readFileSync(path.join(ROOT, 'schede', name)), name);
  const total = state.BLOCKS_DATA.length;
  assert.equal(validateOutput({ scope: 'block', audience: 'student' }), null);
  state.BLOCKS_DATA[0].exercises.forEach(ex => toggleExercise(ex.id));
  assert.match(validateOutput({ scope: 'block', audience: 'student' }), /Non hai scelto/);
  assert.equal(getOutputBlocks({ scope: 'book', audience: 'student' }).length, total - 1);
  const teacherHtml = buildOutputHtml({ scope: 'book', audience: 'teacher' });
  assert.equal((teacherHtml.match(/page-break-block/g) || []).length, total - 1);
});

test('schede pronte: repository GitHub riconosciuto dall\'indirizzo del sito', () => {
  assert.deepEqual(detectGithubRepository(), { owner: 'aalborghetti', name: 'AnalisiLibro' });
  assert.equal(prettyZipName('I_lucci_della_via_lago_lavoro.zip'), 'I lucci della via lago');
});
