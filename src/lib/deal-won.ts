import { relinkContactos } from '@/lib/directorio-link'

// Cuando una oportunidad pasa a GANADO, el "cliente" detrás de esa venta
// tiene que quedar registrado como tal — antes había que acordarse de entrar
// a la ficha de la Empresa y tildar "es cliente" a mano. Este helper lo hace
// solo:
//
//  - Deal con empresa vinculada  → esa Empresa pasa a isCliente (si no lo era)
//  - Deal sin empresa pero con contacto cuya persona YA está en una Empresa
//    → esa Empresa pasa a isCliente
//  - Deal sin empresa, sólo con contacto suelto (consumidor final, el caso
//    típico de Abba) → se crea una Empresa a nombre de la persona, se le
//    engancha el contacto y el propio deal, y queda marcada como cliente
//  - Deal sin empresa y sin contacto → no se puede saber quién es el cliente,
//    no se hace nada
//
// Idempotente: el llamador sólo lo invoca en la transición HACIA ganado
// (existing.stage !== 'GANADO'), y acá igual se chequea isCliente antes de
// escribir. Falla suave — el llamador lo envuelve en try/catch, ganar el
// deal nunca se rompe porque esto falle.

export interface DealWonClienteResult {
  empresaId: string
  nombre: string
  // true = esta venta lo convirtió en cliente ahora (Empresa nueva, o una
  // existente que no era cliente). false = la Empresa ya era cliente.
  nuevoCliente: boolean
  // true = se creó una Empresa nueva para un consumidor final.
  empresaCreada: boolean
}

export async function marcarClienteAlGanar(
  db: any,
  deal: { id: string; empresaId: string | null; contactoId: string | null; ownerId: string },
  orgId: string,
): Promise<DealWonClienteResult | null> {
  let empresaId = deal.empresaId
  let contacto: { id: string; firstName: string; lastName: string; empresaId: string | null } | null = null

  // Sin empresa directa: ver si el contacto de la oportunidad ya pertenece a una.
  if (!empresaId && deal.contactoId) {
    contacto = await db.directorioContacto.findFirst({
      where: { id: deal.contactoId, organizationId: orgId },
      select: { id: true, firstName: true, lastName: true, empresaId: true },
    })
    if (contacto?.empresaId) empresaId = contacto.empresaId
  }

  // Consumidor final: no hay ninguna Empresa en juego, pero sí un contacto
  // suelto → se crea la Empresa a nombre de la persona.
  if (!empresaId && contacto) {
    const nombre = `${contacto.firstName ?? ''} ${contacto.lastName ?? ''}`.trim() || 'Cliente sin nombre'
    const nueva = await db.empresa.create({
      data: {
        name: nombre,
        organizationId: orgId,
        ownerId: deal.ownerId, // queda en la cartera del vendedor que la ganó
        isCliente: true,
        clienteDesde: new Date(),
      },
      select: { id: true, name: true },
    })
    await db.directorioContacto.update({ where: { id: contacto.id }, data: { empresaId: nueva.id } })
    await db.deal.update({ where: { id: deal.id }, data: { empresaId: nueva.id } })
    return { empresaId: nueva.id, nombre: nueva.name, nuevoCliente: true, empresaCreada: true }
  }

  if (!empresaId) return null // ni empresa ni contacto: no hay a quién marcar

  const empresa = await db.empresa.findFirst({
    where: { id: empresaId, organizationId: orgId },
    select: { id: true, name: true, isCliente: true, website: true },
  })
  if (!empresa) return null

  // El deal venía sin empresa (la sacamos del contacto) → vincularlo también.
  if (!deal.empresaId) {
    await db.deal.update({ where: { id: deal.id }, data: { empresaId: empresa.id } })
  }

  if (empresa.isCliente) {
    return { empresaId: empresa.id, nombre: empresa.name, nuevoCliente: false, empresaCreada: false }
  }

  await db.empresa.update({
    where: { id: empresa.id },
    data: { isCliente: true, clienteDesde: new Date() },
  })
  // Mismo gesto que el toggle manual de la ficha de Empresa: enganchar
  // contactos sueltos que matcheen.
  await relinkContactos(db, empresa.id, empresa.name, orgId, empresa.website)

  return { empresaId: empresa.id, nombre: empresa.name, nuevoCliente: true, empresaCreada: false }
}
