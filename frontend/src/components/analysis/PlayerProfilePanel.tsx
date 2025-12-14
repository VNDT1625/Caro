import React from 'react'

type PlayerProfile = {
  offense_defense_ratio: number
  favorite_patterns: string[]
  common_mistakes: string[]
  strengths: string[]
  weaknesses: string[]
  improvements: string[]
}

type Props = {
  profile: PlayerProfile
}

const PlayerProfilePanel: React.FC<Props> = ({ profile }) => {
  return (
    <div className='profile-panel'>
      <div className='ratio'>Tấn công/Phòng thủ: {profile.offense_defense_ratio.toFixed(2)}</div>
      <div className='chips'>
        {profile.strengths.map(item => <span key={item} className='chip positive'>{item}</span>)}
        {profile.weaknesses.map(item => <span key={item} className='chip negative'>{item}</span>)}
      </div>
      <div className='list'>
        <h4>Điểm cải thiện</h4>
        <ul>
          {profile.improvements.map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <style jsx>{`
        .profile-panel {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          border: 1px solid #334155;
        }
        .ratio {
          font-weight: 700;
          margin-bottom: 8px;
        }
        .chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .chip {
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
        }
        .positive {
          background: #22c55e;
          color: #0f172a;
        }
        .negative {
          background: #f97316;
          color: #0f172a;
        }
        .list ul {
          margin: 0;
          padding-left: 18px;
        }
      `}</style>
    </div>
  )
}

export default PlayerProfilePanel
