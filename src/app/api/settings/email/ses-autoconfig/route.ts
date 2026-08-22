import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, canAccess } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Provisiona en un solo clic lo que el checklist de /configuracion/correo
// (pasos "configset"/"sns", marcados opcionales) le pedía a alguien hacer a
// mano en la consola de AWS: un topic de SNS, la suscripción HTTPS al
// webhook de este mismo CRM, y un Configuration Set de SES que publica
// delivery/bounce/complaint/open a ese topic. Sin este paso, SES nunca le
// avisa nada a src/app/api/webhooks/ses/route.ts — que ya está completo y
// probado — y las métricas de comunicaciones/page.tsx quedan en 0 para
// siempre aunque el envío en sí funcione perfecto (caso real: Abba
// Seguridad, sesConfigSet vacío, 10 campañas enviadas con 0 en las 4
// métricas de tracking).
//
// Idempotente a propósito: CreateTopic con el mismo nombre devuelve el ARN
// existente sin error; Subscribe con el mismo endpoint tampoco duplica una
// suscripción ya confirmada; Create(ConfigurationSet|EventDestination)
// atrapan su excepción "AlreadyExists" puntual y siguen. Así, correr este
// botón dos veces (o después de que alguien ya lo armó a mano) no rompe
// nada — sólo confirma/repara el estado.
export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!canAccess(payload.role, 'ADMIN'))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const db = prisma as any
    const org = await db.organization.findUnique({
      where: { id: payload.orgId },
      select: { smtpProvider: true, sesRegion: true, sesAccessKeyId: true, sesSecretKey: true },
    })

    if (!org || org.smtpProvider !== 'SES') {
      return NextResponse.json({ error: 'Activá y guardá Amazon SES como proveedor antes de configurar el tracking' }, { status: 400 })
    }
    if (!org.sesRegion || !org.sesAccessKeyId || !org.sesSecretKey) {
      return NextResponse.json({ error: 'Guardá región, Access Key ID y Secret Key de SES antes de continuar' }, { status: 400 })
    }

    const credentials = { accessKeyId: org.sesAccessKeyId as string, secretAccessKey: org.sesSecretKey as string }
    const region = org.sesRegion as string
    const webhookUrl = `${req.nextUrl.origin}/api/webhooks/ses`
    // Nombres derivados del orgId — únicos por organización, estables entre
    // corridas (así CreateTopic/CreateConfigurationSet son idempotentes de
    // verdad y no acumulan un recurso nuevo cada vez que alguien reintenta).
    const topicName = `crm-ses-tracking-${payload.orgId}`.slice(0, 256)
    const configSetName = `crm-tracking-${payload.orgId}`.slice(0, 64)

    const { SNSClient, CreateTopicCommand, SubscribeCommand } = await import('@aws-sdk/client-sns')
    const {
      SESClient, CreateConfigurationSetCommand, CreateConfigurationSetEventDestinationCommand,
    } = await import('@aws-sdk/client-ses')

    const sns = new SNSClient({ region, credentials })
    const ses = new SESClient({ region, credentials })

    let topicArn: string
    try {
      const topicRes = await sns.send(new CreateTopicCommand({ Name: topicName }))
      if (!topicRes.TopicArn) throw new Error('AWS no devolvió el ARN del topic')
      topicArn = topicRes.TopicArn
    } catch (err: any) {
      return NextResponse.json({ error: awsErrorMessage(err, 'crear el topic de SNS') }, { status: 502 })
    }

    try {
      await sns.send(new SubscribeCommand({ TopicArn: topicArn, Protocol: 'https', Endpoint: webhookUrl }))
    } catch (err: any) {
      return NextResponse.json({ error: awsErrorMessage(err, 'suscribir el webhook al topic de SNS') }, { status: 502 })
    }

    try {
      await ses.send(new CreateConfigurationSetCommand({ ConfigurationSet: { Name: configSetName } }))
    } catch (err: any) {
      if (err?.name !== 'AlreadyExistsException') {
        return NextResponse.json({ error: awsErrorMessage(err, 'crear el Configuration Set de SES') }, { status: 502 })
      }
    }

    try {
      await ses.send(new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: configSetName,
        EventDestination: {
          Name: 'crm-sns-tracking',
          Enabled: true,
          MatchingEventTypes: ['bounce', 'complaint', 'delivery', 'open'],
          SNSDestination: { TopicARN: topicArn },
        },
      }))
    } catch (err: any) {
      if (err?.name !== 'AlreadyExistsException') {
        return NextResponse.json({ error: awsErrorMessage(err, 'conectar el Configuration Set con el topic de SNS') }, { status: 502 })
      }
    }

    await db.organization.update({ where: { id: payload.orgId }, data: { sesConfigSet: configSetName } })

    return NextResponse.json({
      ok: true,
      configSet: configSetName,
      topicArn,
      webhookUrl,
      message: 'Tracking activado. Si el topic se creó recién ahora, AWS SNS ya mandó la confirmación de suscripción a tu webhook — se confirma sola, no hace falta ningún paso extra.',
    })
  } catch (error) {
    console.error('[SES AUTOCONFIG]', error)
    return NextResponse.json({ error: 'Error interno al configurar el tracking' }, { status: 500 })
  }
}

function awsErrorMessage(err: any, action: string): string {
  const name = err?.name ?? ''
  const msg = err?.message ?? String(err)
  if (name === 'AccessDenied' || name === 'AuthorizationErrorException' || /not authorized/i.test(msg)) {
    return `Tu usuario de AWS no tiene permiso para ${action}. Pedile a quien administra la cuenta de AWS que agregue estos permisos al usuario IAM: ses:CreateConfigurationSet, ses:CreateConfigurationSetEventDestination, sns:CreateTopic, sns:Subscribe.`
  }
  return `No se pudo ${action}: ${msg}`
}
