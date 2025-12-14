/**
 * ComparisonPanel - Display win probability comparison between original and alternative lines
 * 
 * Features:
 * - Original vs current win probability display
 * - Color coding (green/red/yellow)
 * - Vietnamese explanation for significant changes
 * - Divergence analysis details
 * 
 * Requirements: 3.1, 3.2, 3.4
 */

import { memo } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import type { DivergenceAnalysis } from '../../lib/replayApi'

interface ComparisonPanelProps {
  originalWinProb: number
  currentWinProb: number
  divergencePoint: number | null
  comparisonColor: 'green' | 'red' | 'yellow'
  explanation: string | null
  divergenceAnalysis?: DivergenceAnalysis | null
  loading?: boolean
  onAnalyze?: () => void
}

const ComparisonPanel = memo(function ComparisonPanel({
  originalWinProb,
  currentWinProb,
  divergencePoint,
  comparisonColor,
  explanation,
  divergenceAnalysis,
  loading = false,
  onAnalyze
}: ComparisonPanelProps) {
  const { t } = useLanguage()
  
  const diff = currentWinProb - originalWinProb
  const diffPercent = Math.round(Math.abs(diff) * 100)
  
  // Color mapping - Requirements 3.4
  const colorMap = {
    green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)', text: '#22C55E' },
    red: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', text: '#EF4444' },
    yellow: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)', text: '#FBBF24' }
  }
  
  const colors = colorMap[comparisonColor]
  
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      borderRadius: 12,
      border: '1px solid rgba(71,85,105,0.35)',
      padding: 14
    }}>
      {/* Header */}
      <div style={{
        fontWeight: 600,
        color: '#F1F5F9',
        fontSize: 14,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        📊 {t('replay.comparison') || 'So sánh'}
      </div>
      
      {/* Win probability comparison - Requirements 3.1 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: 8,
        alignItems: 'center',
        marginBottom: 12
      }}>
        {/* Original */}
        <div style={{
          textAlign: 'center',
          padding: '10px 8px',
          borderRadius: 8,
          background: 'rgba(30,41,59,0.5)'
        }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
            {t('replay.original') || 'Gốc'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9' }}>
            {Math.round(originalWinProb * 100)}%
          </div>
        </div>
        
        {/* Arrow with diff */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2
        }}>
          <div style={{
            fontSize: 16,
            color: colors.text
          }}>
            {diff > 0 ? '→' : diff < 0 ? '→' : '↔'}
          </div>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: colors.text,
            padding: '2px 6px',
            borderRadius: 4,
            background: colors.bg
          }}>
            {diff > 0 ? '+' : ''}{Math.round(diff * 100)}%
          </div>
        </div>
        
        {/* Current */}
        <div style={{
          textAlign: 'center',
          padding: '10px 8px',
          borderRadius: 8,
          background: colors.bg,
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
            {t('replay.current') || 'Hiện tại'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
            {Math.round(currentWinProb * 100)}%
          </div>
        </div>
      </div>
      
      {/* Explanation for significant changes - Requirements 3.2 */}
      {explanation && (
        <div style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          color: colors.text,
          fontSize: 12,
          lineHeight: 1.5,
          marginBottom: 12
        }}>
          {comparisonColor === 'green' && '✨ '}
          {comparisonColor === 'red' && '⚠️ '}
          {comparisonColor === 'yellow' && '↔️ '}
          {explanation}
        </div>
      )}
      
      {/* Divergence point info */}
      {divergencePoint !== null && (
        <div style={{
          padding: '8px 12px',
          borderRadius: 8,
          background: 'rgba(99,102,241,0.12)',
          border: '1px solid rgba(99,102,241,0.3)',
          color: '#A5B4FC',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12
        }}>
          🔀 {t('replay.divergenceAt') || 'Rẽ nhánh tại nước'} #{divergencePoint}
        </div>
      )}
      
      {/* Detailed analysis */}
      {divergenceAnalysis && (
        <div style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(30,41,59,0.5)',
          fontSize: 12,
          color: '#94A3B8',
          lineHeight: 1.6
        }}>
          <div style={{ fontWeight: 600, color: '#F1F5F9', marginBottom: 6 }}>
            📝 {t('replay.analysis') || 'Phân tích'}
          </div>
          {divergenceAnalysis.analysis}
        </div>
      )}
      
      {/* Analyze button */}
      {onAnalyze && !divergenceAnalysis && divergencePoint !== null && (
        <button
          onClick={onAnalyze}
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid rgba(99,102,241,0.4)',
            background: 'rgba(99,102,241,0.12)',
            color: '#A5B4FC',
            fontWeight: 500,
            fontSize: 12,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 12,
                height: 12,
                border: '2px solid rgba(165,180,252,0.3)',
                borderTopColor: '#A5B4FC',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              {t('replay.analyzing') || 'Đang phân tích...'}
            </>
          ) : (
            <>
              🔍 {t('replay.analyzeDetail') || 'Phân tích chi tiết'}
            </>
          )}
        </button>
      )}
      
      {/* Visual progress bar */}
      <div style={{ marginTop: 12 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#64748B',
          marginBottom: 4
        }}>
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <div style={{
          height: 8,
          borderRadius: 4,
          background: 'rgba(51,65,85,0.5)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Original marker */}
          <div style={{
            position: 'absolute',
            left: `${originalWinProb * 100}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: '#94A3B8',
            transform: 'translateX(-50%)'
          }} />
          
          {/* Current marker */}
          <div style={{
            position: 'absolute',
            left: `${currentWinProb * 100}%`,
            top: 0,
            bottom: 0,
            width: 4,
            background: colors.text,
            borderRadius: 2,
            transform: 'translateX(-50%)'
          }} />
          
          {/* Fill to current */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${currentWinProb * 100}%`,
            background: `linear-gradient(90deg, rgba(56,189,248,0.3) 0%, ${colors.bg} 100%)`,
            borderRadius: 4
          }} />
        </div>
      </div>
    </div>
  )
})

export default ComparisonPanel
