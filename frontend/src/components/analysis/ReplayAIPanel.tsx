/**
 * ReplayAIPanel - Control panel for what-if mode in replay analysis
 * 
 * Features:
 * - Mode toggle (replay ↔ what-if)
 * - Difficulty selector
 * - Undo button
 * - Mode indicator
 * 
 * Requirements: 1.1, 1.2, 1.4, 6.1, 6.4, 7.1
 */

import { memo } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import type { Difficulty, ReplayMode } from '../../hooks/useReplayAI'

interface ReplayAIPanelProps {
  mode: ReplayMode
  difficulty: Difficulty
  canUndo: boolean
  loading: boolean
  aiThinking: boolean
  disabled?: boolean
  onEnterWhatIf: () => void
  onExitWhatIf: () => void
  onUndo: () => void
  onDifficultyChange: (d: Difficulty) => void
}

const ReplayAIPanel = memo(function ReplayAIPanel({
  mode,
  difficulty,
  canUndo,
  loading,
  aiThinking,
  disabled = false,
  onEnterWhatIf,
  onExitWhatIf,
  onUndo,
  onDifficultyChange
}: ReplayAIPanelProps) {
  const { t } = useLanguage()
  
  const isWhatIfMode = mode === 'what_if'
  
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      borderRadius: 12,
      border: '1px solid rgba(71,85,105,0.35)',
      padding: 14
    }}>
      {/* Header with mode indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
      }}>
        <div style={{
          fontWeight: 600,
          color: '#F1F5F9',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          🎮 {t('replay.aiMode') || 'Chế độ AI'}
        </div>
        
        {/* Mode indicator - Requirements 1.2 */}
        <div style={{
          fontSize: 11,
          padding: '4px 10px',
          borderRadius: 12,
          background: isWhatIfMode 
            ? 'rgba(34,197,94,0.15)' 
            : 'rgba(56,189,248,0.15)',
          color: isWhatIfMode ? '#22C55E' : '#38BDF8',
          fontWeight: 600
        }}>
          {isWhatIfMode 
            ? (t('replay.whatIfMode') || '🧪 Thử nghiệm')
            : (t('replay.replayMode') || '📺 Xem lại')
          }
        </div>
      </div>
      
      {/* Mode toggle button - Requirements 1.1, 1.4 */}
      <button
        onClick={isWhatIfMode ? onExitWhatIf : onEnterWhatIf}
        disabled={disabled || loading}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: 8,
          border: 'none',
          background: isWhatIfMode
            ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
            : 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
          color: '#FFFFFF',
          fontWeight: 600,
          fontSize: 13,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || loading ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'all 0.2s'
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: 14,
              height: 14,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#FFFFFF',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            {t('replay.loading') || 'Đang tải...'}
          </>
        ) : isWhatIfMode ? (
          <>
            ← {t('replay.exitWhatIf') || 'Quay lại xem'}
          </>
        ) : (
          <>
            🎯 {t('replay.enterWhatIf') || 'Thử đi nước khác'}
          </>
        )}
      </button>
      
      {/* What-if mode controls */}
      {isWhatIfMode && (
        <div style={{ marginTop: 12 }}>
          {/* Difficulty selector - Requirements 7.1 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              color: '#94A3B8',
              marginBottom: 6
            }}>
              {t('replay.difficulty') || 'Độ khó AI'}
            </label>
            <div style={{
              display: 'flex',
              gap: 6
            }}>
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => onDifficultyChange(d)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: difficulty === d 
                      ? '1px solid rgba(56,189,248,0.5)'
                      : '1px solid rgba(71,85,105,0.35)',
                    background: difficulty === d
                      ? 'rgba(56,189,248,0.15)'
                      : 'rgba(30,41,59,0.5)',
                    color: difficulty === d ? '#38BDF8' : '#94A3B8',
                    fontSize: 12,
                    fontWeight: difficulty === d ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {d === 'easy' && (t('replay.difficultyEasy') || '😊 Dễ')}
                  {d === 'medium' && (t('replay.difficultyMedium') || '🤔 TB')}
                  {d === 'hard' && (t('replay.difficultyHard') || '😈 Khó')}
                </button>
              ))}
            </div>
          </div>
          
          {/* Undo button - Requirements 6.1, 6.4 */}
          <button
            onClick={onUndo}
            disabled={!canUndo || loading}
            style={{
              width: '100%',
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid rgba(249,115,22,0.4)',
              background: canUndo ? 'rgba(249,115,22,0.12)' : 'rgba(51,65,85,0.3)',
              color: canUndo ? '#F97316' : '#64748B',
              fontWeight: 500,
              fontSize: 12,
              cursor: canUndo && !loading ? 'pointer' : 'not-allowed',
              opacity: canUndo ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.2s'
            }}
          >
            ↩️ {t('replay.undo') || 'Hoàn tác'}
          </button>
          
          {/* AI thinking indicator */}
          {aiThinking && (
            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#A5B4FC',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{
                width: 12,
                height: 12,
                border: '2px solid rgba(165,180,252,0.3)',
                borderTopColor: '#A5B4FC',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              {t('replay.aiThinking') || 'AI đang suy nghĩ...'}
            </div>
          )}
        </div>
      )}
      
      {/* Instructions */}
      {!isWhatIfMode && (
        <div style={{
          marginTop: 12,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(30,41,59,0.5)',
          color: '#94A3B8',
          fontSize: 11,
          lineHeight: 1.5
        }}>
          💡 {t('replay.instructions') || 'Nhấn "Thử đi nước khác" để vào chế độ thử nghiệm. Bạn có thể đi nước khác và xem AI phản hồi.'}
        </div>
      )}
    </div>
  )
})

export default ReplayAIPanel
