/**
 * MatchListSidebar - Left sidebar showing list of matches
 * 
 * Features:
 * - Search input for filtering matches
 * - Match list with virtual scroll support
 * - Match selection with highlight
 * - Match info display (type, result, date, moves)
 * - Show opponent name for each match
 * - Show "Analyzed" badge for cached analyses
 * - Highlight currently selected match
 * 
 * Requirements: 10.1, 10.2, 16.2, 16.3 (memoization)
 */

import React, { useState, useMemo, memo, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

interface MatchRow {
  id: string
  created_at?: string
  ended_at?: string
  match_type?: string
  result?: string
  total_moves?: number
  is_ai_match?: boolean
  ai_difficulty?: string | null
  player_x_user_id?: string | null
  player_o_user_id?: string | null
  player_x_username?: string | null
  player_o_username?: string | null
}

interface MatchListSidebarProps {
  matches: MatchRow[]
  selectedMatchId: string | null
  loading: boolean
  onSelectMatch: (id: string) => void
  currentUserId?: string | null
  analyzedMatchIds?: Set<string>  // Set of match IDs that have been analyzed (cached)
}

// Memoized match item component for better performance
const MatchItem = memo(function MatchItem({
  match,
  isSelected,
  isAnalyzed,
  opponentName,
  userResult,
  onSelect,
  formatType,
  formatResult,
  formatDate,
  getResultColor
}: {
  match: MatchRow
  isSelected: boolean
  isAnalyzed: boolean
  opponentName: string
  userResult: 'win' | 'loss' | 'draw' | 'playing' | null
  onSelect: (id: string) => void
  formatType: (type?: string, isAi?: boolean, aiDiff?: string | null) => string
  formatResult: (result?: string) => string
  formatDate: (value?: string) => string
  getResultColor: (result?: string) => string
}) {
  const handleClick = useCallback(() => onSelect(match.id), [onSelect, match.id])
  
  // Get user result color
  const getUserResultColor = () => {
    switch (userResult) {
      case 'win': return '#22C55E'
      case 'loss': return '#EF4444'
      case 'draw': return '#94A3B8'
      default: return '#38BDF8'
    }
  }
  
  const getUserResultLabel = () => {
    switch (userResult) {
      case 'win': return '🏆 Thắng'
      case 'loss': return '💔 Thua'
      case 'draw': return '🤝 Hòa'
      default: return '⏳ Đang chơi'
    }
  }
  
  return (
    <button
      onClick={handleClick}
      style={{
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: 8,
        border: '2px solid',
        borderColor: isSelected 
          ? 'rgba(56,189,248,0.8)' 
          : 'rgba(71,85,105,0.3)',
        background: isSelected 
          ? 'rgba(56,189,248,0.2)' 
          : 'rgba(30,41,59,0.4)',
        color: '#F1F5F9',
        cursor: 'pointer',
        transition: 'all 0.15s',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isSelected ? '0 4px 12px rgba(56,189,248,0.25)' : 'none',
        position: 'relative'
      }}
    >
      {/* Analyzed Badge - Requirements 16.2 */}
      {isAnalyzed && (
        <div style={{
          position: 'absolute',
          top: -6,
          right: -6,
          background: 'linear-gradient(135deg, #22C55E, #16A34A)',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: 4,
          boxShadow: '0 2px 6px rgba(34,197,94,0.4)'
        }}>
          ✓ Analyzed
        </div>
      )}
      
      {/* Match Type & User Result */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 6
      }}>
        <span style={{ fontSize: 12, fontWeight: 500 }}>
          {formatType(match.match_type, match.is_ai_match, match.ai_difficulty)}
        </span>
        <span style={{ 
          fontSize: 11, 
          fontWeight: 600,
          color: getUserResultColor(),
          background: `${getUserResultColor()}15`,
          padding: '2px 8px',
          borderRadius: 4
        }}>
          {getUserResultLabel()}
        </span>
      </div>

      {/* Opponent Name - Requirements 16.2 */}
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: '#E2E8F0',
        marginBottom: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}>
        <span style={{ color: '#94A3B8' }}>vs</span>
        <span>{opponentName}</span>
      </div>

      {/* Match Details: Date & Moves */}
      <div style={{ 
        fontSize: 11, 
        color: '#94A3B8',
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap'
      }}>
        <span>🕐 {formatDate(match.ended_at || match.created_at)}</span>
        {match.total_moves && <span>📊 {match.total_moves} nước</span>}
      </div>

      {/* Match ID (truncated) */}
      <div style={{ 
        fontSize: 10, 
        color: '#64748B',
        marginTop: 4,
        fontFamily: 'monospace'
      }}>
        ID: {match.id.slice(0, 8)}...
      </div>
    </button>
  )
})

// Memoized component to prevent unnecessary re-renders - Requirements 16.3
const MatchListSidebar = memo(function MatchListSidebar({
  matches,
  selectedMatchId,
  loading,
  onSelectMatch,
  currentUserId,
  analyzedMatchIds = new Set()
}: MatchListSidebarProps) {
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAiOnly, setFilterAiOnly] = useState(false)
  
  // Helper to get opponent name for a match - Requirements 16.2
  const getOpponentName = useCallback((match: MatchRow): string => {
    if (match.is_ai_match) {
      const aiMap: Record<string, string> = { 
        'nhap-mon': 'AI Nhập Môn',
        'ky-tai': 'AI Kỳ Tài',
        'nghich-thien': 'AI Nghịch Thiên',
        'thien-ton': 'AI Thiên Tôn',
        'hu-vo': 'AI Hư Vô'
      }
      return match.ai_difficulty ? (aiMap[match.ai_difficulty] || 'AI') : 'AI'
    }
    
    if (!currentUserId) {
      // No user logged in, show both players
      const xName = match.player_x_username || 'Người chơi X'
      const oName = match.player_o_username || 'Người chơi O'
      return `${xName} vs ${oName}`
    }
    
    // Determine opponent based on current user
    if (match.player_x_user_id === currentUserId) {
      return match.player_o_username || 'Đối thủ'
    } else if (match.player_o_user_id === currentUserId) {
      return match.player_x_username || 'Đối thủ'
    }
    
    // User is spectator
    const xName = match.player_x_username || 'X'
    const oName = match.player_o_username || 'O'
    return `${xName} vs ${oName}`
  }, [currentUserId])
  
  // Helper to get user's result in a match - Requirements 16.2
  const getUserResult = useCallback((match: MatchRow): 'win' | 'loss' | 'draw' | 'playing' | null => {
    if (!match.result || match.result === 'playing') return 'playing'
    if (match.result === 'draw') return 'draw'
    if (match.result === 'abandoned') return 'loss'
    
    if (!currentUserId) return null
    
    const isPlayerX = match.player_x_user_id === currentUserId
    const isPlayerO = match.player_o_user_id === currentUserId
    
    if (!isPlayerX && !isPlayerO) return null // Spectator
    
    if (match.result === 'win_x') {
      return isPlayerX ? 'win' : 'loss'
    } else if (match.result === 'win_o') {
      return isPlayerO ? 'win' : 'loss'
    }
    
    return null
  }, [currentUserId])

  const formatResult = (result?: string) => {
    switch (result) {
      case 'win_x': return 'X thắng'
      case 'win_o': return 'O thắng'
      case 'draw': return 'Hòa'
      case 'abandoned': return 'Bỏ trận'
      default: return 'Đang chơi'
    }
  }

  const formatType = (type?: string, isAi?: boolean, aiDiff?: string | null) => {
    if (isAi) {
      const aiMap: Record<string, string> = { 
        'nhap-mon': 'Nhập Môn',
        'ky-tai': 'Kỳ Tài',
        'nghich-thien': 'Nghịch Thiên',
        'thien-ton': 'Thiên Tôn',
        'hu-vo': 'Hư Vô'
      }
      return '🤖 ' + (aiDiff ? (aiMap[aiDiff] || aiDiff) : 'AI')
    }
    if (type === 'ranked') return '🏆 Xếp hạng'
    if (type === 'casual') return '🎮 Thường'
    return type || 'Casual'
  }

  const formatDate = (value?: string) => {
    if (!value) return '...'
    const date = new Date(value)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Vừa xong'
    if (diffMins < 60) return `${diffMins} phút trước`
    if (diffHours < 24) return `${diffHours} giờ trước`
    if (diffDays < 7) return `${diffDays} ngày trước`
    return date.toLocaleDateString('vi-VN')
  }

  const getResultColor = (result?: string) => {
    switch (result) {
      case 'win_x': return '#22C55E'
      case 'win_o': return '#F59E0B'
      case 'draw': return '#94A3B8'
      case 'abandoned': return '#EF4444'
      default: return '#38BDF8'
    }
  }

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (filterAiOnly && !m.is_ai_match) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return m.id.toLowerCase().includes(query) ||
               (m.match_type || '').toLowerCase().includes(query) ||
               (m.ai_difficulty || '').toLowerCase().includes(query)
      }
      return true
    })
  }, [matches, searchQuery, filterAiOnly])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(15,23,42,0.6)',
      borderRadius: 12,
      border: '1px solid rgba(71,85,105,0.35)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(71,85,105,0.3)',
        background: 'rgba(30,41,59,0.4)'
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: '#F1F5F9' }}>
          📋 {t('aiAnalysis.selectMatch')}
        </div>
        
        {/* Search Input */}
        <input
          type="text"
          placeholder={t('aiAnalysis.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid rgba(71,85,105,0.5)',
            background: 'rgba(15,23,42,0.7)',
            color: '#F1F5F9',
            fontSize: 13,
            outline: 'none'
          }}
        />

        {/* Filter Toggle */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 8,
          fontSize: 12,
          color: '#94A3B8',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={filterAiOnly}
            onChange={(e) => setFilterAiOnly(e.target.checked)}
            style={{ accentColor: '#38BDF8' }}
          />
          {t('aiAnalysis.filterAiOnly') || 'AI matches only'}
        </label>
      </div>

      {/* Match List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 8
      }}>
        {loading ? (
          <div style={{ 
            padding: 20, 
            textAlign: 'center', 
            color: '#94A3B8',
            fontSize: 13
          }}>
            {t('common.loading')}
          </div>
        ) : filteredMatches.length === 0 ? (
          <div style={{ 
            padding: 20, 
            textAlign: 'center', 
            color: '#64748B',
            fontSize: 13
          }}>
            {t('aiAnalysis.noMatchesFound') || 'No matches found'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredMatches.map(match => (
              <MatchItem
                key={match.id}
                match={match}
                isSelected={selectedMatchId === match.id}
                isAnalyzed={analyzedMatchIds.has(match.id)}
                opponentName={getOpponentName(match)}
                userResult={getUserResult(match)}
                onSelect={onSelectMatch}
                formatType={formatType}
                formatResult={formatResult}
                formatDate={formatDate}
                getResultColor={getResultColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div style={{
        padding: '8px 14px',
        borderTop: '1px solid rgba(71,85,105,0.3)',
        background: 'rgba(30,41,59,0.4)',
        fontSize: 11,
        color: '#64748B',
        textAlign: 'center'
      }}>
        {filteredMatches.length} / {matches.length} trận
      </div>
    </div>
  )
})

export default MatchListSidebar
