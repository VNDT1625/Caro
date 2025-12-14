import React, { useState } from 'react'

type WhatIfResult = {
  initial_score: number
  final_score: number
  evaluation_change: number
  opponent_response?: [number, number] | null
}

type WhatIfPanelProps = {
  onSimulate: (x: number, y: number) => Promise<WhatIfResult>
}

const WhatIfPanel: React.FC<WhatIfPanelProps> = ({ onSimulate }) => {
  const [x, setX] = useState(7)
  const [y, setY] = useState(7)
  const [result, setResult] = useState<WhatIfResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSimulate = async () => {
    setLoading(true)
    try {
      const res = await onSimulate(x, y)
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='what-if-panel'>
      <div className='inputs'>
        <label>
          X
          <input type='number' value={x} min={0} max={14} onChange={e => setX(Number(e.target.value))} />
        </label>
        <label>
          Y
          <input type='number' value={y} min={0} max={14} onChange={e => setY(Number(e.target.value))} />
        </label>
        <button onClick={handleSimulate} disabled={loading}>
          {loading ? 'Đang giả lập...' : 'Giả lập'}
        </button>
      </div>
      {result && (
        <div className='result'>
          <div>Điểm trước: {result.initial_score.toFixed(1)}</div>
          <div>Điểm sau: {result.final_score.toFixed(1)}</div>
          <div>Chênh lệch: {result.evaluation_change.toFixed(1)}</div>
          {result.opponent_response && (
            <div>Đối thủ đáp trả: ({result.opponent_response[0]}, {result.opponent_response[1]})</div>
          )}
        </div>
      )}
      <style jsx>{`
        .what-if-panel {
          border: 1px solid #334155;
          border-radius: 10px;
          padding: 12px;
          background: #0f172a;
          color: #e2e8f0;
        }
        .inputs {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        label {
          display: flex;
          flex-direction: column;
          font-size: 12px;
        }
        input {
          background: #1e293b;
          border: 1px solid #334155;
          color: inherit;
          padding: 4px 6px;
          border-radius: 6px;
        }
        button {
          background: #22d3ee;
          border: none;
          color: #0f172a;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
        }
        .result {
          margin-top: 10px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  )
}

export default WhatIfPanel
