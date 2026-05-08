import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import type { AuthPayload, Role } from '@/types'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret'
const COOKIE_NAME = 'crm_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    return null
  }
}

export function setAuthCookie(token: string): void {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export function clearAuthCookie(): void {
  cookies().set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
}

export function getTokenFromCookies(): string | null {
  try {
    return cookies().get(COOKIE_NAME)?.value ?? null
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null
}

export async function getCurrentUser(req?: NextRequest): Promise<AuthPayload | null> {
  const token = req ? getTokenFromRequest(req) : getTokenFromCookies()
  if (!token) return null
  return verifyToken(token)
}

// Role hierarchy check
export function canAccess(userRole: Role, requiredRole: Role): boolean {
  const hierarchy: Record<Role, number> = { SUPER_ADMIN: 3, ADMIN: 2, SELLER: 1 }
  return hierarchy[userRole] >= hierarchy[requiredRole]
}
