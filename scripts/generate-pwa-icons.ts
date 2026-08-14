// Se corre una sola vez local (npx tsx scripts/generate-pwa-icons.ts) para
// generar los PNG del manifest a partir de public/icon-source.svg — los PNG
// resultantes se commitean, no se regeneran en build. Mismo gradiente
// 135° #6366f1→#8b5cf6 que ya usa .gradient-bg (globals.css) como logo
// fallback en el sidebar, así que no hay diseño nuevo que inventar.
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const root = path.resolve(__dirname, '..')
const src  = path.join(root, 'public', 'icon-source.svg')
const outDir = path.join(root, 'public', 'icons')

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const svg = fs.readFileSync(src)

  await sharp(svg).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'))
  await sharp(svg).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'))

  // Maskable: el ícono real debe caber en la "safe zone" central (~80%) —
  // se compone el mismo SVG más chico sobre un lienzo 512x512 con el mismo
  // fondo de gradiente, para que Android no lo recorte de forma rara.
  const inner = await sharp(svg).resize(410, 410).png().toBuffer()
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 99, g: 102, b: 241, alpha: 1 } },
  })
    .composite([{ input: inner, left: 51, top: 51 }])
    .png()
    .toFile(path.join(outDir, 'icon-maskable-512.png'))

  console.log('OK: iconos PWA generados en public/icons/')
}

main().catch((e) => { console.error(e); process.exit(1) })
