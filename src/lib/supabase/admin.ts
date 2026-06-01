import { createClient } from '@supabase/supabase-js'

// Admin client — uses service role key, bypasses RLS.
// NEVER expose to the browser. Server-only.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY env variable is required')

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
