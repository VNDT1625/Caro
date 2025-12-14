/**
 * AnalysisErrorBoundary - Error boundary for AI Analysis components
 * 
 * Features:
 * - Catches React errors in child components
 * - Displays user-friendly error messages
 * - Provides retry functionality
 * - Shows upgrade modal for auth errors
 * 
 * Requirements: 17.1-17.5 (Error Handling)
 */

import React, { Component, ReactNode } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

interface ErrorBoundaryProps {
  children: ReactNode
  onRetry?: () => void
  onUpgrade?: () => void
  fallbackHeight?: number
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary class component for catching React errors
 */
class AnalysisErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging (in production, send to error tracking service)
    console.error('AnalysisErrorBoundary caught error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          onUpgrade={this.props.onUpgrade}
          height={this.props.fallbackHeight}
        />
      )
    }

    return this.props.children
  }
}

/**
 * Error fallback UI component
 */
interface ErrorFallbackProps {
  error: Error | null
  onRetry?: () => void
  onUpgrade?: () => void
  height?: number
}

function ErrorFallback({ error, onRetry, onUpgrade, height = 200 }: ErrorFallbackProps) {
  // Determine error type for appropriate messaging
  const isAuthError = error?.message?.includes('403') || error?.message?.includes('unauthorized')
  const isRateLimitError = error?.message?.includes('429') || error?.message?.includes('limit')
  const isTimeoutError = error?.message?.includes('504') || error?.message?.includes('timeout')
  const isNetworkError = error?.message?.includes('network') || error?.message?.includes('fetch')

  const getErrorMessage = () => {
    if (isAuthError) {
      return 'Tính năng này yêu cầu nâng cấp lên Pro'
    }
    if (isRateLimitError) {
      return 'Bạn đã đạt giới hạn sử dụng hôm nay'
    }
    if (isTimeoutError) {
      return 'Yêu cầu đã hết thời gian chờ'
    }
    if (isNetworkError) {
      return 'Không thể kết nối đến máy chủ'
    }
    return 'Đã xảy ra lỗi không mong muốn'
  }

  const getErrorIcon = () => {
    if (isAuthError) return '🔒'
    if (isRateLimitError) return '⏱️'
    if (isTimeoutError) return '⌛'
    if (isNetworkError) return '📡'
    return '⚠️'
  }

  return (
    <div style={{
      height,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(239,68,68,0.08)',
      borderRadius: 12,
      border: '1px solid rgba(239,68,68,0.3)',
      padding: 20,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>
        {getErrorIcon()}
      </div>
      <div style={{ 
        color: '#FCA5A5', 
        fontSize: 14, 
        fontWeight: 600,
        marginBottom: 8
      }}>
        {getErrorMessage()}
      </div>
      <div style={{ 
        color: '#94A3B8', 
        fontSize: 12,
        marginBottom: 16,
        maxWidth: 300
      }}>
        {isAuthError 
          ? 'Nâng cấp để mở khóa phân tích AI nâng cao và nhiều tính năng khác'
          : isRateLimitError
            ? 'Vui lòng thử lại sau hoặc nâng cấp để có thêm lượt sử dụng'
            : 'Vui lòng thử lại sau'}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {(isAuthError || isRateLimitError) && onUpgrade && (
          <button
            onClick={onUpgrade}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Nâng cấp Pro
          </button>
        )}
        {onRetry && !isRateLimitError && (
          <button
            onClick={onRetry}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid rgba(71,85,105,0.5)',
              background: 'rgba(30,41,59,0.6)',
              color: '#E2E8F0',
              fontWeight: 500,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  )
}

export default AnalysisErrorBoundaryClass
export { ErrorFallback }
