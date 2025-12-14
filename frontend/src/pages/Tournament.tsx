import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin'

function formatDateInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function generateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  // Use timestamp + random for uniqueness
  const timestamp = Date.now().toString(36).toUpperCase().slice(-3)
  let code = 'MPT-' + timestamp
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

// Check if code exists in database
async function isCodeUnique(code: string): Promise<boolean> {
  const { data } = await supabase
    .from('tournaments')
    .select('id')
    .eq('tournament_code', code)
    .maybeSingle()
  return !data
}

// Generate unique code with retry
async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateCode()
    if (await isCodeUnique(code)) {
      return code
    }
  }
  // Fallback: add more random chars
  return generateCode() + Math.random().toString(36).slice(2, 4).toUpperCase()
}

export default function Tournament() {
  const { t } = useLanguage()
  const now = new Date()
  const defaultRegEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const defaultStart = new Date(now.getTime() + 4 * 60 * 60 * 1000)
  const defaultEnd = new Date(now.getTime() + 7 * 60 * 60 * 1000)

  const [user, setUser] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [createdTournament, setCreatedTournament] = useState<any>(null)
  const [code, setCode] = useState(generateCode())
  
  // View mode: 'create' or 'view'
  const [viewMode, setViewMode] = useState<'create' | 'view'>('create')
  const [viewingTournament, setViewingTournament] = useState<any>(null)
  const [loadingTournament, setLoadingTournament] = useState(false)
  const [participants, setParticipants] = useState<any[]>([])
  const [isRegistered, setIsRegistered] = useState(false)
  const [joining, setJoining] = useState(false)

  // Check URL for tournament code
  useEffect(() => {
    const hash = window.location.hash
    const match = hash.match(/code=([A-Z0-9-]+)/i)
    if (match) {
      const tournamentCode = match[1].toUpperCase()
      loadTournamentByCode(tournamentCode)
    }
  }, [])

  async function loadTournamentByCode(tournamentCode: string) {
    setLoadingTournament(true)
    setViewMode('view')
    
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          creator_profile:profiles!tournaments_creator_fkey(username, display_name, avatar_url)
        `)
        .eq('tournament_code', tournamentCode)
        .single()

      if (error || !data) {
        showToast('error', t('tournament.notFound') || 'Không tìm thấy giải đấu')
        setViewMode('create')
        return
      }

      setViewingTournament(data)
      
      // Load participants
      const { data: parts } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profile:profiles!tournament_participants_user_fkey(username, display_name, avatar_url, current_rank)
        `)
        .eq('tournament_id', data.id)
        .order('registered_at', { ascending: true })

      setParticipants(parts || [])
      
      // Check if current user is registered
      if (user?.id && parts) {
        setIsRegistered(parts.some((p: any) => p.user_id === user.id))
      }
    } catch (err) {
      console.error('Load tournament error:', err)
      showToast('error', 'Lỗi khi tải thông tin giải')
      setViewMode('create')
    } finally {
      setLoadingTournament(false)
    }
  }

  async function handleJoinTournament() {
    if (!user?.id || !viewingTournament) return
    
    setJoining(true)
    try {
      // Check entry fee
      if (viewingTournament.entry_fee_coins > 0 || viewingTournament.entry_fee_gems > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('coins, gems')
          .eq('user_id', user.id)
          .single()

        if (!profile || 
            profile.coins < viewingTournament.entry_fee_coins || 
            profile.gems < viewingTournament.entry_fee_gems) {
          showToast('error', t('tournament.notEnoughFunds') || 'Không đủ tiền đăng ký')
          setJoining(false)
          return
        }

        // Deduct fees
        await supabase
          .from('profiles')
          .update({
            coins: profile.coins - viewingTournament.entry_fee_coins,
            gems: profile.gems - viewingTournament.entry_fee_gems
          })
          .eq('user_id', user.id)
      }

      // Register
      const { error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: viewingTournament.id,
          user_id: user.id,
          status: 'registered'
        })

      if (error) throw error

      showToast('success', t('tournament.joinSuccess') || 'Đăng ký thành công!')
      setIsRegistered(true)
      
      // Reload participants
      loadTournamentByCode(viewingTournament.tournament_code)
    } catch (err) {
      console.error('Join error:', err)
      showToast('error', t('tournament.joinError') || 'Lỗi khi đăng ký')
    } finally {
      setJoining(false)
    }
  }

  async function handleLeaveTournament() {
    if (!user?.id || !viewingTournament) return
    
    setJoining(true)
    try {
      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', viewingTournament.id)
        .eq('user_id', user.id)

      if (error) throw error

      showToast('success', 'Đã hủy đăng ký')
      setIsRegistered(false)
      loadTournamentByCode(viewingTournament.tournament_code)
    } catch (err) {
      showToast('error', 'Lỗi khi hủy đăng ký')
    } finally {
      setJoining(false)
    }
  }
  const [form, setForm] = useState({
    name: 'Vạn Môn Tranh Đấu - Mùa 1',
    description: 'Giải 8-16 người loại trực tiếp, seed theo rank, auto tạo bracket.',
    format: 'single_elimination' as TournamentFormat,
    minPlayers: 8,
    maxPlayers: 16,
    boardSize: 15,
    winLength: 5,
    timePerMove: 30,
    entryFeeCoins: 0,
    entryFeeGems: 0,
    prizeCoins: 2000,
    prizeGems: 0,
    requiredRank: '',
    isPublic: true,
    allowSpectators: true,
    allowChat: false,
    registrationStart: formatDateInput(now),
    registrationEnd: formatDateInput(defaultRegEnd),
    tournamentStart: formatDateInput(defaultStart),
    tournamentEnd: formatDateInput(defaultEnd),
    rules: 'Bo1, cấm 3–3, không undo. BTC sẽ cân bằng seed theo rank.',
    coverImageUrl: ''
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null)).catch(() => setUser(null))
  }, [])

  const suggestedPrizeCoins = useMemo(() => {
    const pot = form.entryFeeCoins * form.maxPlayers
    return pot > form.prizeCoins ? pot : form.prizeCoins
  }, [form.entryFeeCoins, form.maxPlayers, form.prizeCoins])

  const seatsLabel = `${form.minPlayers}–${form.maxPlayers} người`

  function updateField<T extends keyof typeof form>(key: T, value: (typeof form)[T]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4200)
  }

  function validateForm() {
    if (!form.name.trim()) {
      showToast('error', t('tournament.validation.nameEmpty'))
      return false
    }
    if (form.minPlayers < 4 || form.maxPlayers > 128 || form.minPlayers > form.maxPlayers) {
      showToast('error', t('tournament.validation.playersInvalid'))
      return false
    }
    if (form.boardSize < 9 || form.boardSize > 25) {
      showToast('error', t('tournament.validation.boardInvalid'))
      return false
    }
    if (form.winLength < 3 || form.winLength > form.boardSize) {
      showToast('error', t('tournament.validation.winInvalid'))
      return false
    }
    const regStart = form.registrationStart ? new Date(form.registrationStart) : null
    const regEnd = form.registrationEnd ? new Date(form.registrationEnd) : null
    const startAt = form.tournamentStart ? new Date(form.tournamentStart) : null
    if (regStart && regEnd && regStart > regEnd) {
      showToast('error', t('tournament.validation.regTimeInvalid'))
      return false
    }
    if (startAt && regEnd && startAt < regEnd) {
      showToast('error', t('tournament.validation.startTimeInvalid'))
      return false
    }
    return true
  }

  async function handleCreateTournament() {
    if (!user?.id) {
      showToast('error', t('tournament.toast.loginRequired'))
      return
    }
    if (!validateForm()) return

    setCreating(true)
    setToast(null)
    setCreatedTournament(null)

    // Ensure code is unique before creating
    let finalCode = code.trim().slice(0, 20)
    const codeIsUnique = await isCodeUnique(finalCode)
    if (!codeIsUnique) {
      // Generate a new unique code
      finalCode = await generateUniqueCode()
      setCode(finalCode)
    }

    const payload = {
      tournament_name: form.name.trim(),
      tournament_code: finalCode,
      description: form.description.trim() || null,
      creator_user_id: user.id,
      format: form.format,
      min_players: form.minPlayers,
      max_players: form.maxPlayers,
      board_size: form.boardSize,
      win_length: form.winLength,
      time_per_move: form.timePerMove,
      entry_fee_coins: form.entryFeeCoins,
      entry_fee_gems: form.entryFeeGems,
      prize_pool_coins: suggestedPrizeCoins,
      prize_pool_gems: form.prizeGems,
      registration_start: form.registrationStart ? new Date(form.registrationStart).toISOString() : null,
      registration_end: form.registrationEnd ? new Date(form.registrationEnd).toISOString() : null,
      tournament_start: form.tournamentStart ? new Date(form.tournamentStart).toISOString() : null,
      tournament_end: form.tournamentEnd ? new Date(form.tournamentEnd).toISOString() : null,
      is_public: form.isPublic,
      required_rank: form.requiredRank || null,
      cover_image_url: form.coverImageUrl || null,
      rules_text: form.rules.trim() || null,
      game_config: {
        allow_spectators: form.allowSpectators,
        allow_chat: form.allowChat,
        theme: 'tournament-ui-v1'
      },
      status: 'registration'
    }

    console.log('Creating tournament with payload:', payload)
    
    const { data, error } = await supabase
      .from('tournaments')
      .insert(payload)
      .select()
      .single()

    setCreating(false)

    if (error) {
      console.error('Create tournament error:', error)
      // Check if table doesn't exist
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        showToast('error', 'Bảng tournaments chưa được tạo. Vui lòng chạy migration.')
      } else if (error.code === '42501') {
        showToast('error', 'Không có quyền tạo giải. Vui lòng đăng nhập lại.')
      } else {
        showToast('error', error.message || t('tournament.toast.createFailed'))
      }
      return
    }

    console.log('Tournament created successfully:', data)
    setCreatedTournament(data)
    showToast('success', t('tournament.toast.created'))
  }

  function copyInvite() {
    if (!createdTournament?.tournament_code) return
    const link = `${window.location.origin}/#tournament?code=${createdTournament.tournament_code}`
    navigator.clipboard.writeText(link).then(() => {
      showToast('success', t('tournament.toast.copied'))
    }).catch(() => {
      showToast('error', t('tournament.toast.copyFailed'))
    })
  }

  // View Tournament Detail Mode
  if (viewMode === 'view') {
    if (loadingTournament) {
      return (
        <div className="tournament-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center', color: '#94A3B8' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            <p>Đang tải thông tin giải...</p>
          </div>
        </div>
      )
    }

    if (!viewingTournament) {
      return (
        <div className="tournament-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
            <p style={{ color: '#EF4444', marginBottom: '16px' }}>Không tìm thấy giải đấu</p>
            <button className="cta-primary" onClick={() => { setViewMode('create'); window.location.hash = '#tournament' }}>
              Tạo giải mới
            </button>
          </div>
        </div>
      )
    }

    const formatLabel: Record<string, string> = {
      single_elimination: 'Loại trực tiếp',
      double_elimination: 'Loại kép',
      round_robin: 'Vòng tròn',
      swiss: 'Swiss'
    }

    const statusLabel: Record<string, { text: string; color: string }> = {
      draft: { text: 'Nháp', color: '#94A3B8' },
      registration: { text: 'Đang đăng ký', color: '#22C55E' },
      in_progress: { text: 'Đang diễn ra', color: '#FBBF24' },
      completed: { text: 'Đã kết thúc', color: '#64748B' },
      cancelled: { text: 'Đã hủy', color: '#EF4444' }
    }

    const canJoin = viewingTournament.status === 'registration' && 
                    viewingTournament.current_players < viewingTournament.max_players &&
                    !isRegistered

    return (
      <div className="tournament-page">
        {toast && (
          <div className={`tournament-toast ${toast.type}`} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
            {toast.text}
          </div>
        )}

        <div className="tournament-hero glass-card">
          <div className="hero-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ 
                padding: '6px 14px', 
                borderRadius: '20px', 
                fontSize: '12px', 
                fontWeight: 600,
                background: `${statusLabel[viewingTournament.status]?.color}20`,
                color: statusLabel[viewingTournament.status]?.color
              }}>
                {statusLabel[viewingTournament.status]?.text}
              </span>
              <span style={{ fontFamily: 'monospace', color: '#64748B', letterSpacing: '1px' }}>
                #{viewingTournament.tournament_code}
              </span>
            </div>
            <h1 style={{ fontSize: '28px', marginBottom: '12px' }}>{viewingTournament.tournament_name}</h1>
            <p style={{ color: '#94A3B8', marginBottom: '20px' }}>{viewingTournament.description}</p>
            
            <div className="hero-pills" style={{ marginBottom: '20px' }}>
              <span className="pill">{formatLabel[viewingTournament.format]}</span>
              <span className="pill">{viewingTournament.current_players}/{viewingTournament.max_players} người</span>
              <span className="pill">{viewingTournament.time_per_move}s/nước</span>
              <span className="pill">{viewingTournament.board_size}x{viewingTournament.board_size}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Giải thưởng</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#FBBF24' }}>
                  {viewingTournament.prize_pool_coins > 0 && `${viewingTournament.prize_pool_coins} 🪙`}
                  {viewingTournament.prize_pool_gems > 0 && ` ${viewingTournament.prize_pool_gems} 💎`}
                </div>
              </div>
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.2)' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Phí vào</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#22D3EE' }}>
                  {viewingTournament.entry_fee_coins === 0 && viewingTournament.entry_fee_gems === 0 
                    ? 'Miễn phí' 
                    : `${viewingTournament.entry_fee_coins} 🪙`}
                </div>
              </div>
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Bắt đầu</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#8B5CF6' }}>
                  {viewingTournament.tournament_start 
                    ? new Date(viewingTournament.tournament_start).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : 'Chưa xác định'}
                </div>
              </div>
            </div>

            <div className="hero-actions">
              {canJoin && (
                <button className="cta-primary" onClick={handleJoinTournament} disabled={joining}>
                  {joining ? 'Đang xử lý...' : '⚔️ Đăng ký tham gia'}
                </button>
              )}
              {isRegistered && viewingTournament.status === 'registration' && (
                <button className="ghost-btn" onClick={handleLeaveTournament} disabled={joining} style={{ borderColor: '#EF4444', color: '#EF4444' }}>
                  Hủy đăng ký
                </button>
              )}
              {isRegistered && (
                <span style={{ padding: '10px 20px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.2)', color: '#22C55E', fontWeight: 600 }}>
                  ✓ Đã đăng ký
                </span>
              )}
              <button className="ghost-btn" onClick={() => { window.location.hash = '#home' }}>
                Về trang chủ
              </button>
            </div>
          </div>

          <div className="hero-right">
            <div className="summary-card glass-card">
              <div className="summary-header">
                <h3 style={{ margin: 0, fontSize: '16px' }}>Người tham gia ({participants.length})</h3>
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '12px 0' }}>
                {participants.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                    Chưa có ai đăng ký
                  </div>
                ) : (
                  participants.map((p, idx) => (
                    <div key={p.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: p.user_id === user?.id ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                      marginBottom: '4px'
                    }}>
                      <span style={{ width: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                        {idx + 1}
                      </span>
                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        overflow: 'hidden'
                      }}>
                        {p.profile?.avatar_url ? (
                          <img src={p.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : '👤'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: p.user_id === user?.id ? '#22D3EE' : '#F8FAFC' }}>
                          {p.profile?.display_name || p.profile?.username || 'Người chơi'}
                          {p.user_id === user?.id && ' (Bạn)'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {p.profile?.current_rank || 'Chưa xếp hạng'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {viewingTournament.rules_text && (
          <div className="tournament-card glass-card" style={{ marginTop: '20px' }}>
            <h3>Luật chơi</h3>
            <p style={{ color: '#94A3B8', whiteSpace: 'pre-wrap' }}>{viewingTournament.rules_text}</p>
          </div>
        )}
      </div>
    )
  }

  // Create Tournament Mode (original)
  return (
    <div className="tournament-page">
      <div className="tournament-hero glass-card">
        <div className="hero-left">
          <div className="eyebrow">{t('tournament.eyebrow')}</div>
          <h1>{t('tournament.title')}</h1>
          <p>{t('tournament.description')}</p>
          <div className="hero-pills">
            <span className="pill">{t('tournament.info.format')}: {form.format === 'single_elimination' ? t('tournament.format.single') : form.format === 'double_elimination' ? t('tournament.format.double') : t('tournament.format.roundRobin')}</span>
            <span className="pill">{t('tournament.slots')}: {seatsLabel}</span>
            <span className="pill">{t('tournament.timePerMove')}: {form.timePerMove}s</span>
          </div>
          <div className="hero-actions">
            <button className="cta-primary" onClick={handleCreateTournament} disabled={creating}>
              {creating ? t('tournament.actions.creating') : t('tournament.createNow')}
            </button>
            <button className="ghost-btn" onClick={() => { window.location.hash = '#home' }}>
              {t('tournament.backHome')}
            </button>
          </div>
          {toast && (
            <div className={`tournament-toast ${toast.type}`}>
              {toast.text}
            </div>
          )}
        </div>
        <div className="hero-right">
          <div className="summary-card glass-card">
            <div className="summary-header">
              <div>
                <div className="summary-label">{t('tournament.code')}</div>
                <div className="summary-code">{code}</div>
              </div>
              <button className="pill ghost" onClick={() => setCode(generateCode())}>
                {t('tournament.changeCode')}
              </button>
            </div>
            <div className="summary-metrics">
              <div className="metric">
                <div className="metric-label">{t('tournament.registration')}</div>
                <div className="metric-value">{form.minPlayers} - {form.maxPlayers}</div>
              </div>
              <div className="metric">
                <div className="metric-label">{t('tournament.prize')}</div>
                <div className="metric-value">{suggestedPrizeCoins} 🪙 + {form.prizeGems} 💎</div>
              </div>
              <div className="metric">
                <div className="metric-label">{t('tournament.timePerMove')}</div>
                <div className="metric-value">{form.timePerMove}s</div>
              </div>
            </div>
            <div className="summary-body">
              <p className="summary-desc">{form.description}</p>
              <div className="rule-line">Board: {form.boardSize}x{form.boardSize} • {t('tournament.rules.winLength')}: {form.winLength}</div>
              <div className="rule-line">{form.allowSpectators ? t('tournament.allowSpectators') : t('tournament.noSpectators')}</div>
              <div className="rule-line">{form.isPublic ? t('tournament.public') : t('tournament.private')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="tournament-grid">
        <section className="tournament-card glass-card">
          <div className="card-heading-row">
            <div>
              <h3>{t('tournament.info.title')}</h3>
              <p className="card-subtext">{t('tournament.info.subtitle')}</p>
            </div>
            <span className="pill accent">{t('tournament.step1')}</span>
          </div>
          <div className="form-group">
            <label>{t('tournament.info.name')}</label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder={t('tournament.info.namePlaceholder')}
            />
          </div>
          <div className="form-group">
            <label>{t('tournament.info.desc')}</label>
            <textarea
              className="form-input"
              rows={3}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder={t('tournament.info.descPlaceholder')}
            />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('tournament.info.format')}</label>
              <select className="form-select" value={form.format} onChange={e => updateField('format', e.target.value as TournamentFormat)}>
                <option value="single_elimination">{t('tournament.format.single')}</option>
                <option value="double_elimination">{t('tournament.format.double')}</option>
                <option value="round_robin">{t('tournament.format.roundRobin')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('tournament.info.codeLabel')}</label>
              <input
                className="form-input"
                value={code}
                maxLength={20}
                onChange={e => setCode(e.target.value.toUpperCase())}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.info.visibility')}</label>
              <div className="pill-toggle">
                <button className={`pill ${form.isPublic ? 'active' : ''}`} onClick={() => updateField('isPublic', true)}>{t('tournament.info.publicBtn')}</button>
                <button className={`pill ${!form.isPublic ? 'active' : ''}`} onClick={() => updateField('isPublic', false)}>{t('tournament.info.privateBtn')}</button>
              </div>
            </div>
            <div className="form-group">
              <label>{t('tournament.info.requiredRank')}</label>
              <input
                className="form-input"
                value={form.requiredRank}
                onChange={e => updateField('requiredRank', e.target.value)}
                placeholder={t('tournament.info.requiredRankPlaceholder')}
              />
            </div>
          </div>
        </section>

        <section className="tournament-card glass-card">
          <div className="card-heading-row">
            <div>
              <h3>{t('tournament.slots.title')}</h3>
              <p className="card-subtext">{t('tournament.slots.subtitle')}</p>
            </div>
            <span className="pill accent">{t('tournament.step2')}</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('tournament.slots.min')}</label>
              <input
                type="number"
                className="form-input"
                min={4}
                max={128}
                value={form.minPlayers}
                onChange={e => updateField('minPlayers', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.slots.max')}</label>
              <input
                type="number"
                className="form-input"
                min={4}
                max={128}
                value={form.maxPlayers}
                onChange={e => updateField('maxPlayers', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.slots.regStart')}</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.registrationStart}
                onChange={e => updateField('registrationStart', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.slots.regEnd')}</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.registrationEnd}
                onChange={e => updateField('registrationEnd', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.slots.start')}</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.tournamentStart}
                onChange={e => updateField('tournamentStart', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.slots.end')}</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.tournamentEnd}
                onChange={e => updateField('tournamentEnd', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="tournament-card glass-card">
          <div className="card-heading-row">
            <div>
              <h3>{t('tournament.rules.title')}</h3>
              <p className="card-subtext">{t('tournament.rules.subtitle')}</p>
            </div>
            <span className="pill accent">{t('tournament.step3')}</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('tournament.rules.boardSize')}</label>
              <select
                className="form-select"
                value={form.boardSize}
                onChange={e => updateField('boardSize', Number(e.target.value))}
              >
                <option value={9}>9x9</option>
                <option value={15}>15x15</option>
                <option value={19}>19x19</option>
                <option value={25}>25x25</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('tournament.rules.winLength')}</label>
              <input
                type="number"
                className="form-input"
                min={3}
                max={10}
                value={form.winLength}
                onChange={e => updateField('winLength', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.rules.timePerMove')}</label>
              <select
                className="form-select"
                value={form.timePerMove}
                onChange={e => updateField('timePerMove', Number(e.target.value))}
              >
                <option value={10}>10 {t('tournament.rules.seconds')}</option>
                <option value={20}>20 {t('tournament.rules.seconds')}</option>
                <option value={30}>30 {t('tournament.rules.seconds')}</option>
                <option value={45}>45 {t('tournament.rules.seconds')}</option>
                <option value={60}>60 {t('tournament.rules.seconds')}</option>
              </select>
            </div>
            <div className="form-group">
              <label>{t('tournament.rules.spectators')}</label>
              <div className="pill-toggle">
                <button className={`pill ${form.allowSpectators ? 'active' : ''}`} onClick={() => updateField('allowSpectators', true)}>{t('tournament.rules.hasSpectators')}</button>
                <button className={`pill ${!form.allowSpectators ? 'active' : ''}`} onClick={() => updateField('allowSpectators', false)}>{t('tournament.rules.noSpectators')}</button>
              </div>
              <div className="pill-toggle" style={{ marginTop: 8 }}>
                <button className={`pill ${form.allowChat ? 'active' : ''}`} onClick={() => updateField('allowChat', true)}>{t('tournament.rules.openChat')}</button>
                <button className={`pill ${!form.allowChat ? 'active' : ''}`} onClick={() => updateField('allowChat', false)}>{t('tournament.rules.closeChat')}</button>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label>{t('tournament.rules.details')}</label>
            <textarea
              className="form-input"
              rows={4}
              value={form.rules}
              onChange={e => updateField('rules', e.target.value)}
            />
          </div>
        </section>

        <section className="tournament-card glass-card">
          <div className="card-heading-row">
            <div>
              <h3>{t('tournament.fees.title')}</h3>
              <p className="card-subtext">{t('tournament.fees.subtitle')}</p>
            </div>
            <span className="pill accent">{t('tournament.step4')}</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>{t('tournament.fees.entryCoins')}</label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={form.entryFeeCoins}
                onChange={e => updateField('entryFeeCoins', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.fees.entryGems')}</label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={form.entryFeeGems}
                onChange={e => updateField('entryFeeGems', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.fees.prizeCoins')}</label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={form.prizeCoins}
                onChange={e => updateField('prizeCoins', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.fees.prizeGems')}</label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={form.prizeGems}
                onChange={e => updateField('prizeGems', Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.fees.coverImage')}</label>
              <input
                className="form-input"
                value={form.coverImageUrl}
                onChange={e => updateField('coverImageUrl', e.target.value)}
                placeholder={t('tournament.fees.coverPlaceholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('tournament.fees.totalPrize')}</label>
              <div className="stat-block">
                <div className="stat-title">{t('tournament.fees.totalLabel')}</div>
                <div className="stat-value">{suggestedPrizeCoins} 🪙 + {form.prizeGems} 💎</div>
                <div className="stat-hint">{t('tournament.fees.totalHint')}</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="tournament-actions">
        <div>
          <div className="card-subtext">{t('tournament.actions.checkHint')}</div>
        </div>
        <div className="actions-right">
          {createdTournament && (
            <button className="pill accent" onClick={copyInvite}>{t('tournament.actions.copyLink')}</button>
          )}
          <button className="ghost-btn" onClick={() => { window.location.hash = '#home' }}>{t('tournament.actions.cancel')}</button>
          <button className="cta-primary" onClick={handleCreateTournament} disabled={creating}>
            {creating ? t('tournament.actions.creating') : t('tournament.actions.save')}
          </button>
        </div>
      </div>

      {createdTournament && (
        <div className="tournament-success glass-card">
          <div>
            <div className="eyebrow">{t('tournament.success.title')}</div>
            <h3>{createdTournament.tournament_name}</h3>
            <p>{t('tournament.success.code')}: <strong>{createdTournament.tournament_code}</strong> • {t('tournament.success.slots')}: {createdTournament.min_players}–{createdTournament.max_players}</p>
            <p>{t('tournament.success.regEnd')}: {createdTournament.registration_end ? new Date(createdTournament.registration_end).toLocaleString() : t('tournament.success.notSet')}</p>
          </div>
          <div className="success-actions">
            <button className="pill accent" onClick={copyInvite}>{t('tournament.actions.copyLink')}</button>
            <button className="pill ghost" onClick={() => { window.location.hash = '#events' }}>{t('tournament.success.viewEvents')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
