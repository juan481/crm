// jsPDF con la fuente "helvetica" estándar (WinAnsi) no tiene glifo para
// caracteres fullwidth/CJK — algunas descripciones de productos vienen de
// fichas técnicas de fabricantes chinos con paréntesis fullwidth ("（"/"）"),
// comillas curvas u otra puntuación fuera de WinAnsi. Un solo carácter sin
// glifo rompe el cálculo de ancho de jsPDF y descuadra todo el texto que
// sigue (el "efecto letra por letra separada" que se veía en el PDF de
// cotizaciones). NFKC normaliza fullwidth → ASCII normal; lo que sobra
// después de eso (fuera de Latin-1) se saca en vez de arriesgar otro glifo
// faltante.
export function sanitizePdfText(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x00-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
