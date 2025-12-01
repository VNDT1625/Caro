import React, { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'

interface MatchRow { id: string; created_at?: string; status?: string }

interface Mistake { move: number; desc: string; severity: 'minor' | 'major' | 'critical' }
interface Suggestion { text: string }
interface Pattern { label: string; explanation: string }
interface MoveQuality { move: number; score: number; note: string }
interface AlternativePlan { title: string; detail: string }

function generateMockSequence(size = 15, moves = 40) {
  const seq: Array<{ x: number; y: number; p: 'X' | 'O' }> = []
  const used = new Set<string>()
  for (let i = 0; i < moves; i++) {
    let x = Math.floor(Math.random() * size)
    let y = Math.floor(Math.random() * size)
    let key = x + ':' + y
    let guard = 0
    while (used.has(key) && guard < 50) {
      x = Math.floor(Math.random() * size)
      y = Math.floor(Math.random() * size)
      key = x + ':' + y
      guard++
    }
    used.add(key)
    seq.push({ x, y, p: i % 2 === 0 ? 'X' : 'O' })
  }
  return seq
}

export default function AiAnalysis() {
  const { t } = useLanguage()
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [analyzing, setAnalyzing] = useState(false)
  const [sequence, setSequence] = useState<Array<{ x: number; y: number; p: 'X' | 'O' }>>([])
  const [mistakes, setMistakes] = useState<Mistake[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [bestMove, setBestMove] = useState<{ x: number; y: number; reason: string } | null>(null)
  const [moveQuality, setMoveQuality] = useState<MoveQuality[]>([])
  const [altPlans, setAltPlans] = useState<AlternativePlan[]>([])
  const [evaluationFlow, setEvaluationFlow] = useState<string[]>([])

  // Load latest matches (mock if table missing)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingMatches(true)
      try {
        const { data, error } = await supabase.from('matches').select('id, created_at, status').order('created_at', { ascending: false }).limit(20)
        if (!cancelled && !error && Array.isArray(data)) setMatches(data as any)
        else if (!cancelled) {
          // mock fallback
            setMatches(Array.from({ length: 8 }).map((_, i) => ({ id: 'MFAKE' + (1000 + i), status: i % 3 === 0 ? 'finished' : 'active', created_at: new Date(Date.now() - i * 3600000).toISOString() })))
        }
      } catch {
        if (!cancelled) setMatches(Array.from({ length: 8 }).map((_, i) => ({ id: 'MFAKE' + (1000 + i), status: i % 3 === 0 ? 'finished' : 'active', created_at: new Date(Date.now() - i * 3600000).toISOString() })))
      } finally {
        if (!cancelled) setLoadingMatches(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Deterministic pseudo-random from match id for stable demo
  function seededRandom(seed: string) {
    let h = 0
    for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
    return () => {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5
      return (h >>> 0) / 4294967295
    }
  }

  const startAnalysis = (auto = false) => {
    if (!selectedId) return
    setAnalyzing(true)
    const rand = seededRandom(selectedId + (auto ? 'AUTO' : 'MAN'))
    // Simulate AI work
    setTimeout(() => {
      const movesCount = 40 + Math.floor(rand() * 10)
      const seq: Array<{ x: number; y: number; p: 'X' | 'O' }> = []
      const used = new Set<string>()
      for (let i = 0; i < movesCount; i++) {
        let x = Math.floor(rand() * 15)
        let y = Math.floor(rand() * 15)
        let key = x + ':' + y
        let guard = 0
        while (used.has(key) && guard < 60) {
          x = Math.floor(rand() * 15)
          y = Math.floor(rand() * 15)
          key = x + ':' + y
          guard++
        }
        used.add(key)
        seq.push({ x, y, p: i % 2 === 0 ? 'X' : 'O' })
      }
      setSequence(seq)
      // Mock mistakes: pick some random moves
      const mk: Mistake[] = seq.filter((_, i) => i % 11 === 5).slice(0,5).map((m, idx) => ({
        move: idx * 11 + 5,
        desc: 'Nước đi chưa tối ưu hóa thế phản công (demo)',
        severity: ['minor','major','critical'][idx % 3] as any
      }))
      setMistakes(mk)
      // Suggestions
      setSuggestions([
        { text: 'Mở rộng chuỗi mở hai đầu thay vì kín một phía.' },
        { text: 'Phản kích sớm ở cánh trái để cân bằng áp lực.' },
        { text: 'Chuẩn bị nước nối tạo fork chéo hàng 10.' }
      ])
      // Patterns
      setPatterns([
        { label: 'Chuỗi mở 3', explanation: 'Tiềm năng nâng cấp thành 5 trong 2 lượt.' },
        { label: 'Đe dọa chéo kép', explanation: 'Xuất hiện hai đường chéo tạo áp lực buộc phòng thủ.' },
        { label: 'Vùng trung tâm trống', explanation: 'Còn nhiều điểm chiến lược chưa bị kiểm soát.' }
      ])
      // Move quality (sample subset of moves)
      setMoveQuality(seq.slice(0, 18).map((m, i) => ({
        move: i + 1,
        score: Math.round(50 + rand() * 50),
        note: i % 6 === 2 ? 'Tăng áp lực' : i % 5 === 1 ? 'Phòng thủ' : 'Trung tính'
      })))
      // Alternative plans
      setAltPlans([
        { title: 'Khai thác cạnh dưới', detail: 'Di chuyển trọng tâm sang hàng 14 để tạo thế kẹp.' },
        { title: 'Tạo trục kiểm soát trung tâm', detail: 'Chiếm 3 điểm thẳng hàng quanh (8,8) để mở nhiều nhánh.' },
        { title: 'Phòng thủ phản công', detail: 'Chặn chuỗi đối thủ rồi đáp trả bằng chuỗi mở ở hàng 6.' }
      ])
      // Evaluation flow timeline
      setEvaluationFlow([
        'Giai đoạn mở cuộc: Ưu tiên kiểm soát trung tâm',
        'Trung cuộc: Hai bên tạo chuỗi song song',
        'Chuyển thế: Đối thủ hướng sang phòng thủ cánh phải',
        'Cuối cuộc: Cần fork để kết thúc nhanh'
      ])
      // Best move suggestion (random from empty)
      const emptyCells: Array<{ x: number; y: number }> = []
      for (let x = 0; x < 15; x++) for (let y = 0; y < 15; y++) {
        if (!seq.find(c => c.x === x && c.y === y)) emptyCells.push({ x, y })
      }
      const bm = emptyCells[Math.floor(rand() * emptyCells.length)]
      setBestMove({ x: bm.x, y: bm.y, reason: 'Tạo fork tấn công hai hướng (demo).' })
      setAnalyzing(false)
    }, 1200)
  }

  // Auto analysis when selecting a match
  useEffect(() => {
    if (selectedId) {
      startAnalysis(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // Auto select first match after load
  useEffect(() => {
    if (matches.length && !selectedId) {
      setSelectedId(matches[0].id)
    }
  }, [matches, selectedId])

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>{t('aiAnalysis.title')}</h1>
      <p style={{ color: '#94A3B8', marginTop: 4 }}>{t('aiAnalysis.subtitle')}</p>
      {/* Removed demo notice per request */}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <input placeholder={t('aiAnalysis.searchPlaceholder')} value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(71,85,105,0.5)', background: 'rgba(15,23,42,0.7)', color: '#F1F5F9' }} />
        </div>
        <button onClick={() => startAnalysis(false)} disabled={!selectedId || analyzing} style={{ padding: '10px 18px', borderRadius: 8, background: analyzing ? 'rgba(56,189,248,0.3)' : 'linear-gradient(135deg,#38BDF8,#6366F1)', color: '#fff', fontWeight: 600, border: 'none', cursor: selectedId && !analyzing ? 'pointer' : 'default' }}>
          {analyzing ? t('aiAnalysis.loading') : t('aiAnalysis.analyzeButton')}
        </button>
        <button onClick={() => { window.location.hash = '#home' }} style={{ padding: '10px 18px', borderRadius: 8, background: 'rgba(71,85,105,0.4)', color: '#E2E8F0', fontWeight: 500, border: '1px solid rgba(71,85,105,0.6)' }}>← {t('common.close')}</button>
      </div>

      {/* Matches List */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '300px 1fr 320px', gap: 16 }}>
        <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.6)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('aiAnalysis.selectMatch')}</div>
          {loadingMatches && <div style={{ fontSize: 12 }}>{t('common.loading')}</div>}
          <div style={{ display: 'grid', gap: 6 }}>
            {matches.map(m => (
              <button key={m.id} onClick={() => setSelectedId(m.id)} style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: selectedId === m.id ? 'rgba(56,189,248,0.5)' : 'rgba(71,85,105,0.4)',
                background: selectedId === m.id ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.5)',
                color: '#F1F5F9',
                cursor: 'pointer',
                fontSize: 13
              }}>
                <div style={{ fontWeight: 600 }}>{m.id}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.status || '—'} · {m.created_at?.slice(0,10)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Board + Moves */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.6)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('aiAnalysis.board')}</div>
            {sequence.length === 0 && !analyzing && <div style={{ fontSize: 12, color: '#94A3B8' }}>{t('aiAnalysis.noSelection')}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gap: 1, background: '#1e293b', padding: 6, borderRadius: 8 }}>
              {Array.from({ length: 15 * 15 }).map((_, idx) => {
                const x = idx % 15
                const y = Math.floor(idx / 15)
                const piece = sequence.find(m => m.x === x && m.y === y)
                const moveIndex = piece ? sequence.findIndex(m => m === piece) + 1 : null
                return (
                  <div key={idx} style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: 'rgba(148,163,184,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: piece ? (piece.p === 'X' ? '#38BDF8' : '#F59E0B') : 'rgba(148,163,184,0.25)',
                    borderRadius: 2,
                    position: 'relative'
                  }}>
                    {piece ? piece.p : ''}
                    {moveIndex && <span style={{ position: 'absolute', bottom: 1, right: 2, fontSize: 8, opacity: 0.6 }}>{moveIndex}</span>}
                    {bestMove && bestMove.x === x && bestMove.y === y && (
                      <span style={{ position: 'absolute', inset: 0, border: '2px solid #22C55E', borderRadius: 2, pointerEvents: 'none' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.6)', maxHeight: 260, overflowY: 'auto' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('aiAnalysis.moves')}</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 4 }}>
              {sequence.map((m, i) => (
                <li key={i} style={{ listStyle: 'decimal', color: '#CBD5E1' }}>{i+1}. {m.p} ({m.x+1},{m.y+1})</li>
              ))}
            </ol>
          </div>
        </div>

        {/* Analysis Summary & Panels */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.6)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('aiAnalysis.analysisSummary')}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>{mistakes.length} {t('aiAnalysis.mistakes')} · {suggestions.length} {t('aiAnalysis.suggestions')}</div>
            {bestMove && (
              <div style={{ fontSize: 12, background: 'rgba(34,197,94,0.12)', padding: 8, borderRadius: 8, border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E', marginBottom: 8 }}>
                <strong>{t('aiAnalysis.bestMove')}:</strong> ({bestMove.x+1},{bestMove.y+1}) – {bestMove.reason}
              </div>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {mistakes.map((mk, i) => (
                <div key={i} style={{ fontSize: 12, background: 'rgba(239,68,68,0.08)', padding: 8, borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>
                  #{mk.move} · {mk.severity.toUpperCase()} · {mk.desc}
                </div>
              ))}
            </div>
          </div>
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.6)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('aiAnalysis.evaluationFlow')}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#CBD5E1', display: 'grid', gap: 4 }}>
              {evaluationFlow.map((line, i) => (<li key={i}>{line}</li>))}
            </ul>
          </div>
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.6)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('aiAnalysis.moveQuality')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 6 }}>
              {moveQuality.map((mq, i) => (
                <div key={i} style={{ fontSize: 11, padding: 6, borderRadius: 6, background: 'rgba(51,65,85,0.5)', border: '1px solid rgba(71,85,105,0.35)' }}>
                  <div style={{ fontWeight: 600 }}>#{mq.move}</div>
                  <div style={{ color: mq.score > 75 ? '#22C55E' : mq.score > 55 ? '#F59E0B' : '#EF4444', fontWeight: 700 }}>{mq.score}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>{mq.note}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.6)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('aiAnalysis.alternativePlans')}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#CBD5E1', display: 'grid', gap: 4 }}>
              {altPlans.map((p, i) => (<li key={i}><strong>{p.title}</strong>: {p.detail}</li>))}
            </ul>
          </div>
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.6)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('aiAnalysis.suggestions')}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#CBD5E1', display: 'grid', gap: 4 }}>
              {suggestions.map((s, i) => (<li key={i}>{s.text}</li>))}
            </ul>
          </div>
          <div style={{ border: '1px solid rgba(71,85,105,0.35)', borderRadius: 12, padding: 12, background: 'rgba(15,23,42,0.6)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{t('aiAnalysis.patterns')}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#CBD5E1', display: 'grid', gap: 4 }}>
              {patterns.map((p, i) => (<li key={i}><strong>{p.label}</strong>: {p.explanation}</li>))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
