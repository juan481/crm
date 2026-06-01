// Login is now handled client-side via supabase.auth.signInWithPassword()
// This route is kept for backwards compatibility but is no longer the primary auth path.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Use Supabase Auth client-side sign-in instead.' },
    { status: 410 }
  )
}
