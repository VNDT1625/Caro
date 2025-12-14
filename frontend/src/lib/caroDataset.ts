export interface CaroQAEntry {
  id: string
  question: string
  paraphrases: string[]
  answer: string
  difficulty?: string
  topic?: string
  language?: string // 'vi' | 'en' | 'zh' | 'ja' - ngôn ngữ của câu trả lời
}

export interface CaroAnswerHit {
  entry: CaroQAEntry
  score: number
  matchedText?: string
}

let cachedDataset: CaroQAEntry[] | null = null
let cachedLanguage: string | undefined = undefined
const LOCAL_DATASET_KEY = 'caro_dataset_local'
let backgroundLoadPromise: Promise<void> | null = null
let backgroundLoadLanguage: string | undefined = undefined
let preloadPromise: Promise<CaroQAEntry[]> | null = null

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string) {
  if (!value) return []
  return normalizeText(value).split(' ').filter(Boolean)
}

function overlapScore(queryTokens: string[], candidateTokens: string[]) {
  if (!queryTokens.length || !candidateTokens.length) return 0
  const candidateSet = new Set(candidateTokens)
  let overlap = 0
  for (const token of queryTokens) {
    if (candidateSet.has(token)) overlap += 1
  }
  const coverageQuery = overlap / queryTokens.length
  const coverageCandidate = overlap / candidateTokens.length
  const balancePenalty = 1 - Math.min(Math.abs(queryTokens.length - candidateTokens.length) / Math.max(queryTokens.length, candidateTokens.length, 1), 0.5)
  let score = (coverageQuery * 0.6 + coverageCandidate * 0.4) * balancePenalty
  const joinedQuery = queryTokens.join(' ')
  const joinedCandidate = candidateTokens.join(' ')
  if (joinedCandidate.includes(joinedQuery) || joinedQuery.includes(joinedCandidate)) {
    score += 0.08
  }
  return Math.min(score, 1)
}

function parseLine(line: string, index: number): CaroQAEntry | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (!parsed.question || !parsed.answer) return null
    return {
      id: parsed.id || `c-${index}`,
      question: parsed.question,
      paraphrases: Array.isArray(parsed.paraphrases) ? parsed.paraphrases : [],
      answer: parsed.answer,
      difficulty: parsed.difficulty,
      topic: parsed.topic,
      language: parsed.language || 'vi' // Mặc định 'vi' cho các entries cũ không có language
    }
  } catch {
    return null
  }
}

export function parseCaroDataset(raw: string) {
  const lines = raw.split(/\r?\n/)
  const entries: CaroQAEntry[] = []
  lines.forEach((line, idx) => {
    const entry = parseLine(line, idx)
    if (entry) entries.push(entry)
  })
  return entries
}

// Yield control back to browser để tránh block main thread
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 50 })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

export async function loadCaroDataset(language?: string) {
  // Cache per language - nếu language khác thì load lại
  if (cachedDataset && cachedLanguage === language) {
    return cachedDataset
  }

  const merged: CaroQAEntry[] = []
  // Dùng Map để check duplicate O(1) thay vì O(n)
  const seenKeys = new Map<string, boolean>()
  
  const pushUnique = (entry: CaroQAEntry) => {
    // Filter by language if specified
    const entryLanguage = entry.language || 'vi'
    if (language && entryLanguage !== language) {
      return // Skip entries with different language
    }
    
    const key = normalizeText(entry.question) + '|' + entryLanguage
    if (!seenKeys.has(key)) {
      seenKeys.set(key, true)
      merged.push(entry)
    }
  }

  // Load từ các file nhỏ đã chia sẵn
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
    
    // Đọc index để biết có bao nhiêu parts
    const indexRes = await fetch('/datasets/index.json', { signal: controller.signal })
    clearTimeout(timeoutId)
    
    if (!indexRes.ok) {
      throw new Error('Cannot load dataset index')
    }
    
    const index = await indexRes.json()
    console.log(`[caroDataset] Loading ${index.totalParts} parts...`)

    const partsToLoadNow = Math.min(3, index.totalParts) // load nhanh 3 part dau

    const loadPart = async (partNumber: number, timeoutMs: number, background = false) => {
      const partInfo = Array.isArray(index?.parts) ? index.parts[partNumber - 1] : null
      const file = partInfo?.file || `caro_dataset_part${partNumber}.jsonl`
      try {
        const partController = new AbortController()
        const partTimeout = setTimeout(() => partController.abort(), timeoutMs)
        const partRes = await fetch(`/datasets/${file}`, { signal: partController.signal })
        clearTimeout(partTimeout)
        if (partRes.ok) {
          const raw = await partRes.text()
          const entries = parseCaroDataset(raw)
          
          // Process entries in batches để không block main thread
          const BATCH_SIZE = 100
          for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE)
            batch.forEach(pushUnique)
            
            // Yield sau mỗi batch nếu là background load
            if (background && i + BATCH_SIZE < entries.length) {
              await yieldToMain()
            }
          }
          
          const tag = background ? 'Background' : 'Loaded'
          console.log(`[caroDataset] ${tag} part ${partNumber}: ${entries.length} entries`)
        }
      } catch (partErr) {
        const tag = background ? 'background' : 'foreground'
        console.warn(`[caroDataset] Failed to load part ${partNumber} (${tag})`, partErr)
      }
    }

    for (let i = 1; i <= partsToLoadNow; i++) {
      await loadPart(i, 3000, false)
    }

    const remainingStart = partsToLoadNow + 1
    if (remainingStart <= index.totalParts) {
      const langForBg = language
      if (!backgroundLoadPromise || backgroundLoadLanguage !== langForBg) {
        backgroundLoadLanguage = langForBg
        backgroundLoadPromise = (async () => {
          for (let i = remainingStart; i <= index.totalParts; i++) {
            await loadPart(i, 5000, true)
            // Yield giữa các parts để browser có thể xử lý UI
            await yieldToMain()
            await new Promise((resolve) => setTimeout(resolve, 300)) // tăng delay lên 300ms
          }
          console.log(`[caroDataset] Background load done (${merged.length} entries, lang=${langForBg || 'all'})`)
        })().catch((err) => console.warn('[caroDataset] Background load failed', err))
      }
    }
    
    console.log(`[caroDataset] Total loaded: ${merged.length} entries`)
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[caroDataset] Dataset fetch timeout')
    } else {
      console.warn('[caroDataset] Dataset fetch failed', err)
    }
    // Không throw error, chỉ return empty dataset
  }

  cachedDataset = merged

  // Merge với bản local do trial bổ sung (filter theo language nếu có)
  try {
    const local = getLocalDatasetEntries()
    if (local.length) {
      const baseIds = new Set((cachedDataset || []).map((e) => normalizeText(e.question)))
      local.forEach((e) => {
        // Filter by language if specified
        // Entries không có language được coi là 'vi' (mặc định)
        const eLanguage = e.language || 'vi'
        if (language && eLanguage !== language) {
          return // Skip entries with different language
        }
        const key = normalizeText(e.question)
        if (!baseIds.has(key)) {
          cachedDataset?.push(e)
        }
      })
    }
  } catch (err) {
    console.warn('[caroDataset] merge local dataset failed', err)
  }

  // Filter final result by language if specified
  // Entries không có language được coi là 'vi' (mặc định)
  if (language) {
    for (let i = cachedDataset.length - 1; i >= 0; i--) {
      const eLanguage = cachedDataset[i].language || 'vi'
      if (eLanguage !== language) {
        cachedDataset.splice(i, 1)
      }
    }
  }

  // Cache với language để biết đã load cho language nào
  cachedLanguage = language

  return cachedDataset
}

export function findBestCaroAnswer(query: string, dataset: CaroQAEntry[]): CaroAnswerHit | null {
  const qTokens = tokenize(query)
  if (!qTokens.length) return null
  let best: CaroAnswerHit | null = null
  
  for (const entry of dataset) {
    const candidates = [entry.question, ...entry.paraphrases]
    for (const text of candidates) {
      const candidateTokens = tokenize(text)
      const score = overlapScore(qTokens, candidateTokens)
      if (best === null) {
        best = { entry, score, matchedText: text }
      } else if (score > best.score) {
        best = { entry, score, matchedText: text }
      }
    }
  }
  
  if (best === null) return null
  if (best.score < 0.14) return null
  return best
}

function readLocalDataset(): CaroQAEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_DATASET_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((e: any, idx: number) => ({
      id: e.id || `c-local-${idx}-${Date.now()}`,
      question: e.question || '',
      paraphrases: Array.isArray(e.paraphrases) ? e.paraphrases : [],
      answer: e.answer || '',
      difficulty: e.difficulty,
      topic: e.topic
    }))
  } catch {
    return []
  }
}

function saveLocalDataset(entries: CaroQAEntry[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_DATASET_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

export function getLocalDatasetEntries() {
  return readLocalDataset()
}

export function clearLocalDatasetEntries() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LOCAL_DATASET_KEY)
  } catch {
    // ignore
  }
}

export function exportLocalDatasetEntries(filename: string = 'caro_dataset_local.jsonl') {
  const list = readLocalDataset()
  if (!list.length || typeof window === 'undefined') return
  const lines = list.map((item) => JSON.stringify(item)).join('\n')
  const blob = new Blob([lines], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Decode JWT token để lấy payload
 */
function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    console.error('[decodeJWT] Failed to decode token:', e)
    return null
  }
}

/**
 * Validate JWT token (check expiry)
 */
function validateToken(token: string): { valid: boolean; expiresIn?: number; error?: string } {
  const decoded = decodeJWT(token)
  if (!decoded) {
    return { valid: false, error: 'Invalid token format' }
  }
  
  if (!decoded.exp) {
    return { valid: false, error: 'Token missing expiry' }
  }
  
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = decoded.exp - now
  
  if (expiresIn <= 0) {
    return { valid: false, error: 'Token expired' }
  }
  
  return { valid: true, expiresIn }
}

export function addLocalDatasetEntry(entry: Omit<CaroQAEntry, 'id'> & { id?: string }) {
  const list = readLocalDataset()
  const normalized = normalizeText(entry.question)
  const exists = list.some((e) => normalizeText(e.question) === normalized)
  if (exists) return
  const newEntry: CaroQAEntry = {
    id: entry.id || `c-local-${Date.now()}`,
    question: entry.question,
    paraphrases: entry.paraphrases || [],
    answer: entry.answer,
    difficulty: entry.difficulty || 'beginner',
    topic: entry.topic || 'auto'
  }
  list.push(newEntry)
  saveLocalDataset(list)
}

/**
 * Gửi dataset entry lên server để lưu vào caro_dataset.jsonl chung
 * Để tất cả user đều có thể dùng dataset được cải thiện
 * @param language - Ngôn ngữ của câu trả lời ('vi' | 'en' | 'zh' | 'ja')
 */
export async function addServerDatasetEntry(
  entry: Omit<CaroQAEntry, 'id'> & { id?: string },
  language: string,
  token?: string | null
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Not in browser' }
  
  // Validate token trước khi gửi
  if (!token) {
    console.error('[addServerDatasetEntry] No token provided!')
    return { success: false, error: 'Authentication required - no token' }
  }
  
  const tokenValidation = validateToken(token)
  if (!tokenValidation.valid) {
    console.error('[addServerDatasetEntry] Token validation failed:', tokenValidation.error)
    return { success: false, error: `Token invalid: ${tokenValidation.error}` }
  }
  
  if (tokenValidation.expiresIn && tokenValidation.expiresIn < 60) {
    console.warn('[addServerDatasetEntry] Token expires in less than 60 seconds, may need refresh')
  }
  
  console.log('[addServerDatasetEntry] Token valid, expires in:', tokenValidation.expiresIn, 'seconds')
  
  try {
    // Dùng cùng pattern như chat.ts để đảm bảo consistency
    const { getApiBase } = await import('./apiBase')
    let apiBase = getApiBase()
    
    // Force sử dụng port 8001 cho PHP backend (Node socket server dùng 8000)
    if (typeof window !== 'undefined' && window.location) {
      const isDev = window.location.port === '5173' || window.location.hostname === 'localhost'
      if (isDev && (!apiBase || apiBase.includes(':8000'))) {
        apiBase = `${window.location.protocol}//${window.location.hostname}:8001`
        console.log('[addServerDatasetEntry] Using PHP backend on port 8001')
      }
    }
    
    function buildUrl(path: string) {
      const normalized = path.startsWith('/') ? path : `/${path}`
      return apiBase ? `${apiBase}${normalized}` : normalized
    }
    
    const url = buildUrl('/api/dataset/add')
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
    
    console.log('[addServerDatasetEntry] Sending request to:', url)
    console.log('[addServerDatasetEntry] Token (first 30 chars):', token.substring(0, 30) + '...')
    
    const requestBody = {
      question: entry.question,
      answer: entry.answer,
      paraphrases: entry.paraphrases || [],
      topic: entry.topic || 'auto',
      difficulty: entry.difficulty || 'beginner',
      language: language // Thêm language vào request
    }
    
    console.log('[addServerDatasetEntry] API Base:', apiBase)
    console.log('[addServerDatasetEntry] Sending to:', url, 'Body:', requestBody)
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })
    
    console.log('[addServerDatasetEntry] Response status:', response.status, response.statusText)
    
    if (!response.ok) {
      const text = await response.text()
      console.error('[addServerDatasetEntry] Error response:', text)
      let error: any = { error: 'Unknown error' }
      try {
        error = text ? JSON.parse(text) : { error: `HTTP ${response.status}` }
      } catch {
        error = { error: text || `HTTP ${response.status}` }
      }
      return { success: false, error: error.error || error.message || `HTTP ${response.status}` }
    }
    
    return { success: true }
  } catch (err) {
    console.error('Failed to add dataset entry to server:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}


/**
 * Preload dataset khi app khởi động (gọi trong App.tsx)
 * Sử dụng requestIdleCallback để load khi browser rảnh, không block UI
 */
export function preloadDataset(language?: string): Promise<CaroQAEntry[]> {
  // Nếu đã có cache, return ngay
  if (cachedDataset && cachedLanguage === language) {
    return Promise.resolve(cachedDataset)
  }
  
  // Nếu đang preload, return promise đang chạy
  if (preloadPromise) {
    return preloadPromise
  }
  
  // Bắt đầu preload khi browser rảnh
  preloadPromise = new Promise((resolve) => {
    const startPreload = () => {
      console.log('[caroDataset] Starting preload...')
      loadCaroDataset(language)
        .then((data) => {
          console.log(`[caroDataset] Preload complete: ${data.length} entries`)
          resolve(data)
        })
        .catch((err) => {
          console.warn('[caroDataset] Preload failed:', err)
          resolve([])
        })
    }
    
    // Dùng requestIdleCallback nếu có, fallback setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(startPreload, { timeout: 2000 })
    } else {
      setTimeout(startPreload, 100)
    }
  })
  
  return preloadPromise
}

/**
 * Kiểm tra xem dataset đã được load chưa
 */
export function isDatasetLoaded(): boolean {
  return cachedDataset !== null && cachedDataset.length > 0
}

/**
 * Lấy số lượng entries đã load
 */
export function getLoadedEntriesCount(): number {
  return cachedDataset?.length ?? 0
}


/**
 * Server-side search - gửi query lên server để search dataset
 * Dùng khi không muốn load toàn bộ dataset ở frontend
 */
export async function searchDatasetOnServer(
  query: string,
  language?: string
): Promise<CaroAnswerHit | null> {
  try {
    const { getApiBase } = await import('./apiBase')
    let apiBase = getApiBase()
    
    // Force sử dụng port 8001 cho PHP backend
    if (typeof window !== 'undefined' && window.location) {
      const isDev = window.location.port === '5173' || window.location.hostname === 'localhost'
      if (isDev && (!apiBase || apiBase.includes(':8000'))) {
        apiBase = `${window.location.protocol}//${window.location.hostname}:8001`
      }
    }
    
    const url = apiBase ? `${apiBase}/api/dataset/search` : '/api/dataset/search'
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, language })
    })
    
    if (!response.ok) {
      console.warn('[searchDatasetOnServer] HTTP error:', response.status)
      return null
    }
    
    const data = await response.json()
    
    if (!data.found) {
      return null
    }
    
    return {
      entry: {
        id: 'server-result',
        question: data.matchedText || query,
        paraphrases: [],
        answer: data.answer,
        topic: data.topic,
        difficulty: data.difficulty,
        language: language
      },
      score: data.score,
      matchedText: data.matchedText
    }
  } catch (err) {
    console.warn('[searchDatasetOnServer] Error:', err)
    return null
  }
}
