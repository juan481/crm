// Listas curadas para los campos fiscales de Empresa — texto libre por
// debajo (Empresa.condicionIva/formaPagoHabitual son String? en el schema,
// no enums de Prisma), mismo criterio que ya usa el formulario para
// país/ciudad: agregar o corregir una categoría es tocar este archivo, no
// una migración de base.

export const CONDICIONES_IVA = [
  'Responsable Inscripto',
  'Monotributo',
  'Exento',
  'Consumidor Final',
  'No Responsable',
]
export const OTRA_CONDICION_IVA = 'Otra'

export const FORMAS_PAGO = [
  'Transferencia',
  'Cheque',
  'Efectivo',
  'Tarjeta de crédito',
  'Tarjeta de débito',
]
export const OTRA_FORMA_PAGO = 'Otra'
