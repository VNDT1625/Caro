import React, { useState } from 'react'

export default function Guide() {
  const [selectedSection, setSelectedSection] = useState<string>('intro')

  const breadcrumbStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--color-muted)',
    marginBottom: '16px',
    padding: '12px 24px'
  }

  const guideData = {
    intro: {
      title: '🌟 Lời Ngỏ Từ Kỳ Môn',
      icon: '📜',
      content: [
        {
          subtitle: 'Chào mừng tân đồ',
          text: 'Ta là trưởng lão Kỳ Môn, người canh giữ đạo caro trong thế giới MindPoint Arena. Ngươi đã bước chân vào một hành trình tu luyện đầy gian nan nhưng vinh quang.'
        },
        {
          subtitle: 'Đạo caro là gì?',
          text: 'Đạo caro không đơn thuần là trò chơi. Đó là môn kỳ thuật chiến thuật cao siêu, nơi mỗi nước đi là một bước tu hành, mỗi chiến thắng là một tầng đột phá.'
        },
        {
          subtitle: 'Mục tiêu của ngươi',
          text: 'Từ Vô Danh, ngươi sẽ trải qua 7 cảnh giới: Tân Kỳ → Học Kỳ → Kỳ Lão → Cao Kỳ → Tam Kỳ → Đệ Nhị → và cuối cùng là Vô Đối.'
        }
      ]
    },
    rules: {
      title: '⚔️ Quy Luật Đấu Trận',
      icon: '📖',
      content: [
        {
          subtitle: 'Luật cơ bản',
          text: 'Hai kỳ thủ lần lượt đặt quân trên bàn caro. Người nào tạo thành 5 quân liên tiếp theo hàng ngang, dọc hoặc chéo sẽ giành chiến thắng.'
        },
        {
          subtitle: 'Kích thước bàn',
          text: 'Bàn caro có nhiều kích thước: 3x3 (nhập môn), 7x7 (cơ bản), 15x15 (tiêu chuẩn), 19x19 (cao thủ). Kích thước càng lớn, chiến thuật càng phức tạp.'
        },
        {
          subtitle: 'Thời gian suy nghĩ',
          text: 'Mỗi nước đi có giới hạn thời gian (10-45 giây). Tổng thời gian cho cả trận từ 5-20 phút. Hết giờ sẽ tự động thua cuộc.'
        },
        {
          subtitle: 'Ưu tiên lượt đi',
          text: 'Người đi trước (cầm X - màu đen) có lợi thế nhưng cũng phải chịu áp lực tạo thế mạnh ngay từ đầu.'
        }
      ]
    },
    tactics: {
      title: '🧠 Chiến Thuật Căn Bản',
      icon: '⚡',
      content: [
        {
          subtitle: 'Tạo song kiếm',
          text: 'Hình thành 2 dãy 3 quân có khả năng thành 5 cùng lúc. Đối thủ chỉ chặn được 1 đường → ngươi thắng.'
        },
        {
          subtitle: 'Phòng thủ chủ động',
          text: 'Không chỉ tấn công. Quan sát nước đi của đối phương, chặn đứng các dãy 3-4 quân nguy hiểm trước khi chúng thành hình.'
        },
        {
          subtitle: 'Kiểm soát trung tâm',
          text: 'Nước đi ở trung tâm bàn cờ có nhiều hướng phát triển hơn. Cao thủ luôn tranh giành vị trí chiến lược này.'
        },
        {
          subtitle: 'Dụ địch sâu nhập',
          text: 'Tạo một dãy 3 quân giả, khiến đối thủ chặn sai hướng. Trong khi đó, ngươi âm thầm tạo thế thắng ở nơi khác.'
        },
        {
          subtitle: 'Liên hoàn kế',
          text: 'Tạo nhiều mối đe dọa cùng lúc. Dù đối thủ chặn đường nào, ngươi vẫn có đường dự phòng để thắng.'
        }
      ]
    },
    modes: {
      title: '🏆 Các Chế Độ Tu Luyện',
      icon: '🎯',
      content: [
        {
          subtitle: '🤖 Luyện tập với Ma Thú',
          text: 'Đấu với AI để rèn luyện kỹ năng. Có 3 cấp độ: Dễ (cho tân thủ), Trung bình (thử thách), Khó (chỉ dành cho cao thủ).'
        },
        {
          subtitle: '⚔️ Đấu thường',
          text: 'Tự do giao đấu với người chơi khác mà không ảnh hưởng rank. Phù hợp để thử nghiệm chiến thuật mới.'
        },
        {
          subtitle: '🔥 Xếp hạng',
          text: 'Chế độ chính thức! Mỗi trận thắng/thua sẽ tăng/giảm điểm rank. Leo lên để chứng tỏ ngươi là Vô Đối Kỳ Thủ.'
        },
        {
          subtitle: '🏠 Phòng riêng',
          text: 'Tạo phòng với cài đặt tùy chỉnh: kích thước bàn, thời gian, đặt cược coin/gem. Mời bạn bè cùng thi đấu.'
        },
        {
          subtitle: '🏅 Giải đấu',
          text: 'Tham gia các giải đấu lớn với giải thưởng hậu hĩnh. Đây là nơi các cao thủ hội tụ, tranh tài!'
        }
      ]
    },
    progression: {
      title: '✨ Hệ Thống Tu Luyện',
      icon: '🌙',
      content: [
        {
          subtitle: '📊 Rank & ELO',
          text: 'Điểm ELO thể hiện thực lực. Mỗi rank có ngưỡng ELO riêng. Thắng cao thủ tăng nhiều điểm, thua tân thủ mất nhiều điểm.'
        },
        {
          subtitle: '💰 Coin & Gem',
          text: 'Coin kiếm qua nhiệm vụ và trận đấu, dùng mua skin. Gem quý hiếm hơn, dùng để mua item độc quyền hoặc mở rương.'
        },
        {
          subtitle: '🎁 Nhiệm vụ hằng ngày',
          text: 'Hoàn thành nhiệm vụ nhỏ mỗi ngày để nhận coin. Dễ làm, dễ kiếm, giúp ngươi tích lũy tài nguyên ổn định.'
        },
        {
          subtitle: '🏅 Thành tựu',
          text: 'Mở khóa thành tựu khi đạt mốc đặc biệt: 100 trận thắng, 10 chuỗi thắng, đạt rank Vô Đối... Nhận coin + danh hiệu đặc biệt.'
        },
        {
          subtitle: '🎨 Skin & Trang trí',
          text: 'Sưu tầm skin bàn cờ, quân cờ độc đáo trong Shop. Thể hiện phong cách riêng khi giao đấu!'
        }
      ]
    },
    advanced: {
      title: '🔮 Bí Kíp Cao Thủ',
      icon: '💎',
      content: [
        {
          subtitle: '🤖 AI Phân tích',
          text: 'Sau mỗi trận, dùng AI phân tích để xem nước đi sai lầm, nước đi tối ưu. Học hỏi từ chính trận đấu của mình.'
        },
        {
          subtitle: '📈 Replay & Học hỏi',
          text: 'Xem lại các trận đấu của cao thủ. Học cách họ mở đầu, triển khai chiến thuật, xử lý tình huống nguy hiểm.'
        },
        {
          subtitle: '👥 Thiết lập bang hội',
          text: 'Kết bạn với đồng môn, cùng nhau luyện tập. Chia sẻ kinh nghiệm, tổ chức nội chiến để tiến bộ nhanh hơn.'
        },
        {
          subtitle: '⏱️ Quản lý thời gian',
          text: 'Cao thủ không chỉ đi đúng mà còn đi nhanh. Rèn phản xạ, nhận diện thế cờ nhanh để không hết giờ trong lúc căng thẳng.'
        },
        {
          subtitle: '🧘 Tâm thế ổn định',
          text: 'Thua là chuyện bình thường. Quan trọng là học được gì từ thất bại. Giữ tâm bình tĩnh, không cảm xúc khi thua liên tiếp.'
        }
      ]
    },
    faq: {
      title: '❓ Nghi Vấn Thường Gặp',
      icon: '💬',
      content: [
        {
          subtitle: 'Làm sao leo rank nhanh?',
          text: 'Chơi nhiều trận xếp hạng, học chiến thuật, phân tích sai lầm. Thắng liên tiếp sẽ được tăng điểm bonus.'
        },
        {
          subtitle: 'Mất coin khi thua có sao không?',
          text: 'Trận thường không mất coin. Chỉ phòng đặt cược mới có rủi ro mất tiền. Cân nhắc trước khi tham gia!'
        },
        {
          subtitle: 'AI phân tích có chính xác không?',
          text: 'AI của chúng ta được huấn luyện bởi hàng triệu ván cờ cao thủ. Độ chính xác rất cao, đặc biệt với bàn 15x15.'
        },
        {
          subtitle: 'Có thể đổi username không?',
          text: 'Có thể đổi username trong phần Profile. Lần đầu miễn phí, từ lần 2 tốn gem.'
        },
        {
          subtitle: 'Làm sao kiếm gem nhanh?',
          text: 'Gem kiếm qua: Nhiệm vụ tuần, thành tựu khó, giải đấu, hoặc mua bằng tiền thật.'
        }
      ]
    }
  }

  const menuItems = [
    { id: 'intro', label: 'Lời Ngỏ', icon: '🌟' },
    { id: 'rules', label: 'Quy Luật', icon: '⚔️' },
    { id: 'tactics', label: 'Chiến Thuật', icon: '🧠' },
    { id: 'modes', label: 'Chế Độ', icon: '🏆' },
    { id: 'progression', label: 'Tu Luyện', icon: '✨' },
    { id: 'advanced', label: 'Bí Kíp', icon: '🔮' },
    { id: 'faq', label: 'FAQ', icon: '❓' }
  ]

  const currentGuide = guideData[selectedSection as keyof typeof guideData]

  return (
    <div className="guide-container">
      {/* Breadcrumb Navigation */}
      <nav style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: '13px', 
        color: 'rgba(255,255,255,0.5)',
        marginBottom: '16px',
        padding: '20px 24px 0'
      }}>
        <a 
          href="#home" 
          style={{ 
            color: 'rgba(255,255,255,0.5)', 
            textDecoration: 'none',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#22D3EE'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
        >
          Chánh Điện
        </a>
        <span style={{ color: 'rgba(255,255,255,0.5)' }}>›</span>
        <span style={{ color: '#fff' }}>Bí Tịch</span>
      </nav>
      
      {/* Decorative Background Elements */}
      <div className="guide-bg-decoration">
        <div className="floating-orb orb-1"></div>
        <div className="floating-orb orb-2"></div>
        <div className="floating-orb orb-3"></div>
      </div>

      {/* Header */}
      <div className="guide-header">
        <div className="guide-title-wrapper">
          <div className="guide-title-icon">📚</div>
          <div>
            <h1 className="guide-main-title">THIÊN CƠ BÍ ĐIỂN</h1>
            <p className="guide-subtitle">Tổng tập đạo caro trong MindPoint Arena</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="guide-content-grid">
        {/* Left Sidebar - Navigation */}
        <div className="guide-sidebar">
          <div className="guide-menu-title">📖 Mục Lục</div>
          <div className="guide-menu">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className={`guide-menu-item ${selectedSection === item.id ? 'active' : ''}`}
                onClick={() => setSelectedSection(item.id)}
              >
                <span className="menu-icon">{item.icon}</span>
                <span className="menu-label">{item.label}</span>
                {selectedSection === item.id && (
                  <div className="menu-active-indicator"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right Content Panel */}
        <div className="guide-main-panel">
          {/* Section Header */}
          <div className="section-header">
            <div className="section-icon-large">{currentGuide.icon}</div>
            <h2 className="section-title">{currentGuide.title}</h2>
          </div>

          {/* Content Cards */}
          <div className="guide-content-list">
            {currentGuide.content.map((item, index) => (
              <div key={index} className="guide-content-card">
                <div className="card-number">{index + 1}</div>
                <div className="card-body">
                  <h3 className="card-subtitle">{item.subtitle}</h3>
                  <p className="card-text">{item.text}</p>
                </div>
                <div className="card-glow-effect"></div>
              </div>
            ))}
          </div>

          {/* Navigation Footer */}
          <div className="guide-nav-footer">
            <button 
              className="guide-nav-btn prev"
              onClick={() => {
                const currentIndex = menuItems.findIndex(m => m.id === selectedSection)
                if (currentIndex > 0) {
                  setSelectedSection(menuItems[currentIndex - 1].id)
                }
              }}
              disabled={menuItems.findIndex(m => m.id === selectedSection) === 0}
            >
              <span className="nav-arrow">←</span>
              <span>Mục trước</span>
            </button>
            <div className="guide-progress-indicator">
              {menuItems.findIndex(m => m.id === selectedSection) + 1} / {menuItems.length}
            </div>
            <button 
              className="guide-nav-btn next"
              onClick={() => {
                const currentIndex = menuItems.findIndex(m => m.id === selectedSection)
                if (currentIndex < menuItems.length - 1) {
                  setSelectedSection(menuItems[currentIndex + 1].id)
                }
              }}
              disabled={menuItems.findIndex(m => m.id === selectedSection) === menuItems.length - 1}
            >
              <span>Mục tiếp</span>
              <span className="nav-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
