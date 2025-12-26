/**
 * AudioManager - Global Audio System for MindPoint Arena
 * Handles background music, sound effects, and volume control
 * 
 * IMPORTANT: Chỉ cho phép 1 nhạc nền phát tại 1 thời điểm
 * Khi đổi nhạc sẽ crossfade mượt mà
 */

export interface AudioSettings {
  bgMusic: boolean
  bgMusicVolume: number
  sfxEnabled: boolean
  sfxVolume: number
  moveSoundEnabled: boolean
}

export type SoundEffect = 
  | 'move' 
  | 'win' 
  | 'lose' 
  | 'draw'
  | 'notification'
  | 'button'
  | 'error'
  | 'friend-request'
  | 'chat-message'
  | 'purchase'

class AudioManagerClass {
  private audioCtx: AudioContext | null = null
  private bgGain: GainNode | null = null
  private bgSources: OscillatorNode[] = []
  private bgMusicElement: HTMLAudioElement | null = null
  private sfxElements: Map<SoundEffect, HTMLAudioElement> = new Map()
  private settings: AudioSettings = {
    bgMusic: true,
    bgMusicVolume: 70,
    sfxEnabled: true,
    sfxVolume: 80,
    moveSoundEnabled: true
  }
  private initialized = false
  
  // Custom music support
  private currentMusicUrl: string = '/assets/music/Saos.wav'
  private currentMusicId: string | null = null
  private defaultMusicUrl: string = '/assets/music/Saos.wav'
  
  // Crossfade và tracking - đảm bảo chỉ 1 nhạc phát
  private crossfadeDuration: number = 500 // ms
  private musicLoadId: number = 0 // Track để cancel async operations
  private fadingOutElement: HTMLAudioElement | null = null
  
  private isValidMediaUrl(url?: string | null) {
    if (!url) return false
    const trimmed = url.trim()
    if (!trimmed || trimmed.length < 10) return false
    if (trimmed.includes('WebKitFormBoundary')) return false
    if (/^https?:\/\//i.test(trimmed)) return true
    if (trimmed.startsWith('/')) return true
    return false
  }

  initialize(settings: AudioSettings) {
    if (this.initialized) return
    this.settings = settings
    this.initialized = true
    this.preloadSfx()
    console.log('[AudioManager] Initialized with settings:', settings)
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext()
    }
    return this.audioCtx
  }

  private syncSettingsFromStorage() {
    try {
      const stored = localStorage.getItem('gameSettings')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.bgMusicVolume === 'number') this.settings.bgMusicVolume = parsed.bgMusicVolume
        if (typeof parsed.sfxVolume === 'number') this.settings.sfxVolume = parsed.sfxVolume
        if (typeof parsed.bgMusic === 'boolean') this.settings.bgMusic = parsed.bgMusic
        if (typeof parsed.sfxEnabled === 'boolean') this.settings.sfxEnabled = parsed.sfxEnabled
        if (typeof parsed.moveSoundEnabled === 'boolean') this.settings.moveSoundEnabled = parsed.moveSoundEnabled
      }
    } catch (e) {
      console.warn('[AudioManager] Failed to sync settings from storage:', e)
    }
  }

  /**
   * Fade out một audio element
   */
  private fadeOut(element: HTMLAudioElement, duration: number): Promise<void> {
    return new Promise((resolve) => {
      const startVolume = element.volume
      const steps = 20
      const stepDuration = duration / steps
      const volumeStep = startVolume / steps
      let currentStep = 0

      const fade = setInterval(() => {
        currentStep++
        element.volume = Math.max(0, startVolume - (volumeStep * currentStep))
        
        if (currentStep >= steps) {
          clearInterval(fade)
          element.pause()
          element.currentTime = 0
          resolve()
        }
      }, stepDuration)
    })
  }

  /**
   * Fade in một audio element
   */
  private fadeIn(element: HTMLAudioElement, targetVolume: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      element.volume = 0
      const steps = 20
      const stepDuration = duration / steps
      const volumeStep = targetVolume / steps
      let currentStep = 0

      const fade = setInterval(() => {
        currentStep++
        element.volume = Math.min(targetVolume, volumeStep * currentStep)
        
        if (currentStep >= steps) {
          clearInterval(fade)
          element.volume = targetVolume
          resolve()
        }
      }, stepDuration)
    })
  }

  /**
   * Stop tất cả nhạc nền đang phát (bao gồm cả đang fade)
   */
  private stopAllBgMusic() {
    // Stop element chính
    if (this.bgMusicElement) {
      this.bgMusicElement.pause()
      this.bgMusicElement.currentTime = 0
      this.bgMusicElement = null
    }
    // Stop element đang fade out
    if (this.fadingOutElement) {
      this.fadingOutElement.pause()
      this.fadingOutElement.currentTime = 0
      this.fadingOutElement = null
    }
    // Legacy oscillator cleanup
    if (this.bgSources.length) {
      this.bgSources.forEach(osc => {
        try { osc.stop() } catch (e) {}
        try { osc.disconnect() } catch (e) {}
      })
      this.bgSources = []
    }
    if (this.bgGain) {
      try { this.bgGain.disconnect() } catch (e) {}
      this.bgGain = null
    }
  }

  /**
   * Start background music với crossfade
   */
  private async startBgLoop(loadId: number) {
    this.syncSettingsFromStorage()
    const url = this.currentMusicUrl
    const targetVolume = this.settings.bgMusicVolume / 100
    
    console.log('[AudioManager] Starting background music:', url, 'loadId:', loadId)

    // Nếu có nhạc đang phát, fade out trước
    if (this.bgMusicElement && !this.bgMusicElement.paused) {
      console.log('[AudioManager] Crossfading from current music')
      this.fadingOutElement = this.bgMusicElement
      this.bgMusicElement = null
      // Fade out async, không đợi
      this.fadeOut(this.fadingOutElement, this.crossfadeDuration).then(() => {
        this.fadingOutElement = null
      })
    }

    let newAudio: HTMLAudioElement

    // Supabase URLs - fetch as blob
    if (url.includes('supabase.co/storage')) {
      try {
        console.log('[AudioManager] Fetching Supabase audio as blob...')
        const response = await fetch(url)
        
        // Check nếu loadId đã thay đổi (user đổi nhạc khác)
        if (loadId !== this.musicLoadId) {
          console.log('[AudioManager] Load cancelled - newer request exists')
          return
        }
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        
        const blob = await response.blob()
        
        // Check lại loadId
        if (loadId !== this.musicLoadId) {
          console.log('[AudioManager] Load cancelled after blob fetch')
          return
        }
        
        const audioBlob = blob.type.startsWith('audio/') ? blob : new Blob([blob], { type: 'audio/mpeg' })
        const blobUrl = URL.createObjectURL(audioBlob)
        
        newAudio = new Audio(blobUrl)
        newAudio.preload = 'auto'
        newAudio.loop = true
        newAudio.volume = 0 // Start at 0 for fade in
        
        newAudio.onerror = () => {
          console.error('[AudioManager] Audio error for blob')
          URL.revokeObjectURL(blobUrl)
          if (loadId === this.musicLoadId && this.currentMusicUrl !== this.defaultMusicUrl) {
            this.currentMusicUrl = this.defaultMusicUrl
            this.currentMusicId = null
            this.startBgLoop(loadId)
          }
        }
      } catch (err) {
        console.error('[AudioManager] Failed to fetch Supabase audio:', err)
        if (loadId === this.musicLoadId && this.currentMusicUrl !== this.defaultMusicUrl) {
          this.currentMusicUrl = this.defaultMusicUrl
          this.currentMusicId = null
          this.startBgLoop(loadId)
        }
        return
      }
    } else {
      // Local URLs
      newAudio = new Audio()
      newAudio.preload = 'auto'
      newAudio.loop = true
      newAudio.volume = 0 // Start at 0 for fade in
      newAudio.src = url
      
      newAudio.onerror = () => {
        console.error('[AudioManager] Audio error for:', url)
        if (loadId === this.musicLoadId && this.currentMusicUrl !== this.defaultMusicUrl) {
          this.currentMusicUrl = this.defaultMusicUrl
          this.currentMusicId = null
          this.startBgLoop(loadId)
        }
      }
    }

    // Final check trước khi play
    if (loadId !== this.musicLoadId) {
      console.log('[AudioManager] Load cancelled before play')
      return
    }

    // Set element và play
    this.bgMusicElement = newAudio
    
    try {
      await newAudio.play()
      
      // Check lại sau khi play
      if (loadId !== this.musicLoadId) {
        newAudio.pause()
        return
      }
      
      // Fade in
      await this.fadeIn(newAudio, targetVolume, this.crossfadeDuration)
      console.log('[AudioManager] Background music playing successfully')
    } catch (err) {
      console.warn('[AudioManager] Background music play failed:', err)
    }
  }

  /**
   * Set custom background music - CHỈ CHO PHÉP 1 NHẠC PHÁT
   */
  setBackgroundMusic(url: string | null, id: string | null = null) {
    this.syncSettingsFromStorage()
    
    const isValid = this.isValidMediaUrl(url)
    const chosen = isValid ? url! : this.defaultMusicUrl
    
    // Nếu URL giống nhạc đang phát, không làm gì
    if (chosen === this.currentMusicUrl && this.bgMusicElement && !this.bgMusicElement.paused) {
      console.log('[AudioManager] Same music already playing, skipping')
      return
    }
    
    console.log('[AudioManager] setBackgroundMusic:', { url: chosen, id })
    
    this.currentMusicUrl = chosen
    this.currentMusicId = id
    
    // Tăng loadId để cancel các async operations cũ
    this.musicLoadId++
    const currentLoadId = this.musicLoadId

    if (!this.initialized) {
      console.log('[AudioManager] Not initialized, storing URL for later')
      return
    }

    const shouldPlay = this.settings.bgMusic && this.settings.bgMusicVolume > 0
    
    if (shouldPlay) {
      // Start với crossfade
      void this.startBgLoop(currentLoadId)
    } else {
      this.stopAllBgMusic()
      console.log('[AudioManager] Music not started (disabled or volume 0)')
    }
  }

  getCurrentMusicId(): string | null {
    return this.currentMusicId
  }

  getCurrentMusicUrl(): string {
    return this.currentMusicUrl
  }

  playBackgroundMusic() {
    console.log('[AudioManager] playBackgroundMusic called')
    
    if (!this.settings.bgMusic) {
      console.log('[AudioManager] Background music disabled')
      return
    }

    // Nếu đang phát, chỉ resume
    if (this.bgMusicElement && this.bgMusicElement.paused) {
      console.log('[AudioManager] Resuming paused music')
      this.bgMusicElement.play().catch(err => {
        console.warn('[AudioManager] Resume failed:', err)
      })
      return
    }

    // Nếu chưa có element, start mới
    if (!this.bgMusicElement) {
      this.musicLoadId++
      void this.startBgLoop(this.musicLoadId)
    }
  }

  pauseBackgroundMusic() {
    if (this.bgMusicElement) {
      this.bgMusicElement.pause()
    }
  }

  stopBackgroundMusic() {
    this.stopAllBgMusic()
  }

  private preloadSfx() {
    const sfxList: SoundEffect[] = [
      'move', 'win', 'lose', 'draw', 'notification',
      'button', 'error', 'friend-request', 'chat-message', 'purchase'
    ]

    sfxList.forEach(effect => {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.src = `/audio/sfx/${effect}.wav`
      audio.volume = this.settings.sfxVolume / 100
      this.sfxElements.set(effect, audio)
    })
  }

  playSoundEffect(effect: SoundEffect) {
    if (!this.settings.sfxEnabled) return
    if (effect === 'move' && !this.settings.moveSoundEnabled) return

    const ctx = this.ensureContext()
    if (!ctx) return

    const baseVol = (this.settings.sfxVolume / 100) * 0.25
    const toneMap: Record<SoundEffect, { freq: number, duration: number, volume?: number, rampDown?: boolean }> = {
      move: { freq: 660, duration: 80, volume: 0.8 },
      win: { freq: 880, duration: 320 },
      lose: { freq: 220, duration: 320, rampDown: true },
      draw: { freq: 440, duration: 180 },
      notification: { freq: 1200, duration: 140 },
      button: { freq: 520, duration: 90 },
      error: { freq: 180, duration: 200, rampDown: true },
      'friend-request': { freq: 760, duration: 200 },
      'chat-message': { freq: 640, duration: 120 },
      'purchase': { freq: 880, duration: 250 }
    }

    const spec = toneMap[effect]
    if (!spec) return

    const cached = this.sfxElements.get(effect)
    if (cached) {
      try {
        const clone = cached.cloneNode(true) as HTMLAudioElement
        clone.volume = this.settings.sfxVolume / 100
        void clone.play()
        return
      } catch (e) {
        console.warn(`[AudioManager] Fallback to tone for ${effect}:`, e)
      }
    }

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = spec.freq
    gain.gain.value = baseVol * (spec.volume ?? 1)
    osc.connect(gain).connect(ctx.destination)

    if (spec.rampDown) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(80, spec.freq / 2), ctx.currentTime + spec.duration / 1000)
    }

    osc.start()
    osc.stop(ctx.currentTime + spec.duration / 1000)
    osc.onended = () => {
      try { osc.disconnect() } catch (e) {}
      try { gain.disconnect() } catch (e) {}
    }
  }

  updateSettings(newSettings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...newSettings }

    const effectiveVolume = newSettings.bgMusicVolume ?? this.settings.bgMusicVolume
    const effectiveBgMusic = newSettings.bgMusic ?? this.settings.bgMusic
    
    if (this.bgMusicElement) {
      this.bgMusicElement.volume = effectiveVolume / 100
    }
    
    const shouldPlay = effectiveBgMusic && effectiveVolume > 0
    
    if (shouldPlay) {
      if (this.bgMusicElement) {
        if (this.bgMusicElement.paused) {
          this.bgMusicElement.play().catch(err => {
            console.warn('[AudioManager] Resume music failed:', err)
          })
        }
      } else {
        this.playBackgroundMusic()
      }
    } else {
      if (this.bgMusicElement && !this.bgMusicElement.paused) {
        this.bgMusicElement.pause()
      }
    }
    
    if (newSettings.sfxVolume !== undefined && newSettings.sfxVolume <= 0) {
      this.settings.sfxEnabled = false
    }
    if (this.sfxElements.size && newSettings.sfxVolume !== undefined) {
      const vol = newSettings.sfxVolume / 100
      this.sfxElements.forEach(a => { a.volume = vol })
    }

    console.log('[AudioManager] Settings updated:', this.settings)
  }

  getSettings(): AudioSettings {
    return { ...this.settings }
  }

  isInitialized(): boolean {
    return this.initialized
  }

  cleanup() {
    this.stopAllBgMusic()
    if (this.audioCtx) {
      try { this.audioCtx.close() } catch (e) {}
      this.audioCtx = null
    }
    this.initialized = false
    console.log('[AudioManager] Cleanup complete')
  }
}

export const AudioManager = new AudioManagerClass()

export function loadAudioSettingsFromStorage(): AudioSettings {
  try {
    const stored = localStorage.getItem('gameSettings')
    if (stored) {
      const settings = JSON.parse(stored)
      return {
        bgMusic: settings.bgMusic ?? true,
        bgMusicVolume: settings.bgMusicVolume ?? 70,
        sfxEnabled: settings.sfxEnabled ?? true,
        sfxVolume: settings.sfxVolume ?? 80,
        moveSoundEnabled: settings.moveSoundEnabled ?? true
      }
    }
  } catch (error) {
    console.error('[AudioManager] Failed to load settings from storage:', error)
  }

  return {
    bgMusic: true,
    bgMusicVolume: 70,
    sfxEnabled: true,
    sfxVolume: 80,
    moveSoundEnabled: true
  }
}
