import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

interface LeaderboardEntry {
  user_id: string
  display_name: string | null
  username: string | null
  current_rank: string | null
  mindpoint: number | null
  avatar_url: string | null
}

// Map rank code -> i18n key suffix
const rankCodes = ['vo_danh','tan_ky','hoc_ky','ky_lao','cao_ky','ky_thanh','truyen_thuyet'] as const

const fallbackEntries: LeaderboardEntry[] = [
  { user_id: '1', display_name: 'Thanh Vân', username: 'thanhvan', current_rank: 'truyen_thuyet', mindpoint: 2680, avatar_url: null },
  { user_id: '2', display_name: 'Linh Vũ', username: 'linhvu', current_rank: 'ky_thanh', mindpoint: 2410, avatar_url: null },
  { user_id: '3', display_name: 'Hoàng Cực', username: 'hoangcuc', current_rank: 'cao_ky', mindpoint: 2304, avatar_url: null },
  { user_id: '4', display_name: 'Hàn Phong', username: 'hanphong', current_rank: 'ky_lao', mindpoint: 2108, avatar_url: null },
  { user_id: '5', display_name: 'Tử Yên', username: 'tuyen', current_rank: 'hoc_ky', mindpoint: 1982, avatar_url: null }
]

function formatRankLabel(t: (k: string)=>string, rank?: string | null) {
  if (!rank) return t('rank.vo_danh')
  const key = `rank.${rank}`
  return rankCodes.includes(rank as any) ? t(key) : rank
}

function formatMindpoint(value?: number | null, locale?: string) {
  const n = Number(value ?? 0)
  return n.toLocaleString(locale || 'en-US')
}

export default function KhaiNhan() {
  const { t, language } = useLanguage()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const locale = useMemo(() => {
    switch (language) {
      case 'vi': return 'vi-VN'
      case 'zh': return 'zh-CN'
      case 'ja': return 'ja-JP'
      default: return 'en-US'
    }
  }, [language])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) setUserId(data.user.id)
    })()
  }, [])

  useEffect(() => {
    void fetchLeaderboard()
  }, [])

  async function fetchLeaderboard() {
    try {
      setLoading(true)
      setErrorMessage(null)
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, username, current_rank, mindpoint, avatar_url')
        .order('mindpoint', { ascending: false })
        .limit(100)

      if (error) throw error

      const sanitized = (data ?? []).map((row) => ({
        ...row,
        mindpoint: Number(row.mindpoint ?? 0)
      }))

      setEntries(sanitized.length ? sanitized : fallbackEntries)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Load leaderboard failed:', error)
      setEntries(fallbackEntries)
      setErrorMessage(t('leaderboard.errorLoading'))
    } finally {
      setLoading(false)
    }
  }

  const rankedEntries = useMemo(() => {
    return entries.map((entry, index) => ({
      entry,
      rank: index + 1
    }))
  }, [entries])

  return (
    <div className="app-container" style={{ paddingTop: '32px' }}>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        color: 'var(--color-muted)',
        marginBottom: '16px',
        paddingLeft: '24px'
      }}>
        <a
          href="#home"
          style={{ color: 'var(--color-muted)', textDecoration: 'none', transition: 'color 0.2s ease' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted)')}
        >
          {t('breadcrumb.home')}
        </a>
        <span style={{ color: 'var(--color-muted)' }}>›</span>
        <span style={{ color: 'var(--color-text)' }}>{t('leaderboard.breadcrumb')}</span>
      </nav>

      <div className="leaderboard-page">
        <section className="leaderboard-hero glass-card">
          <div>
            <p className="leaderboard-eyebrow">{t('leaderboard.honorBoard')}</p>
            <h1 className="leaderboard-title">{t('leaderboard.title')}</h1>
            <p className="leaderboard-description">{t('leaderboard.description')}</p>
            <div className="leaderboard-meta">
              <span>{t('leaderboard.top100')}</span>
              {lastUpdated && <span>{t('leaderboard.updated')}: {lastUpdated.toLocaleTimeString(locale)}</span>}
            </div>
          </div>
          <div className="leaderboard-actions">
            <button className="refresh-btn" onClick={fetchLeaderboard} disabled={loading}>
              {loading ? t('leaderboard.loading') : t('leaderboard.refresh') }
            </button>
            <p className="leaderboard-note">{t('leaderboard.sortByMindpoint')}</p>
          </div>
        </section>

        {errorMessage && <div className="leaderboard-alert">{errorMessage}</div>}

        <section className="leaderboard-stack glass-card">
          {rankedEntries.map(({ entry, rank }) => {
            const isMe = entry.user_id === userId
            const tierClass = rank === 1
              ? 'legend'
              : rank <= 3
              ? 'champion'
              : rank <= 10
              ? 'elite'
              : ''

            return (
              <article key={entry.user_id ?? rank} className={`stack-row ${tierClass} ${isMe ? 'stack-row-me' : ''}`}>
                <div className="stack-rank">#{rank}</div>
                <div className="stack-player">
                  <div className="leaderboard-avatar stack-avatar">
                    <span>{entry.display_name?.[0] ?? entry.username?.[0] ?? '★'}</span>
                  </div>
                  <div>
                    <strong>{entry.display_name ?? entry.username ?? t('leaderboard.anonymous')}</strong>
                    <p>{entry.username ? `@${entry.username}` : t('leaderboard.noUsernameYet')}</p>
                  </div>
                </div>
                <div className="stack-meta">
                  <span className="stack-rank-chip">{formatRankLabel(t, entry.current_rank)}</span>
                  <span className="stack-mindpoint">{formatMindpoint(entry.mindpoint, locale)} MP</span>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}
