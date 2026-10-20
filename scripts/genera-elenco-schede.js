// Scrive schede/elenco.json con i file .zip presenti nella cartella schede/ (ordinamento naturale).
// Usato dal workflow di pubblicazione; si può lanciare anche a mano: node scripts/genera-elenco-schede.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schede');
const zips = fs.readdirSync(folder)
  .filter(name => name.toLowerCase().endsWith('.zip'))
  .sort((a, b) => a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' }));

fs.writeFileSync(path.join(folder, 'elenco.json'), JSON.stringify(zips, null, 2) + '\n');
console.log(`schede/elenco.json: ${zips.length} file`);
