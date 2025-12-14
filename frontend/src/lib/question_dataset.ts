/**
 * Thu thap cac cau hoi chua co trong dataset Free.
 * Luu vao localStorage (key: question_dataset) va gan len window de export.
 */
export interface UnansweredQuestion {
  question: string
  normalized?: string
  answer?: string
  model?: string
  source: 'free' | 'trial' | 'pro'
  userId: string | null
  ts: number
}

const STORAGE_KEY = 'question_dataset'
const EXPORT_FILENAME = 'question_dataset.jsonl'
const DATASET_APPEND_KEY = 'caro_dataset_appended'

function loadList(): UnansweredQuestion[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Bo cac record loi/khong co question de tranh trim undefined
    return parsed
      .filter((item) => item && typeof item === 'object' && typeof item.question === 'string')
      .map((item) => ({
        ...item,
        question: (item.question || '').toString(),
        normalized: item.normalized ? item.normalized.toString() : undefined,
        answer: item.answer ? item.answer.toString() : undefined,
        model: item.model ? item.model.toString() : undefined
      }))
  } catch {
    return []
  }
}

export function recordUnansweredQuestion(entry: Omit<UnansweredQuestion, 'ts'>) {
  const question = (entry.question || '').toString().trim()
  if (!question) return
  const normalized = (entry.normalized || question).toString().trim()
  const item: UnansweredQuestion = { ...entry, question, normalized, ts: Date.now() }
  const list = loadList()
  const exists = list.some((q) => {
    const qa = (q.normalized ?? q.question ?? '').toString().trim().toLowerCase()
    const qb = (item.normalized ?? item.question ?? '').toString().trim().toLowerCase()
    const ansMatch = (q.answer || '').toString().trim().toLowerCase() === (item.answer || '').toString().trim().toLowerCase()
    return qa === qb && (!!item.answer ? ansMatch : true)
  })
  if (exists) return
  list.push(item)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
      ;(window as any).__question_dataset = list
    } catch {
      // ignore storage errors
    }
  }
}

export function getUnansweredQuestions() {
  return loadList()
}

export function clearUnansweredQuestions() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
    ;(window as any).__question_dataset = []
  } catch {
    // ignore
  }
}

export function exportUnansweredQuestions(filename: string = EXPORT_FILENAME) {
  const list = loadList()
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

export async function appendToCaroDataset(newEntry: { question: string; answer: string; paraphrases?: string[]; topic?: string; difficulty?: string }) {
  if (typeof window === 'undefined') return
  const normalized = newEntry.question.trim().toLowerCase()
  try {
    const appendedRaw = localStorage.getItem(DATASET_APPEND_KEY)
    const appended: string[] = appendedRaw ? JSON.parse(appendedRaw) : []
    if (appended.includes(normalized)) return // already appended this question

    const res = await fetch('/caro_dataset.jsonl')
    const baseText = res.ok ? await res.text() : ''
    const id = `c-auto-${Date.now()}`
    const entry = {
      id,
      question: newEntry.question,
      paraphrases: newEntry.paraphrases || [],
      answer: newEntry.answer,
      topic: newEntry.topic || 'auto',
      difficulty: newEntry.difficulty || 'beginner'
    }
    const combined = `${baseText ? baseText + '\n' : ''}${JSON.stringify(entry)}`
    const blob = new Blob([combined], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'caro_dataset_updated.jsonl'
    a.click()
    URL.revokeObjectURL(url)

    appended.push(normalized)
    localStorage.setItem(DATASET_APPEND_KEY, JSON.stringify(appended))
  } catch (e) {
    console.warn('appendToCaroDataset failed', e)
  }
}
