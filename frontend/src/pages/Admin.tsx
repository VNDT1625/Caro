import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import {
  ResponsiveContainer,
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'

type Section = 'dashboard' | 'users' | 'matches' | 'rooms' | 'admins' | 'database'

type ProfileRow = {
  user_id: string
  username: string | null
  display_name: string | null
  email?: string | null
  current_rank: string | null
  mindpoint: number | null
  elo_rating: number | null
  total_matches: number | null
  total_wins: number | null
  total_losses: number | null
  coins: number | null
  gems: number | null
  settings: Record<string, any> | null
  last_active: string | null
  created_at: string | null
}

type MatchRow = {
  id: string
  match_type: string
  result: string | null
  started_at: string | null
  ended_at: string | null
  total_moves: number | null
  win_condition: string | null
  player_x_user_id: string | null
  player_o_user_id: string | null
  winner_user_id: string | null
  player_x?: { username?: string | null, display_name?: string | null } | null
  player_o?: { username?: string | null, display_name?: string | null } | null
}

type RoomRow = {
  id: string
  room_code: string | null
  room_name: string | null
  mode: string | null
  is_private: boolean | null
  status: string | null
  current_players: number | null
  max_players: number | null
  created_at: string | null
  started_at: string | null
  ended_at: string | null
}

type AdminRow = {
  user_id: string
  email: string
  role: string
  is_active: boolean
  created_at: string | null
  last_active_at: string | null
}

type TableConfig = { table: string, pk: string, orderBy?: string }

const formatDate = (v?: string | null) => v ? new Date(v).toLocaleString() : '—'
const pct = (wins?: number | null, total?: number | null) => {
  const w = Number(wins || 0)
  const t = Number(total || 0)
  if (!t) return '0%'
  return `${Math.round((w / t) * 100)}%`
}
const labelOr = (text: string | undefined, fallback: string) => (text && text !== fallback ? text : fallback)

export default function Admin() {
  const { t } = useLanguage()
  const [active, setActive] = useState<Section>('dashboard')

  const tabs: { id: Section, label: string }[] = useMemo(() => ([
    { id: 'dashboard', label: t('admin.tabs.dashboard') },
    { id: 'users', label: t('admin.tabs.users') },
    { id: 'matches', label: t('admin.tabs.matches') },
    { id: 'rooms', label: t('admin.tabs.rooms') },
    { id: 'admins', label: t('admin.tabs.admins') },
    { id: 'database', label: t('admin.tabs.database') }
  ]), [t])

  return (
    <div className="admin-root" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 'calc(100vh - 80px)', background: 'linear-gradient(135deg,#0f172a,#0b1222)' }}>
      <aside className="admin-sidebar" style={{ borderRight: '1px solid #23324a', padding: 16, background: 'rgba(12,19,35,0.8)', backdropFilter: 'blur(6px)' }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>{t('admin.title')}</h1>
          <p style={{ color: '#94A3B8', margin: '6px 0 0 0' }}>{t('admin.subtitle')}</p>
        </div>
        <nav style={{ display: 'grid', gap: 6 }}>
          {tabs.map(tab => (
            <SidebarBtn key={tab.id} label={tab.label} active={active === tab.id} onClick={() => setActive(tab.id)} />
          ))}
        </nav>
        <div style={{ marginTop: 24, padding: 12, borderRadius: 12, border: '1px solid rgba(56,189,248,0.2)', color: '#cbd5e1', background: 'rgba(15,118,178,0.08)', fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('admin.dashboard.title')}</div>
          <div>{t('admin.dashboard.healthHint')}</div>
          <div style={{ marginTop: 8, color: '#38BDF8' }}>• {t('admin.tabs.users')}</div>
          <div style={{ color: '#38BDF8' }}>• {t('admin.tabs.matches')}</div>
          <div style={{ color: '#38BDF8' }}>• {t('admin.tabs.rooms')}</div>
          <div style={{ color: '#38BDF8' }}>• {t('admin.tabs.admins')}</div>
          <div style={{ color: '#38BDF8' }}>• {t('admin.tabs.database')}</div>
        </div>
      </aside>

      <main className="admin-content" style={{ padding: 20 }}>
        {active === 'dashboard' && <Dashboard t={t} />}
        {active === 'users' && <Users t={t} />}
        {active === 'matches' && <Matches t={t} />}
        {active === 'rooms' && <Rooms t={t} />}
        {active === 'admins' && <Admins t={t} />}
        {active === 'database' && <DatabaseManager t={t} />}
      </main>
    </div>
  )
}

function SidebarBtn({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left',
      padding: '10px 12px',
      borderRadius: 10,
      border: '1px solid',
      borderColor: active ? 'rgba(56, 189, 248, 0.4)' : 'rgba(71,85,105,0.35)',
      background: active ? 'linear-gradient(120deg,rgba(56,189,248,0.18),rgba(14,165,233,0.08))' : 'rgba(2,6,23,0.3)',
      color: active ? '#38BDF8' : '#CBD5E1',
      cursor: 'pointer',
      transition: 'all 120ms ease'
    }}>{label}</button>
  )
}

function Card({ title, value, hint }: { title: string, value: string | number, hint?: string }) {
  return (
    <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 14, padding: 14, background: 'linear-gradient(180deg, rgba(15,23,42,0.7), rgba(11,17,30,0.75))', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <div style={{ color: '#94A3B8', marginBottom: 4, fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
      {hint && <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function Table({ headers, rows }: { headers: string[], rows: (React.ReactNode[])[] }) {
  return (
    <div style={{ border: '1px solid rgba(71,85,105,0.3)', borderRadius: 12, overflow: 'hidden', background: 'rgba(13,20,35,0.65)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))`, gap: 8, padding: '10px 12px', color: '#cbd5e1', background: 'rgba(15,23,42,0.8)', fontWeight: 700, position: 'sticky', top: 0, zIndex: 1 }}>
        {headers.map((h, i) => (<div key={i}>{h}</div>))}
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {rows.length === 0 && (
          <div style={{ padding: 14, color: '#94A3B8' }}>No data</div>
        )}
        {rows.map((r, ri) => (
          <div
            key={ri}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))`,
              gap: 8,
              padding: '12px',
              borderTop: '1px solid rgba(71,85,105,0.25)',
              background: ri % 2 === 0 ? 'rgba(148,163,184,0.04)' : 'transparent'
            }}
          >
            {r.map((c, ci) => (<div key={ci}>{c}</div>))}
          </div>
        ))}
      </div>
    </div>
  )
}

// DASHBOARD
function Dashboard({ t }: { t: (k: string, v?: any) => string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    activeMatches: 0,
    waitingRooms: 0,
    adminCount: 0,
    shopItems: 0,
    avgInactiveMinutes: 0,
    revenueToday: 0
  })
  const [presenceOnline, setPresenceOnline] = useState<number | null>(null)
  const [series, setSeries] = useState({
    matches7d: [] as Array<{ day: string, count: number }>,
    revenue7d: [] as Array<{ day: string, amount: number }>,
    signups7d: [] as Array<{ day: string, count: number }>
  })
  const [lastUpdated, setLastUpdated] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    const fetchMetrics = async () => {
      setLoading(true)
      setError(null)
      try {
        const [
          { count: totalUsers },
          onlineRes,
          activeRes,
          waitingRes,
          adminRes,
          shopRes,
          revenueRes,
          avgLastActive
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          (async () => {
            try {
              const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
              const { count } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .gte('last_active', fiveMinAgo)
              return count ?? 0
            } catch { return 0 }
          })(),
          (async () => {
            try {
              const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2h safeguard
              const { count } = await supabase
                .from('matches')
                .select('*', { count: 'exact', head: true })
                .is('ended_at', null)
                .gte('started_at', cutoff)
              return count ?? 0
            } catch { return 0 }
          })(),
          (async () => {
            try {
              const { count } = await supabase
                .from('rooms')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'waiting')
              return count ?? 0
            } catch { return 0 }
          })(),
          (async () => {
            try {
              const { count } = await supabase.from('admin').select('*', { count: 'exact', head: true })
              return count ?? 0
            } catch { return 0 }
          })(),
          (async () => {
            try {
              const { count } = await supabase.from('items').select('*', { count: 'exact', head: true }).eq('source_type', 'shop').eq('is_available', true)
              return count ?? 0
            } catch { return 0 }
          })(),
          (async () => {
            try {
              const start = new Date(); start.setHours(0, 0, 0, 0)
              const { data, error } = await supabase
                .from('transactions')
                .select('amount, transaction_type, currency_type, created_at')
                .gte('created_at', start.toISOString())
                .eq('transaction_type', 'earn')
              if (!error && Array.isArray(data)) return data.reduce((s, r: any) => s + (Number(r.amount) || 0), 0)
            } catch {}
            return 0
          })()
          ,
          (async () => {
            try {
              const { data, error } = await supabase
                .from('profiles')
                .select('last_active')
                .order('last_active', { ascending: false })
                .limit(500)
              if (error || !data) return 0
              const now = Date.now()
              const minutes = data
                .map(r => r.last_active ? (now - new Date(r.last_active).getTime()) / 60000 : null)
                .filter((v): v is number => v !== null && Number.isFinite(v))
              if (!minutes.length) return 0
              return minutes.reduce((a, b) => a + b, 0) / minutes.length
            } catch { return 0 }
          })()
        ])

        if (!cancelled) setMetrics({
          totalUsers: totalUsers ?? 0,
          onlineUsers: Number(onlineRes) || 0,
          activeMatches: Number(activeRes) || 0,
          waitingRooms: Number(waitingRes) || 0,
          adminCount: Number(adminRes) || 0,
          shopItems: Number(shopRes) || 0,
          avgInactiveMinutes: Number(avgLastActive) || 0,
          revenueToday: Number(revenueRes) || 0
        })

        const today = new Date(); today.setHours(0, 0, 0, 0)
        const start = new Date(today); start.setDate(today.getDate() - 6)
        const startISO = start.toISOString()

        const [matchesData, txData, profilesData] = await Promise.all([
          supabase.from('matches').select('id, created_at').gte('created_at', startISO),
          supabase.from('transactions').select('amount, transaction_type, created_at').gte('created_at', startISO),
          supabase.from('profiles').select('id, created_at').gte('created_at', startISO)
        ])

        const days: string[] = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(start); d.setDate(start.getDate() + i)
          return d.toISOString().slice(0, 10)
        })

        const countByDay = (arr: any[]) => {
          const map = new Map<string, number>()
          for (const r of arr || []) {
            const day = (r.created_at || '').slice(0, 10)
            map.set(day, (map.get(day) || 0) + 1)
          }
          return days.map(day => ({ day, count: map.get(day) || 0 }))
        }
        const sumByDay = (arr: any[]) => {
          const map = new Map<string, number>()
          for (const r of arr || []) {
            const day = (r.created_at || '').slice(0, 10)
            map.set(day, (map.get(day) || 0) + (Number(r.amount) || 0))
          }
          return days.map(day => ({ day, amount: map.get(day) || 0 }))
        }

        if (!cancelled) {
          setSeries({
            matches7d: countByDay(matchesData.data || []),
            revenue7d: sumByDay(txData.data || []),
            signups7d: countByDay(profilesData.data || [])
          })
          setLastUpdated(new Date().toLocaleString())
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchMetrics()
    const id = setInterval(fetchMetrics, 30000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Presence-based realtime online counter
  useEffect(() => {
    let mounted = true
    const setup = async () => {
      const session = await supabase.auth.getSession()
      const uid = session.data.session?.user?.id || `admin-${Math.random().toString(36).slice(2)}`
      const channel = supabase.channel('presence:global', { config: { presence: { key: uid } } })

      channel.on('presence', { event: 'sync' }, () => {
        if (!mounted) return
        try {
          const state = channel.presenceState() as Record<string, Array<Record<string, any>>>
          const nonAdminKeys = Object.entries(state)
            .filter(([_, metas]) => metas?.some(m => m.is_admin !== true))
            .map(([key]) => key)
          setPresenceOnline(nonAdminKeys.length)
        } catch {}
      })

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ viewer: 'admin', at: new Date().toISOString() })
        }
      })

      return channel
    }

    let ch: any
    setup().then((c) => { ch = c })
    return () => { mounted = false; try { ch?.unsubscribe() } catch {} }
  }, [])

  const waitingLabel = React.useMemo(() => {
    const label = t('admin.dashboard.metrics.waitingRooms')
    return labelOr(label, 'Waiting rooms')
  }, [t])
  const adminLabel = React.useMemo(() => labelOr(t('admin.dashboard.metrics.adminCount'), 'Admins'), [t])
  const shopLabel = React.useMemo(() => labelOr(t('admin.dashboard.metrics.shopItems'), 'Shop items'), [t])
  const avgLabel = React.useMemo(() => labelOr(t('admin.dashboard.metrics.avgActive'), 'Avg inactivity (h)'), [t])

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('admin.dashboard.title')}</h2>
          <div style={{ color: '#94A3B8', fontSize: 13 }}>{t('admin.dashboard.healthHint')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lastUpdated && (<span style={{ color: '#94A3B8', fontSize: 12 }}>{lastUpdated}</span>)}
          <button onClick={() => location.reload()} title={t('leaderboard.refresh')} style={{ padding: '6px 10px' }}>
            {t('leaderboard.refresh')}
          </button>
        </div>
      </div>
      {error && <div style={{ marginBottom: 12, color: '#ef4444' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Card title={t('admin.dashboard.metrics.totalUsers')} value={loading ? '…' : metrics.totalUsers} />
        <Card title={t('admin.dashboard.metrics.onlineUsers')} value={presenceOnline ?? (loading ? '…' : metrics.onlineUsers)} />
        <Card title={t('admin.dashboard.metrics.activeMatches')} value={loading ? '…' : metrics.activeMatches} hint="ended_at is NULL and started < 2h" />
        <Card title={waitingLabel} value={loading ? '…' : metrics.waitingRooms} hint="rooms.status = waiting" />
        <Card title={adminLabel} value={loading ? '…' : metrics.adminCount} />
        <Card title={shopLabel} value={loading ? '…' : metrics.shopItems} />
        <Card title={avgLabel} value={loading ? '…' : (metrics.avgInactiveMinutes / 60).toFixed(1)} hint="Avg hours since last_active (latest 500 users)" />
        <Card title={t('admin.dashboard.metrics.revenueToday')} value={loading ? '…' : metrics.revenueToday} hint="transactions today" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
        <ChartCard title={t('admin.dashboard.charts.matches7d')}>
          <AreaChart data={series.matches7d} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.6}/>
                <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Area type="monotone" dataKey="count" stroke="#60A5FA" fillOpacity={1} fill="url(#colorMatches)" />
          </AreaChart>
        </ChartCard>
        <ChartCard title={t('admin.dashboard.charts.revenue7d')}>
          <BarChart data={series.revenue7d} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="amount" fill="#34D399" />
          </BarChart>
        </ChartCard>
        <ChartCard title={t('admin.dashboard.charts.signups7d')}>
          <LineChart data={series.signups7d} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2a44" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ChartCard>
      </div>
    </section>
  )
}

function ChartCard({ title, children }: { title: string, children: React.ReactElement }) {
  return (
    <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.5)' }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>{title}</div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// USERS
function Users({ t }: { t: (k: string) => string }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ProfileRow[]>([])
  const PAGE_SIZE = 15

  useEffect(() => { void load() }, [page])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const selectWithEmail = 'user_id,username,display_name,email,current_rank,mindpoint,elo_rating,total_matches,total_wins,total_losses,coins,gems,settings,last_active,created_at'
      const selectNoEmail = 'user_id,username,display_name,current_rank,mindpoint,elo_rating,total_matches,total_wins,total_losses,coins,gems,settings,last_active,created_at'
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      let query = supabase
        .from('profiles_with_email')
        .select(selectWithEmail, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (search.trim()) {
        const q = search.trim()
        query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      }

      let { data, error, count } = await query

      // Fallback nếu view chưa tồn tại / không có quyền
      if (error) {
        let fallback = supabase
          .from('profiles')
          .select(selectNoEmail, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to)
        if (search.trim()) {
          const q = search.trim()
          fallback = fallback.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        }
        const res = await fallback
        data = res.data
        error = res.error
        count = res.count
      }

      if (error) throw error
      setRows((data || []) as ProfileRow[])
      setTotal(count || 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const toggleBan = async (row: ProfileRow) => {
    const banned = row.settings?.banned === true
    const reason = !banned ? window.prompt('Ban reason (optional)', row.settings?.banned_reason || '') : null
    const nextSettings = { ...(row.settings || {}), banned: !banned, banned_reason: banned ? null : reason, banned_at: banned ? null : new Date().toISOString() }
    try {
      await supabase.from('profiles').update({ settings: nextSettings }).eq('user_id', row.user_id)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to update ban status')
    }
  }

  const banLabel = (row: ProfileRow) => row.settings?.banned ? t('admin.users.unban') : t('admin.users.ban')

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{t('admin.users.title')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder={t('admin.users.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }} />
          <button onClick={() => { setPage(0); void load() }}>{t('common.search')}</button>
          <button onClick={() => { setSearch(''); setPage(0); void load() }}>{t('leaderboard.refresh')}</button>
        </div>
      </div>
      {error && <div style={{ marginBottom: 8, color: '#ef4444' }}>{error}</div>}
      <Table headers={[
        'ID', t('admin.users.username'), 'Email', t('admin.users.rank'), t('admin.users.matches'), t('admin.users.winrate'), 'Coins/Gems', t('common.actions')
      ]} rows={rows.map(r => {
        const banned = r.settings?.banned
        return [
          <div key="id" style={{ color: '#94A3B8', fontSize: 12 }}>{r.user_id}</div>,
          <div key="name">
            <div style={{ fontWeight: 600 }}>{r.display_name || r.username || '-'}</div>
            <div style={{ color: '#94A3B8', fontSize: 12 }}>{r.username ? `@${r.username}` : '-'}</div>
          </div>,
          <div key="email">{r.email || '-'}</div>,
          <div key="rank">{r.current_rank || '-'}</div>,
          <div key="matches">{r.total_matches ?? 0}</div>,
          <div key="win">{pct(r.total_wins, r.total_matches)}</div>,
          <div key="wallet">{r.coins ?? 0} / {r.gems ?? 0}</div>,
          <div key="actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => alert(JSON.stringify(r, null, 2))}>{t('common.view')}</button>
            <button onClick={() => toggleBan(r)} style={{ background: banned ? '#0f172a' : '#1f2937', color: banned ? '#22d3ee' : '#f97316', border: '1px solid rgba(148,163,184,0.4)' }}>
              {banLabel(r)}
            </button>
          </div>
        ]
      })} />
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#94A3B8' }}>
          {total ? `Showing ${page * PAGE_SIZE + 1} - ${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}` : 'No users'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</button>
          <button onClick={() => setPage(p => (p + 1) * PAGE_SIZE < total ? p + 1 : p)} disabled={(page + 1) * PAGE_SIZE >= total}>Next</button>
      </div>
      </div>
    </section>
  )
}

// MATCHES
function Matches({ t }: { t: (k: string) => string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<MatchRow[]>([])
  const [selected, setSelected] = useState<MatchRow | null>(null)
  const [filter, setFilter] = useState<'all' | 'playing' | 'finished' | 'abandoned'>('all')

  useEffect(() => { void load() }, [])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id, match_type, result, started_at, ended_at, total_moves, win_condition, player_x_user_id, player_o_user_id, winner_user_id,
          player_x:profiles!matches_player_x_user_id_fkey(username, display_name),
          player_o:profiles!matches_player_o_user_id_fkey(username, display_name)
        `)
        .order('started_at', { ascending: false })
        .limit(30)
      if (error) throw error
      const normalized = (data || []).map((r: any) => ({
        ...r,
        player_x: Array.isArray(r.player_x) ? r.player_x[0] : r.player_x,
        player_o: Array.isArray(r.player_o) ? r.player_o[0] : r.player_o
      }))
      setRows(normalized as MatchRow[])
    } catch (err: any) {
      setError(err?.message || 'Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  const endMatch = async (id: string) => {
    if (!window.confirm('Mark match as finished/abandoned?')) return
    try {
      const now = new Date().toISOString()
      await supabase.from('matches').update({ ended_at: now, result: 'abandoned' }).eq('id', id)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to end match')
    }
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter === 'all') return true
      const abandoned = r.result === 'abandoned'
      const finished = !!r.ended_at || abandoned
      const playing = !finished
      if (filter === 'playing') return playing
      if (filter === 'finished') return finished && !abandoned
      if (filter === 'abandoned') return abandoned
      return true
    })
  }, [rows, filter])

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{t('admin.matches.title')}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="playing">Playing</option>
            <option value="finished">Finished</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <button onClick={() => void load()}>{t('leaderboard.refresh')}</button>
        </div>
      </div>
      {error && <div style={{ marginBottom: 8, color: '#ef4444' }}>{error}</div>}
      <Table headers={[
        t('admin.matches.matchId'), t('admin.matches.players'), t('admin.matches.status'), t('admin.matches.createdAt'), t('common.actions')
      ]} rows={filtered.map(r => ([
        r.id,
        <div key="players">
          <div style={{ fontWeight: 600 }}>{r.player_x?.display_name || r.player_x?.username || 'Player X'} vs {r.player_o?.display_name || r.player_o?.username || 'Player O'}</div>
          <div style={{ color: '#94A3B8', fontSize: 12 }}>{r.match_type}</div>
        </div>,
        <StatusBadge status={r.ended_at ? 'finished' : 'playing'} label={r.result || (r.ended_at ? 'finished' : 'playing')} />,
        formatDate(r.started_at),
        <div key="actions" style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setSelected(r)}>{t('admin.matches.viewDetail')}</button>
          {!r.ended_at && <button onClick={() => endMatch(r.id)}>{t('admin.matches.delete')}</button>}
        </div>
      ]))} />
      {selected && (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid rgba(71,85,105,0.4)', borderRadius: 12, background: 'rgba(12,18,30,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Match {selected.id}</div>
            <button onClick={() => setSelected(null)}>Close</button>
          </div>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><strong>Type:</strong> {selected.match_type}</div>
            <div><strong>Status:</strong> {selected.result || (selected.ended_at ? 'finished' : 'playing')}</div>
            <div><strong>Started:</strong> {formatDate(selected.started_at)}</div>
            <div><strong>Ended:</strong> {formatDate(selected.ended_at)}</div>
            <div><strong>Moves:</strong> {selected.total_moves ?? 0}</div>
            <div><strong>Win condition:</strong> {selected.win_condition || '—'}</div>
          </div>
        </div>
      )}
    </section>
  )
}

// ROOMS
function Rooms({ t }: { t: (k: string) => string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<RoomRow[]>([])
  const [filter, setFilter] = useState<'all' | 'waiting' | 'playing' | 'finished'>('all')

  useEffect(() => { void load() }, [])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('id, room_code, room_name, mode, is_private, status, current_players, max_players, created_at, started_at, ended_at')
        .order('created_at', { ascending: false })
        .limit(40)
      if (error) throw error
      setRows(data || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  const closeRoom = async (id: string) => {
    if (!window.confirm('Close this room?')) return
    try {
      const now = new Date().toISOString()
      await supabase.from('rooms').update({ status: 'finished', ended_at: now }).eq('id', id)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to close room')
    }
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter === 'all') return true
      return (r.status || '').toLowerCase() === filter
    })
  }, [rows, filter])

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{t('admin.rooms.title')}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="waiting">Waiting</option>
            <option value="playing">Playing</option>
            <option value="finished">Finished</option>
          </select>
          <button onClick={() => void load()}>{t('leaderboard.refresh')}</button>
        </div>
      </div>
      {error && <div style={{ marginBottom: 8, color: '#ef4444' }}>{error}</div>}
      <Table headers={[t('admin.rooms.roomId'), t('admin.rooms.name'), t('admin.rooms.locked'), t('admin.rooms.people'), t('common.actions')]} rows={filtered.map(r => ([
        r.id,
        <div key="name">
          <div style={{ fontWeight: 600 }}>{r.room_name || r.room_code || '—'}</div>
          <div style={{ color: '#94A3B8', fontSize: 12 }}>{r.mode}</div>
        </div>,
        r.is_private ? 'Yes' : 'No',
        `${r.current_players ?? 0}/${r.max_players ?? 2}`,
        <div key="actions" style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => alert(JSON.stringify(r, null, 2))}>{t('common.view')}</button>
          {r.status !== 'finished' && <button onClick={() => closeRoom(r.id)}>{t('admin.rooms.close')}</button>}
        </div>
      ]))} />
    </section>
  )
}

// ADMINS
function Admins({ t }: { t: (k: string) => string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AdminRow[]>([])
  const [form, setForm] = useState({ user_id: '', email: '', role: 'readonly', is_active: true })

  useEffect(() => { void load() }, [])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase.from('admin').select('user_id,email,role,is_active,created_at,last_active_at').order('created_at', { ascending: false })
      if (error) throw error
      setRows(data || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load admins')
    } finally {
      setLoading(false)
    }
  }

  const addAdmin = async () => {
    if (!form.user_id || !form.email) {
      alert('Need user_id and email')
      return
    }
    try {
      await supabase.from('admin').insert([{ user_id: form.user_id, email: form.email, role: form.role, is_active: form.is_active }])
      setForm({ user_id: '', email: '', role: 'readonly', is_active: true })
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to add admin')
    }
  }

  const updateAdmin = async (user_id: string, patch: Partial<AdminRow>) => {
    try {
      await supabase.from('admin').update(patch).eq('user_id', user_id)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to update admin')
    }
  }

  const removeAdmin = async (user_id: string) => {
    if (!window.confirm('Remove this admin?')) return
    try {
      await supabase.from('admin').delete().eq('user_id', user_id)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to remove admin')
    }
  }

  return (
    <section>
      <h2 style={{ marginBottom: 12 }}>{t('admin.admins.title')}</h2>
      {error && <div style={{ marginBottom: 8, color: '#ef4444' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="User ID" value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} style={{ minWidth: 180 }} />
        <input placeholder={t('admin.admins.newEmail')} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={{ minWidth: 180 }} />
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
          <option value="readonly">{t('admin.admins.roleReadOnly')}</option>
          <option value="user">{t('admin.admins.roleUser')}</option>
          <option value="finance">{t('admin.admins.roleFinance')}</option>
          <option value="full">{t('admin.admins.roleFull')}</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}>
          <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
          Active
        </label>
        <button onClick={() => void addAdmin()}>{t('admin.admins.add')}</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <Table headers={[t('admin.admins.email'), t('admin.admins.role'), t('admin.admins.lastActive'), t('common.actions')]} rows={rows.map(r => ([
          <div key="email">
            <div style={{ fontWeight: 600 }}>{r.email}</div>
            <div style={{ color: '#94A3B8', fontSize: 12 }}>{r.user_id}</div>
          </div>,
          <select key="role" value={r.role} onChange={e => updateAdmin(r.user_id, { role: e.target.value })}>
            <option value="readonly">{t('admin.admins.roleReadOnly')}</option>
            <option value="user">{t('admin.admins.roleUser')}</option>
            <option value="finance">{t('admin.admins.roleFinance')}</option>
            <option value="full">{t('admin.admins.roleFull')}</option>
          </select>,
          <div key="last">{formatDate(r.last_active_at) || formatDate(r.created_at)}</div>,
          <div key="actions" style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => updateAdmin(r.user_id, { is_active: !r.is_active })}>{r.is_active ? 'Disable' : 'Enable'}</button>
            <button onClick={() => removeAdmin(r.user_id)}>{t('common.delete')}</button>
          </div>
        ]))} />
      </div>
    </section>
  )
}

function StatusBadge({ status, label }: { status: string, label: string | null }) {
  const color = status === 'playing' ? '#38bdf8' : status === 'finished' ? '#22c55e' : '#eab308'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 10px', borderRadius: 999, background: 'rgba(148,163,184,0.15)', color }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />
      {label || status}
    </span>
  )
}

// Generic DB manager with simple forms per column
function DatabaseManager({ t }: { t: (k: string) => string }) {
  const tables: TableConfig[] = [
    { table: 'profiles', pk: 'user_id', orderBy: 'created_at' },
    { table: 'matches', pk: 'id', orderBy: 'created_at' },
    { table: 'rooms', pk: 'id', orderBy: 'created_at' },
    { table: 'items', pk: 'id', orderBy: 'created_at' },
    { table: 'admin', pk: 'user_id', orderBy: 'created_at' }
  ]
  const [table, setTable] = useState<TableConfig>(tables[0])
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pkValue, setPkValue] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [createForm, setCreateForm] = useState<Record<string, string>>({})
  const [updateForm, setUpdateForm] = useState<Record<string, string>>({})
  const [fetchingRow, setFetchingRow] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const [newColumns, setNewColumns] = useState<Array<{ name: string, type: string, nullable: boolean, isPk: boolean, defaultValue: string }>>([
    { name: 'id', type: 'uuid', nullable: false, isPk: true, defaultValue: 'gen_random_uuid()' }
  ])
  const [ddlResult, setDdlResult] = useState<string>('')
  const [showSqlRunner, setShowSqlRunner] = useState(false)
  const [sqlInput, setSqlInput] = useState('')
  const [sqlResult, setSqlResult] = useState<string>('')
  const [sqlLoading, setSqlLoading] = useState(false)

  useEffect(() => { void load() }, [table])

  const load = async () => {
    setLoading(true); setError(null)
    try {
      let query = supabase.from(table.table).select('*').limit(50)
      if (table.orderBy) query = query.order(table.orderBy as any, { ascending: false })
      const { data, error } = await query
      if (error) throw error
      setRows(data || [])
      const first = (data && data[0]) || {}
      const cols = Object.keys(first)
      setColumns(cols)
      const blank: Record<string, string> = {}
      cols.forEach(c => { blank[c] = '' })
      setCreateForm(blank)
      setUpdateForm(blank)
    } catch (err: any) {
      setError(err?.message || 'Failed to load table')
    } finally {
      setLoading(false)
    }
  }

  const doDelete = async () => {
    if (!pkValue) { alert('Need primary key value'); return }
    if (!window.confirm(`Delete from ${table.table} where ${table.pk}=${pkValue}?`)) return
    try {
      await supabase.from(table.table).delete().eq(table.pk, pkValue)
      setPkValue('')
      await load()
    } catch (err: any) {
      alert(err?.message || 'Delete failed')
    }
  }

  const loadOne = async () => {
    if (!pkValue) { alert(`Nhập ${table.pk}`); return }
    setFetchingRow(true)
    try {
      const { data, error } = await supabase.from(table.table).select('*').eq(table.pk, pkValue).maybeSingle()
      if (error) throw error
      if (!data) { alert('Không tìm thấy bản ghi'); return }
      const filled: Record<string, string> = { ...updateForm }
      columns.forEach(c => { filled[c] = data[c] != null ? String(data[c]) : '' })
      setUpdateForm(filled)
    } catch (err: any) {
      alert(err?.message || 'Không tải được bản ghi')
    } finally {
      setFetchingRow(false)
    }
  }

  const doInsert = async () => {
    try {
      const payload = Object.fromEntries(Object.entries(createForm).filter(([_, v]) => v !== ''))
      await supabase.from(table.table).insert(payload)
      setPkValue('')
      await load()
    } catch (err: any) {
      alert(err?.message || 'Insert failed')
    }
  }

  const doUpdate = async () => {
    if (!pkValue) { alert('Need primary key value'); return }
    try {
      const payload = Object.fromEntries(Object.entries(updateForm).filter(([k, v]) => v !== '' && k !== table.pk))
      await supabase.from(table.table).update(payload).eq(table.pk, pkValue)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Update failed')
    }
  }

  const addNewColumn = () => {
    setNewColumns(cols => [...cols, { name: '', type: 'text', nullable: true, isPk: false, defaultValue: '' }])
  }

  const buildCreateTableSQL = () => {
    if (!newTableName.trim()) throw new Error('Nhập tên bảng')
    const cols = newColumns.filter(c => c.name.trim() && c.type.trim())
    if (!cols.length) throw new Error('Cần ít nhất 1 cột')
    const lines = cols.map(c => {
      const parts = [`  ${c.name} ${c.type}`]
      if (!c.nullable) parts.push('NOT NULL')
      if (c.defaultValue) parts.push(`DEFAULT ${c.defaultValue}`)
      return parts.join(' ')
    })
    const pkCols = cols.filter(c => c.isPk).map(c => c.name)
    if (pkCols.length) {
      lines.push(`  CONSTRAINT ${newTableName}_pkey PRIMARY KEY (${pkCols.join(', ')})`)
    }
    const sql = `CREATE TABLE public.${newTableName} (\n${lines.join(',\n')}\n);`
    return sql
  }

  const createTable = async () => {
    try {
      const sql = buildCreateTableSQL()
      setDdlResult(sql)
      // Attempt to execute via RPC if available
      try {
        const { error } = await supabase.rpc('exec_sql', { sql })
        if (error) throw error
        alert('Đã gửi lệnh tạo bảng. Nếu RLS cho phép, bảng sẽ được tạo.')
        await load()
      } catch (e: any) {
        // Fallback: show SQL to run manually with service role
        alert('Không thể thực thi trực tiếp (cần RPC exec_sql/service role). Đã tạo SQL bên dưới để bạn copy chạy thủ công.')
        setDdlResult(sql + '\n\nLỗi: ' + (e?.message || e))
      }
    } catch (err: any) {
      alert(err?.message || 'Không tạo được SQL')
    }
  }

  const runSql = async () => {
    const sql = sqlInput.trim()
    if (!sql) { alert('Nhập câu lệnh SQL'); return }
    const firstWord = sql.toLowerCase().split(/\s+/)[0]
    if (!['select', 'insert', 'update', 'delete'].includes(firstWord)) {
      alert('Chỉ cho phép SELECT/INSERT/UPDATE/DELETE')
      return
    }
    setSqlLoading(true); setSqlResult('')
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql })
      if (error) throw error
      setSqlResult(JSON.stringify(data, null, 2) || 'OK')
    } catch (err: any) {
      setSqlResult('Lỗi: ' + (err?.message || err))
    } finally {
      setSqlLoading(false)
    }
  }

  return (
    <section>
      <h2 style={{ marginBottom: 12 }}>{labelOr(t('admin.tabs.database'), 'Dữ liệu Database')}</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={table.table} onChange={e => {
          const next = tables.find(t => t.table === e.target.value)
          if (next) setTable(next)
        }}>
          {tables.map(ti => (<option key={ti.table} value={ti.table}>{ti.table}</option>))}
        </select>
        <button onClick={() => void load()} disabled={loading}>{t('leaderboard.refresh')}</button>
        {loading && <span style={{ color: '#94A3B8' }}>Loading...</span>}
      </div>
      {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}

      <div style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <div style={{ padding: 10, border: '1px solid rgba(71,85,105,0.3)', borderRadius: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Thêm bản ghi</div>
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: 6 }}>
            {columns.map(col => (
              <label key={col} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: '#cbd5e1' }}>{col}</span>
                <input value={createForm[col] ?? ''} onChange={e => setCreateForm({ ...createForm, [col]: e.target.value })} />
              </label>
            ))}
          </div>
          <button onClick={() => void doInsert()} style={{ marginTop: 8 }}>Create</button>
        </div>

        <div style={{ padding: 10, border: '1px solid rgba(71,85,105,0.3)', borderRadius: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Sửa bản ghi (theo {table.pk})</div>
          <input
            placeholder={table.pk}
            value={pkValue}
            onChange={e => setPkValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void loadOne() } }}
            style={{ width: '100%', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={() => void loadOne()} disabled={fetchingRow}>{fetchingRow ? 'Đang lấy...' : 'Tải bản ghi'}</button>
            <button onClick={() => { const blank: Record<string, string> = {}; columns.forEach(c => blank[c] = ''); setUpdateForm(blank) }}>Reset form</button>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 6 }}>
            {columns.filter(c => c !== table.pk).map(col => (
              <label key={col} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: '#cbd5e1' }}>{col}</span>
                <input value={updateForm[col] ?? ''} onChange={e => setUpdateForm({ ...updateForm, [col]: e.target.value })} />
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => void doUpdate()}>Update</button>
            <button onClick={() => void doDelete()}>Delete</button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12, padding: 10, border: '1px solid rgba(71,85,105,0.3)', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Chạy SQL (CRUD)</div>
          <button onClick={() => setShowSqlRunner(v => !v)}>{showSqlRunner ? 'Ẩn' : 'Hiện'}</button>
        </div>
        {showSqlRunner && (
          <div>
            <textarea
              rows={4}
              style={{ width: '100%' }}
              placeholder="SELECT * FROM profiles LIMIT 5;"
              value={sqlInput}
              onChange={e => setSqlInput(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
              <button onClick={() => void runSql()} disabled={sqlLoading}>{sqlLoading ? 'Đang chạy...' : 'Thực thi'}</button>
              <span style={{ color: '#94A3B8', fontSize: 12 }}>Chỉ cho phép SELECT / INSERT / UPDATE / DELETE</span>
            </div>
            {sqlResult && (
              <pre style={{ marginTop: 8, padding: 10, background: 'rgba(15,23,42,0.6)', borderRadius: 10, overflowX: 'auto' }}>{sqlResult}</pre>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: 10, border: '1px solid rgba(71,85,105,0.3)', borderRadius: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tạo bảng mới (DDL)</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input placeholder="Tên bảng (public)" value={newTableName} onChange={e => setNewTableName(e.target.value)} />
          <button onClick={() => addNewColumn()}>Thêm cột</button>
          <button onClick={() => { setNewColumns([{ name: 'id', type: 'uuid', nullable: false, isPk: true, defaultValue: 'gen_random_uuid()' }]); setNewTableName('') }}>Reset</button>
        </div>
        <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {newColumns.map((c, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 0.6fr 0.6fr 0.6fr', gap: 6, alignItems: 'center' }}>
              <input placeholder="column" value={c.name} onChange={e => {
                const next = [...newColumns]; next[idx] = { ...c, name: e.target.value }; setNewColumns(next)
              }} />
              <input placeholder="type (text, uuid, int, bool, jsonb...)" value={c.type} onChange={e => {
                const next = [...newColumns]; next[idx] = { ...c, type: e.target.value }; setNewColumns(next)
              }} />
              <input placeholder="DEFAULT" value={c.defaultValue} onChange={e => {
                const next = [...newColumns]; next[idx] = { ...c, defaultValue: e.target.value }; setNewColumns(next)
              }} />
              <label style={{ display: 'flex', gap: 4, color: '#cbd5e1', alignItems: 'center' }}>
                <input type="checkbox" checked={!c.nullable} onChange={e => {
                  const next = [...newColumns]; next[idx] = { ...c, nullable: !e.target.checked }; setNewColumns(next)
                }} /> NOT NULL
              </label>
              <label style={{ display: 'flex', gap: 4, color: '#cbd5e1', alignItems: 'center' }}>
                <input type="checkbox" checked={c.isPk} onChange={e => {
                  const next = [...newColumns]; next[idx] = { ...c, isPk: e.target.checked }; setNewColumns(next)
                }} /> PK
              </label>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={() => void createTable()}>Tạo bảng</button>
          <button onClick={() => {
            try { setDdlResult(buildCreateTableSQL()) } catch (e: any) { alert(e?.message || 'Không tạo được SQL') }
          }}>Xem SQL</button>
        </div>
        {ddlResult && (
          <pre style={{ marginTop: 8, padding: 10, background: 'rgba(15,23,42,0.6)', borderRadius: 10, overflowX: 'auto' }}>{ddlResult}</pre>
        )}
      </div>

      <div style={{ border: '1px solid rgba(71,85,105,0.3)', borderRadius: 12, padding: 12, background: 'rgba(13,20,35,0.6)' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>{table.table} (top {rows.length})</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r, idx) => (
            <pre key={idx} style={{ margin: 0, padding: 10, borderRadius: 10, background: 'rgba(15,23,42,0.6)', overflowX: 'auto' }}>
              {JSON.stringify(r, null, 2)}
            </pre>
          ))}
        </div>
        {rows.length === 0 && <div style={{ color: '#94A3B8' }}>No rows</div>}
      </div>
    </section>
  )
}











