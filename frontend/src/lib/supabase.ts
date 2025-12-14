// Supabase client helper (frontend)
// Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in `frontend/.env`
import { createClient } from '@supabase/supabase-js'

function clean(input?: string) {
  return (input || '').trim()
}

const url = clean(import.meta.env.VITE_SUPABASE_URL as string)
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY as string)

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  }
})
