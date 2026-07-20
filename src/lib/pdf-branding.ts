import type { jsPDF } from 'jspdf'

/**
 * Fetches a logo (PNG/JPEG/WEBP/SVG) and rasterizes it to a PNG data URL via canvas.
 * jsPDF's addImage requires the declared format to match the actual bytes exactly —
 * guessing the format from the URL string breaks for SVG/WEBP logos or extension-less
 * signed URLs, producing a corrupted image in the PDF. Rendering through a canvas
 * sidesteps that: every source format comes out as a clean PNG, and naturalWidth/
 * naturalHeight give the true aspect ratio so the logo is never stretched.
 */
export async function loadLogoForPdf(logoUrl: string | null | undefined): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!logoUrl) return null
  try {
    const resp = await fetch(logoUrl)
    if (!resp.ok) return null
    const blob = await resp.blob()
    const objectUrl = URL.createObjectURL(blob)

    try {
      const img = new window.Image()
      img.src = objectUrl
      await new Promise<void>((resolve, reject) => {
        img.onload  = () => resolve()
        img.onerror = () => reject(new Error('logo load failed'))
      })

      const width  = img.naturalWidth  || 1
      const height = img.naturalHeight || 1
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(img, 0, 0, width, height)

      return { dataUrl: canvas.toDataURL('image/png'), width, height }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return null
  }
}

/** Fits a logo inside a maxW×maxH box without distorting its aspect ratio. */
export function fitLogo(width: number, height: number, maxW: number, maxH: number) {
  const r = Math.min(maxW / width, maxH / height, 1)
  return { w: width * r, h: height * r }
}

const BRAND_URL   = 'https://justcreate.com.ar'
const BRAND_LABEL = 'Cotización realizada con JustCRM, by JustCreate'

/** Draws the standard three-column footer with a clickable JustCreate credit. */
export function drawBrandedFooter(
  doc: jsPDF,
  opts: { pw: number; mg: number; y: number; leftText: string; pr: number; pg: number; pb: number },
) {
  const { pw, mg, y, leftText, pr, pg, pb } = opts
  doc.setDrawColor(226, 232, 240)
  doc.line(mg, y, pw - mg, y)

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184)
  doc.text(leftText, mg, y + 6)

  doc.setFont('helvetica', 'bold'); doc.setTextColor(pr, pg, pb)
  const labelWidth = doc.getTextWidth(BRAND_LABEL)
  doc.textWithLink(BRAND_LABEL, pw / 2 - labelWidth / 2, y + 6, { url: BRAND_URL })

  doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184)
  doc.text('Pág. 1 / 1', pw - mg, y + 6, { align: 'right' })
}
