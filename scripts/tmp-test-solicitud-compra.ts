import { prisma } from '../src/lib/db'

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: { contains: 'Abba', mode: 'insensitive' } }, select: { id: true } })
  if (!org) { console.log('No Abba org'); return }

  const proveedor = await prisma.empresa.findFirst({ where: { organizationId: org.id, esProveedor: true }, select: { id: true, name: true } })
  console.log('Proveedor de prueba:', proveedor)

  const producto = await prisma.product.findFirst({ where: { organizationId: org.id, sku: { not: null } }, select: { id: true, name: true, sku: true, costo: true, currency: true } })
  console.log('Producto de prueba:', producto)

  const solicitud = await prisma.solicitudCompra.create({
    data: { organizationId: org.id, proveedorId: proveedor?.id ?? null },
  })
  console.log('Creada:', solicitud.id)

  if (producto) {
    const item = await prisma.solicitudCompraItem.create({
      data: {
        solicitudId: solicitud.id,
        productId: producto.id,
        sku: producto.sku,
        nombre: producto.name,
        cantidad: 3,
        costoUnitario: producto.costo ?? 0,
        moneda: producto.currency,
      },
    })
    console.log('Item creado:', item.id)
  }

  const full = await prisma.solicitudCompra.findUnique({
    where: { id: solicitud.id },
    include: { items: true, proveedor: { select: { name: true } } },
  })
  console.log('Full read:', JSON.stringify(full, null, 2))

  await prisma.solicitudCompra.delete({ where: { id: solicitud.id } })
  const gone = await prisma.solicitudCompra.findUnique({ where: { id: solicitud.id } })
  console.log('Cleanup OK, borrada:', gone === null)
}
main().finally(() => prisma.$disconnect())
