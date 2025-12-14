import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { supabase } from '../lib/supabase'

interface OnboardingTourProps {
  isOpen: boolean
  onComplete: () => void
  onSkip: () => void
  userId?: string
  skipToQuests?: boolean // When true, skip will jump to quests-intro step instead of closing
}

type StepType = 'info' | 'click' | 'choice' | 'reward'

interface TourStep {
  id: string
  title: string
  description: string
  position: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'bottom-left'
  type: StepType
  target?: string
  action?: () => void
  choices?: { id: string; label: string; icon: string }[]
  reward?: { type: 'coins' | 'gems'; amount: number }
  skipLabel?: string
  nextLabel?: string
  noOverlay?: boolean // Don't show dark overlay
  lockInteractions?: boolean
}

export default function OnboardingTour({ isOpen, onComplete, onSkip, userId, skipToQuests = true }: OnboardingTourProps) {
  const { t } = useLanguage()
  const ob = useCallback((key: string) => t(`onboarding.${key}`), [t])
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [branch, setBranch] = useState<'battle' | 'ai' | null>(null)
  const [secondBranch, setSecondBranch] = useState<'battle' | 'ai' | 'skip' | null>(null)
  const [profileDetailMode, setProfileDetailMode] = useState(false)
  const [rewardClaimed, setRewardClaimed] = useState(false)
  const scrollLockRef = useRef<string | null>(null)
  const handleNextRef = useRef<(() => void) | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  const lockScroll = useCallback(() => {
    if (typeof document === 'undefined') return
    if (scrollLockRef.current !== null) return
    scrollLockRef.current = document.body.style.overflow || ''
    document.body.style.overflow = 'hidden'
  }, [])

  const unlockScroll = useCallback(() => {
    if (typeof document === 'undefined') return
    if (scrollLockRef.current === null) return
    document.body.style.overflow = scrollLockRef.current
    scrollLockRef.current = null
  }, [])

  // Check if user already claimed onboarding reward
  useEffect(() => {
    if (!userId) return
    const checkReward = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('metadata')
          .eq('user_id', userId)
          .maybeSingle()
        if (data?.metadata?.onboarding_reward_claimed) {
          setRewardClaimed(true)
        }
      } catch (e) { /* ignore */ }
    }
    checkReward()
  }, [userId])

  // Main tour steps
  const getSteps = useCallback((): TourStep[] => {
    const baseSteps: TourStep[] = [
      // Step 0: Welcome
      {
        id: 'welcome',
        title: ob('welcome.title'),
        description: ob('welcome.description'),
        position: 'center',
        type: 'info',
        nextLabel: ob('welcome.next'),
        action: () => { window.location.hash = '#home' }
      },
      // Step 1: Go to Profile - click avatar (stay on home, just highlight)
      {
        id: 'profile-intro',
        title: ob('profileIntro.title'),
        description: ob('profileIntro.description'),
        position: 'right', // Position tooltip to the right of avatar
        type: 'click',
        target: '.user-snippet',
        action: () => { window.location.hash = '#profile' }
      },
      // Step 2: Profile overview - let user see the page first (small tooltip, no overlay)
      {
        id: 'profile-overview',
        title: ob('profileOverview.title'),
        description: ob('profileOverview.description'),
        position: 'bottom-left',
        type: 'info',
        nextLabel: ob('profileOverview.next'),
        noOverlay: true,
        lockInteractions: true
      },
      // Step 3: Profile choice - detail or skip
      {
        id: 'profile-choice',
        title: ob('profileChoice.title'),
        description: ob('profileChoice.description'),
        position: 'center',
        type: 'choice',
        choices: [
          { id: 'detail', label: ob('profileChoice.options.detail'), icon: '📝' },
          { id: 'skip', label: ob('profileChoice.options.skip'), icon: '⏭️' }
        ]
      },
      // Step 3: Menu overview (Shop, Inventory, Quests...)
      {
        id: 'menu-overview',
        title: ob('menuOverview.title'),
        description: ob('menuOverview.description'),
        position: 'right',
        type: 'info',
        target: '[data-tour="home-menu"]',
        action: () => { window.location.hash = '#home' }
      },
      // Step 4: Currency explanation
      {
        id: 'currency',
        title: ob('currency.title'),
        description: ob('currency.description'),
        position: 'bottom',
        type: 'info',
        target: '.wallet, .desktop-wallet'
      },
      // Step 5: Reward 1000 coins
      {
        id: 'reward',
        title: ob('reward.title'),
        description: ob('reward.description'),
        position: 'center',
        type: 'reward',
        reward: { type: 'coins', amount: 1000 },
        nextLabel: ob('reward.next')
      },
      // Step 6: Highlight Shop button on Home
      {
        id: 'shop-intro',
        title: ob('shopIntro.title'),
        description: ob('shopIntro.description'),
        position: 'right',
        type: 'click',
        target: '[data-tour="shop"]',
        action: () => {
          window.location.hash = '#shop'
        }
      },
      // Step 7: In Shop, highlight free chess card and buy button
      {
        id: 'shop-free-chess',
        title: ob('shopFreeChess.title'),
        description: ob('shopFreeChess.description'),
        position: 'right',
        type: 'click',
        target: '[data-tour="free-chess"], [data-tour="buy-chess-btn"]',
        action: () => {
          // User clicks buy button - modal will open
        }
      },
      // Step 7.5: Highlight confirm button on modal
      {
        id: 'shop-confirm-chess',
        title: ob('shopConfirm.title'),
        description: ob('shopConfirm.description'),
        position: 'left',
        type: 'click',
        target: '[data-tour="shop-confirm-btn"]',
        action: () => {
          // User clicks confirm
        }
      },
      // Step 7.6: Highlight OK button on success modal
      {
        id: 'shop-success-chess',
        title: ob('shopSuccess.title'),
        description: ob('shopSuccess.description'),
        position: 'left',
        type: 'click',
        target: '[data-tour="shop-success-btn"]',
        action: () => {
          // User clicks OK
        }
      },
      // Step 8: Highlight free board card and buy button - scroll down
      {
        id: 'shop-free-board',
        title: ob('shopFreeBoard.title'),
        description: ob('shopFreeBoard.description'),
        position: 'right',
        type: 'click',
        target: '[data-tour="free-board"], [data-tour="buy-board-btn"]',
        action: () => {
          // User clicks buy button - modal will open
        }
      },
      // Step 8.5: Highlight confirm button on modal for board
      {
        id: 'shop-confirm-board',
        title: ob('shopConfirm.title'),
        description: ob('shopConfirm.description'),
        position: 'left',
        type: 'click',
        target: '[data-tour="shop-confirm-btn"]',
        action: () => {
          // User clicks confirm
        }
      },
      // Step 8.6: Highlight OK button on success modal for board
      {
        id: 'shop-success-board',
        title: ob('shopSuccess.title'),
        description: ob('shopSuccess.description'),
        position: 'left',
        type: 'click',
        target: '[data-tour="shop-success-btn"]',
        action: () => {
          // User clicks OK
        }
      },
      // Step 9: Go to Quests (navigate to Home first)
      {
        id: 'quests-intro',
        title: ob('questsIntro.title'),
        description: ob('questsIntro.description'),
        position: 'bottom',
        type: 'click',
        target: '[data-tour="quests"]',
        action: () => { window.location.hash = '#quests' }
      },
      // Step 10: Quests overview
      {
        id: 'quests-overview',
        title: ob('questsOverview.title'),
        description: ob('questsOverview.description'),
        position: 'bottom-left',
        type: 'info',
        nextLabel: ob('questsOverview.next'),
        skipLabel: ob('questsOverview.skip'),
        noOverlay: true,
        lockInteractions: true
      },
      // Step 11: Highlight first quest
      {
        id: 'claim-first-quest',
        title: ob('claimFirstQuest.title'),
        description: ob('claimFirstQuest.description'),
        position: 'right',
        type: 'info',
        target: '[data-tour="first-quest"]',
        nextLabel: ob('general.next')
      },
      // Step 7: Final choice - Battle or AI
      {
        id: 'final-choice',
        title: ob('finalChoice.title'),
        description: ob('finalChoice.description'),
        position: 'center',
        type: 'choice',
        choices: [
          { id: 'battle', label: ob('finalChoice.options.battle'), icon: '⚔️' },
          { id: 'ai', label: ob('finalChoice.options.ai'), icon: '🤖' }
        ]
      }
    ]

    // Profile detail steps (inserted after profile-choice if user chooses detail)
    const profileDetailSteps: TourStep[] = [
      {
        id: 'go-to-settings',
        title: ob('goToSettings.title'),
        description: ob('goToSettings.description'),
        position: 'right',
        type: 'click',
        target: '.profile-nav-item:nth-child(2)',
        action: () => {
          const settingsBtn = document.querySelector('.profile-nav-item:nth-child(2)') as HTMLElement
          settingsBtn?.click()
        }
      },
      {
        id: 'settings-overview',
        title: ob('settingsOverview.title'),
        description: ob('settingsOverview.description'),
        position: 'bottom-left',
        type: 'info',
        nextLabel: ob('settingsOverview.next'),
        skipLabel: ob('settingsOverview.skip'),
        noOverlay: true,
        lockInteractions: true
      },
      {
        id: 'avatar-upload',
        title: ob('avatarUpload.title'),
        description: ob('avatarUpload.description'),
        position: 'bottom',
        type: 'info',
        target: '[data-tour="avatar-upload"], #avatarInput',
        nextLabel: ob('avatarUpload.next')
      },
      {
        id: 'sound-tab',
        title: ob('soundTab.title'),
        description: ob('soundTab.description'),
        position: 'right',
        type: 'click',
        target: '[data-tour="tab-sound"], .settings-tab:nth-child(3)'
      },
      {
        id: 'sound-settings',
        title: ob('soundSettings.title'),
        description: ob('soundSettings.description'),
        position: 'bottom-left',
        type: 'info',
        nextLabel: ob('settingsOverview.next'),
        target: '[data-tour="tab-sound"]',
        noOverlay: true,
        lockInteractions: true
      },
      {
        id: 'notifications-tab',
        title: ob('notificationsTab.title'),
        description: ob('notificationsTab.description'),
        position: 'right',
        type: 'click',
        target: '[data-tour="tab-notifications"], .settings-tab:nth-child(5)'
      },
      {
        id: 'notification-settings',
        title: ob('notificationSettings.title'),
        description: ob('notificationSettings.description'),
        position: 'bottom-left',
        type: 'info',
        nextLabel: ob('settingsOverview.next'),
        target: '[data-tour="tab-notifications"]',
        noOverlay: true,
        lockInteractions: true
      },
      {
        id: 'ui-tab',
        title: ob('uiTab.title'),
        description: ob('uiTab.description'),
        position: 'right',
        type: 'click',
        target: '[data-tour="tab-ui"], .settings-tab:nth-child(2)'
      },
      {
        id: 'ui-settings',
        title: ob('uiSettings.title'),
        description: ob('uiSettings.description'),
        position: 'bottom-left',
        type: 'info',
        nextLabel: ob('settingsOverview.next'),
        target: '[data-tour="tab-ui"]',
        noOverlay: true,
        lockInteractions: true
      },
      {
        id: 'language-tab',
        title: ob('languageTab.title'),
        description: ob('languageTab.description'),
        position: 'right',
        type: 'click',
        target: '[data-tour="tab-language"], .settings-tab:nth-child(6)'
      },
      {
        id: 'language-settings',
        title: ob('languageSettings.title'),
        description: ob('languageSettings.description'),
        position: 'bottom-left',
        type: 'info',
        nextLabel: ob('settingsOverview.next'),
        target: '[data-tour="tab-language"]',
        noOverlay: true,
        lockInteractions: true
      },
      {
        id: 'match-history-tab',
        title: ob('matchHistoryTab.title'),
        description: ob('matchHistoryTab.description'),
        position: 'right',
        type: 'click',
        target: '[data-tour="profile-history"], .profile-nav-item:nth-child(3)'
      },
      {
        id: 'match-history',
        title: ob('matchHistory.title'),
        description: ob('matchHistory.description'),
        position: 'bottom-left',
        type: 'info',
        nextLabel: ob('settingsOverview.next'),
        target: '[data-tour="profile-history"]',
        noOverlay: true,
        lockInteractions: true
      }
    ]
    // Battle branch steps
    const battleSteps: TourStep[] = [
      {
        id: 'quick-match',
        title: ob('quickMatch.title'),
        description: ob('quickMatch.description'),
        position: 'top',
        type: 'info',
        target: '.quick-match-btn',
        nextLabel: ob('general.next'),
        action: () => { window.location.hash = '#home' }
      },
      {
        id: 'game-modes',
        title: ob('gameModes.title'),
        description: ob('gameModes.description'),
        position: 'top',
        type: 'info',
        target: '[data-tour="game-modes"]',
        action: () => { window.location.hash = '#home' }
      }
    ]

    // AI branch steps  
    const aiSteps: TourStep[] = [
      {
        id: 'social-card',
        title: ob('socialCard.title'),
        description: ob('socialCard.description'),
        position: 'center',
        type: 'info',
        action: () => { window.location.hash = '#home' }
      },
      {
        id: 'ai-analysis',
        title: ob('aiAnalysis.title'),
        description: ob('aiAnalysis.description'),
        position: 'center',
        type: 'info',
        target: '[href="#ai-analysis"], [data-tour="ai"]'
      },
      {
        id: 'training-mode',
        title: ob('trainingMode.title'),
        description: ob('trainingMode.description'),
        position: 'center',
        type: 'info'
      }
    ]

    // Ask about other branch step (after completing first branch)
    const askAboutAiStep: TourStep = {
      id: 'ask-about-ai',
      title: ob('askAboutAi.title'),
      description: ob('askAboutAi.description'),
      position: 'center',
      type: 'choice',
      choices: [
        { id: 'explore-ai', label: ob('askAboutAi.options.yes'), icon: '🤖' },
        { id: 'skip-ai', label: ob('askAboutAi.options.no'), icon: '✅' }
      ]
    }

    const askAboutBattleStep: TourStep = {
      id: 'ask-about-battle',
      title: ob('askAboutBattle.title'),
      description: ob('askAboutBattle.description'),
      position: 'center',
      type: 'choice',
      choices: [
        { id: 'explore-battle', label: ob('askAboutBattle.options.yes'), icon: '⚔️' },
        { id: 'skip-battle', label: ob('askAboutBattle.options.no'), icon: '✅' }
      ]
    }

    // Complete step
    const completeStep: TourStep = {
      id: 'complete',
      title: ob('complete.title'),
      description: ob('complete.description'),
      position: 'center',
      type: 'info',
      nextLabel: ob('complete.next')
    }

    // Build final steps based on choices
    let steps = [...baseSteps]
    
    if (profileDetailMode) {
      // Insert profile detail steps after profile-choice (index 3, since we added profile-overview)
      steps.splice(4, 0, ...profileDetailSteps)
    }

    // Add branch steps before complete
    // After first branch, ask about the other branch
    if (branch === 'battle') {
      if (secondBranch === 'ai') {
        // User chose to explore AI after battle
        steps = [...steps, ...battleSteps, askAboutAiStep, ...aiSteps, completeStep]
      } else if (secondBranch === 'skip') {
        // User chose to skip AI
        steps = [...steps, ...battleSteps, askAboutAiStep, completeStep]
      } else {
        // First branch done, ask about AI
        steps = [...steps, ...battleSteps, askAboutAiStep, completeStep]
      }
    } else if (branch === 'ai') {
      if (secondBranch === 'battle') {
        // User chose to explore battle after AI
        steps = [...steps, ...aiSteps, askAboutBattleStep, ...battleSteps, completeStep]
      } else if (secondBranch === 'skip') {
        // User chose to skip battle
        steps = [...steps, ...aiSteps, askAboutBattleStep, completeStep]
      } else {
        // First branch done, ask about battle
        steps = [...steps, ...aiSteps, askAboutBattleStep, completeStep]
      }
    } else {
      steps = [...steps, completeStep]
    }

    return steps
  }, [ob, profileDetailMode, branch])

  const steps = getSteps()
  const step = steps[currentStep]

  // Track target element reference
  const [targetElement, setTargetElement] = useState<Element | null>(null)

  // Find target element when step changes
  useEffect(() => {
    if (!step?.target) {
      setTargetElement(null)
      return
    }
    
    let retryCount = 0
    const maxRetries = 10
    
    const findElement = () => {
      const selectors = step.target!.split(',').map(s => s.trim())
      for (const selector of selectors) {
        const el = document.querySelector(selector)
        if (el) {
          setTargetElement(el)
          return true
        }
      }
      setTargetElement(null)
      return false
    }
    
    // Retry finding element with increasing delay (for page navigation)
    const tryFind = () => {
      if (findElement()) return
      retryCount++
      if (retryCount < maxRetries) {
        setTimeout(tryFind, 300)
      }
    }
    
    // Initial delay to let DOM settle
    const timer = setTimeout(tryFind, 300)
    return () => clearTimeout(timer)
  }, [step])

  // Update rect from target element - runs on animation frame for smooth tracking
  useEffect(() => {
    if (!isOpen || !targetElement) {
      setTargetRect(null)
      return
    }
    
    let rafId: number
    let lastRect = ''
    
    const updateRect = () => {
      const rect = targetElement.getBoundingClientRect()
      const rectStr = `${rect.top},${rect.left},${rect.width},${rect.height}`
      
      // Only update state if rect actually changed
      if (rectStr !== lastRect) {
        lastRect = rectStr
        setTargetRect(rect)
      }
      
      rafId = requestAnimationFrame(updateRect)
    }
    
    updateRect()
    
    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [isOpen, targetElement])

  // Lock scroll during avatar step to keep focus near upload controls
  useEffect(() => {
    if (!isOpen) {
      unlockScroll()
      return
    }
    if (step?.id === 'avatar-upload') {
      lockScroll()
      const accountTab = document.querySelector('[data-tour="tab-account"]') as HTMLElement | null
      accountTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    } else {
      unlockScroll()
    }
    return () => {
      unlockScroll()
    }
  }, [isOpen, step, lockScroll, unlockScroll])

  // Ensure settings tabs are visible when their step starts
  useEffect(() => {
    if (!isOpen || !step?.target) return
    const scrollSteps = new Set([
      'go-to-settings',
      'sound-tab',
      'notifications-tab',
      'ui-tab',
      'language-tab',
      'avatar-upload',
      'match-history-tab',
      'sound-settings',
      'notification-settings',
      'ui-settings',
      'language-settings',
      'match-history'
    ])
    if (!scrollSteps.has(step.id)) return
    
    const selectors = step.target.split(',').map(s => s.trim()).filter(Boolean)
    if (!selectors.length) return
    
    const findTarget = () => {
      for (const selector of selectors) {
        const el = document.querySelector(selector)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          break
        }
      }
    }
    
    // Delay slightly to allow layout updates (e.g., tab content switching)
    const timer = setTimeout(findTarget, 200)
    return () => clearTimeout(timer)
  }, [isOpen, step])

  // Run step action when step changes (only for non-click steps)
  useEffect(() => {
    if (!isOpen) return
    // Don't auto-run action for 'click' type steps - wait for user to click target
    if (step?.type !== 'click') {
      step?.action?.()
    }
  }, [isOpen, currentStep, step])

  // Scroll to free-chess when shop-free-chess step starts (wait for Shop to load)
  useEffect(() => {
    if (!isOpen) return
    if (step?.id === 'shop-free-chess') {
      // Wait for Shop page to load, then scroll to chess card
      const scrollToChess = () => {
        const chessEl = document.querySelector('[data-tour="free-chess"]')
        if (chessEl) {
          chessEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } else {
          // Retry if element not found yet
          setTimeout(scrollToChess, 200)
        }
      }
      setTimeout(scrollToChess, 500)
    }
  }, [isOpen, step])

  // Scroll to free-board when shop-free-board step starts
  useEffect(() => {
    if (!isOpen) return
    if (step?.id === 'shop-free-board') {
      // Scroll to board card
      setTimeout(() => {
        const boardEl = document.querySelector('[data-tour="free-board"]')
        if (boardEl) {
          boardEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
  }, [isOpen, step])

  // Handle click on target element
  useEffect(() => {
    // Only auto-advance for 'click' type steps, not for restricted steps like avatar-upload
    // Avatar-upload should require user to click Next button after uploading
    if (!isOpen || !step?.target || step.type !== 'click') return
    
    const selectors = step.target.split(',').map(s => s.trim()).filter(Boolean)
    if (!selectors.length) return
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      for (const selector of selectors) {
        if (target.closest(selector)) {
          step.action?.()
          setTimeout(() => setCurrentStep(prev => prev + 1), 500)
          return
        }
      }
    }
    // Use capture phase to catch click before stopPropagation in child elements
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [isOpen, step, currentStep])

  // Block all interactions outside highlight (except tooltip controls)
  useEffect(() => {
    if (!isOpen || (!step?.target && !step?.lockInteractions)) return
    const selectors = step.target ? step.target.split(',').map(s => s.trim()).filter(Boolean) : []
    
    const guard = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (tooltipRef.current?.contains(target)) return

      const matchesSelector = selectors.some(selector => target.closest(selector))
      const isNavTarget = !!target.closest('.settings-tab, .profile-nav-item')
      const noOverlay = !!step?.noOverlay

      if (noOverlay) {
        if (!isNavTarget) return
        if (matchesSelector) return
      } else {
        if (matchesSelector) return
      }

      if (!selectors.length && !isNavTarget) return
      e.stopPropagation()
      if ('preventDefault' in e) e.preventDefault()
      if (e.type === 'focusin' && typeof target.blur === 'function') {
        target.blur()
      }
    }

    const events: (keyof DocumentEventMap)[] = [
      'pointerdown',
      'pointerup',
      'click',
      'dblclick',
      'touchstart',
      'touchend',
      'contextmenu',
      'keydown',
      'keyup',
      'keypress',
      'focusin'
    ]

    events.forEach(evt => document.addEventListener(evt, guard, true))

    return () => {
      events.forEach(evt => document.removeEventListener(evt, guard, true))
    }
  }, [isOpen, step])

  const handleNext = async () => {
    if (step?.id === 'avatar-upload') {
      unlockScroll()
    }
    // Navigate to Home after reward step (to show Shop button)
    if (step?.id === 'reward') {
      window.location.hash = '#home'
    }
    // Navigate to Home before quests-intro step (after buying board)
    if (step?.id === 'shop-free-board') {
      window.location.hash = '#home'
    }
    // Handle reward claim
    if (step?.type === 'reward' && step.reward && userId && !rewardClaimed) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('coins, metadata')
          .eq('user_id', userId)
          .maybeSingle()
        
        if (profile) {
          const newCoins = (profile.coins || 0) + step.reward.amount
          const newMetadata = { ...(profile.metadata || {}), onboarding_reward_claimed: true }
          
          await supabase
            .from('profiles')
            .update({ coins: newCoins, metadata: newMetadata })
            .eq('user_id', userId)
          
          setRewardClaimed(true)
          window.dispatchEvent(new CustomEvent('profileUpdated', { 
            detail: { field: 'currency', coins: newCoins } 
          }))
        }
      } catch (e) {
        console.error('Failed to claim reward:', e)
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      onComplete()
    }
  }

  useEffect(() => {
    handleNextRef.current = handleNext
  }, [handleNext])

  const handleChoice = (choiceId: string) => {
    if (step?.id === 'profile-choice') {
      setProfileDetailMode(choiceId === 'detail')
      setCurrentStep(prev => prev + 1)
    } else if (step?.id === 'final-choice') {
      setBranch(choiceId as 'battle' | 'ai')
      setCurrentStep(prev => prev + 1)
    } else if (step?.id === 'ask-about-ai') {
      // After battle branch, ask about AI
      if (choiceId === 'explore-ai') {
        setSecondBranch('ai')
      } else {
        setSecondBranch('skip')
      }
      setCurrentStep(prev => prev + 1)
    } else if (step?.id === 'ask-about-battle') {
      // After AI branch, ask about battle
      if (choiceId === 'explore-battle') {
        setSecondBranch('battle')
      } else {
        setSecondBranch('skip')
      }
      setCurrentStep(prev => prev + 1)
    }
  }

  // Handle skip - jump to quests-intro step if skipToQuests is enabled
  const handleSkip = () => {
    if (skipToQuests) {
      // Find the quests-intro step index
      const questsStepIndex = steps.findIndex(s => s.id === 'quests-intro')
      if (questsStepIndex !== -1 && currentStep < questsStepIndex) {
        // Navigate to home first, then jump to quests step
        window.location.hash = '#home'
        setTimeout(() => {
          setCurrentStep(questsStepIndex)
        }, 300)
        return
      }
    }
    // Default behavior - close tour
    onSkip()
  }

  // Avatar upload step: wait for user to click Next button, not the file input
  // This allows the user to upload an avatar and see the result before proceeding

  if (!isOpen || !step) return null

  const isCenterPosition = step.position === 'center' || !targetRect

  const isMobile = window.innerWidth < 768

  const getTooltipStyle = (): React.CSSProperties => {
    // On mobile, always center tooltips for better UX
    if (isMobile) {
      // Bottom-left position on mobile - show at bottom with full width
      if (step.position === 'bottom-left') {
        return {
          position: 'fixed',
          bottom: '16px',
          left: '8px',
          right: '8px',
          width: 'auto',
          maxWidth: 'calc(100vw - 16px)',
          zIndex: 100002
        }
      }
      // For all other positions on mobile, center the tooltip
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'calc(100vw - 32px)',
        maxWidth: '400px',
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
        zIndex: 100002
      }
    }

    // Desktop: Center the avatar guidance panel regardless of target to avoid covering UI
    if (step.id === 'avatar-upload') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(440px, 92vw)',
        zIndex: 100002
      }
    }

    // Bottom-left position - small compact tooltip
    if (step.position === 'bottom-left') {
      return {
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        width: 'min(320px, 85vw)',
        zIndex: 100002
      }
    }
    
    // For center position or no target, center the tooltip
    if (isCenterPosition) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(440px, 92vw)',
        zIndex: 100002
      }
    }
    
    // Position tooltip relative to target element
    const tooltipWidth = Math.min(380, window.innerWidth - 32)
    const verticalPadding = step.position === 'bottom' ? 48 : 16
    
    let top = 0
    let left = 0
    
    // Position based on step.position
    if (step.position === 'top') {
      // Position above target with extra spacing
      const tooltipHeight = 280 // Estimated tooltip height
      top = targetRect!.top - tooltipHeight - 24
      left = targetRect!.left + (targetRect!.width / 2) - (tooltipWidth / 2)
      
      // If goes above viewport, position below instead
      if (top < 16) {
        top = targetRect!.bottom + 24
      }
    } else if (step.position === 'right') {
      // Position to the right of target
      top = targetRect!.top
      left = targetRect!.right + 16
      
      // If goes off right edge, position below instead
      if (left + tooltipWidth > window.innerWidth - 16) {
        top = targetRect!.bottom + verticalPadding
        left = targetRect!.left
      }
    } else {
      // Default: position below target, aligned to left edge
      top = targetRect!.bottom + verticalPadding
      left = targetRect!.left
    }
    
    // Keep within viewport
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16
    }
    if (left < 16) left = 16
    
    // If tooltip would go below viewport, position above target
    if (top + 350 > window.innerHeight) {
      top = targetRect!.top - 350 - 16
      if (top < 16) top = 16
    }
    
    return { 
      position: 'fixed', 
      top: `${top}px`, 
      left: `${left}px`, 
      width: `${tooltipWidth}px`,
      zIndex: 100002 
    }
  }

  // Calculate spotlight area with padding
  const spotlight = targetRect && targetRect.width > 0 && !isCenterPosition ? {
    top: targetRect.top - 8,
    left: targetRect.left - 8,
    width: targetRect.width + 16,
    height: targetRect.height + 16,
    right: targetRect.left + targetRect.width + 8,
    bottom: targetRect.top + targetRect.height + 8
  } : null

  // Use Portal to render directly to document.body, bypassing any parent transforms
  return createPortal(
    <div className="onboarding-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 100000, pointerEvents: 'none'
    }}>
      {/* Dark overlay using 4 rectangles around spotlight - skip if noOverlay */}
      {!step.noOverlay && (
        spotlight ? (
          <>
            {/* Top */}
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0,
              height: `${spotlight.top}px`,
              background: 'rgba(2, 6, 23, 0.88)',
              pointerEvents: 'none'
            }} />
            {/* Bottom */}
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              top: `${spotlight.bottom}px`,
              background: 'rgba(2, 6, 23, 0.88)',
              pointerEvents: 'none'
            }} />
            {/* Left */}
            <div style={{
              position: 'fixed',
              top: `${spotlight.top}px`,
              left: 0,
              width: `${spotlight.left}px`,
              height: `${spotlight.height}px`,
              background: 'rgba(2, 6, 23, 0.88)',
              pointerEvents: 'none'
            }} />
            {/* Right */}
            <div style={{
              position: 'fixed',
              top: `${spotlight.top}px`,
              right: 0,
              left: `${spotlight.right}px`,
              height: `${spotlight.height}px`,
              background: 'rgba(2, 6, 23, 0.88)',
              pointerEvents: 'none'
            }} />
          </>
        ) : (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(2, 6, 23, 0.88)',
            pointerEvents: 'none'
          }} />
        )
      )}

      {/* Highlight border around target */}
      {spotlight && (
        <div style={{
          position: 'fixed',
          top: `${spotlight.top}px`, 
          left: `${spotlight.left}px`,
          width: `${spotlight.width}px`, 
          height: `${spotlight.height}px`,
          border: '2px solid rgba(45, 212, 191, 0.9)',
          borderRadius: '12px',
          boxShadow: '0 0 20px rgba(45, 212, 191, 0.6), inset 0 0 20px rgba(45, 212, 191, 0.1)',
          pointerEvents: 'none',
          animation: 'pulse-glow 2s ease-in-out infinite',
          zIndex: 100001
        }} />
      )}

      {/* Tooltip */}
      <div ref={tooltipRef} style={{
        ...getTooltipStyle(),
        background: 'linear-gradient(145deg, rgba(15, 30, 50, 0.98) 0%, rgba(10, 22, 40, 0.98) 100%)',
        borderRadius: step.position === 'bottom-left' ? '16px' : '24px',
        padding: step.position === 'bottom-left' ? '16px' : '28px',
        border: '1px solid rgba(45, 212, 191, 0.3)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(45, 212, 191, 0.15)',
        pointerEvents: 'auto'
      }}>
        {/* Progress - hide for compact bottom-left */}
        {step.position !== 'bottom-left' && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', justifyContent: 'center' }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: i === currentStep ? '20px' : '6px', height: '6px',
                borderRadius: '3px',
                background: i === currentStep ? 'linear-gradient(90deg, #2dd4bf, #6366f1)' 
                  : i < currentStep ? 'rgba(45, 212, 191, 0.5)' : 'rgba(100, 116, 139, 0.3)',
                transition: 'all 0.3s'
              }} />
            ))}
          </div>
        )}

        {/* Icon */}
        <div style={{
          width: step.position === 'bottom-left' ? '40px' : '64px',
          height: step.position === 'bottom-left' ? '40px' : '64px',
          margin: '0 auto 12px',
          background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
          borderRadius: step.position === 'bottom-left' ? '12px' : '18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: step.position === 'bottom-left' ? '20px' : '32px',
          border: '1px solid rgba(45, 212, 191, 0.2)'
        }}>
          {step.id === 'welcome' && '👋'}
          {step.id === 'profile-intro' && '👤'}
          {step.id === 'profile-overview' && '📊'}
          {step.id === 'profile-choice' && '⚙️'}
          {step.id === 'go-to-settings' && '⚙️'}
          {step.id === 'avatar-upload' && '📸'}
          {step.id === 'sound-tab' && '🔊'}
          {step.id === 'sound-settings' && '🔊'}
          {step.id === 'notifications-tab' && '🔔'}
          {step.id === 'notification-settings' && '🔔'}
          {step.id === 'ui-tab' && '🎨'}
          {step.id === 'ui-settings' && '🎨'}
          {step.id === 'language-tab' && '🌐'}
          {step.id === 'language-settings' && '🌐'}
          {step.id === 'match-history-tab' && '📜'}
          {step.id === 'match-history' && '📜'}
          {step.id === 'menu-overview' && '📋'}
          {step.id === 'currency' && <img src="/currency.jpg" alt="currency" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
          {step.id === 'reward' && '🎁'}
          {step.id === 'shop-intro' && '🏯'}
          {step.id === 'shop-free-chess' && '♟️'}
          {step.id === 'shop-confirm-chess' && '✅'}
          {step.id === 'shop-success-chess' && '🎉'}
          {step.id === 'shop-free-board' && '🎲'}
          {step.id === 'shop-confirm-board' && '✅'}
          {step.id === 'shop-success-board' && '🎉'}
          {step.id === 'quests-intro' && '📜'}
          {step.id === 'quests-overview' && '📋'}
          {step.id === 'claim-first-quest' && '🎯'}
          {step.id === 'shop-inventory' && '🛍️'}
          {step.id === 'final-choice' && '🤔'}
          {step.id === 'quick-match' && '⚡'}
          {step.id === 'game-modes' && '🎯'}
          {step.id === 'social-card' && '👥'}
          {step.id === 'ai-analysis' && '🧠'}
          {step.id === 'training-mode' && '🤖'}
          {step.id === 'complete' && '🎊'}
        </div>

        {/* Title */}
        <h3 style={{
          margin: '0 0 8px',
          fontSize: step.position === 'bottom-left' ? '16px' : '22px',
          fontWeight: 700,
          color: '#f1f5f9', textAlign: 'center'
        }}>{step.title}</h3>

        {/* Description */}
        <div style={{
          margin: '0 0 16px',
          fontSize: step.position === 'bottom-left' ? '13px' : '14px',
          color: '#94a3b8',
          textAlign: 'center', lineHeight: 1.6, whiteSpace: 'pre-line'
        }}>
          {step.id === 'currency' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <img src="/coin.png" alt="coin" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                <span>Tinh Thạch (Coins) - Mua vật phẩm cơ bản</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <img src="/gem.png" alt="gem" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                <span>Nguyên Thần (Gems) - Vật phẩm cao cấp</span>
              </div>
              <div style={{ marginTop: '8px' }}>Hoàn thành nhiệm vụ để nhận thưởng!</div>
            </div>
          ) : (
            step.description
          )}
        </div>

        {/* Reward display */}
        {step.type === 'reward' && step.reward && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)',
            borderRadius: '16px', padding: '16px', marginBottom: '20px',
            border: '1px solid rgba(251, 191, 36, 0.3)', textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>
              {step.reward.type === 'coins' ? (
                <img src="/coin.png" alt="coin" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
              ) : (
                <img src="/gem.png" alt="gem" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
              )}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#fbbf24' }}>
              +{step.reward.amount} {step.reward.type === 'coins' ? t('shop.coins') : t('shop.gems')}
            </div>
            {rewardClaimed && (
              <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '8px' }}>✓ {t('quests.claimed')}</div>
            )}
          </div>
        )}

        {/* Choice buttons */}
        {step.type === 'choice' && step.choices && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            {step.choices.map(choice => (
              <button key={choice.id} onClick={() => handleChoice(choice.id)} style={{
                flex: 1, padding: '16px 12px', borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
                border: '1px solid rgba(45, 212, 191, 0.3)', color: '#f1f5f9',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(45, 212, 191, 0.6)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(45, 212, 191, 0.3)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <span style={{ fontSize: '24px' }}>{choice.icon}</span>
                <span>{choice.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Navigation */}
        {step.type !== 'choice' && (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
            {step.type === 'click' ? (
              <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                {ob('general.clickInstruction')}
              </div>
            ) : (
              <>
                {/* Back button - show from step 1 onwards */}
                {currentStep > 0 && (
                  <button onClick={() => setCurrentStep(prev => prev - 1)} style={{
                    padding: '14px 20px', borderRadius: '14px',
                    background: 'transparent',
                    border: '1px solid rgba(100, 116, 139, 0.4)',
                    color: '#94a3b8', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.7)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.4)' }}
                  >
                    {ob('general.back')}
                  </button>
                )}
                <button onClick={handleNext} style={{
                  padding: '14px 32px', borderRadius: '14px', border: 'none',
                  background: 'linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)',
                  color: '#042f2e', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(45, 212, 191, 0.35)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(45, 212, 191, 0.45)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(45, 212, 191, 0.35)' }}
                >
                  {(step.nextLabel || (currentStep === steps.length - 1 ? ob('general.finish') : ob('general.next')))} ?
                </button>
              </>
            )}
          </div>
        )}

        {/* Skip */}
        {currentStep < steps.length - 1 && step.type !== 'choice' && (
          <button onClick={handleSkip} style={{
            marginTop: '16px', padding: '10px', background: 'transparent',
            border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', width: '100%'
          }}>
            {step.skipLabel || ob('general.skip')}
          </button>
        )}

        {/* Step counter - hide for compact bottom-left */}
        {step.position !== 'bottom-left' && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>
            {currentStep + 1} / {steps.length}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(45, 212, 191, 0.4); }
          50% { box-shadow: 0 0 40px rgba(45, 212, 191, 0.7); }
        }
      `}</style>
    </div>,
    document.body
  )
}
