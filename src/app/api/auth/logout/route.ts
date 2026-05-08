import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/lib/auth'

export async function POST() {
  clearAuthCookie()
  return NextResponse.json({ message: 'Sesión cerrada' }, { status: 200 })
}
