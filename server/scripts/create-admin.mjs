import { createClient } from '@supabase/supabase-js'

// Read required env vars
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'

async function ensureAdminUser() {
  // Try create user via admin API
  let user = null
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { username: ADMIN_USERNAME }
  })

  if (error) {
    // If user exists, try to find by listing users and match by email
    if (String(error.message || '').toLowerCase().includes('exists')) {
      console.log('User already exists, locating...')
      let page = 1
      let found = null
      while (!found) {
        const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
        if (listErr) throw listErr
        found = list.users.find(u => (u.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase())
        if (found || list.users.length < 1000) break
        page += 1
      }
      if (!found) throw new Error('Existing user not found after listUsers scan')
      user = found
    } else {
      throw error
    }
  } else {
    user = data.user
  }

  if (!user?.id) throw new Error('Failed to resolve admin user id')

  // Upsert into public.admin with role super
  const { error: upsertErr } = await supabase
    .from('admin')
    .upsert({ user_id: user.id, email: ADMIN_EMAIL, role: 'super', is_active: true }, { onConflict: 'user_id' })
  if (upsertErr) throw upsertErr

  console.log('✅ Admin ready:', { id: user.id, email: ADMIN_EMAIL, role: 'super' })
}

ensureAdminUser().catch((e) => {
  console.error('❌ Failed to provision admin:', e)
  process.exit(1)
})
