const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const baseDir = 'D:\\JustCreate\\Base de datos\\Empresas de seguridad';

function inspectMendoza() {
  const fullPath = path.join(baseDir, 'BD_Brevo_Mendoza.csv');
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  console.log('--- BD_Brevo_Mendoza.csv ---');
  console.log('Total lines:', lines.length);
  console.log('Line 0 (Header):', lines[0]);
  console.log('Line 1:', lines[1]);
  console.log('Line 2:', lines[2]);
  console.log('Line 3:', lines[3]);
}

function inspectExposeg() {
  const fullPath = path.join(baseDir, 'Base Exposeg Córdoba 2026.xlsx');
  const wb = xlsx.readFile(fullPath);
  console.log('\n--- Base Exposeg Córdoba 2026.xlsx ---');
  console.log('Sheets:', wb.SheetNames);
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1 });
    console.log(`Sheet "${name}" rows:`, raw.length);
    if (raw.length > 0) {
      console.log('Row 0:', raw[0]);
      console.log('Row 1:', raw[1]);
      console.log('Row 2:', raw[2]);
      console.log('Row 3:', raw[3]);
    }
  }
}

inspectMendoza();
inspectExposeg();
