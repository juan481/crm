const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const baseDir = 'D:\\JustCreate\\Base de datos\\Empresas de seguridad';

function analyzeFile(filename) {
  const fullPath = path.join(baseDir, filename);
  console.log(`\n==================================================`);
  console.log(`ANALYZING: ${filename}`);
  console.log(`Path: ${fullPath}`);

  if (!fs.existsSync(fullPath)) {
    console.log(`ERROR: File does not exist!`);
    return;
  }

  const workbook = xlsx.readFile(fullPath);
  console.log(`Sheet names:`, workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    console.log(`\n--- Sheet: "${sheetName}" ---`);
    console.log(`Total rows: ${data.length}`);
    if (data.length > 0) {
      console.log(`Columns (${Object.keys(data[0]).length}):`, Object.keys(data[0]));
      console.log(`Sample row 0:`, JSON.stringify(data[0], null, 2));
      if (data.length > 1) {
        console.log(`Sample row 1:`, JSON.stringify(data[1], null, 2));
      }
    }
  }
}

async function main() {
  analyzeFile('BD_Brevo_Mendoza.csv');
  analyzeFile('Base Exposeg Córdoba 2026.xlsx');
  analyzeFile('BD.xlsx');
}

main().catch(console.error);
