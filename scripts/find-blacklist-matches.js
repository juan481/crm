const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const baseDir = 'D:\\JustCreate\\Base de datos\\Empresas de seguridad';

const targets = [
  'abba',
  'pierini',
  'banda',
  'softguard',
  'derrico',
  'castello',
  'avalos',
  'spagnolo'
];

function checkMatch(rowStr) {
  const lower = rowStr.toLowerCase();
  for (const t of targets) {
    if (lower.includes(t)) return t;
  }
  return null;
}

function findMatches() {
  console.log('Searching for target names across all files...');

  // 1. Mendoza
  const mendozaLines = fs.readFileSync(path.join(baseDir, 'BD_Brevo_Mendoza.csv'), 'utf8').split('\n');
  mendozaLines.forEach((line, idx) => {
    const m = checkMatch(line);
    if (m) console.log(`[Mendoza match "${m}"] Line ${idx}: ${line}`);
  });

  // 2. Exposeg
  const exposegWb = xlsx.readFile(path.join(baseDir, 'Base Exposeg Córdoba 2026.xlsx'));
  for (const name of exposegWb.SheetNames) {
    const rows = xlsx.utils.sheet_to_json(exposegWb.Sheets[name], { defval: '' });
    rows.forEach((r, idx) => {
      const str = JSON.stringify(r);
      const m = checkMatch(str);
      if (m) console.log(`[Exposeg "${name}" match "${m}"] Row ${idx}: ${str}`);
    });
  }

  // 3. BD.xlsx
  const bdWb = xlsx.readFile(path.join(baseDir, 'BD.xlsx'));
  const bdRows = xlsx.utils.sheet_to_json(bdWb.Sheets['Hoja 2'], { defval: '' });
  bdRows.forEach((r, idx) => {
    const str = JSON.stringify(r);
    const m = checkMatch(str);
    if (m) console.log(`[BD.xlsx match "${m}"] Row ${idx}: ${str}`);
  });
}

findMatches();
