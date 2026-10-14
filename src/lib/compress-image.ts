// Compresión de imágenes en el navegador — extraído de
// components/ui/image-link-modal.tsx para reusarlo donde se suban fotos
// (comprobantes de pago, etc.) sin depender de storage externo: se guarda
// directo como data URI comprimido, mismo criterio que el resto del CRM.
const MAX_PX = 1000
const TARGET_BYTES = 200 * 1024
const HARD_CAP_BYTES = 260 * 1024

async function compressToBlob(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file

  const img = document.createElement('img')
  const objectUrl = URL.createObjectURL(file)
  try {
    img.src = objectUrl
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('load')) })

    const ratio = Math.min(1, MAX_PX / img.naturalWidth, MAX_PX / img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    let blob: Blob | null = null
    for (const q of [0.82, 0.72, 0.62, 0.5]) {
      blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q))
      if (blob && blob.size <= (q === 0.82 ? TARGET_BYTES : HARD_CAP_BYTES)) break
    }
    if (!blob) throw new Error('encode')
    return blob
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const blobToDataUri = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as string)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

export async function compressImageToDataUri(file: File): Promise<string> {
  const blob = await compressToBlob(file)
  return blobToDataUri(blob)
}
