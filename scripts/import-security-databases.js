const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TARGET_ORG_ID = 'cmske462000008ahb29n2427g'; // Just Create
const FORBIDDEN_ORG_ID = '4e5924f4-850b-407e-9853-6e22d5eaf54c'; // Abba Seguridad

const baseDir = 'D:\\JustCreate\\Base de datos\\Empresas de seguridad';

function normalize(str) {
  if (!str) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function cleanCompany(name) {
  if (!name) return '';
  let c = String(name).trim();
  c = c.replace(/^[-\s.,]+|[-\s.,]+$/g, '');
  return c;
}

function isGenericCompany(name) {
  const norm = normalize(name);
  if (!norm || norm.length < 2) return true;
  const generic = [
    'particular', 'independiente', 'autonomo', 'monotributista', 'estudiante',
    'sin empresa', 'ninguna', 'no tiene', 's/e', 's/n', 'propia', 'personal',
    'consultor independiente', 'instalador independiente', '-', '--', '---', '.', '..', 'repetido'
  ];
  return generic.includes(norm);
}

function checkBlacklist(company, name, email) {
  const normC = normalize(company);
  const normN = normalize(name);
  const normE = normalize(email);

  // Companies
  if (normC === 'abba' || normC.startsWith('abba ') || normC.endsWith(' abba') || normC.includes('abba segur')) return 'ABBA SEGURIDAD';
  if (normC.includes('softguard') || normC.includes('soft guard')) return 'SOFTGUARD';

  // People
  if (normN.includes('sebastian') && normN.includes('pierini')) return 'SEBASTIAN PIERINI';
  if (normN.includes('daniel') && normN.includes('banda')) return 'DANIEL BANDA';
  if (normN.includes('virginia') && normN.includes('derrico')) return 'VIRGINIA DERRICO';
  if (normN.includes('florencia') && (normN.includes('castello') || normN.includes('luro'))) return 'FLORENCIA CASTELLO LURO';
  if ((normN.includes('marco') || normN.includes('marcos')) && normN.includes('avalos')) return 'MARCOS AVALOS';
  if (normN.includes('leonel') && normN.includes('spagnolo')) return 'LEONEL SPAGNOLO';

  // Specific Emails / Domains
  if (normE.includes('softguard')) return 'SOFTGUARD EMAIL';
  if (normE.includes('sebastianpierini')) return 'SEBASTIAN PIERINI EMAIL';
  if (normE.includes('ceo@softguard') || normE.includes('dany_banda')) return 'DANIEL BANDA EMAIL';
  if (normE.includes('vderrico')) return 'VIRGINIA DERRICO EMAIL';
  if (normE.includes('l0gan77@') || normE.includes('mavalos@sbase')) return 'MARCOS AVALOS EMAIL';
  if (normE.includes('spagnolo') && normE.includes('leonel')) return 'LEONEL SPAGNOLO EMAIL';

  return false;
}

function generateId(prefix = 'c') {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function main() {
  console.log(`\n===============================================================`);
  console.log(`🚀 INICIANDO INGESTA DE BASES DE DATOS DE SEGURIDAD`);
  console.log(`Organización Destino: Just Create (${TARGET_ORG_ID})`);
  console.log(`Organización Blindada: Abba Seguridad (${FORBIDDEN_ORG_ID})`);
  console.log(`===============================================================\n`);

  // 1. Verificación previa de seguridad de organizaciones
  const targetOrg = await prisma.organization.findUnique({ where: { id: TARGET_ORG_ID } });
  if (!targetOrg) {
    throw new Error(`CRITICAL: Organización destino Just Create (${TARGET_ORG_ID}) no encontrada!`);
  }
  console.log(`✓ Organización destino verificada: "${targetOrg.name}" (${targetOrg.domain})`);

  const initialAbbaCount = await prisma.empresa.count({ where: { organizationId: FORBIDDEN_ORG_ID } });
  console.log(`✓ Conteo inicial Abba Seguridad (Empresas): ${initialAbbaCount}`);

  // 2. Limpieza de empresas borrador de la blacklist en Just Create
  console.log(`\n--- Paso 1: Limpieza de empresas placeholder en Just Create ---`);
  const placeholdersToDelete = await prisma.empresa.findMany({
    where: {
      organizationId: TARGET_ORG_ID,
      OR: [
        { name: { contains: 'Abba', mode: 'insensitive' } },
        { name: { contains: 'SoftGuard', mode: 'insensitive' } }
      ]
    }
  });

  for (const p of placeholdersToDelete) {
    console.log(`Eliminando placeholder "${p.name}" (ID: ${p.id})...`);
    await prisma.empresa.delete({ where: { id: p.id } });
  }
  console.log(`✓ Limpieza completada: ${placeholdersToDelete.length} placeholders eliminados.`);

  // 3. Carga y parseo de las 3 bases de datos
  console.log(`\n--- Paso 2: Lectura, Normalización y Filtrado de Fuentes ---`);

  const contactsByEmail = new Map();
  const contactsNoEmail = [];
  const excludedLog = [];

  function processRecord(source, rec) {
    const bl = checkBlacklist(rec.empresa, `${rec.firstName} ${rec.lastName}`, rec.email);
    if (bl) {
      excludedLog.push({ source, ...rec, reason: bl });
      return;
    }

    const emailKey = normalize(rec.email);
    if (emailKey && emailKey.includes('@')) {
      if (contactsByEmail.has(emailKey)) {
        const existing = contactsByEmail.get(emailKey);
        if (!existing.phone && rec.phone) existing.phone = rec.phone;
        if (!existing.empresa && rec.empresa) existing.empresa = rec.empresa;
        if (!existing.address && rec.address) existing.address = rec.address;
        if (!existing.city && rec.city) existing.city = rec.city;
        if (!existing.province && rec.province) existing.province = rec.province;
        if (!existing.country && rec.country) existing.country = rec.country;
        if (!existing.activity && rec.activity) existing.activity = rec.activity;
        if (!existing.role && rec.role) existing.role = rec.role;
        if (existing.source !== source && !existing.source.includes(source)) {
          existing.source += ` + ${source}`;
        }
      } else {
        contactsByEmail.set(emailKey, { source, ...rec });
      }
    } else {
      contactsNoEmail.push({ source, ...rec });
    }
  }

  // A. Mendoza CSV
  console.log(`Cargando BD_Brevo_Mendoza.csv...`);
  const mendozaLines = fs.readFileSync(path.join(baseDir, 'BD_Brevo_Mendoza.csv'), 'utf8')
    .split('\n')
    .filter(l => l.trim().length > 0);

  for (let i = 1; i < mendozaLines.length; i++) {
    const parts = mendozaLines[i].split(',');
    const email = String(parts[0] || '').trim();
    const empresaRaw = String(parts[1] || '').trim();
    const nombreFantasia = String(parts[2] || '').trim();
    const domicilio = String(parts[3] || '').trim();

    const empName = cleanCompany(nombreFantasia || empresaRaw);
    processRecord('Mendoza', {
      firstName: 'Contacto',
      lastName: empName,
      empresa: empName,
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

  // B. Exposeg Córdoba 2026.xlsx
  console.log(`Cargando Base Exposeg Córdoba 2026.xlsx...`);
  const exposegWb = xlsx.readFile(path.join(baseDir, 'Base Exposeg Córdoba 2026.xlsx'));
  for (const sheetName of exposegWb.SheetNames) {
    const rows = xlsx.utils.sheet_to_json(exposegWb.Sheets[sheetName], { defval: '' });
    for (const r of rows) {
      const email = String(r.Mail || '').trim();
      const fn = String(r.Nombre || '').trim();
      const ln = String(r.Apellido || '').trim();
      const emp = cleanCompany(String(r.Empresa || ''));
      processRecord(`Exposeg (${sheetName})`, {
        firstName: fn || 'Contacto',
        lastName: ln || (emp || 'Seguridad'),
        empresa: emp,
        companyRaw: emp,
        role: String(r.Cargo || 'Profesional / Técnico').trim(),
        email,
        phone: r.Telefono ? String(r.Telefono).trim() : '',
        address: String(r['Domicilio Laboral'] || '').trim(),
        city: String(r.Localidad || '').trim(),
        province: String(r.Provincia || 'Córdoba').trim(),
        country: String(r.Pais || 'Argentina').trim(),
        activity: String(r['Actividad Empresa'] || 'Seguridad Electrónica / Monitoreo').trim(),
        website: String(r.Web || '').trim()
      });
    }
  }

  // C. BD.xlsx (Hoja 2)
  console.log(`Cargando BD.xlsx...`);
  const bdWb = xlsx.readFile(path.join(baseDir, 'BD.xlsx'));
  const bdSheet = bdWb.Sheets['Hoja 2'] || bdWb.Sheets[bdWb.SheetNames[0]];
  const bdRows = xlsx.utils.sheet_to_json(bdSheet, { defval: '' });
  for (const r of bdRows) {
    const email = String(r.Correo || '').trim();
    const emp = cleanCompany(String(r.Empresa || ''));
    const apellido = String(r.Apellido || '').trim();

    const parts = apellido.split(/\s+/);
    let fn = 'Contacto';
    let ln = apellido;
    if (parts.length > 1) {
      fn = parts[0];
      ln = parts.slice(1).join(' ');
    } else if (parts.length === 1 && parts[0]) {
      ln = parts[0];
    }

    processRecord('BD.xlsx', {
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
      country: String(r.Pais || 'Argentina').trim(),
      activity: 'Seguridad Electrónica / Monitoreo',
      website: ''
    });
  }

  console.log(`✓ Total procesados con email único: ${contactsByEmail.size}`);
  console.log(`✓ Total excluidos por blacklist: ${excludedLog.length}`);
  console.log(`✓ Total sin email (guardados como contactos de referencia): ${contactsNoEmail.length}`);

  // 4. Agrupación Empresa -> Contactos
  console.log(`\n--- Paso 3: Agrupación en Empresas y Generación de Entidades ---`);

  const empresaMap = new Map(); // key = normalized company name -> { id, record, contactos: [] }
  const allContactsToInsert = [];
  const allClientsToInsert = [];

  // Procesa todos los contactos únicos con email
  const allUniqueContacts = Array.from(contactsByEmail.values());

  for (const c of allUniqueContacts) {
    let empresaId = null;
    let isIndependent = false;

    if (!c.empresa || isGenericCompany(c.empresa)) {
      isIndependent = true;
      // Para usuarios finales/independientes, creamos una empresa personal o los dejamos como consumidor final
      const personalEmpresaName = `${c.firstName} ${c.lastName} (Particular)`.trim();
      const pKey = `personal_${normalize(c.email)}`;
      if (!empresaMap.has(pKey)) {
        const empId = generateId('emp');
        empresaMap.set(pKey, {
          id: empId,
          data: {
            id: empId,
            organizationId: TARGET_ORG_ID,
            name: personalEmpresaName,
            isCliente: false,
            tipoCliente: 'CONSUMIDOR_FINAL',
            activity: 'Usuario Final / Independiente',
            address: c.address || null,
            city: c.city || null,
            province: c.province || null,
            country: c.country || 'Argentina',
            website: c.website || null,
          }
        });
      }
      empresaId = empresaMap.get(pKey).id;
    } else {
      const compKey = normalize(c.empresa);
      if (!empresaMap.has(compKey)) {
        const empId = generateId('emp');
        empresaMap.set(compKey, {
          id: empId,
          data: {
            id: empId,
            organizationId: TARGET_ORG_ID,
            name: c.empresa,
            isCliente: false,
            tipoCliente: 'EMPRESA',
            activity: c.activity || 'Seguridad Electrónica / Monitoreo',
            address: c.address || null,
            city: c.city || null,
            province: c.province || null,
            country: c.country || 'Argentina',
            website: c.website || null,
          }
        });
      }
      empresaId = empresaMap.get(compKey).id;
    }

    const contactoId = generateId('con');
    allContactsToInsert.push({
      id: contactoId,
      organizationId: TARGET_ORG_ID,
      empresaId: empresaId,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone || null,
      role: c.role || null,
      companyRaw: c.companyRaw || c.empresa || null,
      recibeFacturas: false,
    });

    const clientId = generateId('cli');
    allClientsToInsert.push({
      id: clientId,
      organizationId: TARGET_ORG_ID,
      name: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      phone: c.phone || null,
      company: c.empresa || null,
      country: c.country || null,
      province: c.province || null,
      city: c.city || null,
      address: c.address || null,
      status: 'PROSPECT',
      clientType: isIndependent ? 'B2C' : 'B2B',
      tags: JSON.stringify(['Prospecto', 'Base Seguridad', c.source.split(' + ')[0]]),
    });
  }

  const allEmpresasToInsert = Array.from(empresaMap.values()).map(e => e.data);
  console.log(`✓ Total Empresas preparadas: ${allEmpresasToInsert.length}`);
  console.log(`✓ Total Directorio Contactos preparados: ${allContactsToInsert.length}`);
  console.log(`✓ Total Clientes (Prospectos) preparados: ${allClientsToInsert.length}`);

  // 5. Inserción por lotes en Base de Datos (Postgres / Supabase)
  const BATCH_SIZE = 500;

  console.log(`\n--- Paso 4: Inserción de Empresas (en lotes de ${BATCH_SIZE}) ---`);
  for (let i = 0; i < allEmpresasToInsert.length; i += BATCH_SIZE) {
    const batch = allEmpresasToInsert.slice(i, i + BATCH_SIZE);
    await prisma.empresa.createMany({ data: batch });
    process.stdout.write(`Empresas insertadas: ${Math.min(i + BATCH_SIZE, allEmpresasToInsert.length)} / ${allEmpresasToInsert.length}\r`);
  }
  console.log(`\n✓ Todas las ${allEmpresasToInsert.length} empresas fueron insertadas exitosamente.`);

  console.log(`\n--- Paso 5: Inserción de Directorio Contactos (en lotes de ${BATCH_SIZE}) ---`);
  for (let i = 0; i < allContactsToInsert.length; i += BATCH_SIZE) {
    const batch = allContactsToInsert.slice(i, i + BATCH_SIZE);
    await prisma.directorioContacto.createMany({ data: batch });
    process.stdout.write(`Contactos insertados: ${Math.min(i + BATCH_SIZE, allContactsToInsert.length)} / ${allContactsToInsert.length}\r`);
  }
  console.log(`\n✓ Todos los ${allContactsToInsert.length} contactos del directorio fueron insertados exitosamente.`);

  console.log(`\n--- Paso 6: Inserción de Clientes Prospectos (en lotes de ${BATCH_SIZE}) ---`);
  for (let i = 0; i < allClientsToInsert.length; i += BATCH_SIZE) {
    const batch = allClientsToInsert.slice(i, i + BATCH_SIZE);
    await prisma.client.createMany({ data: batch });
    process.stdout.write(`Clientes insertados: ${Math.min(i + BATCH_SIZE, allClientsToInsert.length)} / ${allClientsToInsert.length}\r`);
  }
  console.log(`\n✓ Todos los ${allClientsToInsert.length} clientes prospectos fueron insertados exitosamente.`);

  // 6. Verificación de blindaje y consistencia final
  console.log(`\n--- Paso 7: Verificación de Blindaje e Integridad ---`);
  const finalAbbaCount = await prisma.empresa.count({ where: { organizationId: FORBIDDEN_ORG_ID } });
  console.log(`Conteo final Abba Seguridad (Empresas): ${finalAbbaCount} (Inicial: ${initialAbbaCount})`);
  if (finalAbbaCount !== initialAbbaCount) {
    console.error(`ALERTA: Se detectaron cambios en Abba Seguridad!`);
  } else {
    console.log(`✓ Blindaje 100% verificado: Abba Seguridad permaneció intacta.`);
  }

  const finalJustCreateEmpresas = await prisma.empresa.count({ where: { organizationId: TARGET_ORG_ID } });
  const finalJustCreateContactos = await prisma.directorioContacto.count({ where: { organizationId: TARGET_ORG_ID } });
  const finalJustCreateClients = await prisma.client.count({ where: { organizationId: TARGET_ORG_ID } });

  console.log(`\nResultados finales Just Create:`);
  console.log(`- Empresas en Just Create: ${finalJustCreateEmpresas}`);
  console.log(`- Contactos en Just Create: ${finalJustCreateContactos}`);
  console.log(`- Clientes (Prospectos) en Just Create: ${finalJustCreateClients}`);

  // Chequeo de exclusiones en DB Just Create
  const blCheck = await prisma.empresa.count({
    where: {
      organizationId: TARGET_ORG_ID,
      OR: [
        { name: { contains: 'Abba Seguridad', mode: 'insensitive' } },
        { name: { contains: 'SoftGuard', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`- Empresas de Blacklist en Just Create: ${blCheck} (Debe ser 0)`);

  const blContactCheck = await prisma.directorioContacto.count({
    where: {
      organizationId: TARGET_ORG_ID,
      OR: [
        { email: { contains: 'softguard', mode: 'insensitive' } },
        { email: { contains: 'sebastianpierini', mode: 'insensitive' } },
        { email: { contains: 'ceo@softguard', mode: 'insensitive' } }
      ]
    }
  });
  console.log(`- Contactos de Blacklist en Just Create: ${blContactCheck} (Debe ser 0)`);

  console.log(`\n🎉 PROCESO COMPLETADO CON ÉXITO.`);
}

main()
  .catch(err => {
    console.error('Error durante la ingesta:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
