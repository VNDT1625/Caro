import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface DisconnectOverlayProps {
  isVisible: boolean
  disconnectedPlayerId: string
  remainingSeconds: number
  onAutoWin?: (result: AutoWinResult) => void
  autoWinResult?: AutoWinResult | null
}

export interface AutoWinResult {
  winnerId: string
  loserId: string
  mpChange: number
  seriesComplete: boolean
  finalScore: string
  seriesWinnerId?: string
  message?: string
}

/**
 * DisconnectOverlay - Hiển thị khi đối thủ disconnect trong ranked mode
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4 (ranked-disconnect-auto-win)
 * - Hiển thị "Đối thủ đã thoát" message
 * - Countdown 10 giây
 * - Hiển thị kết quả auto-win với +20 MP
 */
export function DisconnectOverlay({
  isVisible,
  disconnectedPlayerId,
  remainingSeconds,
  onAutoWin,
  autoWinResult
}: DisconnectOverlayProps) {
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState(remainingSeconds)

  useEffect(() => {
    setCountdown(remainingSeconds)
  }, [remainingSeconds])

  useEffect(() => {
    if (!isVisible || autoWinResult) return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isVisible, autoWinResult])

  if (!isVisible) return null

  // Hiển thị kết quả auto-win
  if (autoWinResult) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gradient-to-b from-green-900 to-green-950 rounded-2xl p-8 max-w-md w-full mx-4 text-center border border-green-500/30 shadow-2xl">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-green-400 mb-2">
            {t('ranked.autoWin.title', 'Chiến thắng!')}
          </h2>
          <p className="text-gray-300 mb-4">
            {t('ranked.autoWin.opponentLeft', 'Đối thủ đã thoát trận')}
          </p>
          
          <div className="bg-green-500/20 rounded-xl p-4 mb-4">
            <div className="text-4xl font-bold text-green-400">
              +{autoWinResult.mpChange} MP
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {t('ranked.autoWin.forfeitReward', 'Phần thưởng do đối thủ bỏ cuộc')}
            </div>
          </div>

          <div className="text-lg text-gray-300">
            {t('ranked.autoWin.finalScore', 'Tỉ số')}: <span className="font-bold text-white">{autoWinResult.finalScore}</span>
          </div>

          {autoWinResult.seriesComplete && (
            <div className="mt-4 text-yellow-400 font-semibold">
              {t('ranked.autoWin.seriesWon', 'Bạn đã thắng series!')}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Hiển thị countdown chờ auto-win
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 text-center border border-yellow-500/30 shadow-2xl">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-yellow-400 mb-2">
          {t('ranked.disconnect.title', 'Đối thủ đã thoát')}
        </h2>
        <p className="text-gray-300 mb-6">
          {t('ranked.disconnect.waiting', 'Bạn sẽ thắng nếu đối thủ không quay lại')}
        </p>
        
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-700"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-yellow-500"
              strokeDasharray={`${(countdown / 10) * 352} 352`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">{countdown}</span>
          </div>
        </div>

        <p className="text-sm text-gray-400">
          {t('ranked.disconnect.autoWinIn', 'Tự động thắng sau {{seconds}} giây', { seconds: countdown })}
        </p>
      </div>
    </div>
  )
}

export default DisconnectOverlay
