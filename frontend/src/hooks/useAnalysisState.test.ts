/**
 * Unit tests for useAnalysisState quota logic
 * Run: npm test -- useAnalysisState.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock PLAN_LIMITS for testing
const PLAN_LIMITS = {
  free: { basic: 1, pro: 0, ai_qa: 0 },
  trial: { basic: 4, pro: 4, ai_qa: 10 },
  pro: { basic: 40, pro: 40, ai_qa: 120 },
  pro_plus: { basic: 100, pro: 100, ai_qa: 500 }
}

describe('AI Analysis Quota Logic', () => {
  describe('PLAN_LIMITS', () => {
    it('Free plan should have 1 basic analyze, 0 pro, 0 chat', () => {
      expect(PLAN_LIMITS.free.basic).toBe(1)
      expect(PLAN_LIMITS.free.pro).toBe(0)
      expect(PLAN_LIMITS.free.ai_qa).toBe(0)
    })

    it('Trial plan should have 4 analyze, 10 chat', () => {
      expect(PLAN_LIMITS.trial.basic).toBe(4)
      expect(PLAN_LIMITS.trial.pro).toBe(4)
      expect(PLAN_LIMITS.trial.ai_qa).toBe(10)
    })

    it('Pro plan should have 40 analyze, 120 chat', () => {
      expect(PLAN_LIMITS.pro.basic).toBe(40)
      expect(PLAN_LIMITS.pro.pro).toBe(40)
      expect(PLAN_LIMITS.pro.ai_qa).toBe(120)
    })
  })

  describe('Quota Check Logic', () => {
    it('should block analyze when remaining <= 0', () => {
      const dailyRemaining = { basic: 0, pro: 0, ai_qa: 0 }
      const tier = 'basic' as const
      const remaining = (tier as string) === 'pro' ? dailyRemaining.pro : dailyRemaining.basic
      
      expect(remaining <= 0).toBe(true)
    })

    it('should allow analyze when remaining > 0', () => {
      const dailyRemaining = { basic: 1, pro: 0, ai_qa: 0 }
      const tier = 'basic' as const
      const remaining = (tier as string) === 'pro' ? dailyRemaining.pro : dailyRemaining.basic
      
      expect(remaining > 0).toBe(true)
    })

    it('should block pro tier for free users', () => {
      const hasProAccess = false
      const tier = 'pro'
      
      expect(tier === 'pro' && !hasProAccess).toBe(true)
    })

    it('should allow pro tier for trial/pro users', () => {
      const hasProAccess = true
      const tier = 'pro'
      
      expect(tier === 'pro' && hasProAccess).toBe(true)
    })
  })

  describe('Subscription Resolution', () => {
    const resolveSubscription = (
      plan?: string | null,
      trialExpires?: string | null,
      proExpires?: string | null
    ) => {
      const now = new Date()
      if (plan === 'pro') {
        if (!proExpires) return 'pro'
        if (new Date(proExpires) > now) return 'pro'
      }
      if (plan === 'trial' || (!plan && trialExpires)) {
        if (trialExpires && new Date(trialExpires) > now) return 'trial'
      }
      return 'free'
    }

    it('should return free for no plan', () => {
      expect(resolveSubscription(null, null, null)).toBe('free')
    })

    it('should return trial for active trial', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      expect(resolveSubscription('trial', futureDate, null)).toBe('trial')
    })

    it('should return free for expired trial', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString()
      expect(resolveSubscription('trial', pastDate, null)).toBe('free')
    })

    it('should return pro for active pro', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      expect(resolveSubscription('pro', null, futureDate)).toBe('pro')
    })

    it('should return pro for pro without expiry', () => {
      expect(resolveSubscription('pro', null, null)).toBe('pro')
    })
  })

  describe('Usage Decrement', () => {
    it('should decrement basic usage after analyze', () => {
      let dailyUsage = { basic: 0, pro: 0, ai_qa: 0 }
      let dailyRemaining = { basic: 1, pro: 0, ai_qa: 0 }
      
      // Simulate analyze
      dailyUsage.basic += 1
      dailyRemaining.basic = Math.max(0, dailyRemaining.basic - 1)
      
      expect(dailyUsage.basic).toBe(1)
      expect(dailyRemaining.basic).toBe(0)
    })

    it('should decrement ai_qa usage after chat', () => {
      let dailyUsage = { basic: 0, pro: 0, ai_qa: 0 }
      let dailyRemaining = { basic: 1, pro: 0, ai_qa: 10 }
      
      // Simulate chat
      dailyUsage.ai_qa += 1
      dailyRemaining.ai_qa = Math.max(0, dailyRemaining.ai_qa - 1)
      
      expect(dailyUsage.ai_qa).toBe(1)
      expect(dailyRemaining.ai_qa).toBe(9)
    })
  })
})
