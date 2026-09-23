const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateBrandAssets() {
  console.log('Generating brand assets from public/logo.png...');

  const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
  const publicDir = path.join(__dirname, '..', 'public');
  const iconsDir = path.join(publicDir, 'icons');
  const appDir = path.join(__dirname, '..', 'src', 'app');

  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // 1. Favicon PNGs
  await sharp(logoPath).resize(16, 16).png().toFile(path.join(publicDir, 'favicon-16x16.png'));
  await sharp(logoPath).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(logoPath).resize(48, 48).png().toFile(path.join(publicDir, 'favicon-48x48.png'));

  // 2. Apple Touch Icon (180x180)
  await sharp(logoPath)
    .resize(180, 180, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // 3. PWA Icons (192, 512)
  await sharp(logoPath)
    .resize(192, 192, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(path.join(iconsDir, 'icon-192.png'));

  await sharp(logoPath)
    .resize(512, 512, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .png()
    .toFile(path.join(iconsDir, 'icon-512.png'));

  // Maskable icon with 10% padding so system circles/rounded rects don't clip the logo
  await sharp(logoPath)
    .resize(410, 410, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 0 } })
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    })
    .png()
    .toFile(path.join(iconsDir, 'icon-maskable-512.png'));

  // 4. Multi-resolution favicon.ico (16, 32, 48)
  const buf16 = await sharp(logoPath).resize(16, 16).png().toBuffer();
  const buf32 = await sharp(logoPath).resize(32, 32).png().toBuffer();
  const buf48 = await sharp(logoPath).resize(48, 48).png().toBuffer();

  const images = [
    { size: 16, data: buf16 },
    { size: 32, data: buf32 },
    { size: 48, data: buf48 }
  ];

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(images.length, 4); // count

  let offset = 6 + (images.length * 16);
  const dirEntries = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size, 0);
    entry.writeUInt8(img.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += img.data.length;
  }

  const icoBuffer = Buffer.concat([header, ...dirEntries, ...images.map(img => img.data)]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), icoBuffer);

  // 5. OpenGraph & Social Preview Card (1200x630)
  // Prepare resized logo (240x240) with rounded corners/background
  const logoOg = await sharp(logoPath)
    .resize(220, 220, { fit: 'contain' })
    .toBuffer();

  const svgCard = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#070b14"/>
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
        <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="50%" stop-color="#6366f1"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="60" result="blur"/>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>

      <!-- Ambient glow orbs -->
      <circle cx="200" cy="150" r="180" fill="#6366f1" opacity="0.18" filter="url(#glow)"/>
      <circle cx="1050" cy="480" r="220" fill="#06b6d4" opacity="0.14" filter="url(#glow)"/>
      <circle cx="600" cy="300" r="250" fill="#ef4444" opacity="0.08" filter="url(#glow)"/>

      <!-- Border grid accent -->
      <rect x="30" y="30" width="1140" height="570" rx="28" fill="none" stroke="#1e293b" stroke-width="2"/>
      <rect x="30" y="30" width="1140" height="570" rx="28" fill="none" stroke="url(#brandGrad)" stroke-width="1.5" opacity="0.3"/>

      <!-- Badge -->
      <rect x="380" y="105" width="220" height="38" rx="19" fill="#1e1b4b" stroke="#4338ca" stroke-width="1.5"/>
      <text x="490" y="129" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="14" fill="#a5b4fc" text-anchor="middle" letter-spacing="1.5">PRODUCTIVITY OS</text>

      <!-- Headline -->
      <text x="380" y="195" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="64" fill="#ffffff" letter-spacing="-1">JustCRM</text>
      <text x="380" y="245" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="24" fill="#94a3b8">by JustCreate · Solución Integral B2B</text>

      <!-- Value Props -->
      <text x="380" y="315" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="28" fill="#f8fafc">Para Empresas de Seguridad y Servicios Técnicos</text>

      <!-- Bullets / Feature Highlights -->
      <g transform="translate(380, 360)">
        <!-- Bullet 1 -->
        <circle cx="12" cy="12" r="8" fill="#10b981"/>
        <text x="32" y="17" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="18" fill="#e2e8f0">Cotizador en 30s con Listas Gremio &amp; Público</text>

        <!-- Bullet 2 -->
        <circle cx="12" cy="46" r="8" fill="#6366f1"/>
        <text x="32" y="51" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="18" fill="#e2e8f0">App 'Mi Día' para Cuadrillas Técnicas &amp; Órdenes</text>

        <!-- Bullet 3 -->
        <circle cx="12" cy="80" r="8" fill="#06b6d4"/>
        <text x="32" y="85" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="18" fill="#e2e8f0">WhatsApp Oficial con IA NISSI (Gemini 2.5 Flash)</text>

        <!-- Bullet 4 -->
        <circle cx="12" cy="114" r="8" fill="#f59e0b"/>
        <text x="32" y="119" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="18" fill="#e2e8f0">Control de Stock, Pañol y Remitos de Entrega</text>
      </g>

      <!-- Bottom Domain URL -->
      <text x="380" y="545" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18" fill="#60a5fa">crm.justcreate.com.ar</text>
    </svg>
  `;

  // Logo box at (100, 180)
  const svgOverlay = Buffer.from(svgCard);

  await sharp(svgOverlay)
    .composite([
      {
        input: logoOg,
        top: 170,
        left: 100,
      }
    ])
    .png()
    .toFile(path.join(publicDir, 'og-image.png'));

  console.log('All brand and SEO assets generated successfully!');
}

generateBrandAssets().catch(err => {
  console.error(err);
  process.exit(1);
});
