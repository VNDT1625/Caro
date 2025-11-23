import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Quest {
  id: number
  title: string
  desc: string
  coins: number
  gems: number
  tier: 'bronze' | 'silver' | 'gold'
  completed: boolean
  claimed: boolean
}

export default function Quests() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'achievement'>('daily')
  const [quests, setQuests] = useState<Quest[]>([])

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    try {
      const { data } = await supabase.auth.getUser()
      const u = data?.user ?? null
      setUser(u)
      
      if (u) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', u.id)
          .maybeSingle()
        
        if (prof) {
          setProfile(prof)
          loadQuests(prof)
        }
      }
    } catch (e) {
      console.error('Load user failed:', e)
    }
  }

  function loadQuests(prof: any) {
    const questProgress = prof.metadata?.quests || {}
    
    const dailyQuestList: Quest[] = [
      { id: 101, title: 'Chơi 1 trận xếp hạng', desc: 'Thử sức với MindPoint Arena', coins: 30, gems: 0, tier: 'bronze', completed: false, claimed: questProgress[101] || false },
      { id: 102, title: 'Thắng 1 trận bất kỳ', desc: 'Chứng tỏ kỹ năng của bạn', coins: 50, gems: 0, tier: 'bronze', completed: false, claimed: questProgress[102] || false },
      { id: 103, title: 'Chơi 3 trận trong ngày', desc: 'Rèn luyện thường xuyên', coins: 100, gems: 0, tier: 'silver', completed: false, claimed: questProgress[103] || false },
      { id: 104, title: 'Thắng 3 trận liên tiếp', desc: 'Thể hiện sự ổn định', coins: 200, gems: 5, tier: 'gold', completed: false, claimed: questProgress[104] || false }
    ]

    const weeklyQuestList: Quest[] = [
      { id: 201, title: 'Chơi 10 trận xếp hạng', desc: 'Kiên trì leo rank', coins: 200, gems: 0, tier: 'bronze', completed: false, claimed: questProgress[201] || false },
      { id: 202, title: 'Thắng 5 trận xếp hạng', desc: 'Chứng tỏ đẳng cấp', coins: 350, gems: 5, tier: 'silver', completed: false, claimed: questProgress[202] || false },
      { id: 203, title: 'Leo lên rank cao hơn', desc: 'Tiến bộ trong tuần này', coins: 500, gems: 10, tier: 'gold', completed: false, claimed: questProgress[203] || false }
    ]

    const achievementList: Quest[] = [
      { id: 301, title: '🏆 Thắng 50 trận', desc: 'Chiến thần bất bại', coins: 500, gems: 20, tier: 'gold', completed: false, claimed: questProgress[301] || false },
      { id: 302, title: '💎 Đạt rank Học Kỳ', desc: 'Bậc thầy caro', coins: 1000, gems: 50, tier: 'gold', completed: false, claimed: questProgress[302] || false },
      { id: 303, title: '⚔️ Chơi 100 trận', desc: 'Người không biết mệt', coins: 800, gems: 30, tier: 'gold', completed: false, claimed: questProgress[303] || false }
    ]

    const currentList = activeTab === 'daily' ? dailyQuestList : activeTab === 'weekly' ? weeklyQuestList : achievementList
    setQuests(currentList)
  }

  async function handleClaimQuest(quest: Quest) {
    if (!user || !profile) return
    if (quest.claimed) return

    try {
      // Update coins and gems
      const newCoins = (profile.coins || 0) + quest.coins
      const newGems = (profile.gems || 0) + quest.gems

      // Update quest progress
      const questProgress = profile.metadata?.quests || {}
      questProgress[quest.id] = true

      const newMetadata = {
        ...profile.metadata,
        quests: questProgress
      }

      await supabase
        .from('profiles')
        .update({ 
          coins: newCoins, 
          gems: newGems,
          metadata: newMetadata
        })
        .eq('user_id', user.id)

      setProfile({ ...profile, coins: newCoins, gems: newGems, metadata: newMetadata })
      
      // Update quest list
      setQuests(prev => prev.map(q => 
        q.id === quest.id ? { ...q, claimed: true } : q
      ))

      alert(`Đã nhận ${quest.coins} Coin${quest.gems > 0 ? ` và ${quest.gems} Gem` : ''}!`)
    } catch (e) {
      console.error('Claim quest failed:', e)
      alert('Lỗi khi nhận thưởng!')
    }
  }

  const mainStoryChapters = [
    {
      id: 1,
      title: 'Chương 1: Bước vào đạo caro',
      description: 'Hành trình ngàn dặm bắt đầu từ một nước đi',
      quests: [
        { id: 1, title: 'Hoàn thành hướng dẫn cơ bản', reward: 20 },
        { id: 2, title: 'Chơi 1 trận luyện tập với máy', reward: 30 },
        { id: 3, title: 'Thắng 1 trận với máy', reward: 50 }
      ],
      unlocked: true,
      icon: '📜'
    },
    {
      id: 2,
      title: 'Chương 2: Tân Kỳ Xuất Sơn',
      description: 'Rời khỏi sơn môn, thử sức với thiên hạ',
      quests: [
        { id: 4, title: 'Chơi 3 trận xếp hạng', reward: 50 },
        { id: 5, title: 'Thắng 1 trận xếp hạng', reward: 100 },
        { id: 6, title: 'Đạt rank Tân Kỳ', reward: 150 }
      ],
      unlocked: false,
      icon: '⚔️'
    },
    {
      id: 3,
      title: 'Chương 3: Học Kỳ Lập Tâm',
      description: 'Rèn luyện kỹ năng, nắm vững chiến thuật',
      quests: [
        { id: 7, title: 'Phân tích 3 ván đấu với AI', reward: 80 },
        { id: 8, title: 'Tạo 1 phòng riêng', reward: 60 },
        { id: 9, title: 'Đạt rank Học Kỳ', reward: 200 }
      ],
      unlocked: false,
      icon: '🧠'
    }
  ]

  const dailyQuests = [
    { id: 101, title: 'Chơi 1 trận xếp hạng', desc: 'Thử sức với MindPoint', reward: 10, completed: false },
    { id: 102, title: 'Thắng 1 trận bất kỳ', desc: 'Chứng tỏ kỹ năng của bạn', reward: 15, completed: false },
    { id: 103, title: 'Chơi 3 trận trong ngày', desc: 'Rèn luyện thường xuyên', reward: 20, completed: false },
    { id: 104, title: 'Mời 1 bạn bè chơi', desc: 'Chia sẻ niềm vui', reward: 10, completed: false }
  ]

  const weeklyQuests = [
    { id: 201, title: 'Chơi 10 trận xếp hạng', desc: 'Kiên trì leo rank', reward: 100, completed: false },
    { id: 202, title: 'Thắng 5 trận xếp hạng', desc: 'Chứng tỏ đẳng cấp', reward: 150, completed: false },
    { id: 203, title: 'Phân tích 3 ván với AI', desc: 'Học hỏi từ sai lầm', reward: 80, completed: false }
  ]

  const eventQuests = [
    { id: 301, title: '🎉 Sự kiện mùa xuân', desc: 'Thắng 3 trận trong sự kiện', reward: 200, completed: false },
    { id: 302, title: '🏆 Giải đấu cuối tuần', desc: 'Tham gia giải đấu', reward: 300, completed: false }
  ]

  const currentQuests = activeTab === 'daily' ? dailyQuests : activeTab === 'weekly' ? weeklyQuests : eventQuests

  function handleClaimQuest(questId: number) {
    console.log('Claim quest:', questId)
    // TODO: Implement claim logic
  }

  const totalChapters = mainStoryChapters.length
  const completedChapters = mainStoryChapters.filter(ch => ch.unlocked && completedMainQuests.includes(ch.id)).length

  return (
    <div className="quests-container">
      {/* Progress Bar */}
      <div className="quest-progress-bar">
        <div className="progress-label">
          <span className="progress-icon">🎯</span>
          <span>Tiến trình hướng dẫn: {completedChapters} / {totalChapters} chương</span>
        </div>
        <div className="progress-track">
          <div 
            className="progress-fill" 
            style={{ width: `${(completedChapters / totalChapters) * 100}%` }}
          >
            <div className="progress-glow"></div>
          </div>
        </div>
      </div>

      {/* Title Section */}
      <div className="quest-header">
        <h1 className="quest-main-title">HÀNH TRÌNH TỪ VÔ DANH THÀNH VÔ ĐỐI</h1>
        <p className="quest-subtitle">
          Tu luyện đạo caro trong thế giới MindPoint Arena. Từng bước chinh phục đỉnh cao, trở thành Vô Đối Kỳ Thủ!
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="quest-content-grid">
        {/* Left: Main Story */}
        <div className="main-story-panel">
          <div className="panel-header">
            <h2 className="panel-title">📖 Chuỗi Nhiệm Vụ Hướng Dẫn</h2>
            <span className="required-badge">BẮT BUỘC HOÀN THÀNH TRƯỚC</span>
          </div>

          <div className="chapters-list">
            {mainStoryChapters.map((chapter) => (
              <div 
                key={chapter.id} 
                className={`chapter-card ${!chapter.unlocked ? 'locked' : ''}`}
              >
                <div className="chapter-header">
                  <div className="chapter-icon">{chapter.icon}</div>
                  <div className="chapter-info">
                    <h3 className="chapter-title">{chapter.title}</h3>
                    <p className="chapter-desc">{chapter.description}</p>
                  </div>
                  {!chapter.unlocked && (
                    <div className="lock-icon">🔒</div>
                  )}
                </div>

                {chapter.unlocked && (
                  <div className="chapter-quests">
                    {chapter.quests.map((quest) => (
                      <div key={quest.id} className="mini-quest">
                        <div className="quest-check">
                          {completedMainQuests.includes(quest.id) ? '✓' : '○'}
                        </div>
                        <div className="quest-text">
                          <span className="quest-name">{quest.title}</span>
                        </div>
                        <div className="quest-reward">
                          <img src="/coin.png" alt="Coin" className="reward-icon" />
                          <span>+{quest.reward}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!chapter.unlocked && (
                  <div className="locked-message">
                    Hoàn thành Chương trước để mở khóa
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Daily/Weekly/Event */}
        <div className="side-quests-panel">
          <div className="panel-header">
            <h2 className="panel-title">⚡ Nhiệm Vụ Tự Do</h2>
          </div>

          {/* Tabs */}
          <div className="quest-tabs">
            <button 
              className={`quest-tab ${activeTab === 'daily' ? 'active' : ''}`}
              onClick={() => setActiveTab('daily')}
            >
              <span className="tab-icon">📅</span>
              <span>Hằng ngày</span>
            </button>
            <button 
              className={`quest-tab ${activeTab === 'weekly' ? 'active' : ''}`}
              onClick={() => setActiveTab('weekly')}
            >
              <span className="tab-icon">📆</span>
              <span>Hằng tuần</span>
            </button>
            <button 
              className={`quest-tab ${activeTab === 'event' ? 'active' : ''}`}
              onClick={() => setActiveTab('event')}
            >
              <span className="tab-icon">🎉</span>
              <span>Sự kiện</span>
            </button>
          </div>

          {/* Quest List */}
          <div className="side-quests-list">
            {currentQuests.map((quest) => (
              <div key={quest.id} className={`side-quest-card ${quest.completed ? 'completed' : ''}`}>
                <div className="quest-content">
                  <h4 className="quest-title">{quest.title}</h4>
                  <p className="quest-desc">{quest.desc}</p>
                  <div className="quest-reward-inline">
                    <img src="/coin.png" alt="Coin" className="reward-icon-small" />
                    <span className="reward-text">+{quest.reward} Coin</span>
                  </div>
                </div>
                <button 
                  className={`claim-btn ${quest.completed ? 'claimed' : ''}`}
                  onClick={() => handleClaimQuest(quest.id)}
                  disabled={quest.completed}
                >
                  {quest.completed ? 'Đã xong' : 'Nhận'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
