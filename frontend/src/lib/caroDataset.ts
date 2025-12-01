export interface CaroQAEntry {
  id: string
  question: string
  paraphrases: string[]
  answer: string
  difficulty?: string
  topic?: string
}

export interface CaroAnswerHit {
  entry: CaroQAEntry
  score: number
  matchedText?: string
}

let cachedDataset: CaroQAEntry[] | null = null

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
      topic: parsed.topic
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

export async function loadCaroDataset() {
  if (cachedDataset) return cachedDataset
  const mod = await import('../../../backend/data/caro_dataset.jsonl?raw')
  cachedDataset = parseCaroDataset(mod.default)
  return cachedDataset
}

export function findBestCaroAnswer(query: string, dataset: CaroQAEntry[]): CaroAnswerHit | null {
  const qTokens = tokenize(query)
  if (!qTokens.length) return null
  let best: CaroAnswerHit | null = null
  dataset.forEach((entry) => {
    const candidates = [entry.question, ...entry.paraphrases]
    candidates.forEach((text) => {
      const candidateTokens = tokenize(text)
      const score = overlapScore(qTokens, candidateTokens)
      if (!best || score > best.score) {
        best = { entry, score, matchedText: text }
      }
    })
  })
  if (!best || best.score < 0.14) return null
  return best
}
