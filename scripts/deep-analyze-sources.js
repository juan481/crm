const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const baseDir = 'D:\\JustCreate\\Base de datos\\Empresas de seguridad';

const BLACKLIST = {
  companies: [
    'abba seguridad',
    'abba',
    'softguard',
    'soft guard',
  ],
  people: [
    'sebastian pierini',
    'daniel banda',
    'virginia derrico',
    'florencia castello luro',
    'marcos avalos',
    'leonel spagnolo',
  ],
  emails: [
    'sebastianpierini',
    'danielbanda',
    'softguard',
    'abbaseguridad',
  ]
};

function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isBlacklisted(company, name, email) {
  const normC = normalize(company);
  const normN = normalize(name);
  const normE = normalize(email);

  for (const c of BLACKLIST.companies) {
    if (normC === c || normC.includes(c)) return { reason: `Company: ${c}`, match: normC };
  }
  for (const p of BLACKLIST.people) {
    if (normN === p || normN.includes(p)) return { reason: `Person: ${p}`, match: normN };
  }
  for (const e of BLACKLIST.emails) {
    if (normE.includes(e)) return { reason: `Email: ${e}`, match: normE };
  }
  return false;
}

function analyzeAll() {
  console.log('--- Deep Analysis of Sources ---');

  // 1. Mendoza
  const mendozaPath = path.join(baseDir, 'BD_Brevo_Mendoza.csv');
  const mendozaLines = fs.readFileSync(mendozaPath, 'utf8').split('\n').filter(l => l.trim().length > 0);
  console.log(`Mendoza lines: ${mendozaLines.length}`);

  let mendozaExcluded = 0;
  let mendozaValid = 0;
  for (let i = 1; i < mendozaLines.length; i++) {
    const parts = mendozaLines[i].split(',');
    const email = parts[0]?.trim() || '';
    const empresa = parts[1]?.trim() || '';
    const bl = isBlacklisted(empresa, '', email);
    if (bl) {
      mendozaExcluded++;
      console.log(`[Mendoza EXCLUDED] Row ${i}: ${empresa} | ${email} -> ${bl.reason}`);
    } else {
      mendozaValid++;
    }
  }
  console.log(`Mendoza: Valid=${mendozaValid}, Excluded=${mendozaExcluded}`);

  // 2. Exposeg
  const exposegPath = path.join(baseDir, 'Base Exposeg Córdoba 2026.xlsx');
  const exposegWb = xlsx.readFile(exposegPath);
  let exposegTotal = 0;
  let exposegExcluded = 0;
  let exposegValid = 0;

  for (const sheetName of exposegWb.SheetNames) {
    const ws = exposegWb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    console.log(`Exposeg sheet "${sheetName}": ${rows.length} rows`);
    exposegTotal += rows.length;

    for (const r of rows) {
      const name = `${r.Nombre || ''} ${r.Apellido || ''}`.trim();
      const company = r.Empresa || '';
      const email = r.Mail || '';
      const bl = isBlacklisted(company, name, email);
      if (bl) {
        exposegExcluded++;
        console.log(`[Exposeg EXCLUDED] ${name} | ${company} | ${email} -> ${bl.reason}`);
      } else {
        exposegValid++;
      }
    }
  }
  console.log(`Exposeg Total=${exposegTotal}, Valid=${exposegValid}, Excluded=${exposegExcluded}`);

  // 3. BD.xlsx
  const bdPath = path.join(baseDir, 'BD.xlsx');
  const bdWb = xlsx.readFile(bdPath);
  console.log('BD.xlsx Sheets:', bdWb.SheetNames);
  const bdSheet = bdWb.Sheets['Hoja 2'] || bdWb.Sheets[bdWb.SheetNames[0]];
  const bdRows = xlsx.utils.sheet_to_json(bdSheet, { defval: '' });
  console.log(`BD.xlsx rows: ${bdRows.length}`);

  let bdExcluded = 0;
  let bdValid = 0;
  let bdWithEmail = 0;
  let bdWithoutEmail = 0;

  for (let i = 0; i < Math.min(10, bdRows.length); i++) {
    console.log(`Sample BD row ${i}:`, bdRows[i]);
  }

  for (const r of bdRows) {
    const email = r.Correo || r['Correo <CONTACT email>'] || r['paredesmadrid@gmail.com'] || '';
    const company = r.Empresa || r['VISEGUA '] || '';
    const apellido = r.Apellido || r['Apellidos <CONTACT lastname>'] || r['Paredes Madrid'] || '';
    const bl = isBlacklisted(company, apellido, email);
    if (bl) {
      bdExcluded++;
    } else {
      bdValid++;
      if (email && email.includes('@')) bdWithEmail++;
      else bdWithoutEmail++;
    }
  }
  console.log(`BD.xlsx: Valid=${bdValid}, Excluded=${bdExcluded}, WithEmail=${bdWithEmail}, WithoutEmail=${bdWithoutEmail}`);
}

analyzeAll();
