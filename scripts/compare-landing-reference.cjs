const sharp = require('sharp')
const path = require('path')

const outputDir = path.join(process.cwd(), 'output', 'justcrm-landing-redesign')
const sourcePath = path.join(outputDir, 'source-option-1.png')
const implementationPath = path.join(outputDir, 'desktop-viewport.png')
const outputPath = path.join(outputDir, 'reference-vs-implementation.png')

async function main() {
  const panelWidth = 1536
  const panelHeight = 1024
  const gap = 18
  const labelHeight = 44

  const source = await sharp(sourcePath).resize(panelWidth, panelHeight, { fit: 'fill' }).png().toBuffer()
  const implementation = await sharp(implementationPath).resize(panelWidth, panelHeight, { fit: 'fill' }).png().toBuffer()
  const labels = Buffer.from(`
    <svg width="${panelWidth * 2 + gap}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#071129"/>
      <text x="24" y="29" fill="#ffffff" font-family="Arial, sans-serif" font-size="17" font-weight="700">REFERENCIA SELECCIONADA</text>
      <text x="${panelWidth + gap + 24}" y="29" fill="#ffffff" font-family="Arial, sans-serif" font-size="17" font-weight="700">IMPLEMENTACIÓN</text>
    </svg>
  `)

  await sharp({
    create: {
      width: panelWidth * 2 + gap,
      height: panelHeight + labelHeight,
      channels: 4,
      background: '#dce4ec',
    },
  })
    .composite([
      { input: labels, left: 0, top: 0 },
      { input: source, left: 0, top: labelHeight },
      { input: implementation, left: panelWidth + gap, top: labelHeight },
    ])
    .png()
    .toFile(outputPath)

  process.stdout.write(outputPath)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
