import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, company, email, phone, message } = body

    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: 'Por favor completá nombre, email y teléfono.' },
        { status: 400 }
      )
    }

    const cleanPhone = String(phone).trim()
    const fechaHora = new Date().toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      dateStyle: 'full',
      timeStyle: 'medium',
    })

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0f19; color: #1e293b; margin: 0; padding: 24px; }
          .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15); }
          .header { background: linear-gradient(135deg, #ef4444 0%, #4f46e5 50%, #06b6d4 100%); padding: 28px 24px; color: white; text-align: center; }
          .content { padding: 28px 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 14px; }
          th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #f1f5f9; }
          th { width: 35%; color: #64748b; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { color: #0f172a; font-weight: 500; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; background-color: #ede9fe; color: #6d28d9; font-weight: 700; font-size: 12px; }
          .btn-wa { display: inline-block; margin-top: 24px; padding: 14px 28px; border-radius: 12px; background-color: #25D366; color: white; text-decoration: none; font-weight: 800; font-size: 14px; text-align: center; box-shadow: 0 4px 14px 0 rgba(37, 211, 102, 0.4); }
          .footer { padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin:0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">🚀 Nueva Solicitud de Demo JustCRM</h1>
            <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.95;">Landing Page Oficial · CRM para Empresas de Seguridad & Servicios</p>
          </div>
          <div class="content">
            <span class="badge">Lead Calificado Web</span>
            <p style="margin-top: 14px; font-size: 15px; color: #334155; line-height: 1.5;">
              Se ha recibido una nueva solicitud de demostración guiada desde el formulario de contacto de la landing page:
            </p>
            <table>
              <tr>
                <th>Nombre:</th>
                <td><strong style="color: #0f172a; font-size: 15px;">${name}</strong></td>
              </tr>
              <tr>
                <th>Empresa:</th>
                <td>${company || 'No especificada'}</td>
              </tr>
              <tr>
                <th>Email:</th>
                <td><a href="mailto:${email}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">${email}</a></td>
              </tr>
              <tr>
                <th>WhatsApp / Tel:</th>
                <td><a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}" style="color: #059669; font-weight: bold; text-decoration: none;">${cleanPhone}</a></td>
              </tr>
              ${message ? `<tr><th>Consulta / Notas:</th><td style="color: #334155; font-style: italic;">${message}</td></tr>` : ''}
              <tr>
                <th>Fecha y Hora:</th>
                <td>${fechaHora}</td>
              </tr>
            </table>

            <div style="text-align: center; margin-top: 24px;">
              <a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}?text=Hola%20${encodeURIComponent(name)},%20te%20contacto%20de%20JustCRM%20(JustCreate)%20por%20tu%20solicitud%20de%20demo." class="btn-wa" target="_blank">
                Abrir Chat de WhatsApp con el Prospecto →
              </a>
            </div>
          </div>
          <div class="footer">
            Notificación automática dirigida a contacto@justcreate.com.ar · JustCRM by JustCreate
          </div>
        </div>
      </body>
      </html>
    `

    // 1. Envío de correo a contacto@justcreate.com.ar
    try {
      await sendEmail({
        to: 'contacto@justcreate.com.ar',
        subject: `🚀 Solicitud de Demo JustCRM: ${name} (${company || 'Web Lead'})`,
        html: htmlContent,
      })
      console.log(`[Contacto API] Email de contacto enviado exitosamente para ${email}`)
    } catch (emailErr) {
      console.error('[Contacto API] Error al enviar email:', emailErr)
    }

    // 2. Registro en base de datos si existe organización
    try {
      const defaultOrg = await prisma.organization.findFirst({
        select: { id: true },
      })
      if (defaultOrg) {
        await prisma.client.create({
          data: {
            name,
            company: company || null,
            email,
            phone: cleanPhone,
            status: 'PROSPECT',
            tags: JSON.stringify(['Landing Page', 'Solicitud Demo', 'Web']),
            organizationId: defaultOrg.id,
          },
        })
        console.log(`[Contacto API] Prospecto registrado en base de datos: ${name}`)
      }
    } catch (dbErr) {
      console.warn('[Contacto API] No se pudo guardar lead en base de datos (ignorable):', dbErr)
    }

    return NextResponse.json({
      success: true,
      message: '¡Gracias! Tu solicitud ha sido recibida correctamente. Nos pondremos en contacto a la brevedad.',
    })
  } catch (error) {
    console.error('[Contacto API] Error general:', error)
    return NextResponse.json(
      { error: 'Ocurrió un error inesperado al procesar la solicitud.' },
      { status: 500 }
    )
  }
}
