import React from 'react'

type Level = 1 | 2 | 3

type ProgressiveAnalysisViewProps = {
  level: Level
  summary: React.ReactNode
  details: React.ReactNode
  expert: React.ReactNode
  onLevelChange?: (level: Level) => void
}

const levelLabels: Record<Level, string> = {
  1: 'Tóm tắt',
  2: 'Chi tiết',
  3: 'Chuyên sâu'
}

export const ProgressiveAnalysisView: React.FC<ProgressiveAnalysisViewProps> = ({
  level,
  summary,
  details,
  expert,
  onLevelChange
}) => {
  const renderSection = () => {
    if (level === 1) return summary
    if (level === 2) return details
    return expert
  }

  return (
    <div className='progressive-analysis'>
      <div className='level-selector'>
        {(Object.keys(levelLabels) as unknown as Level[]).map(lv => (
          <button
            key={lv}
            className={lv === level ? 'active' : ''}
            onClick={() => onLevelChange?.(lv)}
          >
            {levelLabels[lv]}
          </button>
        ))}
      </div>
      <div className='level-content'>
        {renderSection()}
      </div>
      <style jsx>{`
        .progressive-analysis {
          background: linear-gradient(135deg, #0f172a, #1e293b);
          color: #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }
        .level-selector {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        button {
          border: 1px solid #334155;
          background: transparent;
          color: inherit;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
        }
        button.active {
          background: #22d3ee;
          color: #0f172a;
          border-color: #22d3ee;
        }
        .level-content {
          min-height: 80px;
        }
      `}</style>
    </div>
  )
}

export default ProgressiveAnalysisView
