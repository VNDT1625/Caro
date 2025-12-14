let cachedBaseUrl: string | null = null

function sanitize(value?: string | null): string {
  if (!value) return ''
  return value.trim().replace(/\/$/, '')
}

function candidateValues(): string[] {
  return [
    import.meta.env.VITE_SOCIAL_API_URL as string | undefined,
    import.meta.env.VITE_CHAT_API_URL as string | undefined,
    import.meta.env.VITE_API_URL as string | undefined,
    import.meta.env.VITE_SERVER_URL as string | undefined,
    import.meta.env.VITE_BACKEND_URL as string | undefined
  ]
    .filter((val): val is string => typeof val === 'string' && Boolean(val.trim()))
    .map((val) => val.trim())
}

export function getApiBase(): string {
  // Reset cache on each call in dev mode to allow hot reload
  if (import.meta.env.DEV) {
    cachedBaseUrl = null
  }
  
  if (cachedBaseUrl !== null) return cachedBaseUrl

  const fromEnv = candidateValues().find(Boolean)
  if (fromEnv) {
    cachedBaseUrl = sanitize(fromEnv)
    return cachedBaseUrl
  }

  if (typeof window !== 'undefined') {
    const fallback =
      (window as any).__MP_API_BASE__ ||
      // Dev fallback: if running Vite on 5173, use Node socket server on 8000 for chat/social APIs
      (window.location?.port === '5173' ? `${window.location.protocol}//${window.location.hostname}:8000` : '') ||
      window.location?.origin ||
      ''
    cachedBaseUrl = sanitize(fallback)
    
    console.log('[apiBase] API Base URL:', cachedBaseUrl) // Debug log
    return cachedBaseUrl
  }

  cachedBaseUrl = ''
  return cachedBaseUrl
}
