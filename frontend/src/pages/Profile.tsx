import React from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { ReportModal } from '../components/report'
import { RankBadgeV2, RankProgressV2 } from '../components/rank'
import type { MainRank, RankTier, RankLevel } from '../types/rankV2'
import { AudioManager } from '../lib/AudioManager'
import { NotificationManager } from '../lib/NotificationManager'
import { validateUsernameInput } from '../lib/username'
import MusicSelector from '../components/settings/MusicSelector'
import { getEquippedTitle } from '../lib/titleApi'
import { EquippedTitleBadge } from '../components/title/TitleCard'
import { AvatarWithFrame, type AvatarFrameData } from '../components/avatar'
import { useEquippedFrame, getOwnedFrames } from '../hooks/useEquippedFrame'
import { MobileBreadcrumb } from '../components/layout'

const AVATAR_BUCKET = (import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || 'avatars').trim()
const USERNAME_ERROR_KEY_MAP = {
  empty: 'usernameErrorEmpty',
  short: 'usernameErrorShort',
  long: 'usernameErrorLong',
  invalid: 'usernameErrorInvalid'
} as const

export default function Profile() {
  const { language, setLanguage, t } = useLanguage()
  const [user, setUser] = React.useState<any>(null)
  const [analyzedMatches, setAnalyzedMatches] = React.useState<Set<string>>(new Set())
  const [profile, setProfile] = React.useState<any>(null)
  const [linkedProviders, setLinkedProviders] = React.useState<string[]>([])
  const [loadingProfile, setLoadingProfile] = React.useState(true)
  const [showUsernamePopup, setShowUsernamePopup] = React.useState(false)
  const [newUsername, setNewUsername] = React.useState('')
  const [usernameError, setUsernameError] = React.useState('')
  const [activeSection, setActiveSection] = React.useState<'overview' | 'settings' | 'history'>('overview')
  const [activeSettingsTab, setActiveSettingsTab] = React.useState<'account' | 'ui' | 'sound' | 'board' | 'notifications' | 'language' | 'other'>('account')
  const [matchHistory, setMatchHistory] = React.useState<any[]>([])
  const [showReportModal, setShowReportModal] = React.useState(false)
  const [reportTarget, setReportTarget] = React.useState<{ userId: string; matchId: string } | null>(null)
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)
  
  // Password change states
  const [showPasswordChange, setShowPasswordChange] = React.useState(false)
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [passwordError, setPasswordError] = React.useState('')
  const [passwordSuccess, setPasswordSuccess] = React.useState('')
  const [changingPassword, setChangingPassword] = React.useState(false)
  
  // Email change states
  const [showEmailChange, setShowEmailChange] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState('')
  const [emailError, setEmailError] = React.useState('')
  const [emailSuccess, setEmailSuccess] = React.useState('')
  const [changingEmail, setChangingEmail] = React.useState(false)
  
  // Phone change states
  const [showPhoneChange, setShowPhoneChange] = React.useState(false)
  const [newPhone, setNewPhone] = React.useState('')
  const [phoneError, setPhoneError] = React.useState('')
  const [phoneSuccess, setPhoneSuccess] = React.useState('')
  const [changingPhone, setChangingPhone] = React.useState(false)
  
  // Notification permission state
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationPermission>('default')
  
  // Equipped title state
  const [equippedTitle, setEquippedTitle] = React.useState<any>(null)
  
  // Avatar frame states
  const { frame: equippedFrame, equipFrame } = useEquippedFrame(user?.id)
  const [ownedFrames, setOwnedFrames] = React.useState<AvatarFrameData[]>([])
  const [showFrameSelector, setShowFrameSelector] = React.useState(false)

  // Load user data from Supabase
  React.useEffect(() => {
    loadUserData()
    
    // Check current notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])
  
  // Load equipped title when user is available
  React.useEffect(() => {
    if (user?.id) {
      getEquippedTitle(user.id).then(setEquippedTitle)
    }
  }, [user?.id])
  
  // Load owned frames when user is available
  React.useEffect(() => {
    if (user?.id) {
      getOwnedFrames(user.id).then(setOwnedFrames)
    }
  }, [user?.id])

  // Load match history when history section is active
  React.useEffect(() => {
    if (activeSection === 'history' && user) {
      loadMatchHistory()
    }
  }, [activeSection, user])

  async function loadUserData() {
    setLoadingProfile(true)
    try {
      const { data } = await supabase.auth.getUser()
      const u = data?.user ?? null
      setUser(u)
      
      if (u) {
        const providers = new Set<string>()
        if (u.identities) {
          u.identities.forEach((i: any) => providers.add(i.provider))
        }
        if (u.app_metadata?.provider) providers.add(u.app_metadata.provider as string)
        if (u.email) providers.add('email')
        setLinkedProviders(Array.from(providers))
      } else {
        setLinkedProviders([])
      }
      
      if (u) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', u.id)
          .maybeSingle()
        
        if (prof) {
          // Kiểm tra xem có vừa liên kết Facebook không và cần khôi phục profile
          // Hỗ trợ cả query string và hash routing
          const urlParams = new URLSearchParams(window.location.search)
          let justLinked = urlParams.get('linked')
          
          // Nếu không tìm thấy trong search, kiểm tra trong hash (cho hash routing)
          if (!justLinked && window.location.hash.includes('?')) {
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1])
            justLinked = hashParams.get('linked')
          }
          
          if (justLinked === 'facebook') {
            // Xóa param khỏi URL (hỗ trợ cả query string và hash routing)
            const cleanHash = window.location.hash.split('?')[0] || '#profile'
            window.history.replaceState({}, '', window.location.pathname + cleanHash)
            
            // Kiểm tra backup và khôi phục nếu profile bị ghi đè
            const backupStr = localStorage.getItem('profile_backup_before_link')
            if (backupStr) {
              try {
                const backup = JSON.parse(backupStr)
                // Chỉ khôi phục nếu backup là của user này và trong vòng 5 phút
                if (backup.user_id === u.id && Date.now() - backup.timestamp < 5 * 60 * 1000) {
                  // Kiểm tra xem profile có bị ghi đè không
                  const wasOverwritten = (
                    (backup.username && prof.username !== backup.username) ||
                    (backup.display_name && prof.display_name !== backup.display_name) ||
                    (backup.avatar_url && prof.avatar_url !== backup.avatar_url)
                  )
                  
                  if (wasOverwritten) {
                    console.log('[Profile] Restoring profile data after Facebook link')
                    // Khôi phục dữ liệu profile
                    const { error: restoreError } = await supabase
                      .from('profiles')
                      .update({
                        username: backup.username || prof.username,
                        display_name: backup.display_name || prof.display_name,
                        avatar_url: backup.avatar_url || prof.avatar_url
                      })
                      .eq('user_id', u.id)
                    
                    if (!restoreError) {
                      // Reload profile sau khi khôi phục
                      const { data: restoredProf } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('user_id', u.id)
                        .maybeSingle()
                      
                      if (restoredProf) {
                        setProfile(restoredProf)
                        localStorage.removeItem('profile_backup_before_link')
                        setLoadingProfile(false)
                        return
                      }
                    }
                  }
                }
                localStorage.removeItem('profile_backup_before_link')
              } catch (e) {
                console.error('Failed to restore profile backup:', e)
                localStorage.removeItem('profile_backup_before_link')
              }
            }
          }
          
          setProfile(prof)
          // Show popup if username is empty - user MUST set username
          if (!prof.username || prof.username.trim() === '') {
            setShowUsernamePopup(true)
          }
        }
      }
    } catch (e) {
      console.error('Load user failed:', e)
    } finally {
      setLoadingProfile(false)
    }
  }

  async function handleSaveUsername() {
    const { displayName, slug, error } = validateUsernameInput(newUsername)

    if (error) {
      setUsernameError(t(`profile.${USERNAME_ERROR_KEY_MAP[error]}`))
      return
    }

    try {
      // Check if username exists (case-insensitive)
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('username', slug)
        .maybeSingle()

      if (existing && existing.user_id !== user.id) {
        setUsernameError(t('profile.usernameErrorTaken'))
        return
      }

      // Update both username and display_name
      // username: lowercase, unique identifier for search/mention
      // display_name: same as username initially, user can change later in settings
      const { error } = await supabase
        .from('profiles')
        .update({ 
          username: slug,
          display_name: displayName // Keep original casing for display
        })
        .eq('user_id', user.id)

      if (error) throw error

      // Notify other components
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { 
          username: slug,
          display_name: displayName,
          field: 'username'
        } 
      }))

      // Reload user data
      await loadUserData()
      setShowUsernamePopup(false)
      setNewUsername('')
      setUsernameError('')
    } catch (e: any) {
      console.error('Save username error:', e)
      setUsernameError(e.message || t('common.error'))
    }
  }

  async function handleUpdateUsername() {
    const { displayName, slug, error } = validateUsernameInput(newUsername)

    if (error) {
      alert(t(`profile.${USERNAME_ERROR_KEY_MAP[error]}`))
      return
    }

    try {
      // Check if username exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('username', slug)
        .maybeSingle()

      if (existing && existing.user_id !== user.id) {
        alert(t('profile.usernameErrorTaken'))
        return
      }

      // Update username
      const { error } = await supabase
        .from('profiles')
        .update({ username: slug, display_name: displayName })
        .eq('user_id', user.id)

      if (error) throw error

      // Reload user data
      await loadUserData()
      setNewUsername('')
      
      // Dispatch profile update event for global consistency
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { 
          username: slug,
          display_name: displayName,
          field: 'username'
        } 
      }))
      
      alert(t('profile.usernameUpdateSuccess'))
    } catch (e: any) {
      alert(e.message || t('common.error'))
    }
  }

  async function loadMatchHistory() {
    if (!user) return
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          player_x_user_id,
          player_o_user_id,
          winner_user_id,
          result,
          player_x_mindpoint_change,
          player_o_mindpoint_change,
          ended_at,
          player_x:profiles!matches_player_x_user_id_fkey(username, display_name),
          player_o:profiles!matches_player_o_user_id_fkey(username, display_name)
        `)
        .or(`player_x_user_id.eq.${user.id},player_o_user_id.eq.${user.id}`)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(20)

      if (error) throw error

      const formatted = (data || []).map((match: any) => {
        const isPlayerX = match.player_x_user_id === user.id
        const opponentName = isPlayerX 
          ? (match.player_o?.username || match.player_o?.display_name || 'AI')
          : (match.player_x?.username || match.player_x?.display_name || t('profile.opponent'))
        const opponentId = isPlayerX ? match.player_o_user_id : match.player_x_user_id
        
        let result = 'draw'
        if (match.winner_user_id === user.id) result = 'win'
        else if (match.winner_user_id && match.winner_user_id !== user.id) result = 'lose'

        const eloChange = isPlayerX ? match.player_x_mindpoint_change : match.player_o_mindpoint_change
        
        const timeAgo = formatTimeAgo(match.ended_at)

        return {
          id: match.id,
          result,
          opponent: opponentName,
          opponentId,
          eloChange: eloChange || 0,
          time: timeAgo
        }
      })

      setMatchHistory(formatted)
      
      // Check which matches have been analyzed (cached)
      if (formatted.length > 0) {
        const matchIds = formatted.map((m: any) => m.id)
        const { data: cachedAnalyses } = await supabase
          .from('analysis_cache')
          .select('match_id')
          .in('match_id', matchIds)
        
        if (cachedAnalyses && cachedAnalyses.length > 0) {
          const analyzedSet = new Set(cachedAnalyses.map((c: any) => c.match_id))
          setAnalyzedMatches(analyzedSet)
        }
      }
    } catch (e) {
      console.error('Load match history failed:', e)
    } finally {
      setLoadingHistory(false)
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return t('profile.historyTimeJustNow')
    if (diffMins < 60) return t('profile.historyTimeMinutes', { minutes: diffMins })
    if (diffHours < 24) return t('profile.historyTimeHours', { hours: diffHours })
    if (diffDays < 7) return t('profile.historyTimeDays', { days: diffDays })
    return date.toLocaleDateString(language === 'vi' ? 'vi-VN' : undefined)
  }

  async function handleChangePassword() {
    setPasswordError('')
    setPasswordSuccess('')

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('profile.passwordErrorMissing'))
      return
    }

    if (!user?.email) {
      setPasswordError(t('common.error'))
      return
    }

    if (newPassword.length < 8) {
      setPasswordError(t('profile.passwordErrorShort'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordErrorMismatch'))
      return
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setPasswordError(t('profile.passwordErrorStrength'))
      return
    }

    setChangingPassword(true)
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      })

      if (reauthError) {
        setPasswordError(t('profile.passwordErrorCurrent'))
        return
      }

      // Use Supabase Auth to update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setPasswordSuccess(t('profile.passwordSuccess'))
      setShowPasswordChange(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      // Optional: Sign out user to require re-login with new password
      setTimeout(() => {
        setPasswordSuccess('')
      }, 3000)
    } catch (e: any) {
      setPasswordError(e.message || t('common.error'))
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleChangeEmail() {
    setEmailError('')
    setEmailSuccess('')

    // Validation
    if (!newEmail || !newEmail.trim()) {
      setEmailError(t('profile.emailErrorInvalid'))
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setEmailError(t('profile.emailErrorInvalid'))
      return
    }

    // Check if email is same as current
    if (newEmail === user?.email) {
      setEmailError(t('profile.emailErrorSame'))
      return
    }

    setChangingEmail(true)
    try {
      // Use Supabase Auth to update email
      // This will send a confirmation email to the new address
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      })

      if (error) throw error

      setEmailSuccess(t('profile.emailSuccess'))
      setShowEmailChange(false)
      setNewEmail('')
      
      setTimeout(() => {
        setEmailSuccess('')
      }, 5000)
    } catch (e: any) {
      setEmailError(e.message || t('common.error'))
    } finally {
      setChangingEmail(false)
    }
  }

  async function handleChangePhone() {
    setPhoneError('')
    setPhoneSuccess('')

    if (!newPhone || !newPhone.trim()) {
      setPhoneError(t('profile.phoneErrorMissing'))
      return
    }

    const phoneRegex = /^[0-9+()\-.\s]{8,20}$/
    if (!phoneRegex.test(newPhone.trim())) {
      setPhoneError(t('profile.phoneErrorInvalid'))
      return
    }

    if (!user) {
      setPhoneError(t('common.error'))
      return
    }

    setChangingPhone(true)
    try {
      const { error } = await supabase.auth.updateUser({
        phone: newPhone.trim()
      })

      if (error) throw error

      await loadUserData()
      setPhoneSuccess(t('profile.phoneSuccess'))
      setShowPhoneChange(false)
      setNewPhone('')

      setTimeout(() => {
        setPhoneSuccess('')
      }, 4000)
    } catch (e: any) {
      setPhoneError(e.message || t('common.error'))
    } finally {
      setChangingPhone(false)
    }
  }

  async function compressAvatar(file: File) {
    // Giảm kích thước ảnh trước khi upload để tránh lưu base64 nặng
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error(t('profile.avatarErrorRead')))
      reader.readAsDataURL(file)
    })

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(t('profile.avatarErrorGeneric')))
      image.src = dataUrl
    })

    const maxSize = 640
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(t('common.error'))
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b)
        else reject(new Error(t('profile.avatarErrorGeneric')))
      }, 'image/jpeg', 0.85)
    })

    return { blob, extension: 'jpg' }
  }

  async function handleUploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !user) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert(t('profile.avatarErrorType'))
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('profile.avatarErrorSize'))
      event.target.value = ''
      return
    }

    setUploadingAvatar(true)
    try {
      // Compress và convert sang base64 (hoạt động tốt hơn Storage URL)
      const { blob } = await compressAvatar(file)
      
      // Convert blob to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Không thể đọc file'))
        reader.readAsDataURL(blob)
      })

      // Lưu base64 trực tiếp vào database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: base64 })
        .eq('user_id', user.id)

      if (updateError) throw updateError

      await loadUserData()
      
      // Dispatch profile update event cho các nơi khác
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { 
          avatar_url: base64,
          field: 'avatar'
        } 
      }))
      
      alert(t('profile.avatarSuccess'))
    } catch (e: any) {
      console.error('Upload avatar failed:', e)
      const msg = e?.message || ''
      if (/Bucket not found/i.test(msg)) {
        alert(t('profile.avatarErrorBucket'))
      } else {
        alert(msg || t('profile.avatarErrorGeneric'))
      }
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  async function handleLogout() {
    if (confirm(t('profile.logoutConfirm'))) {
      try {
        await supabase.auth.signOut()
        window.location.href = '/'
      } catch (e) {
        console.error('Logout failed:', e)
        alert(t('profile.logoutError'))
      }
    }
  }

  async function handleLinkFacebook() {
    setEmailError('')
    try {
      // Lưu profile data hiện tại trước khi link để bảo vệ khỏi bị ghi đè
      if (profile) {
        localStorage.setItem('profile_backup_before_link', JSON.stringify({
          user_id: user?.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          timestamp: Date.now()
        }))
      }
      
      // Sử dụng linkIdentity thay vì signInWithOAuth để liên kết provider
      // mà không ghi đè session hiện tại
      const { error } = await supabase.auth.linkIdentity({
        provider: 'facebook',
        options: { redirectTo: `${window.location.origin}?linked=facebook#profile` }
      })
      if (error) throw error
    } catch (e: any) {
      setEmailError(e.message || "Liên kết Facebook thất bại")
    }
  }


  // Load settings from localStorage on mount
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('gameSettings')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
    return {
      // UI
      theme: 'dark',
      uiEffects: true,
      effectsQuality: 'high',
      uiStyle: 'xianxia',
      fontSize: 'medium',
      // Sound
      bgMusic: true,
      bgMusicVolume: 70,
      sfxEnabled: true,
      sfxVolume: 80,
      moveSoundEnabled: true,
      // Board
      boardSize: '15x15',
      highlightLastMove: true,
      showWinningLine: true,
      pieceDropEffect: true,
      showHints: false,
      boardSkin: 'default',
      // Notifications
      systemNotif: true,
      inviteNotif: true,
      chatNotif: true,
      turnNotif: true,
      // Language
      language: 'vi',
      // Vibration
      vibrationEnabled: true
    }
  }

  // Settings state
  const [settings, setSettings] = React.useState(loadSettings())

  // Save settings to localStorage whenever they change
  React.useEffect(() => {
    try {
      localStorage.setItem('gameSettings', JSON.stringify(settings))
      applySettings(settings)
      
      // Update AudioManager with new audio settings
      AudioManager.updateSettings({
        bgMusic: settings.bgMusic,
        bgMusicVolume: settings.bgMusicVolume,
        sfxEnabled: settings.sfxEnabled,
        sfxVolume: settings.sfxVolume,
        moveSoundEnabled: settings.moveSoundEnabled
      })
      
      // Update NotificationManager with new notification settings
      NotificationManager.updateSettings({
        systemNotif: settings.systemNotif,
        inviteNotif: settings.inviteNotif,
        chatNotif: settings.chatNotif,
        turnNotif: settings.turnNotif
      })
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }, [settings])

  // Apply settings to the app
  const applySettings = (newSettings: typeof settings) => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', newSettings.theme)
    if (newSettings.theme === 'dark') {
      document.body.style.background = 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)'
    } else {
      document.body.style.background = 'linear-gradient(135deg, #f5f7fa, #c3cfe2)'
    }

    // Apply UI effects
    document.documentElement.style.setProperty('--effects-enabled', newSettings.uiEffects ? '1' : '0')
    if (newSettings.uiEffects) {
      document.body.classList.add('effects-enabled')
      document.body.classList.remove('effects-disabled')
    } else {
      document.body.classList.add('effects-disabled')
      document.body.classList.remove('effects-enabled')
    }
    
    // Apply effects quality
    document.body.setAttribute('data-effects-quality', newSettings.effectsQuality)
    
    // Apply UI style
    document.body.setAttribute('data-ui-style', newSettings.uiStyle)
    
    // Apply font size
    const fontSizes = { small: '14px', medium: '16px', large: '18px' }
    document.documentElement.style.fontSize = fontSizes[newSettings.fontSize as keyof typeof fontSizes] || '16px'

    // Language is handled by LanguageContext's setLanguage(), no need to apply here

    // Apply board preferences as data attributes for game component
    document.body.setAttribute('data-highlight-last-move', newSettings.highlightLastMove.toString())
    document.body.setAttribute('data-piece-drop-effect', newSettings.pieceDropEffect.toString())
    document.body.setAttribute('data-vibration-enabled', newSettings.vibrationEnabled.toString())

    // Store in global for access by other components
    if (typeof window !== 'undefined') {
      (window as any).gameSettings = newSettings
    }
  }

  // Reset all settings to default
  const handleResetSettings = () => {
    if (confirm(t('profile.restoreDefaults'))) {
      const defaultSettings = {
        theme: 'dark',
        uiEffects: true,
        effectsQuality: 'high',
        uiStyle: 'xianxia',
        fontSize: 'medium',
        bgMusic: true,
        bgMusicVolume: 70,
        sfxEnabled: true,
        sfxVolume: 80,
        moveSoundEnabled: true,
        boardSize: '15x15',
        highlightLastMove: true,
        showWinningLine: true,
        pieceDropEffect: true,
        showHints: false,
        boardSkin: 'default',
        systemNotif: true,
        inviteNotif: true,
        chatNotif: true,
        turnNotif: true,
        language: 'vi',
        vibrationEnabled: true
      }
      setSettings(defaultSettings)
      localStorage.removeItem('gameSettings')
      applySettings(defaultSettings)
    }
  }

  // Update a specific setting
  const updateSetting = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }))
  }

  // Calculate EXP for next level (same formula as Quests)
  function getExpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5))
  }

  // EXP/Level state with animation to phản ánh realtime khi exp tăng
  const targetLevel = profile?.level || 1
  const targetExp = profile?.exp || 0
  const [displayLevel, setDisplayLevel] = React.useState(targetLevel)
  const [displayExp, setDisplayExp] = React.useState(targetExp)

  React.useEffect(() => {
    let level = displayLevel
    let exp = displayExp
    let rafId: number | null = null

    const animate = () => {
      const targetL = targetLevel
      const targetE = targetExp

      // Nếu data giảm (hiếm), sync ngay
      if (targetL < level || (targetL === level && targetE < exp)) {
        level = targetL
        exp = targetE
        setDisplayLevel(level)
        setDisplayExp(exp)
        return
      }

      const expNeededForLevel = getExpForLevel(level)
      const goalExp = level < targetL ? expNeededForLevel : targetE
      if (exp >= goalExp) {
        // lên level
        exp -= expNeededForLevel
        level += 1
      }

      if (level > targetL || (level === targetL && exp >= targetE)) {
        setDisplayLevel(targetL)
        setDisplayExp(targetE)
        return
      }

      const step = Math.max(1, Math.floor(expNeededForLevel / 40))
      exp = Math.min(goalExp, exp + step)
      setDisplayLevel(level)
      setDisplayExp(exp)

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [targetLevel, targetExp])

  const expNeeded = getExpForLevel(displayLevel)
  const expProgress = Math.min((displayExp / expNeeded) * 100, 100)

  const userData = {
    username: profile?.username || profile?.display_name || t('profile.noUsername'),
    email: user?.email || 'user@example.com',
    phone: user?.phone || t('profile.noPhone'),
    avatar: profile?.avatar_url || '',
    level: displayLevel,
    exp: displayExp,
    expNeeded: expNeeded,
    expProgress: expProgress,
    rank: getRankName(profile?.current_rank || 'vo_danh'),
    rankCode: (profile?.current_rank || 'vo_danh') as MainRank,
    rankTier: (profile?.rank_tier || 'so_ky') as RankTier,
    rankLevel: (profile?.rank_level || 1) as RankLevel,
    mindpoint: profile?.mindpoint || 0,
    rankIcon: getRankIcon(profile?.current_rank || 'vo_danh'),
    title: t('profile.titleValue'),
    coins: profile?.coins || 0,
    gems: profile?.gems || 0,
    stats: {
      totalMatches: profile?.total_matches || 0,
      wins: profile?.total_wins || 0,
      losses: profile?.total_losses || 0,
      winRate: profile?.total_matches > 0 ? Math.round((profile?.total_wins / profile?.total_matches) * 100) : 0,
      currentStreak: profile?.win_streak || 0,
      elo: profile?.elo_rating || 1000
    }
  }

  function getRankName(rank: string) {
    const ranks: any = {
      'vo_danh': 'Vô Danh',
      'tan_ky': 'Tân Kỳ',
      'hoc_ky': 'Học Kỳ',
      'ky_lao': 'Kỳ Lão',
      'cao_ky': 'Cao Kỳ',
      'ky_thanh': 'Kỳ Thánh',
      'truyen_thuyet': 'Truyền Thuyết'
    }
    return ranks[rank] || 'Vô Danh'
  }

  function getRankIcon(rank: string) {
    const icons: any = {
      'vo_danh': '🥉',
      'tan_ky': '🥈',
      'hoc_ky': '🥇',
      'ky_lao': '💎',
      'cao_ky': '🏆',
      'ky_thanh': '👑',
      'truyen_thuyet': '⭐'
    }
    return icons[rank] || '🥉'
  }

  return (
    <div className="profile-container">
      {/* Frame Selector Modal */}
      {showFrameSelector && (
        <div className="popup-overlay" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.9)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }} onClick={() => setShowFrameSelector(false)}>
          <div className="popup-content glass-card" style={{
            padding: 24,
            maxWidth: 500,
            width: '100%',
            borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#F8FAFC' }}>🖼️ {t('profile.selectFrame')}</h3>
              <button onClick={() => setShowFrameSelector(false)} style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: 20,
                cursor: 'pointer'
              }}>✕</button>
            </div>
            
            {ownedFrames.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🖼️</div>
                <p>{t('profile.noFrames')}</p>
                <button 
                  onClick={() => { window.location.hash = '#shop'; setShowFrameSelector(false) }}
                  style={{
                    marginTop: 16,
                    padding: '10px 24px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {t('profile.goToShop')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
                {/* No frame option */}
                <div
                  onClick={async () => {
                    await equipFrame(null)
                    // Reload owned frames to update isEquipped status
                    const updated = await getOwnedFrames(user.id)
                    setOwnedFrames(updated)
                    setShowFrameSelector(false)
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: !equippedFrame ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                    border: `2px solid ${!equippedFrame ? '#38BDF8' : 'rgba(71, 85, 105, 0.3)'}`,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🚫</div>
                  <div style={{ fontSize: 12, color: '#94A3B8' }}>{t('profile.noFrameOption')}</div>
                </div>
                
                {/* Owned frames */}
                {ownedFrames.map(frame => {
                  const isSelected = (frame as any).isEquipped || equippedFrame?.id === frame.id
                  return (
                  <div
                    key={frame.id}
                    onClick={async () => {
                      await equipFrame(frame.id)
                      // Reload owned frames to update isEquipped status
                      const updated = await getOwnedFrames(user.id)
                      setOwnedFrames(updated)
                      setShowFrameSelector(false)
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                      border: `2px solid ${isSelected ? '#A855F7' : 'rgba(71, 85, 105, 0.3)'}`,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    {frame.preview_url ? (
                      <img src={frame.preview_url} alt={frame.name} style={{ width: 64, height: 64, objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🖼️</div>
                    )}
                    <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 6 }}>{frame.name}</div>
                    <div style={{ 
                      fontSize: 10, 
                      color: frame.rarity === 'legendary' ? '#F59E0B' : frame.rarity === 'epic' ? '#A855F7' : frame.rarity === 'rare' ? '#3B82F6' : '#94A3B8',
                      textTransform: 'capitalize'
                    }}>{frame.rarity}</div>
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Username Popup */}
      {/* Username Popup - MANDATORY, cannot be closed without setting username */}
      {showUsernamePopup && (
        <div className="popup-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(2, 6, 23, 0.95)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div className="popup-content glass-card" style={{
            padding: '40px 36px',
            maxWidth: '440px',
            width: '100%',
            borderRadius: '24px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)'
          }}>
            {/* Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '40px'
            }}>
              🎮
            </div>

            <h2 style={{ 
              marginBottom: '8px', 
              fontSize: '26px', 
              fontWeight: 800,
              background: 'linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              {t('profile.usernamePopupTitle')}
            </h2>
            
            <p style={{ 
              marginBottom: '28px', 
              color: '#94a3b8', 
              lineHeight: 1.6,
              fontSize: '15px'
            }}>
              {t('profile.usernamePopupDesc')}
            </p>

            {/* Username Input */}
            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#94a3b8',
                marginBottom: '8px'
              }}>
                Username
              </label>
              <input
                type="text"
                placeholder={t('profile.usernamePlaceholder')}
                value={newUsername}
                onChange={(e) => {
                  setNewUsername(e.target.value)
                  setUsernameError('')
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveUsername()}
                maxLength={20}
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  border: `2px solid ${usernameError ? 'rgba(248, 113, 113, 0.5)' : 'rgba(56, 189, 248, 0.2)'}`,
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#f1f5f9',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
              />
              
              {/* Character count & error */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px'
              }}>
                <span style={{
                  fontSize: '12px',
                  color: usernameError ? '#f87171' : '#64748b'
                }}>
                  {usernameError || ''}
                </span>
                <span style={{
                  fontSize: '12px',
                  color: newUsername.length > 15 ? '#facc15' : '#64748b'
                }}>
                  {newUsername.length}/20
                </span>
              </div>
            </div>

            {/* Rules */}
            <div style={{
              background: 'rgba(56, 189, 248, 0.05)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#64748b',
                marginBottom: '8px',
                fontWeight: 600
              }}>
                {t('profile.usernameRulesTitle') || 'Quy tắc đặt tên:'}
              </div>
              <ul style={{
                margin: 0,
                padding: '0 0 0 16px',
                fontSize: '12px',
                color: '#94a3b8',
                lineHeight: 1.8
              }}>
                <li>{t('profile.usernameRuleMin')}</li>
                <li>{t('profile.usernameRuleAllowed')}</li>
                <li>{t('profile.usernameRuleUnique') || '• Username phải là duy nhất'}</li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSaveUsername}
              disabled={!newUsername || newUsername.length < 3}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '14px',
                border: 'none',
                background: (!newUsername || newUsername.length < 3)
                  ? 'rgba(148, 163, 184, 0.2)'
                  : 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                color: (!newUsername || newUsername.length < 3) ? '#64748b' : '#0f172a',
                fontSize: '16px',
                fontWeight: 700,
                cursor: (!newUsername || newUsername.length < 3) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {t('profile.usernameConfirm')}
              <span>→</span>
            </button>

            {/* Note - cannot skip */}
            <p style={{
              marginTop: '16px',
              fontSize: '12px',
              color: '#64748b'
            }}>
              {t('profile.usernameRequired') || '⚠️ Bạn cần đặt username để tiếp tục sử dụng'}
            </p>
          </div>
        </div>
      )}
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span 
          style={{ fontSize: 13, color: 'var(--color-muted)', cursor: 'pointer' }}
          onClick={() => window.location.hash = '#home'}
        >
          {t('breadcrumb.home')}
        </span>
        <span style={{ color: 'var(--color-muted)' }}>›</span>
        <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
          {t('breadcrumb.profile')}
        </span>
      </div>
      <div className="profile-grid">
        {/* Left Sidebar - Simple BangBang Style */}
        <aside className="profile-sidebar glass-card">
          <nav className="profile-nav">
            <button 
              className={`profile-nav-item ${activeSection === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveSection('overview')}
            >
              <span className="nav-dot">•</span>
              <span className="nav-text">{t('profile.overview')}</span>
            </button>
            <button 
              className={`profile-nav-item ${activeSection === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveSection('settings')}
            >
              <span className="nav-dot">•</span>
              <span className="nav-text">{t('profile.settings')}</span>
            </button>
            <button 
              className={`profile-nav-item ${activeSection === 'history' ? 'active' : ''}`}
              onClick={() => setActiveSection('history')}
              data-tour="profile-history"
            >
              <span className="nav-dot">•</span>
              <span className="nav-text">{t('profile.history')}</span>
            </button>
          </nav>
        </aside>

        {/* Main Content - Center Right */}
        <main className="profile-main glass-card energy-border">
          {activeSection === 'overview' && (
            <div className="profile-overview">
              {/* Avatar Section */}
              <div className="profile-avatar-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative' }}>
                  <AvatarWithFrame
                    avatarUrl={userData.avatar}
                    frame={equippedFrame}
                    size={120}
                    username={userData.username}
                    showGlow={false}
                  />
                  
                  {/* Frame selector button */}
                  <button
                    onClick={() => setShowFrameSelector(true)}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #A855F7 0%, #7C3AED 100%)',
                      border: '2px solid rgba(15, 23, 42, 0.8)',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)',
                      transition: 'all 0.2s'
                    }}
                    title={t('profile.changeFrame')}
                  >
                    🖼️
                  </button>
                </div>
                
                {/* Username */}
                <h2 className="profile-username" style={{ margin: 0, marginTop: '8px' }}>{userData.username}</h2>
                
                {/* Level & EXP */}
                <div className="profile-level">
                  <span className="level-label" style={{ textAlign: 'left', display: 'block' }}>{t('profile.levelLabel')} {userData.level}</span>
                  <div className="exp-bar">
                    <div className="exp-fill" style={{ width: `${userData.expProgress}%` }}></div>
                  </div>
                  <span className="exp-text">{userData.exp} / {userData.expNeeded} {t('profile.expText')}</span>
                </div>
              </div>

              {/* User Info */}
              <div className="profile-info">
                {/* Rank Section - similar to Level */}
                <div className="profile-rank-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', width: '100%', maxWidth: '400px', marginBottom: '16px', marginTop: '8px' }}>
                  <span className="rank-label" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-primary)' }}>
                    Rank: {userData.rank}
                  </span>
                  <div className="rank-bar" style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div className="rank-fill" style={{ width: `${(userData.mindpoint % 100)}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #6366f1)', borderRadius: '8px', transition: 'width 0.5s ease-out' }}></div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{userData.mindpoint % 100} / 100 MP</span>
                </div>
                <div 
                  className="profile-title" 
                  style={{ marginTop: '16px', cursor: 'pointer' }}
                  onClick={() => { window.location.hash = '#titles' }}
                  title={t('title.pageTitle')}
                >
                  <span className="title-label">{t('profile.titleLabel')}:</span>
                  {equippedTitle?.titles ? (
                    <EquippedTitleBadge title={equippedTitle.titles} size="normal" />
                  ) : (
                    <span className="title-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      "{t('profile.titleValue')}"
                      <span style={{ fontSize: '12px', color: 'var(--color-primary)', opacity: 0.7 }}>→</span>
                    </span>
                  )}
                </div>
                
                <div className="profile-details">
                  <div className="detail-item">
                    <span className="detail-label">{t('profile.emailLabel')}:</span>
                    <span className="detail-value">{userData.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{t('profile.phoneLabel')}:</span>
                    <span className="detail-value">{userData.phone}</span>
                  </div>
                </div>
              </div>

              {/* Stats Box - BangBang Style */}
              <div className="profile-stats-box">
                <div className="stat-item">
                  <div className="stat-value">{userData.stats.winRate}%</div>
                  <div className="stat-label">{t('profile.stats.winRate')}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{userData.stats.totalMatches}</div>
                  <div className="stat-label">{t('profile.stats.total')}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{userData.stats.currentStreak}</div>
                  <div className="stat-label">{t('profile.stats.streak')}</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{userData.stats.elo}</div>
                  <div className="stat-label">{t('profile.stats.elo')}</div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="profile-settings">
              <h2 className="section-title">{t('profile.settingsTitle')}</h2>
              
              {/* Settings Sidebar */}
              <div className="settings-layout">
                <aside className="settings-sidebar">
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'account' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('account')}
                    data-tour="tab-account"
                  >
                    • {t('profile.account')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'ui' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('ui')}
                    data-tour="tab-ui"
                  >
                    • {t('profile.ui')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'sound' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('sound')}
                    data-tour="tab-sound"
                  >
                    • {t('profile.sound')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'board' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('board')}
                  >
                    • {t('profile.board')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'notifications' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('notifications')}
                    data-tour="tab-notifications"
                  >
                    • {t('profile.notifications')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'language' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('language')}
                    data-tour="tab-language"
                  >
                    • {t('profile.language')}
                  </button>
                  <button 
                    className={`settings-tab ${activeSettingsTab === 'other' ? 'active' : ''}`}
                    onClick={() => setActiveSettingsTab('other')}
                  >
                    • {t('profile.other')}
                  </button>
                  
                  {/* Reset Button - Moved to sidebar bottom */}
                  <button 
                    className="btn-reset-compact"
                    onClick={handleResetSettings}
                  >
                    <span style={{ fontSize: '14px' }}>↻</span>
                    <span style={{ fontSize: '11px' }}>{t('profile.restoreDefaults')}</span>
                  </button>
                </aside>

                <div className="settings-content">
                  {/* CARD 1 - TÀI KHOẢN */}
                  {activeSettingsTab === 'account' && (
                    <div className="settings-card">
                      <h3 className="card-title">{t('profile.account')}</h3>
                      <div className="setting-item">
                        <label>{t('profile.username')}</label>
                        <input type="text" value={userData.username} disabled />
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.username')}</label>
                        <div className="input-group">
                          <input 
                            type="text" 
                            placeholder={t('profile.usernamePlaceholder')} 
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                          />
                          <button className="btn-primary" onClick={handleUpdateUsername}>{t('profile.phoneUpdate')}</button>
                        </div>
                        
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.avatarLabel')}</label>
                        <input 
                          type="file" 
                          id="avatarInput" 
                          accept="image/*" 
                          style={{ display: 'none' }} 
                          onChange={handleUploadAvatar}
                        />
                        <button 
                          className="btn-secondary" 
                          onClick={() => document.getElementById('avatarInput')?.click()}
                          data-tour="avatar-upload"
                          disabled={uploadingAvatar}
                        >
                          {uploadingAvatar ? t('profile.avatarUploading') : t('profile.avatarChoose')}
                        </button>
                        
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.emailLabel')}</label>
                        <input type="text" value={userData.email} disabled />
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.emailChange')}</label>
                        {!showEmailChange ? (
                          <button 
                            className="btn-secondary" 
                            onClick={() => setShowEmailChange(true)}
                          >
                            📧 {t('profile.emailChange')}
                          </button>
                        ) : (
                          <div className="email-change-form" style={{
                            marginTop: '12px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            <div style={{ marginBottom: '12px' }}>
                              <input
                                type="email"
                                placeholder={t('profile.emailPlaceholder')}
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'white',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            {emailError && (
                              <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '8px' }}>
                                {emailError}
                              </p>
                            )}
                            {emailSuccess && (
                              <p style={{ color: '#10B981', fontSize: '13px', marginBottom: '8px' }}>
                                {emailSuccess}
                              </p>
                            )}
                            <p style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '12px' }}>
                              {t('profile.emailInfo')}
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="btn-primary" 
                                onClick={handleChangeEmail}
                                disabled={changingEmail}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                {changingEmail ? t('profile.emailSending') : t('profile.emailSend')}
                              </button>
                              <button 
                                className="btn-secondary" 
                                onClick={() => {
                                  setShowEmailChange(false)
                                  setNewEmail('')
                                  setEmailError('')
                                  setEmailSuccess('')
                                }}
                                disabled={changingEmail}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                {t('profile.emailCancel')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.phoneLabel')}</label>
                        <input type="text" value={userData.phone} disabled />
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.phoneChange')}</label>
                        {!showPhoneChange ? (
                          <button 
                            className="btn-secondary" 
                            onClick={() => setShowPhoneChange(true)}
                          >
                            📱 {t('profile.phoneChange')}
                          </button>
                        ) : (
                          <div className="phone-change-form" style={{
                            marginTop: '12px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            <div style={{ marginBottom: '12px' }}>
                              <input
                                type="tel"
                                placeholder={t('profile.phonePlaceholder')}
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'white',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            {phoneError && (
                              <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '8px' }}>
                                {phoneError}
                              </p>
                            )}
                            {phoneSuccess && (
                              <p style={{ color: '#10B981', fontSize: '13px', marginBottom: '8px' }}>
                                {phoneSuccess}
                              </p>
                            )}
                            <p style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '12px' }}>
                              {t('profile.phoneInfo')}
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="btn-primary" 
                                onClick={handleChangePhone}
                                disabled={changingPhone}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                {changingPhone ? t('profile.phoneUpdating') : t('profile.phoneUpdate')}
                              </button>
                              <button 
                                className="btn-secondary" 
                                onClick={() => {
                                  setShowPhoneChange(false)
                                  setNewPhone('')
                                  setPhoneError('')
                                  setPhoneSuccess('')
                                }}
                                disabled={changingPhone}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                {t('profile.phoneCancel')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.passwordChange')}</label>
                        {!showPasswordChange ? (
                          <button 
                            className="btn-secondary" 
                            onClick={() => setShowPasswordChange(true)}
                          >
                            🔒 {t('profile.passwordChange')}
                          </button>
                        ) : (
                          <div className="password-change-form" style={{
                            marginTop: '12px',
                            padding: '16px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            <div style={{ marginBottom: '12px' }}>
                              <input
                                type="password"
                                placeholder={t('profile.passwordCurrent')}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'white',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                              <input
                                type="password"
                                placeholder={t('profile.passwordNew')}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'white',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                              <input
                                type="password"
                                placeholder={t('profile.passwordConfirm')}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 12px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  background: 'rgba(255,255,255,0.05)',
                                  color: 'white',
                                  fontSize: '14px'
                                }}
                              />
                            </div>
                            {passwordError && (
                              <p style={{ color: '#EF4444', fontSize: '13px', marginBottom: '8px' }}>
                                {passwordError}
                              </p>
                            )}
                            {passwordSuccess && (
                              <p style={{ color: '#10B981', fontSize: '13px', marginBottom: '8px' }}>
                                {passwordSuccess}
                              </p>
                            )}
                            <p style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '12px' }}>
                              {t('profile.passwordInfo').split('\\n').map((line, idx) => (<React.Fragment key={idx}>{line}<br/></React.Fragment>))}
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="btn-primary" 
                                onClick={handleChangePassword}
                                disabled={changingPassword}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                {changingPassword ? t('common.loading') : t('profile.passwordSave')}
                              </button>
                              <button 
                                className="btn-secondary" 
                                onClick={() => {
                                  setShowPasswordChange(false)
                                  setCurrentPassword('')
                                  setNewPassword('')
                                  setConfirmPassword('')
                                  setPasswordError('')
                                  setPasswordSuccess('')
                                }}
                                disabled={changingPassword}
                                style={{ flex: 1, padding: '8px' }}
                              >
                                {t('profile.passwordCancel')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.linkAccounts')}</label>
                        <div className="link-accounts">
                          <button
                            className="link-btn google"
                            disabled={linkedProviders.includes('facebook')}
                            onClick={() => {
                              if (!linkedProviders.includes('facebook')) {
                                handleLinkFacebook()
                              }
                            }}
                          >
                            {linkedProviders.includes('facebook') ? t('profile.facebookLinked') : t('profile.linkFacebook')}
                          </button>
                          <button className="link-btn email" disabled>
                            {user?.email ? `Email (${user.email})` : t('profile.emailDefault')}
                          </button>
                        </div>
                      </div>

                      <div className="setting-item">
                        <button className="btn-danger" onClick={handleLogout}>{t('profile.logout')}</button>
                      </div>
                    </div>
                  )}

                  {/* CARD 2 - GIAO DIỆN */}
                  {activeSettingsTab === 'ui' && (
                    <div className="settings-card">
                      <h3 className="card-title">{t('profile.ui')}</h3>
                      <div className="setting-item">
                        <label>{t('profile.theme')}</label>
                        <div className="toggle-group">
                          <button 
                            className={`toggle-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, theme: 'dark'})}
                          >
                            🌙 {t('profile.themeDark')}
                          </button>
                          <button 
                            className={`toggle-btn ${settings.theme === 'light' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, theme: 'light'})}
                          >
                            ☀️ {t('profile.themeLight')}
                          </button>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.uiEffects')}</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="uiEffects" 
                            checked={settings.uiEffects}
                            onChange={(e) => setSettings({...settings, uiEffects: e.target.checked})}
                          />
                          <label htmlFor="uiEffects" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.fontSize')}</label>
                        <div className="toggle-group">
                          <button 
                            className={`toggle-btn ${settings.fontSize === 'small' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, fontSize: 'small'})}
                          >
                            {t('profile.fontSmall')}
                          </button>
                          <button 
                            className={`toggle-btn ${settings.fontSize === 'medium' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, fontSize: 'medium'})}
                          >
                            {t('profile.fontMedium')}
                          </button>
                          <button 
                            className={`toggle-btn ${settings.fontSize === 'large' ? 'active' : ''}`}
                            onClick={() => setSettings({...settings, fontSize: 'large'})}
                          >
                            {t('profile.fontLarge')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CARD 3 - ÂM THANH */}
                  {activeSettingsTab === 'sound' && (
                    <div className="settings-card">
                      <h3 className="card-title">{t('profile.soundTitle')}</h3>
                      <div className="setting-item">
                        <label>{t('profile.bgMusic')}</label>
                        <div className="slider-group">
                          <div className="switch-wrapper">
                            <input 
                              type="checkbox" 
                              id="bgMusic" 
                              checked={settings.bgMusic}
                              onChange={(e) => setSettings({...settings, bgMusic: e.target.checked})}
                            />
                            <label htmlFor="bgMusic" className="switch"></label>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={settings.bgMusicVolume}
                            onChange={(e) => setSettings({...settings, bgMusicVolume: Number(e.target.value)})}
                            disabled={!settings.bgMusic}
                          />
                          <span className="volume-label">{settings.bgMusicVolume}%</span>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.sfxEffects')}</label>
                        <div className="slider-group">
                          <div className="switch-wrapper">
                            <input 
                              type="checkbox" 
                              id="sfxEnabled" 
                              checked={settings.sfxEnabled}
                              onChange={(e) => setSettings({...settings, sfxEnabled: e.target.checked})}
                            />
                            <label htmlFor="sfxEnabled" className="switch"></label>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={settings.sfxVolume}
                            onChange={(e) => setSettings({...settings, sfxVolume: Number(e.target.value)})}
                            disabled={!settings.sfxEnabled}
                          />
                          <span className="volume-label">{settings.sfxVolume}%</span>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.moveSound')}</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="moveSoundEnabled" 
                            checked={settings.moveSoundEnabled}
                            onChange={(e) => setSettings({...settings, moveSoundEnabled: e.target.checked})}
                          />
                          <label htmlFor="moveSoundEnabled" className="switch"></label>
                        </div>
                      </div>
                      
                      {/* Music Selector */}
                      <div className="setting-item" style={{ marginTop: 16 }}>
                        <MusicSelector />
                      </div>
                    </div>
                  )}

                  {/* CARD 4 - BÀN CỜ & NƯỚC ĐI */}
                  {activeSettingsTab === 'board' && (
                    <div className="settings-card">
                      <h3 className="card-title">{t('profile.boardTitle')}</h3>
                      <div className="setting-item">
                        <label>{t('profile.highlightLastMove')}</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="highlightLastMove" 
                            checked={settings.highlightLastMove}
                            onChange={(e) => setSettings({...settings, highlightLastMove: e.target.checked})}
                          />
                          <label htmlFor="highlightLastMove" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.pieceDropEffect')}</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="pieceDropEffect" 
                            checked={settings.pieceDropEffect}
                            onChange={(e) => setSettings({...settings, pieceDropEffect: e.target.checked})}
                          />
                          <label htmlFor="pieceDropEffect" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.vibration')}</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="vibrationEnabled" 
                            checked={settings.vibrationEnabled}
                            onChange={(e) => setSettings({...settings, vibrationEnabled: e.target.checked})}
                          />
                          <label htmlFor="vibrationEnabled" className="switch"></label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CARD 5 - THÔNG BÁO */}
                  {activeSettingsTab === 'notifications' && (
                    <div className="settings-card">
                      <h3 className="card-title">{t('profile.notifTitle')}</h3>
                      <div className="setting-item" style={{
                        padding: '16px',
                        background: notificationPermission === 'granted' 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : notificationPermission === 'denied'
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '8px',
                        border: `1px solid ${notificationPermission === 'granted' 
                          ? 'rgba(16, 185, 129, 0.3)' 
                          : notificationPermission === 'denied'
                          ? 'rgba(239, 68, 68, 0.3)'
                          : 'rgba(59, 130, 246, 0.3)'}`,
                        marginBottom: '16px'
                      }}>
                        <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                          {t('profile.notifBrowserTitle')}
                        </label>
                        <p style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '12px', lineHeight: '1.5' }}>
                          {notificationPermission === 'granted' 
                            ? `✅ ${t('profile.notifGranted')}`
                            : notificationPermission === 'denied'
                            ? `❌ ${t('profile.notifDenied')}`
                            : `🔔 ${t('profile.notifDefault')}`}
                        </p>
                        {notificationPermission !== 'granted' && notificationPermission !== 'denied' && (
                          <button 
                            className="btn-primary"
                            onClick={async () => {
                              const permission = await NotificationManager.requestPermission()
                              setNotificationPermission(permission)
                              if (permission === 'granted') {
                                NotificationManager.notifySystem(t('profile.notifTestSuccess'), t('profile.notifTestSuccessMsg'))
                              }
                            }}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                          >
                            🔔 {t('profile.notifAllow')}
                          </button>
                        )}
                        {notificationPermission === 'granted' && (
                          <button 
                            className="btn-secondary"
                            onClick={() => {
                              NotificationManager.notifySystem(t('profile.notifTestTitle'), t('profile.notifTestMsg'))
                            }}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                          >
                            🧪 {t('profile.notifTest')}
                          </button>
                        )}
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.notifSystem')}</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="systemNotif" 
                            checked={settings.systemNotif}
                            onChange={(e) => setSettings({...settings, systemNotif: e.target.checked})}
                          />
                          <label htmlFor="systemNotif" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.notifInvite')}</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="inviteNotif" 
                            checked={settings.inviteNotif}
                            onChange={(e) => setSettings({...settings, inviteNotif: e.target.checked})}
                          />
                          <label htmlFor="inviteNotif" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.notifChat')}</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="chatNotif" 
                            checked={settings.chatNotif}
                            onChange={(e) => setSettings({...settings, chatNotif: e.target.checked})}
                          />
                          <label htmlFor="chatNotif" className="switch"></label>
                        </div>
                      </div>
                      <div className="setting-item">
                        <label>{t('profile.notifTurn')}</label>
                        <div className="switch-wrapper">
                          <input 
                            type="checkbox" 
                            id="turnNotif" 
                            checked={settings.turnNotif}
                            onChange={(e) => setSettings({...settings, turnNotif: e.target.checked})}
                          />
                          <label htmlFor="turnNotif" className="switch"></label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CARD 6 - NGÔN NGỮ */}
                  {activeSettingsTab === 'language' && (
                    <div className="settings-card">
                      <h3 className="card-title">{t('profile.language')}</h3>
                      <div className="language-grid">
                        <button 
                          className={`language-btn ${language === 'vi' ? 'active' : ''}`}
                          onClick={() => {
                            setLanguage('vi')
                            setSettings({...settings, language: 'vi'})
                          }}
                        >
                          🇻🇳 Tiếng Việt
                        </button>
                        <button 
                          className={`language-btn ${language === 'en' ? 'active' : ''}`}
                          onClick={() => {
                            setLanguage('en')
                            setSettings({...settings, language: 'en'})
                          }}
                        >
                          🇬🇧 English
                        </button>
                        <button 
                          className={`language-btn ${language === 'zh' ? 'active' : ''}`}
                          onClick={() => {
                            setLanguage('zh')
                            setSettings({...settings, language: 'zh'})
                          }}
                        >
                          🇨🇳 中文
                        </button>
                        <button 
                          className={`language-btn ${language === 'ja' ? 'active' : ''}`}
                          onClick={() => {
                            setLanguage('ja')
                            setSettings({...settings, language: 'ja'})
                          }}
                        >
                          🇯🇵 日本語
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CARD 7 - KHÁC */}
                  {activeSettingsTab === 'other' && (
                    <div className="settings-card">
                      <h3 className="card-title">{t('profile.otherTitle')}</h3>
                      <div className="setting-item">
                        <button className="btn-link">📖 {t('profile.aboutGame')}</button>
                      </div>
                      <div className="setting-item">
                        <button className="btn-link">📜 {t('profile.termsOfService')}</button>
                      </div>
                      <div className="setting-item">
                        <button className="btn-link">🔒 {t('profile.privacyPolicy')}</button>
                      </div>
                      <div className="setting-item version-info">
                        <span>{t('profile.version')}: v1.0.0</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'history' && (
            <div className="profile-history">
              <h2 className="section-title">{t('profile.historyTitle')}</h2>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)' }}>
                  {t('profile.historyLoading')}
                </div>
              ) : matchHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-muted)' }}>
                  {t('profile.historyEmpty')}
                </div>
              ) : (
              <div className="history-list">
                {matchHistory.map((match) => (
                  <div key={match.id} className={`history-item ${match.result}`}>
                    <div className="history-result">
                      {match.result === 'win' ? (
                        <span className="result-badge win">{t('profile.historyWin')}</span>
                      ) : (
                        <span className="result-badge lose">{t('profile.historyLose')}</span>
                      )}
                    </div>
                    <div className="history-row" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <div className="history-opponent">{t('profile.historyVs')} {match.opponent}</div>
                      <div className={`history-elo ${match.eloChange > 0 ? 'positive' : 'negative'}`} style={{ minWidth: 70, textAlign: 'right' }}>
                        {match.eloChange > 0 ? '+' : ''}{match.eloChange} Elo
                      </div>
                    </div>
                    <div className="history-footer" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, justifyContent: 'space-between' }}>
                      <div
                        className="history-time"
                        style={{
                          fontSize: 12,
                          color: '#94A3B8',
                          background: 'rgba(148,163,184,0.12)',
                          padding: '4px 10px',
                          borderRadius: 12,
                          lineHeight: 1,
                          minWidth: 90,
                          textAlign: 'center'
                        }}
                      >
                        {match.time}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Analyze Button - Requirements 16.2, 20.2 */}
                        <button
                          className="btn-primary"
                          onClick={() => { window.location.hash = `#ai-analysis?matchId=${match.id}` }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(56, 189, 248, 0.5)',
                            background: analyzedMatches.has(match.id) 
                              ? 'rgba(34, 197, 94, 0.15)' 
                              : 'rgba(56, 189, 248, 0.15)',
                            color: analyzedMatches.has(match.id) ? '#22C55E' : '#38BDF8',
                            cursor: 'pointer',
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {analyzedMatches.has(match.id) ? '✓' : '🔍'} {t('aiAnalysis.analyzeButton')}
                        </button>
                        {/* Report Button */}
                        <button
                          className="btn-secondary"
                          disabled={!match.opponentId}
                          onClick={() => {
                            if (!match.opponentId) {
                              alert(t('report.errorNoReport') || 'Không tìm thấy đối thủ để báo cáo')
                              return
                            }
                            setReportTarget({ userId: match.opponentId, matchId: match.id })
                            setShowReportModal(true)
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(239,68,68,0.5)',
                            background: 'rgba(239,68,68,0.08)',
                            color: '#EF4444',
                            cursor: match.opponentId ? 'pointer' : 'not-allowed',
                            fontSize: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          🚩 {t('report.button') || 'Báo cáo'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </main>

      {showReportModal && reportTarget && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => { setShowReportModal(false); setReportTarget(null) }}
          reportedUserId={reportTarget.userId}
          matchId={reportTarget.matchId}
          onSuccess={() => { setShowReportModal(false); setReportTarget(null) }}
        />
      )}
      </div>
    </div>
  )
}
