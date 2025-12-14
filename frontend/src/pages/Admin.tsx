import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getUnansweredQuestions, exportUnansweredQuestions, clearUnansweredQuestions } from '../lib/question_dataset'
import { loadCaroDataset, getLocalDatasetEntries, exportLocalDatasetEntries, clearLocalDatasetEntries } from '../lib/caroDataset'
import { useLanguage } from '../contexts/LanguageContext'
import { AudioManager, type AudioSettings } from '../lib/AudioManager'
import {
  ResponsiveContainer,
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts'

type Section = 'dashboard' | 'users' | 'matches' | 'rooms' | 'admins' | 'database' | 'ai' | 'shop' | 'skill-packages' | 'finance'

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
  const audioBackup = useRef<AudioSettings | null>(null)

  const handleLogout = async () => {
    if (confirm(t('profile.logoutConfirm'))) {
      try {
        await supabase.auth.signOut()
        window.location.href = '/'
      } catch (e) {
        console.error('Logout failed:', e)
        alert(t('profile.logoutError'))
      }
    }
  }

  useEffect(() => {
    audioBackup.current = AudioManager.getSettings()
    AudioManager.updateSettings({ bgMusic: false, sfxEnabled: false, moveSoundEnabled: false })
    AudioManager.pauseBackgroundMusic()
    return () => {
      if (audioBackup.current) {
        AudioManager.updateSettings(audioBackup.current)
        audioBackup.current = null
      }
    }
  }, [])

  const tabs: { id: Section, label: string }[] = useMemo(() => ([
    { id: 'dashboard', label: t('admin.tabs.dashboard') },
    { id: 'users', label: t('admin.tabs.users') },
    { id: 'matches', label: t('admin.tabs.matches') },
    { id: 'rooms', label: t('admin.tabs.rooms') },
    { id: 'shop', label: '🛒 Shop' },
    { id: 'skill-packages', label: '🎴 Gói Skill' },
    { id: 'finance', label: '💰 Kinh tế' },
    { id: 'admins', label: t('admin.tabs.admins') },
    { id: 'database', label: t('admin.tabs.database') },
    { id: 'ai', label: labelOr(t('admin.tabs.ai'), 'AI') }
  ]), [t])

  return (
    <div className="admin-root" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: 'calc(100vh - 80px)', background: 'linear-gradient(135deg,#0f172a,#0b1222)' }}>
      <aside className="admin-sidebar" style={{ borderRight: '1px solid #23324a', padding: 16, background: 'rgba(12,19,35,0.8)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>{t('admin.title')}</h1>
          <p style={{ color: '#94A3B8', margin: '6px 0 0 0' }}>{t('admin.subtitle')}</p>
        </div>
        <nav style={{ display: 'grid', gap: 6 }}>
          {tabs.map(tab => (
            <SidebarBtn key={tab.id} label={tab.label} active={active === tab.id} onClick={() => setActive(tab.id)} />
          ))}
        </nav>
        {/* Quick Links to Other Admin Pages */}
        <div style={{ marginTop: 24, padding: 12, borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', color: '#cbd5e1', background: 'rgba(239,68,68,0.08)', fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#EF4444' }}>📋 Quản lý Vi phạm</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <button onClick={() => window.location.hash = 'admin-reports'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', textAlign: 'left', fontSize: 13, cursor: 'pointer' }}>
              📋 Báo cáo vi phạm
            </button>
            <button onClick={() => window.location.hash = 'admin-appeals'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#FBBF24', textAlign: 'left', fontSize: 13, cursor: 'pointer' }}>
              📨 Khiếu nại
            </button>
            <button onClick={() => window.location.hash = 'admin-notifications'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#38BDF8', textAlign: 'left', fontSize: 13, cursor: 'pointer' }}>
              🔔 Gửi thông báo
            </button>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: '1px solid rgba(56,189,248,0.2)', color: '#cbd5e1', background: 'rgba(15,118,178,0.08)', fontSize: 13 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('admin.dashboard.title')}</div>
          <div>{t('admin.dashboard.healthHint')}</div>
          <div style={{ marginTop: 8, color: '#38BDF8' }}>• {t('admin.tabs.users')}</div>
          <div style={{ color: '#38BDF8' }}>• {t('admin.tabs.matches')}</div>
          <div style={{ color: '#38BDF8' }}>• {t('admin.tabs.rooms')}</div>
          <div style={{ color: '#38BDF8' }}>• {t('admin.tabs.admins')}</div>
          <div style={{ color: '#38BDF8' }}>• {t('admin.tabs.database')}</div>
          <div style={{ color: '#38BDF8' }}>• {labelOr(t('admin.tabs.ai'), 'AI')}</div>
        </div>
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            marginTop: 'auto',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'linear-gradient(120deg, rgba(239,68,68,0.15), rgba(220,38,38,0.08))',
            color: '#F87171',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 150ms ease'
          }}
        >
          🚪 {t('nav.logout')}
        </button>
      </aside>

      <main className="admin-content" style={{ padding: 20 }}>
        {active === 'dashboard' && <Dashboard t={t} />}
        {active === 'users' && <Users t={t} />}
        {active === 'matches' && <Matches t={t} />}
        {active === 'rooms' && <Rooms t={t} />}
        {active === 'admins' && <Admins t={t} />}
        {active === 'shop' && <ShopManager t={t} />}
        {active === 'skill-packages' && <SkillPackageManager t={t} />}
        {active === 'finance' && <FinanceManager t={t} />}
        {active === 'database' && <DatabaseManager t={t} />}
        {active === 'ai' && <AiTools t={t} />}
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
  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null)
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null)
  const [editForm, setEditForm] = useState({ coins: 0, gems: 0, current_rank: '', display_name: '' })
  const [saving, setSaving] = useState(false)
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
        data = res.data?.map((r: any) => ({ ...r, email: null })) ?? null
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

  const openEdit = (user: ProfileRow) => {
    setEditingUser(user)
    setEditForm({
      coins: user.coins ?? 0,
      gems: user.gems ?? 0,
      current_rank: user.current_rank || '',
      display_name: user.display_name || ''
    })
  }

  const saveEdit = async () => {
    if (!editingUser) return
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({
        coins: editForm.coins,
        gems: editForm.gems,
        current_rank: editForm.current_rank || null,
        display_name: editForm.display_name || null
      }).eq('user_id', editingUser.user_id)
      if (error) throw error
      setEditingUser(null)
      await load()
    } catch (err: any) {
      alert(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
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
          <div key="id" style={{ color: '#94A3B8', fontSize: 12 }}>{r.user_id.slice(0, 8)}...</div>,
          <div key="name">
            <div style={{ fontWeight: 600 }}>{r.display_name || r.username || '-'}</div>
            <div style={{ color: '#94A3B8', fontSize: 12 }}>{r.username ? `@${r.username}` : '-'}</div>
          </div>,
          <div key="email" style={{ fontSize: 12 }}>{r.email || '-'}</div>,
          <div key="rank">{r.current_rank || '-'}</div>,
          <div key="matches">{r.total_matches ?? 0}</div>,
          <div key="win">{pct(r.total_wins, r.total_matches)}</div>,
          <div key="wallet">{r.coins ?? 0} / {r.gems ?? 0}</div>,
          <div key="actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedUser(r)} style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38BDF8' }}>👁️</button>
            <button onClick={() => openEdit(r)} style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E' }}>✏️</button>
            <button onClick={() => toggleBan(r)} style={{ padding: '4px 8px', fontSize: 12, background: banned ? 'rgba(34,211,238,0.15)' : 'rgba(249,115,22,0.15)', border: `1px solid ${banned ? 'rgba(34,211,238,0.3)' : 'rgba(249,115,22,0.3)'}`, color: banned ? '#22d3ee' : '#f97316' }}>
              {banned ? '🔓' : '🔒'}
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

      {/* User Detail Modal */}
      {selectedUser && (
        <div onClick={() => setSelectedUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto', background: 'linear-gradient(180deg, #1e293b, #0f172a)', borderRadius: 16, border: '1px solid rgba(71,85,105,0.4)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(71,85,105,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{selectedUser.display_name || selectedUser.username || 'User'}</h3>
                  <div style={{ color: '#64748B', fontSize: 12 }}>@{selectedUser.username || 'unknown'}</div>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                <InfoCard label="User ID" value={selectedUser.user_id} />
                <InfoCard label="Email" value={selectedUser.email || '—'} />
                <InfoCard label="Rank" value={selectedUser.current_rank || '—'} />
                <InfoCard label="ELO" value={String(selectedUser.elo_rating ?? 0)} />
                <InfoCard label="Mindpoint" value={String(selectedUser.mindpoint ?? 0)} />
                <InfoCard label="Matches" value={`${selectedUser.total_matches ?? 0} (W: ${selectedUser.total_wins ?? 0} / L: ${selectedUser.total_losses ?? 0})`} />
                <InfoCard label="Coins" value={String(selectedUser.coins ?? 0)} highlight="#F59E0B" />
                <InfoCard label="Gems" value={String(selectedUser.gems ?? 0)} highlight="#A855F7" />
                <InfoCard label="Created" value={formatDate(selectedUser.created_at)} />
                <InfoCard label="Last Active" value={formatDate(selectedUser.last_active)} />
              </div>
              {selectedUser.settings?.banned && (
                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 16 }}>
                  <div style={{ color: '#EF4444', fontWeight: 600, marginBottom: 4 }}>🚫 User đang bị BAN</div>
                  <div style={{ color: '#F87171', fontSize: 13 }}>Lý do: {selectedUser.settings?.banned_reason || 'Không có'}</div>
                  <div style={{ color: '#94A3B8', fontSize: 12 }}>Thời gian: {formatDate(selectedUser.settings?.banned_at)}</div>
                </div>
              )}
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(71,85,105,0.2)', border: '1px solid rgba(71,85,105,0.3)' }}>
                <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>Settings (JSON)</div>
                <pre style={{ margin: 0, fontSize: 11, color: '#CBD5E1', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(selectedUser.settings, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div onClick={() => setEditingUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 450, background: 'linear-gradient(180deg, #1e293b, #0f172a)', borderRadius: 16, border: '1px solid rgba(71,85,105,0.4)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(71,85,105,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #22C55E, #16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✏️</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Chỉnh sửa User</h3>
                  <div style={{ color: '#64748B', fontSize: 12 }}>{editingUser.display_name || editingUser.username}</div>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: 12, marginBottom: 6 }}>Display Name</label>
                <input value={editForm.display_name} onChange={e => setEditForm({ ...editForm, display_name: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: 12, marginBottom: 6 }}>Current Rank</label>
                <select value={editForm.current_rank} onChange={e => setEditForm({ ...editForm, current_rank: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }}>
                  <option value="">— Chưa xếp hạng —</option>
                  <option value="Đồng">🥉 Đồng</option>
                  <option value="Bạc">🥈 Bạc</option>
                  <option value="Vàng">🥇 Vàng</option>
                  <option value="Bạch Kim">💎 Bạch Kim</option>
                  <option value="Kim Cương">💠 Kim Cương</option>
                  <option value="Cao Thủ">🏆 Cao Thủ</option>
                  <option value="Đại Cao Thủ">👑 Đại Cao Thủ</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', color: '#F59E0B', fontSize: 12, marginBottom: 6 }}>💰 Coins</label>
                  <input type="number" value={editForm.coins} onChange={e => setEditForm({ ...editForm, coins: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.4)', color: '#F59E0B', fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#A855F7', fontSize: 12, marginBottom: 6 }}>💎 Gems</label>
                  <input type="number" value={editForm.gems} onChange={e => setEditForm({ ...editForm, gems: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168,85,247,0.4)', color: '#A855F7', fontWeight: 600 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setEditingUser(null)} style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(71,85,105,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#94A3B8', cursor: 'pointer' }}>Hủy</button>
                <button onClick={saveEdit} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #22C55E, #16A34A)', border: 'none', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Đang lưu...' : '💾 Lưu'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// Helper component for User Detail Modal
function InfoCard({ label, value, highlight }: { label: string, value: string, highlight?: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 8, background: 'rgba(71,85,105,0.15)', border: '1px solid rgba(71,85,105,0.25)' }}>
      <div style={{ color: '#64748B', fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div style={{ color: highlight || '#F8FAFC', fontSize: 13, fontWeight: 500, wordBreak: 'break-all' }}>{value}</div>
    </div>
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
  const [form, setForm] = useState({ user_id: '', email: '', role: 'manager_user', is_active: true })

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
      setForm({ user_id: '', email: '', role: 'manager_user', is_active: true })
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
          <option value="super">🔑 Toàn quyền (Super)</option>
          <option value="manager_user">👤 Quản lý người dùng</option>
          <option value="manager_finance">💰 Quản lý kinh tế</option>
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
            <option value="super">🔑 Toàn quyền</option>
            <option value="manager_user">👤 QL Người dùng</option>
            <option value="manager_finance">💰 QL Kinh tế</option>
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

// Audio Preview Component - Fetches as blob to bypass MIME type issues
function AudioPreview({ url }: { url: string }) {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const loadAudio = async () => {
      if (!url) return
      
      // For Supabase URLs, fetch as blob
      if (url.includes('supabase.co/storage')) {
        setLoading(true)
        setError(null)
        try {
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          const blob = await response.blob()
          console.log('[AudioPreview] Blob loaded:', { size: blob.size, type: blob.type })
          
          // Create blob with correct audio type
          const audioBlob = blob.type.startsWith('audio/') 
            ? blob 
            : new Blob([blob], { type: 'audio/mpeg' })
          
          if (!cancelled) {
            const objUrl = URL.createObjectURL(audioBlob)
            setBlobUrl(objUrl)
          }
        } catch (err: any) {
          console.error('[AudioPreview] Failed to load:', err)
          if (!cancelled) {
            setError(err?.message || 'Failed to load audio')
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      } else {
        // For other URLs, use directly
        setBlobUrl(url)
      }
    }
    
    loadAudio()
    return () => {
      cancelled = true
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [url])

  if (loading) {
    return <div style={{ marginTop: 8, color: '#94A3B8', fontSize: 12 }}>⏳ Đang tải audio...</div>
  }
  
  if (error) {
    return <div style={{ marginTop: 8, color: '#EF4444', fontSize: 12 }}>❌ Lỗi: {error}</div>
  }
  
  if (!blobUrl) {
    return null
  }

  return <audio controls src={blobUrl} style={{ marginTop: 8, width: '100%' }} />
}

// Shop Manager - Quản lý sản phẩm Shop
function ShopManager({ t }: { t: (k: string) => string }) {
  const [items, setItems] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [form, setForm] = useState({
    item_code: '',
    name: '',
    name_en: '',
    name_zh: '',
    name_ja: '',
    description: '',
    description_en: '',
    description_zh: '',
    description_ja: '',
    category: '',
    price_coins: '0',
    price_gems: '0',
    rarity: 'common',
    preview_url: '',
    is_available: true
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Google Translate API (unofficial, free)
  const translateText = useCallback(async (text: string, targetLang: string): Promise<string> => {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
      const response = await fetch(url)
      const data = await response.json()
      // Response format: [[["translated text","original text",null,null,10]],null,"vi",...]
      if (data && data[0]) {
        return data[0].map((item: any) => item[0]).join('')
      }
      return text
    } catch (error) {
      console.error(`Translation to ${targetLang} failed:`, error)
      return text
    }
  }, [])

  const [translating, setTranslating] = useState(false)

  const handleAutoTranslateName = useCallback(async () => {
    if (!form.name.trim()) {
      alert('Vui lòng nhập tên tiếng Việt trước')
      return
    }
    setTranslating(true)
    try {
      const [en, zh, ja] = await Promise.all([
        translateText(form.name, 'en'),
        translateText(form.name, 'zh-CN'),
        translateText(form.name, 'ja')
      ])
      setForm(prev => ({
        ...prev,
        name_en: en,
        name_zh: zh,
        name_ja: ja
      }))
    } catch (error) {
      alert('Lỗi khi dịch: ' + error)
    } finally {
      setTranslating(false)
    }
  }, [form.name, translateText])

  const handleAutoTranslateDesc = useCallback(async () => {
    if (!form.description.trim()) {
      alert('Vui lòng nhập mô tả tiếng Việt trước')
      return
    }
    setTranslating(true)
    try {
      const [en, zh, ja] = await Promise.all([
        translateText(form.description, 'en'),
        translateText(form.description, 'zh-CN'),
        translateText(form.description, 'ja')
      ])
      setForm(prev => ({
        ...prev,
        description_en: en,
        description_zh: zh,
        description_ja: ja
      }))
    } catch (error) {
      alert('Lỗi khi dịch: ' + error)
    } finally {
      setTranslating(false)
    }
  }, [form.description, translateText])

  const legacyCategories = useMemo(() => ([
    { id: 'âm nhạc', name_vi: 'Âm nhạc', name_en: 'Music', icon: '🎵' },
    { id: 'music', name_vi: 'Music (legacy)', name_en: 'Music (legacy)', icon: '🎵' },
    { id: 'piece_skin', name_vi: 'Skin Quân Cờ', name_en: 'Piece Skin', icon: '♟️' },
    { id: 'board_skin', name_vi: 'Skin Bàn Cờ', name_en: 'Board Skin', icon: '🎯' },
    { id: 'avatar_frame', name_vi: 'Khung Avatar', name_en: 'Avatar Frame', icon: '🖼️' },
    { id: 'emote', name_vi: 'Biểu Cảm', name_en: 'Emote', icon: '😀' }
  ]), [])
  const categoryOptions = useMemo(() => {
    const source = categories.length > 0 ? categories : legacyCategories
    const seen = new Set<string>()
    return source.filter(c => {
      const id = c.id || ''
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [categories, legacyCategories])
  const resolveCategoryId = useCallback((raw?: string | null) => {
    const value = (raw || '').trim()
    if (!value) return categoryOptions[0]?.id || null
    const lower = value.toLowerCase()
    const direct = categoryOptions.find(c => (c.id || '').toLowerCase() === lower)
    if (direct) return direct.id
    const aliasMap: Record<string, string> = {
      music: 'âm nhạc',
      'am nhac': 'âm nhạc',
      'âm nhạc': 'âm nhạc'
    }
    const alias = aliasMap[lower]
    if (alias) {
      const found = categoryOptions.find(c => (c.id || '').toLowerCase() === alias.toLowerCase())
      if (found) return found.id
    }
    return null
  }, [categoryOptions])
  const toStorageFolder = useCallback((id?: string | null) => {
    const base = (id || 'misc').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const sanitized = base.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase()
    return sanitized || 'misc'
  }, [])

  useEffect(() => {
    if (categoryOptions.length === 0) return
    setForm(prev => {
      const resolved = resolveCategoryId(prev.category)
      const nextCat = resolved || categoryOptions[0]?.id
      if (!nextCat || nextCat === prev.category) return prev
      return { ...prev, category: nextCat }
    })
  }, [categoryOptions, resolveCategoryId])

  useEffect(() => {
    void loadItems()
    void loadCategories()
  }, [])

  const loadItems = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setItems(data || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('id, name_vi, name_en').eq('is_active', true)
      setCategories(data || [])
    } catch {}
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Determine MIME type
    const guessedType = (() => {
      if (file.type && file.type !== 'application/octet-stream') return file.type
      const name = file.name.toLowerCase()
      if (name.endsWith('.mp3')) return 'audio/mpeg'
      if (name.endsWith('.wav')) return 'audio/wav'
      if (name.endsWith('.ogg')) return 'audio/ogg'
      if (name.endsWith('.mp4')) return 'video/mp4'
      if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
      if (name.endsWith('.png')) return 'image/png'
      if (name.endsWith('.gif')) return 'image/gif'
      if (name.endsWith('.webp')) return 'image/webp'
      return 'application/octet-stream'
    })()

    // Prepare file path
    const ext = file.name.split('.').pop()
    const resolvedCategory = resolveCategoryId(form.category) || form.category || 'misc'
    const folder = toStorageFolder(resolvedCategory)
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

    setUploading(true)
    try {
      // Read file as ArrayBuffer to ensure binary upload (not multipart)
      const arrayBuffer = await file.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: guessedType })
      
      console.log('[Admin] Uploading file:', { 
        fileName, 
        originalType: file.type, 
        guessedType, 
        size: file.size,
        blobSize: blob.size,
        blobType: blob.type
      })

      const { error } = await supabase.storage
        .from('shop-assets')
        .upload(fileName, blob, { 
          cacheControl: '3600', 
          upsert: false, 
          contentType: guessedType 
        })

      if (error) throw error

      // Get public URL
      const { data: urlData } = supabase.storage.from('shop-assets').getPublicUrl(fileName)
      const publicUrl = urlData?.publicUrl

      if (publicUrl) {
        setForm(prev => ({ ...prev, preview_url: publicUrl }))
        alert(`Upload thành công!\n\nURL: ${publicUrl}\nMIME Type: ${guessedType}\nSize: ${(file.size / 1024).toFixed(1)} KB\n\nLưu ý: Nếu là file audio, hãy test preview trước khi lưu.`)
      }
    } catch (err: any) {
      // If file exists, try to delete and re-upload
      if (err?.message?.includes('already exists') || err?.message?.includes('Duplicate')) {
        const shouldReplace = window.confirm('File đã tồn tại. Bạn có muốn thay thế không?')
        if (shouldReplace) {
          try {
            await supabase.storage.from('shop-assets').remove([fileName])
            
            // Re-read and upload
            const arrayBuffer = await file.arrayBuffer()
            const blob = new Blob([arrayBuffer], { type: guessedType })
            
            const { error: retryErr } = await supabase.storage
              .from('shop-assets')
              .upload(fileName, blob, { 
                cacheControl: '3600', 
                upsert: true, 
                contentType: guessedType 
              })
            if (retryErr) throw retryErr
            
            const { data: urlData } = supabase.storage.from('shop-assets').getPublicUrl(fileName)
            if (urlData?.publicUrl) {
              setForm(prev => ({ ...prev, preview_url: urlData.publicUrl }))
              alert(`Upload thành công (đã thay thế)!\n\nURL: ${urlData.publicUrl}\nMIME Type: ${guessedType}`)
            }
          } catch (retryError: any) {
            alert('Không thể thay thế file: ' + (retryError?.message || retryError))
          }
        }
      } else {
        alert('Upload failed: ' + (err?.message || err) + '\n\nĐảm bảo bucket "shop-assets" đã được tạo trong Supabase Storage.')
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const isBoundaryLike = (val?: string | null) => {
    if (!val) return false
    return val.includes('WebKitFormBoundary') || val.trim().startsWith('------WebKitFormBoundary')
  }

  // Verify if URL is accessible (for audio/image files)
  const verifyUrlAccessible = async (url: string): Promise<boolean> => {
    if (!url || !url.startsWith('http')) return true // Skip validation for empty or relative URLs
    try {
      const response = await fetch(url, { method: 'HEAD' })
      return response.ok
    } catch {
      return false
    }
  }

  const createItem = async () => {
    if (!form.item_code || !form.name) {
      alert('Cần nhập item_code và name')
      return
    }
    if (isBoundaryLike(form.preview_url)) {
      alert('Preview URL có vẻ là nội dung multipart (WebKitFormBoundary). Vui lòng upload lại file đúng hoặc nhập URL media hợp lệ.')
      return
    }
    // Verify URL is accessible before saving
    if (form.preview_url && form.preview_url.startsWith('http')) {
      const isAccessible = await verifyUrlAccessible(form.preview_url)
      if (!isAccessible) {
        const proceed = window.confirm('⚠️ Cảnh báo: Preview URL không thể truy cập được (404 hoặc lỗi mạng).\n\nURL: ' + form.preview_url + '\n\nBạn có muốn tiếp tục lưu không?')
        if (!proceed) return
      }
    }
    const categoryId = resolveCategoryId(form.category)
    if (!categoryId) {
      alert('Category không hợp lệ. Hãy tải lại danh mục hoặc chọn lại.')
      return
    }
    const fillLang = (val?: string, fallback?: string | null) => {
      const trimmed = (val || '').trim()
      if (trimmed) return trimmed
      const fb = (fallback || '').trim()
      return fb || null
    }
    const viName = form.name?.trim() || ''
    const viDesc = form.description?.trim() || ''
    try {
      const payload = {
        item_code: form.item_code,
        name: viName,
        name_en: fillLang(form.name_en, viName),
        name_zh: fillLang(form.name_zh, viName),
        name_ja: fillLang(form.name_ja, viName),
        description: viDesc || null,
        description_en: fillLang(form.description_en, viDesc),
        description_zh: fillLang(form.description_zh, viDesc),
        description_ja: fillLang(form.description_ja, viDesc),
        category: categoryId,
        price_coins: parseInt(form.price_coins) || 0,
        price_gems: parseInt(form.price_gems) || 0,
        rarity: form.rarity,
        preview_url: form.preview_url || null,
        is_available: form.is_available,
        source_type: 'shop'
      }
      const { error } = await supabase.from('items').insert([payload])
      if (error) throw error
      alert('Tạo sản phẩm thành công!')
      setForm({
        item_code: '', name: '', name_en: '', name_zh: '', name_ja: '', description: '', description_en: '', description_zh: '', description_ja: '',
        category: categoryOptions[0]?.id || '', price_coins: '0', price_gems: '0', rarity: 'common',
        preview_url: '', is_available: true
      })
      await loadItems()
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err))
    }
  }

  const deleteItem = async (id: string) => {
    if (!window.confirm('Xóa sản phẩm này?')) return
    try {
      await supabase.from('items').delete().eq('id', id)
      await loadItems()
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err))
    }
  }

  const toggleAvailable = async (id: string, current: boolean) => {
    try {
      await supabase.from('items').update({ is_available: !current }).eq('id', id)
      await loadItems()
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err))
    }
  }

  const openEditItem = (item: any) => {
    setEditingItem(item)
    setEditForm({
      item_code: item.item_code || '',
      name: item.name || '',
      name_en: item.name_en || '',
      name_zh: item.name_zh || '',
      name_ja: item.name_ja || '',
      price_coins: item.price_coins || 0,
      price_gems: item.price_gems || 0,
      rarity: item.rarity || 'common',
      preview_url: item.preview_url || '',
      is_available: item.is_available ?? true
    })
  }

  const saveEditItem = async () => {
    if (!editingItem) return
    try {
      const { error } = await supabase.from('items').update({
        item_code: editForm.item_code,
        name: editForm.name,
        name_en: editForm.name_en || null,
        name_zh: editForm.name_zh || null,
        name_ja: editForm.name_ja || null,
        price_coins: editForm.price_coins,
        price_gems: editForm.price_gems,
        rarity: editForm.rarity,
        preview_url: editForm.preview_url || null,
        is_available: editForm.is_available
      }).eq('id', editingItem.id)
      if (error) throw error
      setEditingItem(null)
      await loadItems()
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err))
    }
  }

  const musicCategoryId = (resolveCategoryId(form.category) || '').toLowerCase()
  const isMusicCategory = musicCategoryId === 'music' || musicCategoryId === 'âm nhạc'

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>🛒 Quản lý Shop</h2>
        <button onClick={() => void loadItems()}>{t('leaderboard.refresh')}</button>
      </div>
      {error && <div style={{ marginBottom: 8, color: '#ef4444' }}>{error}</div>}

      {/* Form thêm sản phẩm */}
      <div style={{ padding: 16, border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, background: 'rgba(15,23,42,0.6)', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px 0' }}>➕ Thêm sản phẩm mới</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Item Code *</span>
            <input value={form.item_code} onChange={e => setForm({ ...form, item_code: e.target.value })} placeholder="music_epic_battle" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Tên (VI) *</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhạc Chiến Đấu" style={{ flex: 1 }} />
              <button 
                type="button"
                onClick={handleAutoTranslateName}
                disabled={translating}
                title="Tự động dịch sang EN/ZH/JA (Google Translate)"
                style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', color: '#A855F7', whiteSpace: 'nowrap', opacity: translating ? 0.6 : 1 }}
              >
                {translating ? '⏳...' : '🌐 Auto'}
              </button>
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Tên (EN)</span>
            <input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} placeholder="Epic Battle Music" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Tên (ZH)</span>
            <input value={form.name_zh} onChange={e => setForm({ ...form, name_zh: e.target.value })} placeholder="史诗战斗配乐" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Tên (JA)</span>
            <input value={form.name_ja} onChange={e => setForm({ ...form, name_ja: e.target.value })} placeholder="エピックバトル音楽" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Category</span>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {categoryOptions.map(c => {
                const label = c.name_vi || c.name_en || c.id
                return (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}{label}
                  </option>
                )
              })}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Giá Coins</span>
            <input type="number" value={form.price_coins} onChange={e => setForm({ ...form, price_coins: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Giá Gems</span>
            <input type="number" value={form.price_gems} onChange={e => setForm({ ...form, price_gems: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Rarity</span>
            <select value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value })}>
              <option value="common">Common</option>
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Preview URL (hoặc upload)</span>
            <input value={form.preview_url} onChange={e => setForm({ ...form, preview_url: e.target.value })} placeholder="https://..." />
          </label>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8', fontSize: 12 }}>Mô tả (VI)</span>
              <button 
                type="button"
                onClick={handleAutoTranslateDesc}
                disabled={translating}
                title="Tự động dịch mô tả sang EN/ZH/JA (Google Translate)"
                style={{ padding: '2px 6px', fontSize: 10, background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', color: '#A855F7', opacity: translating ? 0.6 : 1 }}
              >
                {translating ? '⏳...' : '🌐 Auto'}
              </button>
            </div>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Mô tả cho người dùng tiếng Việt" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Description (EN)</span>
            <textarea rows={2} value={form.description_en} onChange={e => setForm({ ...form, description_en: e.target.value })} placeholder="Description for English users" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>描述 (ZH)</span>
            <textarea rows={2} value={form.description_zh} onChange={e => setForm({ ...form, description_zh: e.target.value })} placeholder="中文描述" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>説明 (JA)</span>
            <textarea rows={2} value={form.description_ja} onChange={e => setForm({ ...form, description_ja: e.target.value })} placeholder="日本語の説明" />
          </label>
        </div>
        
        <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}>
            <input type="checkbox" checked={form.is_available} onChange={e => setForm({ ...form, is_available: e.target.checked })} />
            Hiển thị trong Shop
          </label>
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="audio/*,image/*,video/*" 
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ background: 'rgba(34,211,238,0.2)', border: '1px solid rgba(34,211,238,0.4)', color: '#22D3EE' }}
            >
              {uploading ? '⏳ Đang upload...' : '📤 Upload file'}
            </button>
          </div>
          
          <button onClick={createItem} style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E' }}>
            ✅ Tạo sản phẩm
          </button>
        </div>

        {form.preview_url && (
          <div style={{ marginTop: 12, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Preview URL:</div>
            <div style={{ wordBreak: 'break-all', fontSize: 12 }}>{form.preview_url}</div>
            {/* Show audio player for music category OR audio file extensions */}
            {(isMusicCategory || /\.(mp3|wav|ogg|m4a)$/i.test(form.preview_url)) && form.preview_url && (
              <AudioPreview url={form.preview_url} />
            )}
            {/* Show image preview for image files */}
            {/\.(jpg|jpeg|png|gif|webp)$/i.test(form.preview_url) && (
              <img src={form.preview_url} alt="Preview" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 200, borderRadius: 4 }} />
            )}
            {/* Show video preview for video files */}
            {/\.(mp4|webm)$/i.test(form.preview_url) && (
              <video controls src={form.preview_url} style={{ marginTop: 8, maxWidth: '100%', maxHeight: 200, borderRadius: 4 }} />
            )}
          </div>
        )}
      </div>

      {/* Danh sách sản phẩm */}
      <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: 12, background: 'rgba(15,23,42,0.8)', fontWeight: 700 }}>
          📦 Danh sách sản phẩm ({items.length})
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {items.map((item, idx) => (
            <div key={item.id} style={{ 
              padding: 12, 
              borderTop: '1px solid rgba(71,85,105,0.25)',
              background: idx % 2 === 0 ? 'rgba(148,163,184,0.04)' : 'transparent',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                {(item.name_en || item.name_zh || item.name_ja) && (
                  <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {item.name_en && <span>EN: {item.name_en}</span>}
                    {item.name_zh && <span>ZH: {item.name_zh}</span>}
                    {item.name_ja && <span>JA: {item.name_ja}</span>}
                  </div>
                )}
                <div style={{ color: '#94A3B8', fontSize: 12 }}>
                  {item.item_code} • {item.category} • {item.rarity} • 
                  {item.price_coins > 0 ? ` ${item.price_coins} coins` : ''} 
                  {item.price_gems > 0 ? ` ${item.price_gems} gems` : ''}
                  {item.price_coins === 0 && item.price_gems === 0 ? ' FREE' : ''}
                </div>
                {item.preview_url && (
                  <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                    URL: {item.preview_url.slice(0, 50)}...
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button 
                  onClick={() => toggleAvailable(item.id, item.is_available)}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: 11,
                    background: item.is_available ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    border: `1px solid ${item.is_available ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                    color: item.is_available ? '#22C55E' : '#EF4444'
                  }}
                >
                  {item.is_available ? '✓ Active' : '✗ Hidden'}
                </button>
                <button 
                  onClick={() => openEditItem(item)}
                  style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA' }}
                >
                  ✏️
                </button>
                <button 
                  onClick={() => deleteItem(item.id)}
                  style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171' }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ padding: 20, color: '#94A3B8', textAlign: 'center' }}>Chưa có sản phẩm</div>}
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div onClick={() => setEditingItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 600, maxHeight: '85vh', overflow: 'auto', background: 'linear-gradient(180deg, #1e293b, #0f172a)', borderRadius: 16, border: '1px solid rgba(71,85,105,0.4)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(71,85,105,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>✏️ Chỉnh sửa sản phẩm</h3>
              <button onClick={() => setEditingItem(null)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>Item Code</span>
                  <input value={editForm.item_code || ''} onChange={e => setEditForm({ ...editForm, item_code: e.target.value })} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>Tên (VI)</span>
                  <input value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>Tên (EN)</span>
                  <input value={editForm.name_en || ''} onChange={e => setEditForm({ ...editForm, name_en: e.target.value })} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>Tên (ZH)</span>
                  <input value={editForm.name_zh || ''} onChange={e => setEditForm({ ...editForm, name_zh: e.target.value })} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>Tên (JA)</span>
                  <input value={editForm.name_ja || ''} onChange={e => setEditForm({ ...editForm, name_ja: e.target.value })} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#F59E0B', fontSize: 12 }}>💰 Giá Coins</span>
                  <input type="number" value={editForm.price_coins || 0} onChange={e => setEditForm({ ...editForm, price_coins: parseInt(e.target.value) || 0 })} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.4)', color: '#F59E0B', fontWeight: 600 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#A855F7', fontSize: 12 }}>💎 Giá Gems</span>
                  <input type="number" value={editForm.price_gems || 0} onChange={e => setEditForm({ ...editForm, price_gems: parseInt(e.target.value) || 0 })} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(168,85,247,0.4)', color: '#A855F7', fontWeight: 600 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>Rarity</span>
                  <select value={editForm.rarity || 'common'} onChange={e => setEditForm({ ...editForm, rarity: e.target.value })} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }}>
                    <option value="common">Common</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>Preview URL</span>
                <input value={editForm.preview_url || ''} onChange={e => setEditForm({ ...editForm, preview_url: e.target.value })} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1' }}>
                <input type="checkbox" checked={editForm.is_available ?? true} onChange={e => setEditForm({ ...editForm, is_available: e.target.checked })} />
                Hiển thị trong Shop
              </label>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setEditingItem(null)} style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(71,85,105,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#94A3B8', cursor: 'pointer' }}>Hủy</button>
                <button onClick={saveEditItem} style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #2563EB)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>💾 Lưu</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// Skill Package Manager - Quản lý gói skill với tỉ lệ rớt
function SkillPackageManager({ t }: { t: (k: string) => string }) {
  const [packages, setPackages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editingPkg, setEditingPkg] = useState<any | null>(null)
  const [form, setForm] = useState({
    package_code: '',
    name_vi: '',
    name_en: '',
    description_vi: '',
    description_en: '',
    cards_count: '5',
    common_rate: '0.7000',
    rare_rate: '0.2500',
    legendary_rate: '0.0500',
    price_tinh_thach: '0',
    price_nguyen_than: '0',
    source: 'shop',
    is_active: true,
    icon_url: '',
    background_color: '#ffffff'
  })
  const [editForm, setEditForm] = useState({
    package_code: '',
    name_vi: '',
    name_en: '',
    description_vi: '',
    description_en: '',
    cards_count: '5',
    common_rate: '0.7000',
    rare_rate: '0.2500',
    legendary_rate: '0.0500',
    price_tinh_thach: '0',
    price_nguyen_than: '0',
    source: 'shop',
    is_active: true,
    icon_url: '',
    background_color: '#ffffff'
  })

  useEffect(() => { void loadPackages() }, [])

  const loadPackages = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('skill_packages')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setPackages(data || [])
    } catch (err: any) {
      alert('Lỗi load packages: ' + (err?.message || err))
    } finally {
      setLoading(false)
    }
  }

  const validateRates = () => {
    const common = parseFloat(form.common_rate) || 0
    const rare = parseFloat(form.rare_rate) || 0
    const legendary = parseFloat(form.legendary_rate) || 0
    const total = common + rare + legendary
    return Math.abs(total - 1.0) < 0.0001
  }

  const createPackage = async () => {
    if (!form.package_code || !form.name_vi) {
      alert('Cần nhập package_code và tên')
      return
    }
    if (!validateRates()) {
      alert('Tổng tỉ lệ (common + rare + legendary) phải = 1.0')
      return
    }
    try {
      const payload = {
        package_code: form.package_code,
        name_vi: form.name_vi,
        name_en: form.name_en || null,
        description_vi: form.description_vi || null,
        description_en: form.description_en || null,
        cards_count: parseInt(form.cards_count) || 5,
        common_rate: parseFloat(form.common_rate),
        rare_rate: parseFloat(form.rare_rate),
        legendary_rate: parseFloat(form.legendary_rate),
        price_tinh_thach: parseInt(form.price_tinh_thach) || 0,
        price_nguyen_than: parseInt(form.price_nguyen_than) || 0,
        source: form.source,
        is_active: form.is_active,
        icon_url: form.icon_url || null,
        background_color: form.background_color
      }
      const { error } = await supabase.from('skill_packages').insert([payload])
      if (error) throw error
      alert('Tạo gói skill thành công!')
      setForm({
        package_code: '', name_vi: '', name_en: '', description_vi: '', description_en: '',
        cards_count: '5', common_rate: '0.7000', rare_rate: '0.2500', legendary_rate: '0.0500',
        price_tinh_thach: '0', price_nguyen_than: '0', source: 'shop', is_active: true,
        icon_url: '', background_color: '#ffffff'
      })
      await loadPackages()
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err))
    }
  }

  const deletePackage = async (id: string) => {
    if (!window.confirm('Xóa gói skill này?')) return
    try {
      await supabase.from('skill_packages').delete().eq('id', id)
      await loadPackages()
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err))
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await supabase.from('skill_packages').update({ is_active: !current }).eq('id', id)
      await loadPackages()
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err))
    }
  }

  const openEditModal = (pkg: any) => {
    setEditingPkg(pkg)
    setEditForm({
      package_code: pkg.package_code || '',
      name_vi: pkg.name_vi || '',
      name_en: pkg.name_en || '',
      description_vi: pkg.description_vi || '',
      description_en: pkg.description_en || '',
      cards_count: String(pkg.cards_count || 5),
      common_rate: String(pkg.common_rate || 0.7),
      rare_rate: String(pkg.rare_rate || 0.25),
      legendary_rate: String(pkg.legendary_rate || 0.05),
      price_tinh_thach: String(pkg.price_tinh_thach || 0),
      price_nguyen_than: String(pkg.price_nguyen_than || 0),
      source: pkg.source || 'shop',
      is_active: pkg.is_active ?? true,
      icon_url: pkg.icon_url || '',
      background_color: pkg.background_color || '#ffffff'
    })
  }

  const validateEditRates = () => {
    const common = parseFloat(editForm.common_rate) || 0
    const rare = parseFloat(editForm.rare_rate) || 0
    const legendary = parseFloat(editForm.legendary_rate) || 0
    const total = common + rare + legendary
    return Math.abs(total - 1.0) < 0.0001
  }

  const updatePackage = async () => {
    if (!editingPkg) return
    if (!editForm.package_code || !editForm.name_vi) {
      alert('Cần nhập package_code và tên')
      return
    }
    if (!validateEditRates()) {
      alert('Tổng tỉ lệ (common + rare + legendary) phải = 1.0')
      return
    }
    try {
      const payload = {
        package_code: editForm.package_code,
        name_vi: editForm.name_vi,
        name_en: editForm.name_en || null,
        description_vi: editForm.description_vi || null,
        description_en: editForm.description_en || null,
        cards_count: parseInt(editForm.cards_count) || 5,
        common_rate: parseFloat(editForm.common_rate),
        rare_rate: parseFloat(editForm.rare_rate),
        legendary_rate: parseFloat(editForm.legendary_rate),
        price_tinh_thach: parseInt(editForm.price_tinh_thach) || 0,
        price_nguyen_than: parseInt(editForm.price_nguyen_than) || 0,
        source: editForm.source,
        is_active: editForm.is_active,
        icon_url: editForm.icon_url || null,
        background_color: editForm.background_color
      }
      const { error } = await supabase.from('skill_packages').update(payload).eq('id', editingPkg.id)
      if (error) throw error
      alert('Cập nhật gói skill thành công!')
      setEditingPkg(null)
      await loadPackages()
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || err))
    }
  }

  const rateSum = (parseFloat(form.common_rate) || 0) + (parseFloat(form.rare_rate) || 0) + (parseFloat(form.legendary_rate) || 0)
  const editRateSum = (parseFloat(editForm.common_rate) || 0) + (parseFloat(editForm.rare_rate) || 0) + (parseFloat(editForm.legendary_rate) || 0)
  const editRateValid = Math.abs(editRateSum - 1.0) < 0.0001
  const rateValid = Math.abs(rateSum - 1.0) < 0.0001

  // Rarity colors for game vibe
  const rarityColors = {
    common: { bg: 'linear-gradient(135deg, #374151, #1f2937)', border: '#6B7280', glow: 'none' },
    rare: { bg: 'linear-gradient(135deg, #1e3a5f, #0c4a6e)', border: '#3B82F6', glow: '0 0 20px rgba(59,130,246,0.3)' },
    legendary: { bg: 'linear-gradient(135deg, #78350f, #92400e)', border: '#F59E0B', glow: '0 0 25px rgba(245,158,11,0.4)' }
  }

  const getPackageTier = (pkg: any) => {
    if (pkg.legendary_rate >= 0.1) return 'legendary'
    if (pkg.rare_rate >= 0.3) return 'rare'
    return 'common'
  }

  return (
    <section style={{ position: 'relative' }}>
      {/* Header với gradient */}
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
        padding: '16px 20px', borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))',
        border: '1px solid rgba(139,92,246,0.3)',
        boxShadow: '0 4px 20px rgba(139,92,246,0.1)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, background: 'linear-gradient(135deg, #A78BFA, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🎴 Quản Lý Gói Skill
          </h2>
          <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: 13 }}>Tạo và quản lý các gói thẻ skill với tỉ lệ rớt</p>
        </div>
        <button 
          onClick={() => void loadPackages()}
          style={{ 
            padding: '10px 20px', borderRadius: 10,
            background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
            border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(139,92,246,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
        >
          🔄 Làm mới
        </button>
      </div>

      {/* Form thêm gói - Game Style */}
      <div style={{ 
        padding: 20, borderRadius: 16, marginBottom: 24,
        background: 'linear-gradient(180deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
        border: '1px solid rgba(71,85,105,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #10B981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✨</div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Tạo Gói Skill Mới</h3>
            <p style={{ margin: 0, color: '#64748B', fontSize: 12 }}>Thiết lập thông tin và tỉ lệ rớt</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>📦 Package Code *</span>
            <input value={form.package_code} onChange={e => setForm({ ...form, package_code: e.target.value })} placeholder="PKG_NEW_PACK" 
              style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>🏷️ Tên (VI) *</span>
            <input value={form.name_vi} onChange={e => setForm({ ...form, name_vi: e.target.value })} placeholder="Gói Mới"
              style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>🌐 Tên (EN)</span>
            <input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} placeholder="New Pack"
              style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>🃏 Số thẻ/gói</span>
            <input type="number" value={form.cards_count} onChange={e => setForm({ ...form, cards_count: e.target.value })}
              style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
          </div>
        </div>

        {/* Tỉ lệ rớt - Visual */}
        <div style={{ 
          marginTop: 20, padding: 16, borderRadius: 12,
          background: rateValid ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.05))' : 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(185,28,28,0.05))',
          border: `1px solid ${rateValid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)}'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: rateValid ? '#10B981' : '#EF4444' }}>
              📊 Tỉ Lệ Rớt {rateValid ? '✓' : `(${rateSum.toFixed(4)} ≠ 1.0)`}
            </span>
            <div style={{ 
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: rateValid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
              color: rateValid ? '#10B981' : '#EF4444'
            }}>
              Tổng: {(rateSum * 100).toFixed(2)}%
            </div>
          </div>
          
          {/* Visual rate bar */}
          <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
            <div style={{ width: `${(parseFloat(form.common_rate) || 0) * 100}%`, background: 'linear-gradient(90deg, #6B7280, #9CA3AF)', transition: 'width 0.3s' }} />
            <div style={{ width: `${(parseFloat(form.rare_rate) || 0) * 100}%`, background: 'linear-gradient(90deg, #3B82F6, #60A5FA)', transition: 'width 0.3s' }} />
            <div style={{ width: `${(parseFloat(form.legendary_rate) || 0) * 100}%`, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)', transition: 'width 0.3s' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#9CA3AF' }} />
                <span style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 600 }}>COMMON</span>
              </div>
              <input type="number" step="0.01" value={form.common_rate} onChange={e => setForm({ ...form, common_rate: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(107,114,128,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
              <div style={{ marginTop: 4, color: '#64748B', fontSize: 11 }}>{((parseFloat(form.common_rate) || 0) * 100).toFixed(1)}%</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
                <span style={{ color: '#60A5FA', fontSize: 12, fontWeight: 600 }}>RARE</span>
              </div>
              <input type="number" step="0.01" value={form.rare_rate} onChange={e => setForm({ ...form, rare_rate: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(59,130,246,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
              <div style={{ marginTop: 4, color: '#64748B', fontSize: 11 }}>{((parseFloat(form.rare_rate) || 0) * 100).toFixed(1)}%</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
                <span style={{ color: '#FBBF24', fontSize: 12, fontWeight: 600 }}>LEGENDARY</span>
              </div>
              <input type="number" step="0.01" value={form.legendary_rate} onChange={e => setForm({ ...form, legendary_rate: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
              <div style={{ marginTop: 4, color: '#64748B', fontSize: 11 }}>{((parseFloat(form.legendary_rate) || 0) * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Giá và nguồn */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 16 }}>
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
            <span style={{ color: '#A78BFA', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><img src="/gem.png" alt="gem" style={{ width: 14, height: 14 }} /> Tinh Thạch</span>
            <input type="number" value={form.price_tinh_thach} onChange={e => setForm({ ...form, price_tinh_thach: e.target.value })}
              style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)' }}>
            <span style={{ color: '#F472B6', fontSize: 12, fontWeight: 500 }}>✨ Nguyên Thần</span>
            <input type="number" value={form.price_nguyen_than} onChange={e => setForm({ ...form, price_nguyen_than: e.target.value })}
              style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(236,72,153,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)' }}>
            <span style={{ color: '#22D3EE', fontSize: 12, fontWeight: 500 }}>📍 Nguồn</span>
            <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}
              style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,211,238,0.4)', color: '#fff' }}>
              <option value="shop">🛒 Shop</option>
              <option value="event">🎉 Event</option>
              <option value="quest">📜 Quest</option>
            </select>
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(71,85,105,0.2)', border: '1px solid rgba(71,85,105,0.4)' }}>
            <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>🖼️ Icon URL</span>
            <input value={form.icon_url} onChange={e => setForm({ ...form, icon_url: e.target.value })} placeholder="https://..."
              style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: '#10B981' }} />
            <span>Kích hoạt ngay</span>
          </label>
          <button 
            onClick={createPackage} 
            disabled={!rateValid}
            style={{ 
              padding: '12px 28px', borderRadius: 12, fontWeight: 600, fontSize: 15,
              background: rateValid ? 'linear-gradient(135deg, #10B981, #059669)' : 'rgba(71,85,105,0.3)',
              border: 'none', color: '#fff', cursor: rateValid ? 'pointer' : 'not-allowed',
              boxShadow: rateValid ? '0 4px 15px rgba(16,185,129,0.3)' : 'none',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
          >
            ✨ Tạo Gói Skill
          </button>
        </div>
      </div>

      {/* Danh sách gói - Card Grid */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>🎴 Gói Skill Hiện Có</h3>
          <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(139,92,246,0.2)', color: '#A78BFA', fontSize: 13, fontWeight: 600 }}>
            {packages.length} gói
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {packages.map((pkg) => {
            const tier = getPackageTier(pkg)
            const colors = rarityColors[tier]
            return (
              <div key={pkg.id} style={{ 
                borderRadius: 16, overflow: 'hidden',
                background: colors.bg,
                border: `2px solid ${colors.border}`,
                boxShadow: colors.glow,
                transition: 'transform 0.2s, box-shadow 0.2s',
                position: 'relative'
              }}>
                {/* Header với tier badge */}
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${colors.border}40`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{pkg.icon_url ? '📦' : '🎴'}</span>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{pkg.name_vi}</span>
                    </div>
                    {pkg.name_en && <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>{pkg.name_en}</div>}
                  </div>
                  <div style={{ 
                    padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    background: tier === 'legendary' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : tier === 'rare' ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'rgba(107,114,128,0.3)',
                    color: '#fff'
                  }}>
                    {tier}
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: 16 }}>
                  <div style={{ color: '#64748B', fontSize: 11, marginBottom: 12 }}>{pkg.package_code}</div>
                  
                  {/* Rate bars */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                      <div style={{ flex: pkg.common_rate, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #6B7280, #9CA3AF)' }} />
                      <div style={{ flex: pkg.rare_rate, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #3B82F6, #60A5FA)' }} />
                      <div style={{ flex: pkg.legendary_rate, height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8' }}>
                      <span>⚪ {(pkg.common_rate * 100).toFixed(1)}%</span>
                      <span style={{ color: '#60A5FA' }}>🔵 {(pkg.rare_rate * 100).toFixed(1)}%</span>
                      <span style={{ color: '#FBBF24' }}>🟡 {(pkg.legendary_rate * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Info row */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', fontSize: 12 }}>
                      🃏 {pkg.cards_count} thẻ
                    </div>
                    <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.2)', fontSize: 12 }}>
                      📍 {pkg.source}
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {pkg.price_tinh_thach > 0 && (
                      <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)', fontSize: 13, fontWeight: 600, color: '#A78BFA' }}>
                        <img src="/gem.png" alt="gem" style={{ width: 14, height: 14, marginRight: 4 }} />{pkg.price_tinh_thach.toLocaleString()}
                      </div>
                    )}
                    {pkg.price_nguyen_than > 0 && (
                      <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(236,72,153,0.2)', border: '1px solid rgba(236,72,153,0.3)', fontSize: 13, fontWeight: 600, color: '#F472B6' }}>
                        ✨ {pkg.price_nguyen_than.toLocaleString()}
                      </div>
                    )}
                    {pkg.price_tinh_thach === 0 && pkg.price_nguyen_than === 0 && (
                      <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', fontSize: 13, fontWeight: 600, color: '#10B981' }}>
                        🎁 FREE
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      onClick={() => toggleActive(pkg.id, pkg.is_active)}
                      style={{ 
                        flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: pkg.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                        border: `1px solid ${pkg.is_active ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                        color: pkg.is_active ? '#10B981' : '#EF4444'
                      }}
                    >
                      {pkg.is_active ? '✓ Đang bán' : '✗ Ẩn'}
                    </button>
                    <button 
                      onClick={() => openEditModal(pkg)}
                      style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', cursor: 'pointer' }}
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => deletePackage(pkg.id)}
                      style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Status indicator */}
                {!pkg.is_active && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.9)', color: '#fff', fontWeight: 600, fontSize: 12 }}>ĐÃ ẨN</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {packages.length === 0 && (
          <div style={{ 
            padding: 40, textAlign: 'center', borderRadius: 16,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.6), rgba(30,41,59,0.4))',
            border: '1px dashed rgba(71,85,105,0.4)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎴</div>
            <div style={{ color: '#94A3B8', fontSize: 14 }}>Chưa có gói skill nào</div>
            <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>Tạo gói đầu tiên ở form phía trên</div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingPkg && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setEditingPkg(null)}>
          <div style={{
            width: '90%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto',
            background: 'linear-gradient(180deg, #1e293b, #0f172a)',
            borderRadius: 20, border: '1px solid rgba(59,130,246,0.3)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(71,85,105,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #3B82F6, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✏️</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>Chỉnh Sửa Gói Skill</h3>
                  <p style={{ margin: 0, color: '#64748B', fontSize: 12 }}>{editingPkg.name_vi}</p>
                </div>
              </div>
              <button onClick={() => setEditingPkg(null)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>📦 Package Code *</span>
                  <input value={editForm.package_code} onChange={e => setEditForm({ ...editForm, package_code: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>🏷️ Tên (VI) *</span>
                  <input value={editForm.name_vi} onChange={e => setEditForm({ ...editForm, name_vi: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>🌐 Tên (EN)</span>
                  <input value={editForm.name_en} onChange={e => setEditForm({ ...editForm, name_en: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>🃏 Số thẻ/gói</span>
                  <input type="number" value={editForm.cards_count} onChange={e => setEditForm({ ...editForm, cards_count: e.target.value })}
                    style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </div>
              </div>

              {/* Tỉ lệ rớt */}
              <div style={{ 
                marginTop: 20, padding: 16, borderRadius: 12,
                background: editRateValid ? 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.05))' : 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(185,28,28,0.05))',
                border: `1px solid ${editRateValid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, color: editRateValid ? '#10B981' : '#EF4444' }}>
                    📊 Tỉ Lệ Rớt {editRateValid ? '✓' : `(${editRateSum.toFixed(4)} ≠ 1.0)`}
                  </span>
                  <div style={{ 
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: editRateValid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                    color: editRateValid ? '#10B981' : '#EF4444'
                  }}>
                    Tổng: {(editRateSum * 100).toFixed(2)}%
                  </div>
                </div>
                
                <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
                  <div style={{ width: `${(parseFloat(editForm.common_rate) || 0) * 100}%`, background: 'linear-gradient(90deg, #6B7280, #9CA3AF)', transition: 'width 0.3s' }} />
                  <div style={{ width: `${(parseFloat(editForm.rare_rate) || 0) * 100}%`, background: 'linear-gradient(90deg, #3B82F6, #60A5FA)', transition: 'width 0.3s' }} />
                  <div style={{ width: `${(parseFloat(editForm.legendary_rate) || 0) * 100}%`, background: 'linear-gradient(90deg, #F59E0B, #FBBF24)', transition: 'width 0.3s' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 10, background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#9CA3AF' }} />
                      <span style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 600 }}>COMMON</span>
                    </div>
                    <input type="number" step="0.01" value={editForm.common_rate} onChange={e => setEditForm({ ...editForm, common_rate: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(107,114,128,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#3B82F6', boxShadow: '0 0 8px rgba(59,130,246,0.5)' }} />
                      <span style={{ color: '#60A5FA', fontSize: 12, fontWeight: 600 }}>RARE</span>
                    </div>
                    <input type="number" step="0.01" value={editForm.rare_rate} onChange={e => setEditForm({ ...editForm, rare_rate: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(59,130,246,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
                      <span style={{ color: '#FBBF24', fontSize: 12, fontWeight: 600 }}>LEGENDARY</span>
                    </div>
                    <input type="number" step="0.01" value={editForm.legendary_rate} onChange={e => setEditForm({ ...editForm, legendary_rate: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
                  </div>
                </div>
              </div>

              {/* Giá và nguồn */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 16 }}>
                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <span style={{ color: '#A78BFA', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><img src="/gem.png" alt="gem" style={{ width: 14, height: 14 }} /> Tinh Thạch</span>
                  <input type="number" value={editForm.price_tinh_thach} onChange={e => setEditForm({ ...editForm, price_tinh_thach: e.target.value })}
                    style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(139,92,246,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)' }}>
                  <span style={{ color: '#F472B6', fontSize: 12, fontWeight: 500 }}>✨ Nguyên Thần</span>
                  <input type="number" value={editForm.price_nguyen_than} onChange={e => setEditForm({ ...editForm, price_nguyen_than: e.target.value })}
                    style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(236,72,153,0.4)', color: '#fff', fontSize: 16, fontWeight: 600 }} />
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)' }}>
                  <span style={{ color: '#22D3EE', fontSize: 12, fontWeight: 500 }}>📍 Nguồn</span>
                  <select value={editForm.source} onChange={e => setEditForm({ ...editForm, source: e.target.value })}
                    style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(34,211,238,0.4)', color: '#fff' }}>
                    <option value="shop">🛒 Shop</option>
                    <option value="event">🎉 Event</option>
                    <option value="quest">📜 Quest</option>
                  </select>
                </div>
                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(71,85,105,0.2)', border: '1px solid rgba(71,85,105,0.4)' }}>
                  <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>🖼️ Icon URL</span>
                  <input value={editForm.icon_url} onChange={e => setEditForm({ ...editForm, icon_url: e.target.value })} placeholder="https://..."
                    style={{ width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#fff' }} />
                </div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                    style={{ width: 18, height: 18, accentColor: '#10B981' }} />
                  <span>Kích hoạt</span>
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={() => setEditingPkg(null)}
                    style={{ padding: '12px 24px', borderRadius: 12, fontWeight: 600, background: 'rgba(71,85,105,0.3)', border: '1px solid rgba(71,85,105,0.4)', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={updatePackage} 
                    disabled={!editRateValid}
                    style={{ 
                      padding: '12px 28px', borderRadius: 12, fontWeight: 600, fontSize: 15,
                      background: editRateValid ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'rgba(71,85,105,0.3)',
                      border: 'none', color: '#fff', cursor: editRateValid ? 'pointer' : 'not-allowed',
                      boxShadow: editRateValid ? '0 4px 15px rgba(59,130,246,0.3)' : 'none'
                    }}
                  >
                    💾 Lưu Thay Đổi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// AI Tools
function AiTools({ t }: { t: (k: string) => string }) {
  const [datasetCount, setDatasetCount] = useState<number>(0)
  const [localDatasetCount, setLocalDatasetCount] = useState<number>(0)
  const [unanswered, setUnanswered] = useState<{ question: string; normalized?: string; source: string; userId: string | null; ts: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [datasetError, setDatasetError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await Promise.race([
          loadCaroDataset(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('dataset-timeout')), 6000))
        ])
        if (mounted) {
          setDatasetCount(data.length)
          setLocalDatasetCount(getLocalDatasetEntries().length)
          setDatasetError(null)
        }
      } catch {
        if (mounted) {
          setDatasetCount(0)
          setLocalDatasetCount(0)
          setDatasetError('Khong tai duoc dataset (timeout/loi).')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    setUnanswered(getUnansweredQuestions())
    return () => { mounted = false }
  }, [])

  const handleExportUnanswered = () => {
    exportUnansweredQuestions()
  }

  const handleClearUnanswered = () => {
    clearUnansweredQuestions()
    setUnanswered([])
  }

  const handleExportLocal = () => {
    exportLocalDatasetEntries()
  }

  const handleClearLocal = () => {
    clearLocalDatasetEntries()
    setLocalDatasetCount(0)
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{labelOr(t('admin.tabs.ai'), 'AI')}</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleExportUnanswered} disabled={!unanswered.length}>Xuất Q chưa đáp</button>
          <button onClick={handleClearUnanswered} disabled={!unanswered.length}>Xóa log Q chưa đáp</button>
          <button onClick={handleExportLocal} disabled={!localDatasetCount}>Xuất Q&A Trial</button>
          <button onClick={handleClearLocal} disabled={!localDatasetCount}>Xóa Q&A Trial local</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <Card title="Cau hoi trong dataset" value={loading ? '...' : datasetCount} hint={datasetError || 'backend/data + local'} />
        <Card title="Cau hoi chua co dap an" value={unanswered.length} hint="Luu tai question_dataset (localStorage)" />
        <Card title="Q&A bo sung Trial" value={localDatasetCount} hint="Luu tai caro_dataset_local (localStorage)" />
      </div>

      {unanswered.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Câu hỏi chưa đáp (tối đa 20 gần nhất)</h4>
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 8, padding: 12, background: 'rgba(15,23,42,0.6)', maxHeight: 320, overflow: 'auto' }}>
            {unanswered.slice(-20).reverse().map((item, idx) => (
              <div key={idx} style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(71,85,105,0.2)' }}>
                <div style={{ fontWeight: 600 }}>{item.question}</div>
                {item.normalized && <div style={{ color: '#94A3B8', fontSize: 12 }}>Normalized: {item.normalized}</div>}
                <div style={{ color: '#94A3B8', fontSize: 12 }}>Source: {item.source} {item.userId ? `• user ${item.userId}` : ''}</div>
                <div style={{ color: '#64748B', fontSize: 12 }}>{new Date(item.ts).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}




// Finance Manager - Quản lý kinh tế: lịch sử mua, nạp tiền, nguồn lời
function FinanceManager({ t }: { t: (k: string) => string }) {
  const [activeTab, setActiveTab] = useState<'purchases' | 'payments' | 'profit'>('purchases')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Currency purchases (mua coin/gem)
  const [purchases, setPurchases] = useState<any[]>([])
  const [purchasePage, setPurchasePage] = useState(0)
  const [purchaseTotal, setPurchaseTotal] = useState(0)
  
  // Payments (nạp tiền VNPay)
  const [payments, setPayments] = useState<any[]>([])
  const [paymentPage, setPaymentPage] = useState(0)
  const [paymentTotal, setPaymentTotal] = useState(0)
  
  // Profit metrics
  const [profitMetrics, setProfitMetrics] = useState({
    totalRevenue: 0,
    totalApiCost: 0,
    netProfit: 0,
    revenueToday: 0,
    apiCostToday: 0,
    profitToday: 0
  })
  
  // Transactions for profit calculation
  const [transactions, setTransactions] = useState<any[]>([])
  
  const PAGE_SIZE = 15

  useEffect(() => {
    if (activeTab === 'purchases') void loadPurchases()
    else if (activeTab === 'payments') void loadPayments()
    else if (activeTab === 'profit') void loadProfitData()
  }, [activeTab, purchasePage, paymentPage])

  const loadPurchases = async () => {
    setLoading(true); setError(null)
    try {
      const from = purchasePage * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from('currency_purchases')
        .select(`
          id, user_id, package_id, txn_ref, currency_type, amount, bonus_amount, total_amount,
          price_vnd, status, payment_method, balance_before, balance_after, created_at, paid_at,
          profiles:user_id(username, display_name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      setPurchases((data || []).map((r: any) => ({
        ...r,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      })))
      setPurchaseTotal(count || 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }

  const loadPayments = async () => {
    setLoading(true); setError(null)
    try {
      const from = paymentPage * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error, count } = await supabase
        .from('payments')
        .select(`
          id, user_id, package_id, amount_vnd, credits_awarded, owner_cut_vnd,
          provider, provider_txid, status, created_at,
          profiles:user_id(username, display_name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      setPayments((data || []).map((r: any) => ({
        ...r,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      })))
      setPaymentTotal(count || 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  const loadProfitData = async () => {
    setLoading(true); setError(null)
    try {
      // Get all paid payments for total revenue
      const { data: allPayments } = await supabase
        .from('payments')
        .select('amount_vnd, owner_cut_vnd, created_at')
        .eq('status', 'paid')
      
      // Get all paid currency purchases
      const { data: allPurchases } = await supabase
        .from('currency_purchases')
        .select('price_vnd, created_at')
        .eq('status', 'paid')
      
      // Get API usage logs for cost calculation
      const { data: usageLogs } = await supabase
        .from('logs_usage')
        .select('cost_credits, created_at, type')
      
      // Get AI analysis logs for token cost
      const { data: aiLogs } = await supabase
        .from('ai_analysis_logs')
        .select('tokens_used, cost_cents, created_at')
      
      // Calculate totals
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()
      
      let totalRevenue = 0
      let revenueToday = 0
      
      // Revenue from payments
      for (const p of allPayments || []) {
        const amt = Number(p.amount_vnd) || 0
        totalRevenue += amt
        if (p.created_at >= todayISO) revenueToday += amt
      }
      
      // Revenue from currency purchases
      for (const p of allPurchases || []) {
        const amt = Number(p.price_vnd) || 0
        totalRevenue += amt
        if (p.created_at >= todayISO) revenueToday += amt
      }
      
      // API cost estimation (1 credit = ~100 VND, adjust as needed)
      let totalApiCost = 0
      let apiCostToday = 0
      const CREDIT_TO_VND = 100
      
      for (const log of usageLogs || []) {
        const cost = (Number(log.cost_credits) || 0) * CREDIT_TO_VND
        totalApiCost += cost
        if (log.created_at >= todayISO) apiCostToday += cost
      }
      
      // AI analysis cost (cost_cents to VND, 1 cent = ~250 VND)
      const CENT_TO_VND = 250
      for (const log of aiLogs || []) {
        const cost = (Number(log.cost_cents) || 0) * CENT_TO_VND
        totalApiCost += cost
        if (log.created_at >= todayISO) apiCostToday += cost
      }
      
      setProfitMetrics({
        totalRevenue,
        totalApiCost,
        netProfit: totalRevenue - totalApiCost,
        revenueToday,
        apiCostToday,
        profitToday: revenueToday - apiCostToday
      })
      
      // Load recent transactions for display
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      setTransactions(txData || [])
      
    } catch (err: any) {
      setError(err?.message || 'Failed to load profit data')
    } finally {
      setLoading(false)
    }
  }

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#22C55E'
      case 'pending': return '#F59E0B'
      case 'failed': return '#EF4444'
      case 'refunded': return '#8B5CF6'
      default: return '#94A3B8'
    }
  }

  return (
    <section>
      {/* Header */}
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
        padding: '16px 20px', borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.1))',
        border: '1px solid rgba(34,197,94,0.3)',
        boxShadow: '0 4px 20px rgba(34,197,94,0.1)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, background: 'linear-gradient(135deg, #22C55E, #10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            💰 Quản Lý Kinh Tế
          </h2>
          <p style={{ margin: '4px 0 0', color: '#94A3B8', fontSize: 13 }}>Lịch sử mua hàng, nạp tiền và nguồn lời</p>
        </div>
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('purchases')}
          style={{
            padding: '12px 20px', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
            background: activeTab === 'purchases' ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)' : 'rgba(71,85,105,0.2)',
            border: activeTab === 'purchases' ? 'none' : '1px solid rgba(71,85,105,0.4)',
            color: activeTab === 'purchases' ? '#fff' : '#94A3B8',
            boxShadow: activeTab === 'purchases' ? '0 4px 15px rgba(139,92,246,0.3)' : 'none'
          }}
        >
          🛒 Lịch sử mua Coin/Gem
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          style={{
            padding: '12px 20px', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
            background: activeTab === 'payments' ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'rgba(71,85,105,0.2)',
            border: activeTab === 'payments' ? 'none' : '1px solid rgba(71,85,105,0.4)',
            color: activeTab === 'payments' ? '#fff' : '#94A3B8',
            boxShadow: activeTab === 'payments' ? '0 4px 15px rgba(59,130,246,0.3)' : 'none'
          }}
        >
          💳 Lịch sử nạp tiền
        </button>
        <button
          onClick={() => setActiveTab('profit')}
          style={{
            padding: '12px 20px', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
            background: activeTab === 'profit' ? 'linear-gradient(135deg, #22C55E, #16A34A)' : 'rgba(71,85,105,0.2)',
            border: activeTab === 'profit' ? 'none' : '1px solid rgba(71,85,105,0.4)',
            color: activeTab === 'profit' ? '#fff' : '#94A3B8',
            boxShadow: activeTab === 'profit' ? '0 4px 15px rgba(34,197,94,0.3)' : 'none'
          }}
        >
          📊 Nguồn lời (Profit)
        </button>
      </div>

      {error && <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>{error}</div>}

      {/* Purchases Tab */}
      {activeTab === 'purchases' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><img src="/coin.png" alt="coin" style={{ width: 20, height: 20 }} /><img src="/gem.png" alt="gem" style={{ width: 20, height: 20 }} /> Lịch sử mua Coin/Gem ({purchaseTotal})</h3>
            <button onClick={() => void loadPurchases()} disabled={loading}>🔄 Làm mới</button>
          </div>
          
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr', gap: 8, padding: '12px 16px', background: 'rgba(15,23,42,0.8)', fontWeight: 700, fontSize: 13 }}>
              <div>Người dùng</div>
              <div>Loại</div>
              <div>Số lượng</div>
              <div>Giá VND</div>
              <div>Trạng thái</div>
              <div>Thời gian</div>
            </div>
            <div style={{ maxHeight: 450, overflowY: 'auto' }}>
              {loading && <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>Đang tải...</div>}
              {!loading && purchases.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>Chưa có giao dịch</div>}
              {purchases.map((p, idx) => (
                <div key={p.id} style={{ 
                  display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr', gap: 8, padding: '12px 16px',
                  borderTop: '1px solid rgba(71,85,105,0.25)',
                  background: idx % 2 === 0 ? 'rgba(148,163,184,0.04)' : 'transparent',
                  fontSize: 13
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.profiles?.display_name || p.profiles?.username || 'Unknown'}</div>
                    <div style={{ color: '#64748B', fontSize: 11 }}>{p.user_id?.slice(0, 8)}...</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <img src={p.currency_type === 'coin' ? '/coin.png' : '/gem.png'} alt={p.currency_type} style={{ width: 18, height: 18 }} />
                    {p.currency_type}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.total_amount?.toLocaleString()}</div>
                    {p.bonus_amount > 0 && <div style={{ color: '#22C55E', fontSize: 11 }}>+{p.bonus_amount} bonus</div>}
                  </div>
                  <div style={{ fontWeight: 600, color: '#F59E0B' }}>{formatVND(p.price_vnd || 0)}</div>
                  <div>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: `${getStatusColor(p.status)}20`,
                      color: getStatusColor(p.status)
                    }}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: 11 }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('vi-VN') : '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Pagination */}
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#94A3B8', fontSize: 13 }}>
              {purchaseTotal > 0 ? `${purchasePage * PAGE_SIZE + 1} - ${Math.min((purchasePage + 1) * PAGE_SIZE, purchaseTotal)} / ${purchaseTotal}` : 'Không có dữ liệu'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPurchasePage(p => Math.max(0, p - 1))} disabled={purchasePage === 0}>← Trước</button>
              <button onClick={() => setPurchasePage(p => (p + 1) * PAGE_SIZE < purchaseTotal ? p + 1 : p)} disabled={(purchasePage + 1) * PAGE_SIZE >= purchaseTotal}>Sau →</button>
            </div>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>💳 Lịch sử nạp tiền VNPay ({paymentTotal})</h3>
            <button onClick={() => void loadPayments()} disabled={loading}>🔄 Làm mới</button>
          </div>
          
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr', gap: 8, padding: '12px 16px', background: 'rgba(15,23,42,0.8)', fontWeight: 700, fontSize: 13 }}>
              <div>Người dùng</div>
              <div>Số tiền</div>
              <div>Credits</div>
              <div>Owner Cut</div>
              <div>Trạng thái</div>
              <div>Thời gian</div>
            </div>
            <div style={{ maxHeight: 450, overflowY: 'auto' }}>
              {loading && <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>Đang tải...</div>}
              {!loading && payments.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>Chưa có giao dịch</div>}
              {payments.map((p, idx) => (
                <div key={p.id} style={{ 
                  display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 0.8fr', gap: 8, padding: '12px 16px',
                  borderTop: '1px solid rgba(71,85,105,0.25)',
                  background: idx % 2 === 0 ? 'rgba(148,163,184,0.04)' : 'transparent',
                  fontSize: 13
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.profiles?.display_name || p.profiles?.username || 'Unknown'}</div>
                    <div style={{ color: '#64748B', fontSize: 11 }}>{p.provider || 'vnpay'}</div>
                  </div>
                  <div style={{ fontWeight: 600, color: '#3B82F6' }}>{formatVND(p.amount_vnd || 0)}</div>
                  <div style={{ color: '#A78BFA' }}>+{p.credits_awarded?.toLocaleString() || 0}</div>
                  <div style={{ color: '#22C55E' }}>{formatVND(p.owner_cut_vnd || 0)}</div>
                  <div>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: `${getStatusColor(p.status)}20`,
                      color: getStatusColor(p.status)
                    }}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ color: '#94A3B8', fontSize: 11 }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('vi-VN') : '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Pagination */}
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#94A3B8', fontSize: 13 }}>
              {paymentTotal > 0 ? `${paymentPage * PAGE_SIZE + 1} - ${Math.min((paymentPage + 1) * PAGE_SIZE, paymentTotal)} / ${paymentTotal}` : 'Không có dữ liệu'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPaymentPage(p => Math.max(0, p - 1))} disabled={paymentPage === 0}>← Trước</button>
              <button onClick={() => setPaymentPage(p => (p + 1) * PAGE_SIZE < paymentTotal ? p + 1 : p)} disabled={(paymentPage + 1) * PAGE_SIZE >= paymentTotal}>Sau →</button>
            </div>
          </div>
        </div>
      )}

      {/* Profit Tab */}
      {activeTab === 'profit' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>📊 Tổng quan Lợi nhuận</h3>
            <button onClick={() => void loadProfitData()} disabled={loading}>🔄 Làm mới</button>
          </div>
          
          {/* Profit Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {/* Total Revenue */}
            <div style={{ 
              padding: 20, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(37,99,235,0.1))',
              border: '1px solid rgba(59,130,246,0.3)'
            }}>
              <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>💰 Tổng doanh thu</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#3B82F6' }}>{formatVND(profitMetrics.totalRevenue)}</div>
              <div style={{ marginTop: 8, color: '#60A5FA', fontSize: 13 }}>
                Hôm nay: {formatVND(profitMetrics.revenueToday)}
              </div>
            </div>
            
            {/* API Cost */}
            <div style={{ 
              padding: 20, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(185,28,28,0.1))',
              border: '1px solid rgba(239,68,68,0.3)'
            }}>
              <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>🔥 Chi phí API</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#EF4444' }}>{formatVND(profitMetrics.totalApiCost)}</div>
              <div style={{ marginTop: 8, color: '#F87171', fontSize: 13 }}>
                Hôm nay: {formatVND(profitMetrics.apiCostToday)}
              </div>
            </div>
            
            {/* Net Profit */}
            <div style={{ 
              padding: 20, borderRadius: 16,
              background: profitMetrics.netProfit >= 0 
                ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.1))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(185,28,28,0.1))',
              border: `1px solid ${profitMetrics.netProfit >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`
            }}>
              <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>📈 Lợi nhuận ròng</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: profitMetrics.netProfit >= 0 ? '#22C55E' : '#EF4444' }}>
                {formatVND(profitMetrics.netProfit)}
              </div>
              <div style={{ marginTop: 8, color: profitMetrics.profitToday >= 0 ? '#4ADE80' : '#F87171', fontSize: 13 }}>
                Hôm nay: {formatVND(profitMetrics.profitToday)}
              </div>
            </div>
          </div>
          
          {/* Cost breakdown info */}
          <div style={{ 
            padding: 16, borderRadius: 12, marginBottom: 20,
            background: 'rgba(71,85,105,0.1)', border: '1px solid rgba(71,85,105,0.3)'
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>📋 Cách tính chi phí API</div>
            <div style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.6 }}>
              • <strong>logs_usage</strong>: 1 credit = 100 VND (có thể điều chỉnh)<br/>
              • <strong>ai_analysis_logs</strong>: 1 cent = 250 VND (tỷ giá USD/VND)<br/>
              • Doanh thu = payments (VNPay) + currency_purchases (mua coin/gem)
            </div>
          </div>
          
          {/* Recent Transactions */}
          <div>
            <h4 style={{ margin: '0 0 12px 0' }}>📜 Giao dịch gần đây (transactions)</h4>
            <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.5fr', gap: 8, padding: '12px 16px', background: 'rgba(15,23,42,0.8)', fontWeight: 700, fontSize: 13 }}>
                <div>Loại</div>
                <div>Tiền tệ</div>
                <div>Số lượng</div>
                <div>Số dư sau</div>
                <div>Lý do</div>
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {transactions.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>Chưa có giao dịch</div>}
                {transactions.map((tx, idx) => (
                  <div key={tx.id} style={{ 
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.5fr', gap: 8, padding: '10px 16px',
                    borderTop: '1px solid rgba(71,85,105,0.25)',
                    background: idx % 2 === 0 ? 'rgba(148,163,184,0.04)' : 'transparent',
                    fontSize: 12
                  }}>
                    <div>
                      <span style={{ 
                        padding: '3px 8px', borderRadius: 4, fontSize: 11,
                        background: tx.transaction_type === 'earn' ? 'rgba(34,197,94,0.2)' : tx.transaction_type === 'spend' ? 'rgba(239,68,68,0.2)' : 'rgba(139,92,246,0.2)',
                        color: tx.transaction_type === 'earn' ? '#22C55E' : tx.transaction_type === 'spend' ? '#EF4444' : '#A78BFA'
                      }}>
                        {tx.transaction_type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <img src={tx.currency_type === 'coins' ? '/coin.png' : '/gem.png'} alt={tx.currency_type} style={{ width: 16, height: 16 }} />
                      {tx.currency_type}
                    </div>
                    <div style={{ 
                      fontWeight: 600,
                      color: tx.transaction_type === 'earn' || tx.transaction_type === 'reward' ? '#22C55E' : '#EF4444'
                    }}>
                      {tx.transaction_type === 'earn' || tx.transaction_type === 'reward' ? '+' : '-'}{Math.abs(tx.amount)?.toLocaleString()}
                    </div>
                    <div style={{ color: '#94A3B8' }}>{tx.balance_after?.toLocaleString()}</div>
                    <div style={{ color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.reason || '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
