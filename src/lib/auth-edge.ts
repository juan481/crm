import { jwtVerify } from 'jose'
import { NextRequest } from 'next/server'
import type { AuthPayload } from '@/types'

const COOKIE_NAME = 'crm_token'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'change-this-secret'
  return new TextEncoder().encode(secret)
}

export async function verifyTokenEdge(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as AuthPayload
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null
}

export async function getAuthPayload(req: NextRequest): Promise<AuthPayload | null> {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyTokenEdge(token)
}
