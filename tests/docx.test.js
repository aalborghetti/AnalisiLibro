import { sampleFromPrompt, downloads, resetBrowserStorage } from './browser-env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitMarkedFiles } from '../js/book.js';
import { loadRawWorksheets } from '../js/book.js';
import { exportOutputDocx } from '../js/docx.js';

const outputs = [
  ['scheda studenti', { scope: 'block', audience: 'student' }, {}],
  ['guida docente', { scope: 'block', audience: 'teacher' }, {}],
  ['fascicolo studenti', { scope: 'book', audience: 'student' }, {}],
  ['fascicolo studenti DSA', { scope: 'book', audience: 'student' }, { dsa: true }],
  ['guida docente del libro', { scope: 'book', audience: 'teacher' }, {}]
];

for (const [label, output, opts] of outputs) {
  test(`Word: ${label}`, async () => {
    resetBrowserStorage();
    loadRawWorksheets(splitMarkedFiles(sampleFromPrompt()));
    await exportOutputDocx(output, opts);
    assert.equal(downloads.length, 1);

    const zip = await window.JSZip.loadAsync(Buffer.from(await downloads[0].arrayBuffer()));
    const xml = await zip.file('word/document.xml').async('string');
    assert.ok(!xml.includes('&amp;nbsp;'), 'nessun &nbsp; letterale');
    assert.ok(!/<w:t[^>]*>[^<]*\*[^<]*<\/w:t>/.test(xml), 'nessun asterisco Markdown letterale');
    assert.equal((xml.match(/<w:tbl>/g) || []).length, (xml.match(/<w:tblGrid>/g) || []).length, 'ogni tabella ha tblGrid');
    if (output.scope === 'book') assert.ok(xml.includes('w:type="page"'), 'le unità iniziano su una nuova pagina');
    if (opts.dsa) {
      const styles = await zip.file('word/styles.xml').async('string');
      assert.ok(styles.includes('Verdana'), 'carattere ad alta leggibilità');
      assert.ok(!xml.includes('<w:i/>'), 'nessun corsivo in alta leggibilità');
    }
  });
}
