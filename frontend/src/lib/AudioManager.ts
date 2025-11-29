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

class AudioManagerClass {
  private bgMusicAudio: HTMLAudioElement | null = null
  private soundEffects: Map<SoundEffect, HTMLAudioElement> = new Map()
  private settings: AudioSettings = {
    bgMusic: true,
    bgMusicVolume: 70,
    sfxEnabled: true,
    sfxVolume: 80,
    moveSoundEnabled: true
  }
  private initialized = false

  /**
   * Initialize audio system with settings
   */
  initialize(settings: AudioSettings) {
    if (this.initialized) return
    
    this.settings = settings
    this.loadAudioFiles()
    this.initialized = true
    
    console.log('[AudioManager] Initialized with settings:', settings)
  }

  /**
   * Load all audio files
   * Note: For production, replace placeholder URLs with actual audio files
   */
  private loadAudioFiles() {
    try {
      // Background Music - loopable ambient music
      // For now, using a placeholder. Replace with actual audio file path
      // Example: this.bgMusicAudio = new Audio('/assets/audio/bg-music.mp3')
      this.bgMusicAudio = this.createPlaceholderAudio('background-music')
      if (this.bgMusicAudio) {
        this.bgMusicAudio.loop = true
        this.bgMusicAudio.volume = this.settings.bgMusicVolume / 100
      }

      // Sound Effects - short audio clips
      const sfxList: SoundEffect[] = [
        'move',
        'win', 
        'lose',
        'draw',
        'notification',
        'button',
        'error',
        'friend-request',
        'chat-message'
      ]

      sfxList.forEach(sfx => {
        // Placeholder for now. Replace with actual audio files
        // Example: const audio = new Audio(`/assets/audio/sfx/${sfx}.mp3`)
        const audio = this.createPlaceholderAudio(sfx)
        if (audio) {
          audio.volume = this.settings.sfxVolume / 100
          this.soundEffects.set(sfx, audio)
        }
      })

      console.log('[AudioManager] Audio files loaded')
    } catch (error) {
      console.error('[AudioManager] Failed to load audio files:', error)
    }
  }

  /**
   * Create placeholder audio using Web Audio API
   * This generates simple tones until real audio files are provided
   */
  private createPlaceholderAudio(type: string): HTMLAudioElement | null {
    // For production, return null and load actual files instead
    // This is just a placeholder to avoid errors
    
    // You can replace this with actual audio file loading:
    // return new Audio(`/assets/audio/${type}.mp3`)
    
    return null // Disabled placeholder for now
  }

  /**
   * Play background music
   */
  playBackgroundMusic() {
    if (!this.settings.bgMusic || !this.bgMusicAudio) return

    try {
      this.bgMusicAudio.volume = this.settings.bgMusicVolume / 100
      this.bgMusicAudio.play().catch(err => {
        console.warn('[AudioManager] BG Music play failed (user interaction required):', err)
      })
    } catch (error) {
      console.error('[AudioManager] BG Music play error:', error)
    }
  }

  /**
   * Pause background music
   */
  pauseBackgroundMusic() {
    if (!this.bgMusicAudio) return
    
    try {
      this.bgMusicAudio.pause()
    } catch (error) {
      console.error('[AudioManager] BG Music pause error:', error)
    }
  }

  /**
   * Stop background music and reset to beginning
   */
  stopBackgroundMusic() {
    if (!this.bgMusicAudio) return
    
    try {
      this.bgMusicAudio.pause()
      this.bgMusicAudio.currentTime = 0
    } catch (error) {
      console.error('[AudioManager] BG Music stop error:', error)
    }
  }

  /**
   * Play a sound effect
   */
  playSoundEffect(effect: SoundEffect) {
    if (!this.settings.sfxEnabled) return
    
    // Special case: move sound can be disabled separately
    if (effect === 'move' && !this.settings.moveSoundEnabled) return

    const audio = this.soundEffects.get(effect)
    if (!audio) {
      console.warn(`[AudioManager] Sound effect "${effect}" not loaded`)
      return
    }

    try {
      // Clone audio to allow overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement
      clone.volume = this.settings.sfxVolume / 100
      clone.play().catch(err => {
        console.warn(`[AudioManager] SFX "${effect}" play failed:`, err)
      })
    } catch (error) {
      console.error(`[AudioManager] SFX "${effect}" play error:`, error)
    }
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...newSettings }

    // Apply volume changes
    if (this.bgMusicAudio && newSettings.bgMusicVolume !== undefined) {
      this.bgMusicAudio.volume = newSettings.bgMusicVolume / 100
    }

    // Update all sound effect volumes
    if (newSettings.sfxVolume !== undefined) {
      const volume = newSettings.sfxVolume / 100
      this.soundEffects.forEach(audio => {
        audio.volume = volume
      })
    }

    // Handle background music toggle
    if (newSettings.bgMusic !== undefined) {
      if (newSettings.bgMusic) {
        this.playBackgroundMusic()
      } else {
        this.pauseBackgroundMusic()
      }
    }

    console.log('[AudioManager] Settings updated:', this.settings)
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
    this.soundEffects.clear()
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
