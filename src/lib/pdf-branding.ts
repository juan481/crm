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

export interface PdfLogo { dataUrl: string; width: number; height: number }

/**
 * Draws the document header band: logo + brand name on the left, a small
 * uppercase "kicker" pill and the date stacked on the right, plus a subtle
 * darker diagonal accent for depth instead of a flat single-color block.
 * Returns the band height so callers know where the body content starts.
 */
export function drawPdfHeader(doc: jsPDF, opts: {
  pw: number; mg: number
  pr: number; pg: number; pb: number
  orgName: string
  logo: PdfLogo | null
  kicker: string
  dateLabel: string
}): number {
  const { pw, mg, pr, pg, pb, orgName, logo, kicker, dateLabel } = opts
  const H = 46

  doc.setFillColor(pr, pg, pb)
  doc.rect(0, 0, pw, H, 'F')

  const darken = (c: number) => Math.max(0, Math.round(c * 0.82))
  doc.setFillColor(darken(pr), darken(pg), darken(pb))
  doc.triangle(pw - 46, H, pw, H - 20, pw, H, 'F')

  let textX = mg
  if (logo) {
    const maxW = 40, maxH = 24
    const { w: lW, h: lH } = fitLogo(logo.width, logo.height, maxW, maxH)
    doc.addImage(logo.dataUrl, 'PNG', mg, (H - lH) / 2, lW, lH)
    textX = mg + lW + 5
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19)
  doc.text(orgName, textX, H / 2 + 4)

  // Kicker pill (top-right)
  const kickerText = kicker.toUpperCase()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  const kw = doc.getTextWidth(kickerText) + 8
  const pillX = pw - mg - kw, pillY = 10
  doc.setGState(doc.GState({ opacity: 0.18 }))
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(pillX, pillY, kw, 7, 3.5, 3.5, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))
  doc.setTextColor(255, 255, 255)
  doc.text(kickerText, pillX + kw / 2, pillY + 4.9, { align: 'center' })

  // Date (below the pill)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.setGState(doc.GState({ opacity: 0.85 }))
  doc.text(dateLabel, pw - mg, pillY + 15, { align: 'right' })
  doc.setGState(doc.GState({ opacity: 1 }))

  return H
}

/**
 * Draws a subtle tinted notice bar stating how long the quote is valid for.
 * Returns the y position right after the bar so callers can keep stacking content.
 */
export function drawValidityNote(doc: jsPDF, opts: {
  mg: number; cw: number; y: number
  pr: number; pg: number; pb: number
  validityDays: number
  fromDate: Date
}): number {
  const { mg, cw, y, pr, pg, pb, validityDays, fromDate } = opts
  const expiry = new Date(fromDate)
  expiry.setDate(expiry.getDate() + validityDays)
  const expiryLabel = expiry.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  const text = `Cotización válida por ${validityDays} días luego de su emisión — vence el ${expiryLabel}.`

  const h = 9
  doc.setGState(doc.GState({ opacity: 0.08 }))
  doc.setFillColor(pr, pg, pb)
  doc.roundedRect(mg, y, cw, h, 2, 2, 'F')
  doc.setGState(doc.GState({ opacity: 1 }))

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(pr, pg, pb)
  doc.text(text, mg + cw / 2, y + h / 2 + 1.4, { align: 'center' })

  return y + h + 8
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
