/**
 * Tests for analysisApi.ts
 * 
 * Tests the API client functions and error handling utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isApiError,
  isRateLimitError,
  isAuthError,
  isTimeoutError,
  getErrorMessage,
  type ApiError
} from './analysisApi'

describe('analysisApi', () => {
  describe('Error Type Guards', () => {
    it('isApiError returns true for valid ApiError', () => {
      const error: ApiError = { status: 400, error: 'Bad Request' }
      expect(isApiError(error)).toBe(true)
    })

    it('isApiError returns false for non-ApiError', () => {
      expect(isApiError(null)).toBe(false)
      expect(isApiError(undefined)).toBe(false)
      expect(isApiError('string error')).toBe(false)
      expect(isApiError(new Error('test'))).toBe(false)
      expect(isApiError({ message: 'test' })).toBe(false)
    })

    it('isRateLimitError returns true for 429 status', () => {
      const error: ApiError = { status: 429, error: 'Rate limit exceeded' }
      expect(isRateLimitError(error)).toBe(true)
    })

    it('isRateLimitError returns false for other statuses', () => {
      expect(isRateLimitError({ status: 400, error: 'Bad Request' })).toBe(false)
      expect(isRateLimitError({ status: 500, error: 'Server Error' })).toBe(false)
    })

    it('isAuthError returns true for 403 status', () => {
      const error: ApiError = { status: 403, error: 'Forbidden' }
      expect(isAuthError(error)).toBe(true)
    })

    it('isAuthError returns false for other statuses', () => {
      expect(isAuthError({ status: 401, error: 'Unauthorized' })).toBe(false)
      expect(isAuthError({ status: 400, error: 'Bad Request' })).toBe(false)
    })

    it('isTimeoutError returns true for 504 status', () => {
      const error: ApiError = { status: 504, error: 'Timeout' }
      expect(isTimeoutError(error)).toBe(true)
    })

    it('isTimeoutError returns false for other statuses', () => {
      expect(isTimeoutError({ status: 408, error: 'Request Timeout' })).toBe(false)
      expect(isTimeoutError({ status: 500, error: 'Server Error' })).toBe(false)
    })
  })

  describe('getErrorMessage', () => {
    it('returns Vietnamese message for rate limit error', () => {
      const error: ApiError = { status: 429, error: 'Rate limit exceeded' }
      expect(getErrorMessage(error)).toBe('Bạn đã đạt giới hạn sử dụng hôm nay. Vui lòng thử lại sau.')
    })

    it('returns Vietnamese message for auth error', () => {
      const error: ApiError = { status: 403, error: 'Forbidden' }
      expect(getErrorMessage(error)).toBe('Tính năng này yêu cầu gói Pro. Vui lòng nâng cấp để tiếp tục.')
    })

    it('returns Vietnamese message for timeout error', () => {
      const error: ApiError = { status: 504, error: 'Timeout' }
      expect(getErrorMessage(error)).toBe('Yêu cầu quá thời gian. Vui lòng thử lại.')
    })

    it('returns Vietnamese message for network error', () => {
      const error: ApiError = { status: 0, error: 'Network error' }
      expect(getErrorMessage(error)).toBe('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.')
    })

    it('returns details if available for other errors', () => {
      const error: ApiError = { status: 400, error: 'Bad Request', details: 'matchId is required' }
      expect(getErrorMessage(error)).toBe('matchId is required')
    })

    it('returns error message if no details', () => {
      const error: ApiError = { status: 500, error: 'Internal Server Error' }
      expect(getErrorMessage(error)).toBe('Internal Server Error')
    })

    it('returns Error message for Error instances', () => {
      const error = new Error('Test error message')
      expect(getErrorMessage(error)).toBe('Test error message')
    })

    it('returns default message for unknown errors', () => {
      expect(getErrorMessage('string error')).toBe('Đã xảy ra lỗi không xác định.')
      expect(getErrorMessage(null)).toBe('Đã xảy ra lỗi không xác định.')
      expect(getErrorMessage(undefined)).toBe('Đã xảy ra lỗi không xác định.')
    })
  })

  describe('API Request Validation', () => {
    // These tests verify that the API functions throw appropriate errors
    // for invalid inputs without making actual network requests
    
    it('analyzeMatch throws for missing matchId', async () => {
      const { analyzeMatch } = await import('./analysisApi')
      
      await expect(analyzeMatch({
        matchId: '',
        moves: [],
        tier: 'basic',
        userId: 'test-user'
      })).rejects.toMatchObject({
        status: 400,
        error: 'Invalid request',
        details: 'matchId is required'
      })
    })

    it('analyzeMatch throws for missing userId', async () => {
      const { analyzeMatch } = await import('./analysisApi')
      
      await expect(analyzeMatch({
        matchId: 'test-match',
        moves: [],
        tier: 'basic',
        userId: ''
      })).rejects.toMatchObject({
        status: 400,
        error: 'Invalid request',
        details: 'userId is required'
      })
    })

    it('askQuestion throws for missing matchId', async () => {
      const { askQuestion } = await import('./analysisApi')
      
      await expect(askQuestion({
        matchId: '',
        question: 'test question',
        userId: 'test-user'
      })).rejects.toMatchObject({
        status: 400,
        error: 'Invalid request',
        details: 'matchId is required'
      })
    })

    it('askQuestion throws for empty question', async () => {
      const { askQuestion } = await import('./analysisApi')
      
      await expect(askQuestion({
        matchId: 'test-match',
        question: '   ',
        userId: 'test-user'
      })).rejects.toMatchObject({
        status: 400,
        error: 'Invalid request',
        details: 'question is required'
      })
    })

    it('createReplaySession throws for missing matchId', async () => {
      const { createReplaySession } = await import('./analysisApi')
      
      await expect(createReplaySession({
        matchId: '',
        moves: [],
        userId: 'test-user'
      })).rejects.toMatchObject({
        status: 400,
        error: 'Invalid request',
        details: 'matchId is required'
      })
    })

    it('navigateReplay throws for missing sessionId', async () => {
      const { navigateReplay } = await import('./analysisApi')
      
      await expect(navigateReplay({
        sessionId: '',
        moveIndex: 0
      })).rejects.toMatchObject({
        status: 400,
        error: 'Invalid request',
        details: 'sessionId is required'
      })
    })

    it('playReplayMove throws for missing sessionId', async () => {
      const { playReplayMove } = await import('./analysisApi')
      
      await expect(playReplayMove({
        sessionId: '',
        move: { x: 0, y: 0, p: 'X' }
      })).rejects.toMatchObject({
        status: 400,
        error: 'Invalid request',
        details: 'sessionId is required'
      })
    })

    it('getUsage throws for missing userId', async () => {
      const { getUsage } = await import('./analysisApi')
      
      await expect(getUsage({
        userId: ''
      })).rejects.toMatchObject({
        status: 400,
        error: 'Invalid request',
        details: 'userId is required'
      })
    })
  })
})
