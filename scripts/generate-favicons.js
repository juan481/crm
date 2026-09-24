const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generate() {
  console.log('Generating crisp favicons from logo.png...');

  // The squircle icon is inside public/logo.png at [left: 98, top: 367, width: 290, height: 290]
  // Extract with a round squircle mask (rx=64) so corners are fully transparent
  const maskSvg = Buffer.from(
    `<svg width="290" height="290"><rect x="0" y="0" width="290" height="290" rx="64" ry="64" fill="white"/></svg>`
  );

  const baseIcon = await sharp('public/logo.png')
    .extract({ left: 98, top: 367, width: 290, height: 290 })
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Save the master icon
  fs.writeFileSync('public/app-icon.png', baseIcon);

  // Generate PNG sizes
  const sizes = [16, 32, 48, 64, 128, 180, 192, 512];
  const pngBuffers = {};

  for (const s of sizes) {
    const buf = await sharp(baseIcon)
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers[s] = buf;
  }

  fs.writeFileSync('public/favicon-16x16.png', pngBuffers[16]);
  fs.writeFileSync('public/favicon-32x32.png', pngBuffers[32]);
  fs.writeFileSync('public/favicon-48x48.png', pngBuffers[48]);
  fs.writeFileSync('public/apple-touch-icon.png', pngBuffers[180]);
  if (!fs.existsSync('public/icons')) fs.mkdirSync('public/icons', { recursive: true });
  fs.writeFileSync('public/icons/icon-192.png', pngBuffers[192]);
  fs.writeFileSync('public/icons/icon-512.png', pngBuffers[512]);

  // Build standard multi-resolution ICO file containing 16x16, 32x32, 48x48
  // ICO file format with embedded PNGs:
  const icoSizes = [16, 32, 48];
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = icoSizes.length;
  let offset = headerSize + dirEntrySize * numImages;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type
  header.writeUInt16LE(numImages, 4); // count

  const dirEntries = [];
  const imageBuffers = [];

  for (const s of icoSizes) {
    const imgBuf = pngBuffers[s];
    imageBuffers.push(imgBuf);

    const entry = Buffer.alloc(16);
    entry.writeUInt8(s === 256 ? 0 : s, 0); // width
    entry.writeUInt8(s === 256 ? 0 : s, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(imgBuf.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // image offset

    dirEntries.push(entry);
    offset += imgBuf.length;
  }

  const icoBuffer = Buffer.concat([header, ...dirEntries, ...imageBuffers]);
  fs.writeFileSync('public/favicon.ico', icoBuffer);
  fs.writeFileSync('src/app/favicon.ico', icoBuffer);

  console.log('Successfully generated public/favicon.ico and src/app/favicon.ico (multi-res 16/32/48)');
}

generate().catch(console.error);
