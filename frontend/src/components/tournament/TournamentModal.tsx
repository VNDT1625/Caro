import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../contexts/LanguageContext'

// Inline translations for tournament modal
const translations: Record<string, Record<string, string>> = {
  vi: {
    'tournamentModal.title': 'Vạn Môn Tranh Đấu',
    'tournamentModal.subtitle': 'Tham gia giải đấu, tranh tài cùng cao thủ',
    'tournamentModal.tabs.list': 'Giải Đang Mở',
    'tournamentModal.tabs.search': 'Tìm Theo Mã',
    'tournamentModal.tabs.create': 'Tạo Giải',
    'tournamentModal.tabs.mine': 'Giải Của Tôi',
    'tournamentModal.noTournaments': 'Chưa có giải đấu nào đang mở',
    'tournamentModal.createFirst': 'Tạo giải đầu tiên',
    'tournamentModal.search.placeholder': 'Nhập mã giải (VD: MPT-XXXXX)',
    'tournamentModal.search.button': 'Tìm',
    'tournamentModal.search.emptyCode': 'Vui lòng nhập mã giải',
    'tournamentModal.search.notFound': 'Không tìm thấy giải với mã này',
    'tournamentModal.search.error': 'Lỗi khi tìm kiếm',
    'tournamentModal.search.hint': 'Nhập mã giải để tìm và tham gia',
    'tournamentModal.status.registration': 'Đang đăng ký',
    'tournamentModal.status.inProgress': 'Đang diễn ra',
    'tournamentModal.status.completed': 'Đã kết thúc',
    'tournamentModal.status.cancelled': 'Đã hủy',
    'tournamentModal.players': 'người chơi',
    'tournamentModal.format': 'Thể thức',
    'tournamentModal.prize': 'Giải thưởng',
    'tournamentModal.entry': 'Phí vào',
    'tournamentModal.regEnd': 'Hết đăng ký',
    'tournamentModal.start': 'Bắt đầu',
    'tournamentModal.viewDetails': 'Xem chi tiết',
    'tournamentModal.join': 'Tham gia',
    'tournamentModal.loginRequired': 'Vui lòng đăng nhập để tham gia',
    'tournamentModal.full': 'Giải đã đủ người',
    'tournamentModal.alreadyJoined': 'Bạn đã đăng ký giải này',
    'tournamentModal.notEnoughFunds': 'Không đủ tiền để đăng ký',
    'tournamentModal.joinSuccess': 'Đăng ký thành công!',
    'tournamentModal.joinError': 'Lỗi khi đăng ký',
    'tournamentModal.mine.noTournaments': 'Bạn chưa tham gia hoặc tạo giải nào',
    'tournamentModal.mine.created': 'Giải tôi tạo',
    'tournamentModal.mine.joined': 'Giải tôi tham gia',
    'tournamentModal.mine.delete': 'Xóa giải',
    'tournamentModal.mine.leave': 'Rời giải',
    'tournamentModal.mine.deleteConfirm': 'Bạn có chắc muốn xóa giải này?',
    'tournamentModal.mine.leaveConfirm': 'Bạn có chắc muốn rời giải này?',
    'tournamentModal.mine.cannotDelete': 'Không thể xóa giải đã có người tham gia',
    'tournamentModal.mine.scheduleConflict': 'Trùng lịch với giải khác',
    'tournamentModal.mine.timeline': 'Lịch thi đấu'
  },
  en: {
    'tournamentModal.title': 'Tournament Arena',
    'tournamentModal.subtitle': 'Join tournaments, compete with masters',
    'tournamentModal.tabs.list': 'Open Tournaments',
    'tournamentModal.tabs.search': 'Search by Code',
    'tournamentModal.tabs.create': 'Create',
    'tournamentModal.tabs.mine': 'My Tournaments',
    'tournamentModal.noTournaments': 'No open tournaments',
    'tournamentModal.createFirst': 'Create the first one',
    'tournamentModal.search.placeholder': 'Enter code (e.g. MPT-XXXXX)',
    'tournamentModal.search.button': 'Search',
    'tournamentModal.search.emptyCode': 'Please enter tournament code',
    'tournamentModal.search.notFound': 'Tournament not found',
    'tournamentModal.search.error': 'Search error',
    'tournamentModal.search.hint': 'Enter tournament code to find and join',
    'tournamentModal.status.registration': 'Registration',
    'tournamentModal.status.inProgress': 'In Progress',
    'tournamentModal.status.completed': 'Completed',
    'tournamentModal.status.cancelled': 'Cancelled',
    'tournamentModal.players': 'players',
    'tournamentModal.format': 'Format',
    'tournamentModal.prize': 'Prize',
    'tournamentModal.entry': 'Entry',
    'tournamentModal.regEnd': 'Reg. ends',
    'tournamentModal.start': 'Starts',
    'tournamentModal.viewDetails': 'View Details',
    'tournamentModal.join': 'Join',
    'tournamentModal.loginRequired': 'Please login to join',
    'tournamentModal.full': 'Tournament is full',
    'tournamentModal.alreadyJoined': 'You already registered',
    'tournamentModal.notEnoughFunds': 'Not enough funds',
    'tournamentModal.joinSuccess': 'Registration successful!',
    'tournamentModal.joinError': 'Registration error',
    'tournamentModal.mine.noTournaments': 'You have not joined or created any tournaments',
    'tournamentModal.mine.created': 'Created by me',
    'tournamentModal.mine.joined': 'Joined',
    'tournamentModal.mine.delete': 'Delete',
    'tournamentModal.mine.leave': 'Leave',
    'tournamentModal.mine.deleteConfirm': 'Are you sure you want to delete this tournament?',
    'tournamentModal.mine.leaveConfirm': 'Are you sure you want to leave this tournament?',
    'tournamentModal.mine.cannotDelete': 'Cannot delete tournament with participants',
    'tournamentModal.mine.scheduleConflict': 'Schedule conflict with another tournament',
    'tournamentModal.mine.timeline': 'Schedule'
  }
}

interface Tournament {
  id: string
  tournament_code: string
  tournament_name: string
  description: string | null
  creator_user_id: string
  format: string
  status: string
  min_players: number
  max_players: number
  current_players: number
  board_size: number
  win_length: number
  time_per_move: number
  entry_fee_coins: number
  entry_fee_gems: number
  prize_pool_coins: number
  prize_pool_gems: number
  registration_start: string | null
  registration_end: string | null
  tournament_start: string | null
  is_public: boolean
  cover_image_url: string | null
  created_at: string
  creator_profile?: {
    username: string
    display_name: string
    avatar_url: string
  }
}

interface TournamentModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

type TabType = 'list' | 'search' | 'create' | 'mine'

interface MyTournamentEntry {
  tournament: Tournament
  role: 'creator' | 'participant'
  participantStatus?: string
}

export default function TournamentModal({ isOpen, onClose, user }: TournamentModalProps) {
  const { t: globalT, language } = useLanguage()
  
  // Use local translations with fallback to global
  const t = (key: string) => {
    const lang = language || 'vi'
    return translations[lang]?.[key] || translations['vi']?.[key] || globalT(key) || key
  }
  const [activeTab, setActiveTab] = useState<TabType>('list')
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(false)
  const [searchCode, setSearchCode] = useState('')
  const [searchResult, setSearchResult] = useState<Tournament | null>(null)
  const [searchError, setSearchError] = useState('')
  const [joining, setJoining] = useState<string | null>(null)
  
  // My tournaments state
  const [myTournaments, setMyTournaments] = useState<MyTournamentEntry[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  // Load public tournaments
  const loadTournaments = useCallback(async () => {
    setLoading(true)
    try {
      // First try simple query without join
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_public', true)
        .in('status', ['registration', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Load tournaments error:', error)
        // Table might not exist
        if (error.message?.includes('does not exist')) {
          console.warn('tournaments table does not exist. Please run migration.')
        }
        setTournaments([])
        return
      }
      
      console.log('Loaded tournaments:', data?.length || 0)
      setTournaments(data || [])
    } catch (err) {
      console.error('Load tournaments error:', err)
      setTournaments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && activeTab === 'list') {
      loadTournaments()
    }
    if (isOpen && activeTab === 'mine' && user?.id) {
      loadMyTournaments()
    }
  }, [isOpen, activeTab, loadTournaments, user?.id])

  // Load my tournaments (created + joined)
  const loadMyTournaments = useCallback(async () => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const entries: MyTournamentEntry[] = []
      
      // Load tournaments I created
      const { data: created } = await supabase
        .from('tournaments')
        .select('*')
        .eq('creator_user_id', user.id)
        .order('created_at', { ascending: false })

      if (created) {
        created.forEach(t => entries.push({ tournament: t, role: 'creator' }))
      }

      // Load tournaments I joined (but didn't create)
      const { data: participations } = await supabase
        .from('tournament_participants')
        .select('tournament_id, status')
        .eq('user_id', user.id)

      if (participations && participations.length > 0) {
        const joinedIds = participations
          .map(p => p.tournament_id)
          .filter(id => !created?.some(c => c.id === id))

        if (joinedIds.length > 0) {
          const { data: joined } = await supabase
            .from('tournaments')
            .select('*')
            .in('id', joinedIds)

          if (joined) {
            joined.forEach(t => {
              const p = participations.find(pp => pp.tournament_id === t.id)
              entries.push({ 
                tournament: t, 
                role: 'participant',
                participantStatus: p?.status 
              })
            })
          }
        }
      }

      // Sort by tournament_start date
      entries.sort((a, b) => {
        const dateA = a.tournament.tournament_start ? new Date(a.tournament.tournament_start).getTime() : 0
        const dateB = b.tournament.tournament_start ? new Date(b.tournament.tournament_start).getTime() : 0
        return dateA - dateB
      })

      setMyTournaments(entries)
    } catch (err) {
      console.error('Load my tournaments error:', err)
      setMyTournaments([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // Check schedule conflict
  const hasScheduleConflict = (tournament: Tournament): Tournament | null => {
    if (!tournament.tournament_start) return null
    
    const startTime = new Date(tournament.tournament_start).getTime()
    const duration = 3 * 60 * 60 * 1000 // Assume 3 hours per tournament
    
    for (const entry of myTournaments) {
      if (entry.tournament.id === tournament.id) continue
      if (!entry.tournament.tournament_start) continue
      if (entry.tournament.status === 'completed' || entry.tournament.status === 'cancelled') continue
      
      const otherStart = new Date(entry.tournament.tournament_start).getTime()
      // Check if times overlap (within 3 hours of each other)
      if (Math.abs(startTime - otherStart) < duration) {
        return entry.tournament
      }
    }
    return null
  }

  // Delete tournament (only if creator and no participants)
  const handleDeleteTournament = async (tournament: Tournament) => {
    if (!user?.id || tournament.creator_user_id !== user.id) {
      console.log('Cannot delete: not creator', { userId: user?.id, creatorId: tournament.creator_user_id })
      return
    }
    
    if (!confirm(t('tournamentModal.mine.deleteConfirm'))) return
    
    // Check if has participants
    if (tournament.current_players > 0) {
      alert(t('tournamentModal.mine.cannotDelete'))
      return
    }
    
    setDeleting(tournament.id)
    try {
      console.log('Deleting tournament:', tournament.id)
      
      const { error, count } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id)
        .eq('creator_user_id', user.id)
        .select()

      console.log('Delete result:', { error, count })

      if (error) {
        console.error('Delete error:', error)
        // Check for RLS error
        if (error.code === '42501' || error.message?.includes('policy')) {
          alert('Không có quyền xóa. Vui lòng chạy migration: 20251209_000050_add_tournament_delete_policies.sql')
        } else {
          alert('Lỗi: ' + error.message)
        }
        return
      }
      
      alert('Đã xóa giải thành công!')
      loadMyTournaments()
    } catch (err: any) {
      console.error('Delete tournament error:', err)
      alert('Lỗi khi xóa giải: ' + (err?.message || 'Unknown error'))
    } finally {
      setDeleting(null)
    }
  }

  // Leave tournament
  const handleLeaveTournament = async (tournament: Tournament) => {
    if (!user?.id) return
    
    if (!confirm(t('tournamentModal.mine.leaveConfirm'))) return
    
    setDeleting(tournament.id)
    try {
      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)

      if (error) throw error
      
      loadMyTournaments()
    } catch (err) {
      console.error('Leave tournament error:', err)
      alert('Lỗi khi rời giải')
    } finally {
      setDeleting(null)
    }
  }

  // Search tournament by code
  const handleSearch = async () => {
    if (!searchCode.trim()) {
      setSearchError(t('tournamentModal.search.emptyCode'))
      return
    }

    setLoading(true)
    setSearchError('')
    setSearchResult(null)

    try {
      console.log('Searching for tournament code:', searchCode.trim().toUpperCase())
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('tournament_code', searchCode.trim().toUpperCase())
        .maybeSingle()

      console.log('Search result:', { data, error })

      if (error) {
        console.error('Search error:', error)
        if (error.message?.includes('does not exist')) {
          setSearchError('Bảng tournaments chưa được tạo')
        } else {
          setSearchError(t('tournamentModal.search.error'))
        }
        return
      }

      if (!data) {
        setSearchError(t('tournamentModal.search.notFound'))
        return
      }

      setSearchResult(data)
    } catch (err) {
      console.error('Search exception:', err)
      setSearchError(t('tournamentModal.search.error'))
    } finally {
      setLoading(false)
    }
  }

  // Join tournament
  const handleJoin = async (tournament: Tournament) => {
    if (!user?.id) {
      alert(t('tournamentModal.loginRequired'))
      return
    }

    if (tournament.current_players >= tournament.max_players) {
      alert(t('tournamentModal.full'))
      return
    }

    setJoining(tournament.id)
    try {
      // Check if already registered
      const { data: existing } = await supabase
        .from('tournament_participants')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        alert(t('tournamentModal.alreadyJoined'))
        setJoining(null)
        return
      }

      // Deduct entry fee if any
      if (tournament.entry_fee_coins > 0 || tournament.entry_fee_gems > 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('coins, gems')
          .eq('user_id', user.id)
          .single()

        if (!profile || profile.coins < tournament.entry_fee_coins || profile.gems < tournament.entry_fee_gems) {
          alert(t('tournamentModal.notEnoughFunds'))
          setJoining(null)
          return
        }

        // Deduct fees
        await supabase
          .from('profiles')
          .update({
            coins: profile.coins - tournament.entry_fee_coins,
            gems: profile.gems - tournament.entry_fee_gems
          })
          .eq('user_id', user.id)
      }

      // Register participant
      const { error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          user_id: user.id,
          status: 'registered'
        })

      if (error) throw error

      alert(t('tournamentModal.joinSuccess'))
      loadTournaments()
    } catch (err) {
      console.error('Join tournament error:', err)
      alert(t('tournamentModal.joinError'))
    } finally {
      setJoining(null)
    }
  }

  // Navigate to create tournament page
  const handleCreateClick = () => {
    onClose()
    window.location.hash = '#tournament'
  }

  // Navigate to tournament detail
  const handleViewTournament = (tournament: Tournament) => {
    onClose()
    window.location.hash = `#tournament?code=${tournament.tournament_code}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      registration: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22C55E', label: t('tournamentModal.status.registration') },
      in_progress: { bg: 'rgba(251, 191, 36, 0.2)', color: '#FBBF24', label: t('tournamentModal.status.inProgress') },
      completed: { bg: 'rgba(148, 163, 184, 0.2)', color: '#94A3B8', label: t('tournamentModal.status.completed') },
      cancelled: { bg: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', label: t('tournamentModal.status.cancelled') }
    }
    const s = styles[status] || styles.registration
    return (
      <span style={{ 
        padding: '4px 10px', 
        borderRadius: '12px', 
        fontSize: '11px', 
        fontWeight: 600,
        background: s.bg,
        color: s.color
      }}>
        {s.label}
      </span>
    )
  }

  if (!isOpen) return null

  return (
    <div 
      className="tournament-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div 
        className="tournament-modal glass-card"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '85vh',
          overflow: 'hidden',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>⚔️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#FBBF24' }}>
                {t('tournamentModal.title')}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#94A3B8' }}>
                {t('tournamentModal.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94A3B8',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '12px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.2)',
          overflowX: 'auto'
        }}>
          {[
            { key: 'list', icon: '📋', label: t('tournamentModal.tabs.list') },
            { key: 'mine', icon: '👤', label: t('tournamentModal.tabs.mine') },
            { key: 'search', icon: '🔍', label: t('tournamentModal.tabs.search') },
            { key: 'create', icon: '➕', label: t('tournamentModal.tabs.create') }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => tab.key === 'create' ? handleCreateClick() : setActiveTab(tab.key as TabType)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === tab.key 
                  ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%)'
                  : 'transparent',
                color: activeTab === tab.key ? '#FBBF24' : '#94A3B8',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                minWidth: 'fit-content'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ 
          padding: '20px 24px', 
          overflowY: 'auto', 
          maxHeight: 'calc(85vh - 180px)' 
        }}>
          {/* List Tab */}
          {activeTab === 'list' && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                  {t('common.loading')}
                </div>
              ) : tournaments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
                  <p style={{ color: '#94A3B8', marginBottom: '16px' }}>
                    {t('tournamentModal.noTournaments')}
                  </p>
                  <button
                    onClick={handleCreateClick}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                      color: '#0F172A',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {t('tournamentModal.createFirst')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {tournaments.map(tournament => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                      onJoin={() => handleJoin(tournament)}
                      onView={() => handleViewTournament(tournament)}
                      joining={joining === tournament.id}
                      formatDate={formatDate}
                      getStatusBadge={getStatusBadge}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div>
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginBottom: '20px' 
              }}>
                <input
                  type="text"
                  value={searchCode}
                  onChange={e => setSearchCode(e.target.value.toUpperCase())}
                  placeholder={t('tournamentModal.search.placeholder')}
                  onKeyPress={e => e.key === 'Enter' && handleSearch()}
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '16px',
                    fontFamily: 'monospace',
                    letterSpacing: '2px',
                    textTransform: 'uppercase'
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  style={{
                    padding: '14px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                    color: '#0F172A',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? '...' : t('tournamentModal.search.button')}
                </button>
              </div>

              {searchError && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  textAlign: 'center'
                }}>
                  {searchError}
                </div>
              )}

              {searchResult && (
                <TournamentCard
                  tournament={searchResult}
                  onJoin={() => handleJoin(searchResult)}
                  onView={() => handleViewTournament(searchResult)}
                  joining={joining === searchResult.id}
                  formatDate={formatDate}
                  getStatusBadge={getStatusBadge}
                  t={t}
                  expanded
                />
              )}

              {!searchResult && !searchError && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                  <p>{t('tournamentModal.search.hint')}</p>
                </div>
              )}
            </div>
          )}

          {/* My Tournaments Tab */}
          {activeTab === 'mine' && (
            <div>
              {!user?.id ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                  <p>{t('tournamentModal.loginRequired')}</p>
                </div>
              ) : loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                  {t('common.loading')}
                </div>
              ) : myTournaments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
                  <p style={{ color: '#94A3B8', marginBottom: '16px' }}>
                    {t('tournamentModal.mine.noTournaments')}
                  </p>
                  <button
                    onClick={handleCreateClick}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                      color: '#0F172A',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {t('tournamentModal.tabs.create')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {myTournaments.map(entry => {
                    const conflict = hasScheduleConflict(entry.tournament)
                    return (
                      <div 
                        key={entry.tournament.id}
                        style={{
                          padding: '16px',
                          borderRadius: '14px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: conflict ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)'
                        }}
                      >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                              <h3 style={{ 
                                margin: 0, 
                                fontSize: '15px', 
                                fontWeight: 600, 
                                color: '#F8FAFC',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '250px'
                              }}>
                                {entry.tournament.tournament_name}
                              </h3>
                              {getStatusBadge(entry.tournament.status)}
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '8px',
                                fontSize: '10px',
                                fontWeight: 600,
                                background: entry.role === 'creator' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(34, 211, 238, 0.2)',
                                color: entry.role === 'creator' ? '#8B5CF6' : '#22D3EE'
                              }}>
                                {entry.role === 'creator' ? t('tournamentModal.mine.created') : t('tournamentModal.mine.joined')}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>
                              #{entry.tournament.tournament_code}
                            </div>
                          </div>
                        </div>

                        {/* Schedule Info */}
                        <div style={{ 
                          display: 'flex', 
                          gap: '16px', 
                          fontSize: '12px', 
                          color: '#94A3B8',
                          marginBottom: '12px',
                          padding: '10px',
                          borderRadius: '8px',
                          background: 'rgba(0, 0, 0, 0.2)'
                        }}>
                          <span>📅 {t('tournamentModal.start')}: {formatDate(entry.tournament.tournament_start)}</span>
                          <span>👥 {entry.tournament.current_players}/{entry.tournament.max_players}</span>
                          <span>🏆 {entry.tournament.prize_pool_coins} 🪙</span>
                        </div>

                        {/* Conflict Warning */}
                        {conflict && (
                          <div style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#EF4444',
                            fontSize: '12px',
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            ⚠️ {t('tournamentModal.mine.scheduleConflict')}: {conflict.tournament_name}
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => handleViewTournament(entry.tournament)}
                            style={{
                              flex: 1,
                              padding: '10px 16px',
                              borderRadius: '10px',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              background: 'transparent',
                              color: '#F8FAFC',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {t('tournamentModal.viewDetails')}
                          </button>
                          
                          {entry.role === 'creator' && entry.tournament.current_players === 0 && entry.tournament.status !== 'completed' && (
                            <button
                              onClick={() => handleDeleteTournament(entry.tournament)}
                              disabled={deleting === entry.tournament.id}
                              style={{
                                padding: '10px 16px',
                                borderRadius: '10px',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#EF4444',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: deleting === entry.tournament.id ? 'not-allowed' : 'pointer',
                                opacity: deleting === entry.tournament.id ? 0.5 : 1
                              }}
                            >
                              {deleting === entry.tournament.id ? '...' : t('tournamentModal.mine.delete')}
                            </button>
                          )}
                          
                          {entry.role === 'participant' && entry.tournament.status === 'registration' && (
                            <button
                              onClick={() => handleLeaveTournament(entry.tournament)}
                              disabled={deleting === entry.tournament.id}
                              style={{
                                padding: '10px 16px',
                                borderRadius: '10px',
                                border: '1px solid rgba(251, 191, 36, 0.3)',
                                background: 'rgba(251, 191, 36, 0.1)',
                                color: '#FBBF24',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: deleting === entry.tournament.id ? 'not-allowed' : 'pointer',
                                opacity: deleting === entry.tournament.id ? 0.5 : 1
                              }}
                            >
                              {deleting === entry.tournament.id ? '...' : t('tournamentModal.mine.leave')}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// Tournament Card Component
interface TournamentCardProps {
  tournament: Tournament
  onJoin: () => void
  onView: () => void
  joining: boolean
  formatDate: (date: string | null) => string
  getStatusBadge: (status: string) => React.ReactNode
  t: (key: string) => string
  expanded?: boolean
}

function TournamentCard({ 
  tournament, 
  onJoin, 
  onView, 
  joining, 
  formatDate, 
  getStatusBadge,
  t,
  expanded 
}: TournamentCardProps) {
  const canJoin = tournament.status === 'registration' && 
                  tournament.current_players < tournament.max_players

  const formatLabel = {
    single_elimination: 'Loại trực tiếp',
    double_elimination: 'Loại kép',
    round_robin: 'Vòng tròn',
    swiss: 'Swiss'
  }[tournament.format] || tournament.format

  return (
    <div style={{
      padding: '16px',
      borderRadius: '14px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      transition: 'all 0.2s'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h3 style={{ 
              margin: 0, 
              fontSize: '16px', 
              fontWeight: 600, 
              color: '#F8FAFC',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '300px'
            }}>
              {tournament.tournament_name}
            </h3>
            {getStatusBadge(tournament.status)}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#64748B',
            fontFamily: 'monospace',
            letterSpacing: '1px'
          }}>
            #{tournament.tournament_code}
          </div>
        </div>
        <div style={{ 
          textAlign: 'right',
          fontSize: '13px',
          color: '#94A3B8'
        }}>
          <div style={{ fontWeight: 600, color: '#22D3EE' }}>
            {tournament.current_players}/{tournament.max_players}
          </div>
          <div style={{ fontSize: '11px' }}>{t('tournamentModal.players')}</div>
        </div>
      </div>

      {/* Info Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '12px',
        marginBottom: '12px',
        padding: '12px',
        borderRadius: '10px',
        background: 'rgba(0, 0, 0, 0.2)'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '2px' }}>
            {t('tournamentModal.format')}
          </div>
          <div style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500 }}>
            {formatLabel}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '2px' }}>
            {t('tournamentModal.prize')}
          </div>
          <div style={{ fontSize: '13px', color: '#FBBF24', fontWeight: 600 }}>
            {tournament.prize_pool_coins > 0 && `${tournament.prize_pool_coins} 🪙`}
            {tournament.prize_pool_gems > 0 && ` ${tournament.prize_pool_gems} 💎`}
            {tournament.prize_pool_coins === 0 && tournament.prize_pool_gems === 0 && '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '2px' }}>
            {t('tournamentModal.entry')}
          </div>
          <div style={{ fontSize: '13px', color: '#F8FAFC' }}>
            {tournament.entry_fee_coins === 0 && tournament.entry_fee_gems === 0 
              ? t('common.free')
              : `${tournament.entry_fee_coins} 🪙`
            }
          </div>
        </div>
      </div>

      {expanded && tournament.description && (
        <p style={{ 
          fontSize: '13px', 
          color: '#94A3B8', 
          margin: '0 0 12px',
          lineHeight: 1.5
        }}>
          {tournament.description}
        </p>
      )}

      {/* Time Info */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        fontSize: '12px', 
        color: '#64748B',
        marginBottom: '14px'
      }}>
        <span>📅 {t('tournamentModal.regEnd')}: {formatDate(tournament.registration_end)}</span>
        <span>🎮 {t('tournamentModal.start')}: {formatDate(tournament.tournament_start)}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onView}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'transparent',
            color: '#F8FAFC',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {t('tournamentModal.viewDetails')}
        </button>
        {canJoin && (
          <button
            onClick={onJoin}
            disabled={joining}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: joining 
                ? 'rgba(251, 191, 36, 0.3)'
                : 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 600,
              cursor: joining ? 'not-allowed' : 'pointer'
            }}
          >
            {joining ? t('common.loading') : t('tournamentModal.join')}
          </button>
        )}
      </div>
    </div>
  )
}
