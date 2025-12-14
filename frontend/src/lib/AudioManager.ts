/**
 * AudioManager - Global Audio System for MindPoint Arena
 * Handles background music, sound effects, and volume control
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
  private isValidMediaUrl(url?: string | null) {
    if (!url) return false
    const trimmed = url.trim()
    // Reject empty or obviously invalid URLs
    if (!trimmed || trimmed.length < 10) return false
    // Reject multipart form data artifacts
    if (trimmed.includes('WebKitFormBoundary')) return false
    // Accept http/https URLs
    if (/^https?:\/\//i.test(trimmed)) return true
    // Accept relative URLs starting with /
    if (trimmed.startsWith('/')) return true
    return false
  }

  /**
   * Initialize audio system with settings
   */
  initialize(settings: AudioSettings) {
    if (this.initialized) return
    
    this.settings = settings
    this.initialized = true
    this.preloadSfx()
    
    console.log('[AudioManager] Initialized with settings:', settings)
  }

  /**
   * Ensure AudioContext exists
   */
  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext()
    }
    return this.audioCtx
  }

  /**
   * Sync settings from localStorage to ensure volume is up-to-date
   */
  private syncSettingsFromStorage() {
    try {
      const stored = localStorage.getItem('gameSettings')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.bgMusicVolume === 'number') {
          this.settings.bgMusicVolume = parsed.bgMusicVolume
        }
        if (typeof parsed.sfxVolume === 'number') {
          this.settings.sfxVolume = parsed.sfxVolume
        }
        if (typeof parsed.bgMusic === 'boolean') {
          this.settings.bgMusic = parsed.bgMusic
        }
        if (typeof parsed.sfxEnabled === 'boolean') {
          this.settings.sfxEnabled = parsed.sfxEnabled
        }
        if (typeof parsed.moveSoundEnabled === 'boolean') {
          this.settings.moveSoundEnabled = parsed.moveSoundEnabled
        }
      }
    } catch (e) {
      console.warn('[AudioManager] Failed to sync settings from storage:', e)
    }
  }

  /**
   * Start background music from file
   * For Supabase URLs, fetch as blob to bypass MIME type issues
   */
  private async startBgLoop() {
    // Stop existing
    this.stopBackgroundMusic()
    
    // Sync settings from localStorage to get latest volume
    this.syncSettingsFromStorage()

    const url = this.currentMusicUrl
    console.log('[AudioManager] Starting background music:', url, 'volume:', this.settings.bgMusicVolume)

    // For Supabase Storage URLs, fetch as blob to bypass MIME type issues
    if (url.includes('supabase.co/storage')) {
      try {
        console.log('[AudioManager] Fetching Supabase audio as blob...')
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        // Get the blob and create object URL with correct type
        const blob = await response.blob()
        console.log('[AudioManager] Blob received:', { size: blob.size, type: blob.type })
        
        // Create a new blob with correct audio MIME type if needed
        const audioBlob = blob.type.startsWith('audio/') 
          ? blob 
          : new Blob([blob], { type: 'audio/mpeg' })
        
        const blobUrl = URL.createObjectURL(audioBlob)
        console.log('[AudioManager] Created blob URL:', blobUrl)
        
        this.bgMusicElement = new Audio(blobUrl)
        this.bgMusicElement.preload = 'auto'
        this.bgMusicElement.loop = true
        this.bgMusicElement.volume = this.settings.bgMusicVolume / 100
        
        this.bgMusicElement.onerror = (ev) => {
          console.error('[AudioManager] Audio error for bg music (blob):', ev)
          URL.revokeObjectURL(blobUrl)
          if (this.currentMusicUrl !== this.defaultMusicUrl) {
            console.log('[AudioManager] Falling back to default music')
            this.currentMusicUrl = this.defaultMusicUrl
            this.currentMusicId = null
            this.startBgLoop()
          }
        }
        
        this.bgMusicElement.oncanplaythrough = () => {
          console.log('[AudioManager] Audio can play through (blob)')
        }
        
        await this.bgMusicElement.play()
        console.log('[AudioManager] Background music playing successfully (blob)')
        return
      } catch (err) {
        console.error('[AudioManager] Failed to fetch Supabase audio:', err)
        // Fallback to default music
        if (this.currentMusicUrl !== this.defaultMusicUrl) {
          console.log('[AudioManager] Falling back to default music after fetch error')
          this.currentMusicUrl = this.defaultMusicUrl
          this.currentMusicId = null
          this.startBgLoop()
        }
        return
      }
    }

    // For local/other URLs, use standard approach
    this.bgMusicElement = new Audio()
    this.bgMusicElement.preload = 'auto'
    this.bgMusicElement.loop = true
    this.bgMusicElement.volume = this.settings.bgMusicVolume / 100
    console.log('[AudioManager] Setting volume for local URL:', this.settings.bgMusicVolume / 100)

    this.bgMusicElement.onerror = (ev) => {
      console.error('[AudioManager] Audio error for bg music:', ev, 'url:', this.currentMusicUrl)
      // Try to fallback to default if custom music fails
      if (this.currentMusicUrl !== this.defaultMusicUrl) {
        console.log('[AudioManager] Falling back to default music')
        this.currentMusicUrl = this.defaultMusicUrl
        this.currentMusicId = null
        this.startBgLoop()
      }
    }

    this.bgMusicElement.oncanplaythrough = () => {
      console.log('[AudioManager] Audio can play through:', this.currentMusicUrl)
    }

    this.bgMusicElement.src = this.currentMusicUrl
    this.bgMusicElement.load()
    this.bgMusicElement
      .play()
      .then(() => {
        console.log('[AudioManager] Background music playing successfully')
      })
      .catch(err => {
        console.warn('[AudioManager] Background music play failed:', err)
      })
  }

  /**
   * Set custom background music
   * @param url - URL of the music file, or null to use default
   * @param id - ID of the music item (for tracking)
   */
  setBackgroundMusic(url: string | null, id: string | null = null) {
    // Sync settings from localStorage first to get latest volume
    this.syncSettingsFromStorage()
    
    const isValid = this.isValidMediaUrl(url)
    const chosen = isValid ? url! : this.defaultMusicUrl
    
    console.log('[AudioManager] setBackgroundMusic called:', { 
      inputUrl: url, 
      isValid, 
      chosenUrl: chosen,
      id,
      initialized: this.initialized,
      bgMusicEnabled: this.settings.bgMusic,
      currentVolume: this.settings.bgMusicVolume
    })
    
    this.currentMusicUrl = chosen
    this.currentMusicId = id

    // If not initialized yet, just store the URL - it will be used when playBackgroundMusic is called
    if (!this.initialized) {
      console.log('[AudioManager] Not initialized yet, storing URL for later')
      return
    }

    // Only play if music is enabled AND volume > 0
    const shouldPlay = this.settings.bgMusic && this.settings.bgMusicVolume > 0
    
    if (shouldPlay) {
      this.stopBackgroundMusic()
      this.playBackgroundMusic()
    } else {
      // ensure element cleared when music is off or volume is 0
      this.stopBackgroundMusic()
      console.log('[AudioManager] Music not started (bgMusic:', this.settings.bgMusic, 'volume:', this.settings.bgMusicVolume, ')')
    }

    console.log('[AudioManager] Background music set:', { url: this.currentMusicUrl, id, shouldPlay })
  }

  /**
   * Get current music ID
   */
  getCurrentMusicId(): string | null {
    return this.currentMusicId
  }

  /**
   * Get current music URL
   */
  getCurrentMusicUrl(): string {
    return this.currentMusicUrl
  }

  private appendDownloadParam(url: string): string {
    if (!url) return url
    return url
  }

  /**
   * Play background music
   */
  playBackgroundMusic() {
    console.log('[AudioManager] playBackgroundMusic called:', {
      bgMusicEnabled: this.settings.bgMusic,
      initialized: this.initialized,
      currentUrl: this.currentMusicUrl,
      hasElement: !!this.bgMusicElement
    })
    
    if (!this.settings.bgMusic) {
      console.log('[AudioManager] Background music disabled in settings')
      return
    }

    // If already playing, just resume
    if (this.bgMusicElement) {
      console.log('[AudioManager] Resuming existing audio element')
      this.bgMusicElement.play().catch(err => {
        console.warn('[AudioManager] Resume background music failed:', err)
      })
      return
    }

    // Start new background music (async but we don't await)
    console.log('[AudioManager] Starting new background music loop')
    void this.startBgLoop()
  }

  /**
   * Pause background music
   */
  pauseBackgroundMusic() {
    this.stopBackgroundMusic()
  }

  /**
   * Stop background music and reset to beginning
   */
  stopBackgroundMusic() {
    if (this.bgMusicElement) {
      this.bgMusicElement.pause()
      this.bgMusicElement.currentTime = 0
      this.bgMusicElement = null
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
   * Preload sound effects from /audio/sfx
   */
  private preloadSfx() {
    const sfxList: SoundEffect[] = [
      'move',
      'win', 
      'lose',
      'draw',
      'notification',
      'button',
      'error',
      'friend-request',
      'chat-message',
      'purchase'
    ]

    sfxList.forEach(effect => {
      const audio = new Audio()
      audio.preload = 'auto'
      // Dung wav truc tiep de tranh request mp3 khong ton tai tra ve HTML
      audio.src = `/audio/sfx/${effect}.wav`
      audio.volume = this.settings.sfxVolume / 100
      this.sfxElements.set(effect, audio)
    })
  }

  /**
   * Play a sound effect
   */
  playSoundEffect(effect: SoundEffect) {
    if (!this.settings.sfxEnabled) return
    
    // Special case: move sound can be disabled separately
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

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...newSettings }

    // Determine effective volume (use new value if provided, else current)
    const effectiveVolume = newSettings.bgMusicVolume ?? this.settings.bgMusicVolume
    const effectiveBgMusic = newSettings.bgMusic ?? this.settings.bgMusic
    
    // Apply volume changes for background music
    if (this.bgMusicElement) {
      this.bgMusicElement.volume = effectiveVolume / 100
    }
    
    // Handle music play/pause based on both bgMusic toggle AND volume
    // Music should only play if: bgMusic = true AND volume > 0
    const shouldPlay = effectiveBgMusic && effectiveVolume > 0
    
    if (shouldPlay) {
      // Should be playing
      if (this.bgMusicElement) {
        if (this.bgMusicElement.paused) {
          this.bgMusicElement.play().catch(err => {
            console.warn('[AudioManager] Resume music failed:', err)
          })
          console.log('[AudioManager] Background music resumed')
        }
      } else {
        // No element yet, start new
        this.playBackgroundMusic()
      }
    } else {
      // Should be paused (either bgMusic = false OR volume = 0)
      if (this.bgMusicElement && !this.bgMusicElement.paused) {
        this.bgMusicElement.pause()
        console.log('[AudioManager] Background music paused (bgMusic:', effectiveBgMusic, 'volume:', effectiveVolume, ')')
      }
    }
    
    // Apply volume changes for SFX
    if (newSettings.sfxVolume !== undefined && newSettings.sfxVolume <= 0) {
      this.settings.sfxEnabled = false
    }
    if (this.sfxElements.size && newSettings.sfxVolume !== undefined) {
      const vol = newSettings.sfxVolume / 100
      this.sfxElements.forEach(a => { a.volume = vol })
    }

    console.log('[AudioManager] Settings updated:', this.settings, 'shouldPlay:', shouldPlay)
  }

  /**
   * Get current settings
   */
  getSettings(): AudioSettings {
    return { ...this.settings }
  }

  /**
   * Check if audio is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Cleanup - stop all audio
   */
  cleanup() {
    this.stopBackgroundMusic()
    if (this.audioCtx) {
      try { this.audioCtx.close() } catch (e) {}
      this.audioCtx = null
    }
    this.initialized = false
    console.log('[AudioManager] Cleanup complete')
  }
}

// Export singleton instance
export const AudioManager = new AudioManagerClass()

// Helper function to load audio settings from localStorage
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

  // Return defaults
  return {
    bgMusic: true,
    bgMusicVolume: 70,
    sfxEnabled: true,
    sfxVolume: 80,
    moveSoundEnabled: true
  }
}
