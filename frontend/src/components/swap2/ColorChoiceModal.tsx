/**
 * ColorChoiceModal Component
 * 
 * Displays color choice options during Swap 2 phase.
 * - swap2_choice phase: 3 options (black, white, place_more)
 * - swap2_final_choice phase: 2 options (black, white)
 * 
 * Requirements: 5.3, 5.5
 */

import { useState, memo, useMemo } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import type { Swap2Phase, Swap2Choice, TentativeStone } from '../../types/swap2'

interface ColorChoiceModalProps {
  phase: 'swap2_choice' | 'swap2_final_choice'
  onChoice: (choice: Swap2Choice) => void
  tentativeStones: TentativeStone[]
  timeRemaining?: number
  disabled?: boolean
}

const ColorChoiceModal = memo(function ColorChoiceModal({
  phase,
  onChoice,
  tentativeStones,
  timeRemaining,
  disabled = false
}: ColorChoiceModalProps) {
  const { t } = useLanguage()
  const [selectedChoice, setSelectedChoice] = useState<Swap2Choice | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const isFirstChoice = phase === 'swap2_choice'
  
  const options = useMemo<Array<{
    value: Swap2Choice
    label: string
    description: string
    icon: string
    color: string
  }>>(() => isFirstChoice
    ? [
        {
          value: 'black',
          label: t('swap2.chooseBlack') || 'Chọn Đen',
          description: t('swap2.chooseBlackDesc') || 'Bạn sẽ đi tiếp với quân Đen',
          icon: '⚫',
          color: '#374151'
        },
        {
          value: 'white',
          label: t('swap2.chooseWhite') || 'Chọn Trắng',
          description: t('swap2.chooseWhiteDesc') || 'Bạn sẽ đi tiếp với quân Trắng',
          icon: '⚪',
          color: '#E5E7EB'
        },
        {
          value: 'place_more',
          label: t('swap2.placeMore') || 'Đặt thêm 2 quân',
          description: t('swap2.placeMoreDesc') || 'Đặt thêm 2 quân, đối thủ sẽ chọn màu',
          icon: '➕',
          color: '#F59E0B'
        }
      ]
    : [
        {
          value: 'black',
          label: t('swap2.chooseBlack') || 'Chọn Đen',
          description: t('swap2.chooseBlackDesc') || 'Bạn sẽ đi tiếp với quân Đen',
          icon: '⚫',
          color: '#374151'
        },
        {
          value: 'white',
          label: t('swap2.chooseWhite') || 'Chọn Trắng',
          description: t('swap2.chooseWhiteDesc') || 'Bạn sẽ đi tiếp với quân Trắng',
          icon: '⚪',
          color: '#E5E7EB'
        }
      ], [isFirstChoice, t])

  const handleSelect = (choice: Swap2Choice) => {
    if (disabled) return
    setSelectedChoice(choice)
    setIsConfirming(true)
  }

  const handleConfirm = () => {
    if (selectedChoice && !disabled) {
      onChoice(selectedChoice)
    }
  }

  const handleCancel = () => {
    setSelectedChoice(null)
    setIsConfirming(false)
  }

  return (
    <div
      className="color-choice-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
        animation: 'fadeIn 0.3s ease-out'
      }}
    >
      <div
        className="color-choice-modal"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
          borderRadius: '24px',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
          animation: 'slideUp 0.4s ease-out'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, transparent 100%)',
          padding: '24px',
          textAlign: 'center',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>
            {isFirstChoice ? '🎨' : '✨'}
          </div>
          <h2 style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 700,
            color: '#E2E8F0'
          }}>
            {isFirstChoice 
              ? (t('swap2.makeYourChoice') || 'Chọn lựa của bạn')
              : (t('swap2.finalChoice') || 'Lựa chọn cuối cùng')
            }
          </h2>
          <p style={{
            margin: '8px 0 0',
            fontSize: '14px',
            color: '#94A3B8'
          }}>
            {isFirstChoice
              ? (t('swap2.choiceInstructions') || 'Xem xét vị trí các quân và đưa ra quyết định')
              : (t('swap2.finalChoiceInstructions') || 'Chọn màu bạn muốn chơi')
            }
          </p>
          
          {/* Timer */}
          {timeRemaining !== undefined && timeRemaining > 0 && (
            <div style={{
              marginTop: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: timeRemaining <= 10 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.8)',
              borderRadius: '20px',
              padding: '8px 16px',
              border: `1px solid ${timeRemaining <= 10 ? '#EF4444' : '#475569'}40`
            }}>
              <span style={{ fontSize: '14px', color: '#94A3B8' }}>
                {t('swap2.timeRemaining') || 'Thời gian còn'}:
              </span>
              <span style={{
                fontSize: '18px',
                fontWeight: 700,
                color: timeRemaining <= 10 ? '#EF4444' : '#22D3EE',
                fontFamily: 'monospace'
              }}>
                {timeRemaining}s
              </span>
            </div>
          )}
        </div>

        {/* Mini Board Preview */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#64748B',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {t('swap2.currentStones') || 'Quân đã đặt'} ({tentativeStones.length})
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            {tentativeStones.map((stone, index) => (
              <div
                key={`${stone.x}-${stone.y}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(30, 41, 59, 0.6)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '12px'
                }}
              >
                <span style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: index % 2 === 0 
                    ? 'radial-gradient(circle at 35% 35%, #666, #000)'
                    : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                  boxShadow: index % 2 === 0
                    ? '0 2px 4px rgba(0,0,0,0.4)'
                    : '0 2px 4px rgba(0,0,0,0.2)'
                }} />
                <span style={{ color: '#94A3B8' }}>
                  ({stone.x}, {stone.y})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Options */}
        <div style={{ padding: '24px' }}>
          {!isConfirming ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  disabled={disabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '2px solid rgba(71, 85, 105, 0.3)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    if (!disabled) {
                      e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)'
                      e.currentTarget.style.borderColor = option.value === 'place_more' 
                        ? '#F59E0B' 
                        : option.value === 'black' ? '#64748B' : '#E5E7EB'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)'
                    e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <span style={{ fontSize: '32px' }}>{option.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#E2E8F0',
                      marginBottom: '4px'
                    }}>
                      {option.label}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#94A3B8'
                    }}>
                      {option.description}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '20px',
                    color: '#64748B'
                  }}>
                    →
                  </span>
                </button>
              ))}
            </div>
          ) : (
            /* Confirmation View */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                {options.find(o => o.value === selectedChoice)?.icon}
              </div>
              <h3 style={{
                margin: '0 0 8px',
                fontSize: '18px',
                fontWeight: 600,
                color: '#E2E8F0'
              }}>
                {t('swap2.confirmChoice') || 'Xác nhận lựa chọn'}
              </h3>
              <p style={{
                margin: '0 0 24px',
                fontSize: '14px',
                color: '#94A3B8'
              }}>
                {options.find(o => o.value === selectedChoice)?.label}
              </p>
              
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '10px',
                    background: 'rgba(71, 85, 105, 0.3)',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    color: '#94A3B8',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {t('common.cancel') || 'Hủy'}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={disabled}
                  style={{
                    padding: '12px 32px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                    boxShadow: '0 4px 16px rgba(34, 211, 238, 0.3)'
                  }}
                >
                  {t('common.confirm') || 'Xác nhận'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
})

export default ColorChoiceModal