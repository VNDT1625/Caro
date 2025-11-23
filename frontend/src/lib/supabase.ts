// Supabase client helper (frontend)
// Fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in `frontend/.env`
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key)
