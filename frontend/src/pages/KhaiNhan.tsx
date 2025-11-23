import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

interface LeaderboardEntry {
  user_id: string
  display_name: string | null
  username: string | null
  current_rank: string | null
  mindpoint: number | null
  avatar_url: string | null
}

const rankLabelMap: Record<string, string> = {
  vo_danh: 'Vô Danh',
  tan_ky: 'Tân Kỳ',
  hoc_ky: 'Học Kỳ',
  ky_lao: 'Kỳ Lão',
  cao_ky: 'Cao Kỳ',
  ky_thanh: 'Kỳ Thành',
  truyen_thuyet: 'Truyền Thuyết'
}

const fallbackEntries: LeaderboardEntry[] = [
  { user_id: '1', display_name: 'Thanh Vân', username: 'thanhvan', current_rank: 'truyen_thuyet', mindpoint: 2680, avatar_url: null },
  { user_id: '2', display_name: 'Linh Vũ', username: 'linhvu', current_rank: 'ky_thanh', mindpoint: 2410, avatar_url: null },
  { user_id: '3', display_name: 'Hoàng Cực', username: 'hoangcuc', current_rank: 'cao_ky', mindpoint: 2304, avatar_url: null },
  { user_id: '4', display_name: 'Hàn Phong', username: 'hanphong', current_rank: 'ky_lao', mindpoint: 2108, avatar_url: null },
  { user_id: '5', display_name: 'Tử Yên', username: 'tuyen', current_rank: 'hoc_ky', mindpoint: 1982, avatar_url: null }
]

function formatRankLabel(rank?: string | null) {
  if (!rank) return 'Ẩn danh'
  return rankLabelMap[rank] ?? rank
}

function formatMindpoint(value?: number | null) {
  const n = Number(value ?? 0)
  return n.toLocaleString('vi-VN')
}

export default function KhaiNhan() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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
      setErrorMessage('Không thể tải xếp hạng trực tiếp, hiển thị danh sách mẫu.')
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
          Chánh Điện
        </a>
        <span style={{ color: 'var(--color-muted)' }}>›</span>
        <span style={{ color: 'var(--color-text)' }}>Khai Nhãn</span>
      </nav>

      <div className="leaderboard-page">
        <section className="leaderboard-hero glass-card">
          <div>
            <p className="leaderboard-eyebrow">BẢNG TÔN VINH MINDPOINT</p>
            <h1 className="leaderboard-title">Khai Nhãn Các</h1>
            <p className="leaderboard-description">
              Top đạo hữu sở hữu MindPoint cao nhất toàn cõi. Càng leo cao càng dễ được trưởng lão để mắt và mở khóa phần thưởng danh dự.
            </p>
            <div className="leaderboard-meta">
              <span>100 cao thủ hàng đầu</span>
              {lastUpdated && <span>Cập nhật: {lastUpdated.toLocaleTimeString('vi-VN')}</span>}
            </div>
          </div>
          <div className="leaderboard-actions">
            <button className="refresh-btn" onClick={fetchLeaderboard} disabled={loading}>
              {loading ? 'Đang tải...' : 'Tải lại bảng' }
            </button>
            <p className="leaderboard-note">Sắp xếp theo MindPoint thực, cập nhật liên tục.</p>
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
                    <strong>{entry.display_name ?? entry.username ?? 'Ẩn danh'}</strong>
                    <p>{entry.username ? `@${entry.username}` : 'Chưa đặt danh'}</p>
                  </div>
                </div>
                <div className="stack-meta">
                  <span className="stack-rank-chip">{formatRankLabel(entry.current_rank)}</span>
                  <span className="stack-mindpoint">{formatMindpoint(entry.mindpoint)} MP</span>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}
