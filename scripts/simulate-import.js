const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const baseDir = 'D:\\JustCreate\\Base de datos\\Empresas de seguridad';

const BLACKLIST = {
  companies: ['abba seguridad', 'abba', 'softguard', 'soft guard'],
  people: [
    'sebastian pierini', 'daniel banda', 'virginia derrico',
    'florencia castello luro', 'marcos avalos', 'leonel spagnolo'
  ],
  emails: ['sebastianpierini', 'danielbanda', 'softguard', 'abbaseguridad', 'vderrico', 'mavalos@sbase', 'l0gan77@hotmail']
};

function normalize(str) {
  if (!str) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function cleanCompany(name) {
  if (!name) return '';
  let c = String(name).trim();
  // Remove trailing dots, dashes, commas
  c = c.replace(/^[-\s.,]+|[-\s.,]+$/g, '');
  return c;
}

function isGenericCompany(name) {
  const norm = normalize(name);
  if (!norm || norm.length < 2) return true;
  const generic = [
    'particular', 'independiente', 'autonomo', 'monotributista', 'estudiante',
    'sin empresa', 'ninguna', 'no tiene', 's/e', 's/n', 'propia', 'personal',
    'consultor independiente', 'instalador independiente', '-', '--', '---', '.', '..'
  ];
  return generic.includes(norm);
}

function checkBlacklist(company, name, email) {
  const normC = normalize(company);
  const normN = normalize(name);
  const normE = normalize(email);

  if (normC === 'abba' || normC.startsWith('abba ') || normC.endsWith(' abba') || normC.includes('abba segur')) return 'ABBA SEGURIDAD';
  if (normC.includes('softguard') || normC.includes('soft guard')) return 'SOFTGUARD';

  if (normN.includes('sebastian') && normN.includes('pierini')) return 'SEBASTIAN PIERINI';
  if (normN.includes('daniel') && normN.includes('banda')) return 'DANIEL BANDA';
  if (normN.includes('virginia') && normN.includes('derrico')) return 'VIRGINIA DERRICO';
  if (normN.includes('florencia') && (normN.includes('castello') || normN.includes('luro'))) return 'FLORENCIA CASTELLO LURO';
  if ((normN.includes('marco') || normN.includes('marcos')) && normN.includes('avalos')) return 'MARCOS AVALOS';
  if (normN.includes('leonel') && normN.includes('spagnolo')) return 'LEONEL SPAGNOLO';

  if (normE.includes('softguard')) return 'SOFTGUARD EMAIL';
  if (normE.includes('sebastianpierini')) return 'SEBASTIAN PIERINI EMAIL';
  if (normE.includes('ceo@softguard') || normE.includes('dany_banda')) return 'DANIEL BANDA EMAIL';
  if (normE.includes('vderrico')) return 'VIRGINIA DERRICO EMAIL';
  if (normE.includes('l0gan77@') || normE.includes('mavalos@sbase')) return 'MARCOS AVALOS EMAIL';
  if (normE.includes('spagnolo') && normE.includes('leonel')) return 'LEONEL SPAGNOLO EMAIL';

  return false;
}

function simulate() {
  console.log('--- Simulating Import & Deduplication ---');

  // Unified contacts map keyed by normalized email
  const contactsByEmail = new Map();
  // Contacts without email keyed by name + company
  const contactsNoEmail = [];

  // Track exclusions
  const excludedRecords = [];

  // Helper to add contact
  function addRecord(source, rec) {
    const bl = checkBlacklist(rec.empresa, `${rec.firstName} ${rec.lastName}`, rec.email);
    if (bl) {
      excludedRecords.push({ source, ...rec, reason: bl });
      return;
    }

    const emailKey = normalize(rec.email);
    if (emailKey && emailKey.includes('@')) {
      if (contactsByEmail.has(emailKey)) {
        // Merge / enrich existing record
        const existing = contactsByEmail.get(emailKey);
        if (!existing.phone && rec.phone) existing.phone = rec.phone;
        if (!existing.empresa && rec.empresa) existing.empresa = rec.empresa;
        if (!existing.city && rec.city) existing.city = rec.city;
        if (!existing.province && rec.province) existing.province = rec.province;
        if (!existing.country && rec.country) existing.country = rec.country;
        if (!existing.activity && rec.activity) existing.activity = rec.activity;
        if (!existing.role && rec.role) existing.role = rec.role;
        if (existing.source !== source) existing.source += ` + ${source}`;
      } else {
        contactsByEmail.set(emailKey, { source, ...rec });
      }
    } else {
      contactsNoEmail.push({ source, ...rec });
    }
  }

  // 1. Mendoza
  console.log('Reading Mendoza...');
  const mendozaLines = fs.readFileSync(path.join(baseDir, 'BD_Brevo_Mendoza.csv'), 'utf8').split('\n').filter(l => l.trim().length > 0);
  for (let i = 1; i < mendozaLines.length; i++) {
    const parts = mendozaLines[i].split(',');
    const email = parts[0]?.trim() || '';
    const empresaRaw = parts[1]?.trim() || '';
    const nombreFantasia = parts[2]?.trim() || '';
    const domicilio = parts[3]?.trim() || '';
    const zona = parts[4]?.trim() || '';

    const empresaName = cleanCompany(nombreFantasia || empresaRaw);
    addRecord('Mendoza', {
      firstName: 'Contacto',
      lastName: empresaName,
      empresa: empresaName,
      companyRaw: empresaRaw,
      role: 'Administración / Comercial',
      email,
      phone: '',
      address: domicilio,
      city: 'Mendoza',
      province: 'Mendoza',
      country: 'Argentina',
      activity: 'Seguridad y Vigilancia'
    });
  }

  // 2. Exposeg
  console.log('Reading Exposeg...');
  const exposegWb = xlsx.readFile(path.join(baseDir, 'Base Exposeg Córdoba 2026.xlsx'));
  for (const sheetName of exposegWb.SheetNames) {
    const rows = xlsx.utils.sheet_to_json(exposegWb.Sheets[sheetName], { defval: '' });
    for (const r of rows) {
      const email = (r.Mail || '').trim();
      const fn = (r.Nombre || '').trim();
      const ln = (r.Apellido || '').trim();
      const emp = cleanCompany(r.Empresa || '');
      addRecord(`Exposeg (${sheetName})`, {
        firstName: fn || 'Contacto',
        lastName: ln || (emp || 'Seguridad'),
        empresa: emp,
        companyRaw: emp,
        role: r.Cargo || 'Profesional / Técnico',
        email,
        phone: r.Telefono ? String(r.Telefono).trim() : '',
        address: r['Domicilio Laboral'] || '',
        city: r.Localidad || '',
        province: r.Provincia || 'Córdoba',
        country: r.Pais || 'Argentina',
        activity: r['Actividad Empresa'] || 'Seguridad Electrónica / Monitoreo',
        website: r.Web || ''
      });
    }
  }

  // 3. BD.xlsx
  console.log('Reading BD.xlsx...');
  const bdWb = xlsx.readFile(path.join(baseDir, 'BD.xlsx'));
  const bdSheet = bdWb.Sheets['Hoja 2'] || bdWb.Sheets[bdWb.SheetNames[0]];
  const bdRows = xlsx.utils.sheet_to_json(bdSheet, { defval: '' });
  for (const r of bdRows) {
    const email = String(r.Correo || '').trim();
    const emp = cleanCompany(String(r.Empresa || ''));
    const apellido = String(r.Apellido || '').trim();
    
    // In BD.xlsx, Apellido is often the full name or last name
    const parts = apellido.split(/\s+/);
    let fn = 'Contacto';
    let ln = apellido;
    if (parts.length > 1) {
      fn = parts[0];
      ln = parts.slice(1).join(' ');
    } else if (parts.length === 1 && parts[0]) {
      ln = parts[0];
    }

    addRecord('BD.xlsx', {
      firstName: fn,
      lastName: ln || (emp || 'Contacto'),
      empresa: emp,
      companyRaw: emp,
      role: 'Contacto Comercial / Técnico',
      email,
      phone: '',
      address: '',
      city: '',
      province: '',
      country: r.Pais || 'Argentina',
      activity: 'Seguridad Electrónica / Monitoreo',
      website: ''
    });
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Total Excluded Blacklist records: ${excludedRecords.length}`);
  console.log(`Total Unique Contacts with Valid Email: ${contactsByEmail.size}`);
  console.log(`Total Contacts without Email: ${contactsNoEmail.length}`);

  // Analyze Company Grouping
  const companiesMap = new Map();
  let independentCount = 0;

  for (const [email, c] of contactsByEmail.entries()) {
    if (isGenericCompany(c.empresa)) {
      independentCount++;
    } else {
      const key = normalize(c.empresa);
      if (!companiesMap.has(key)) {
        companiesMap.set(key, {
          name: c.empresa,
          country: c.country,
          province: c.province,
          city: c.city,
          address: c.address,
          activity: c.activity,
          contacts: []
        });
      }
      companiesMap.get(key).contacts.push(c);
    }
  }

  console.log(`Total Distinct Companies: ${companiesMap.size}`);
  console.log(`Total Independent / End User Contacts (No Company): ${independentCount}`);

  // Sample top companies with most contacts
  const topCompanies = Array.from(companiesMap.values())
    .sort((a, b) => b.contacts.length - a.contacts.length)
    .slice(0, 15);

  console.log(`\nTop Companies by Contact Count:`);
  topCompanies.forEach(tc => {
    console.log(`- ${tc.name} (${tc.country}): ${tc.contacts.length} contactos`);
  });

  // Sample excluded records
  console.log(`\nSample Excluded Records (${excludedRecords.length} total):`);
  excludedRecords.slice(0, 10).forEach(ex => {
    console.log(`- [${ex.reason}] ${ex.firstName} ${ex.lastName} | ${ex.empresa} | ${ex.email} (Source: ${ex.source})`);
  });
}

simulate();
