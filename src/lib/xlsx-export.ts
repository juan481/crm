// Helper compartido para el plugin "Exportación de Datos" — dispara la
// descarga de un .xlsx directo en el navegador a partir de filas ya
// armadas (sin pasar por el servidor: los datos ya llegaron autenticados
// vía los mismos endpoints que ya usa cada listado). xlsx pesa ~500kB, se
// carga sólo en el momento de exportar, no en el bundle inicial de la
// pantalla — mismo criterio que ya usan los imports de Contactos/Empresas.
export async function exportToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}
