export type TrainingDifficulty = 'nhap-mon' | 'ky-tai' | 'nghich-thien' | 'thien-ton' | 'hu-vo'

export interface AIMoveResult {
  x: number
  y: number
  score: number
  rationale: string
}

type BoardCell = 'X' | 'O' | null

type BoardMatrix = BoardCell[][]

type DifficultyTuning = {
  offenseWeight: number
  defenseWeight: number
  randomness: number
  searchRadius: number
  label: string
  style: 'defense' | 'balanced' | 'offense'
  lookaheadDepth?: number
  lookaheadBranching?: number
}

const difficultyProfiles: Record<TrainingDifficulty, DifficultyTuning> = {
  'nhap-mon': {
    offenseWeight: 0.65,
    defenseWeight: 1.4,
    randomness: 0.25,
    searchRadius: 2,
    label: 'Nhập Môn',
    style: 'defense'
  },
  'ky-tai': {
    offenseWeight: 1,
    defenseWeight: 1,
    randomness: 0.12,
    searchRadius: 2,
    label: 'Kỳ Tài',
    style: 'balanced'
  },
  'nghich-thien': {
    offenseWeight: 1.45,
    defenseWeight: 0.85,
    randomness: 0.05,
    searchRadius: 3,
    label: 'Nghịch Thiên',
    style: 'offense'
  },
  'thien-ton': {
    offenseWeight: 1.6,
    defenseWeight: 0.95,
    randomness: 0.02,
    searchRadius: 4,
    label: 'Thiên Tôn',
    style: 'offense',
    lookaheadDepth: 2,
    lookaheadBranching: 4
  },
  'hu-vo': {
    offenseWeight: 1.8,
    defenseWeight: 1.1,
    randomness: 0.005,
    searchRadius: 5,
    label: 'Hư Vô',
    style: 'offense',
    lookaheadDepth: 3,
    lookaheadBranching: 5
  }
}

const directions = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
] as const

type Direction = typeof directions[number]

const patternScores: Record<number, number> = {
  5: 120000,
  4: 16000,
  3: 1500,
  2: 220,
  1: 40
}

export function getAIMove(
  board: BoardMatrix,
  aiSymbol: 'X' | 'O',
  difficulty: TrainingDifficulty,
  opponentSymbol: 'X' | 'O'
): AIMoveResult | null {
  const profile = difficultyProfiles[difficulty]
  const candidates = collectCandidateCells(board, profile.searchRadius)
  if (!candidates.length) {
    const fallback = findFallbackCell(board)
    return fallback ? { ...fallback, score: 0, rationale: 'fallback' } : null
  }

  const scored = candidates.map(({ x, y }) => {
    const attack = evaluatePotential(board, x, y, aiSymbol)
    const defense = evaluatePotential(board, x, y, opponentSymbol)
    const proximity = countNeighbors(board, x, y)
    const randomness = Math.random() * profile.randomness * 50
    const score = attack * profile.offenseWeight + defense * profile.defenseWeight + proximity * 25 + randomness
    const rationale = buildRationale(attack, defense, profile.style)
    return { x, y, score, rationale }
  })

  scored.sort((a, b) => b.score - a.score)

  if (profile.lookaheadDepth && profile.lookaheadDepth > 0) {
    const branch = profile.lookaheadBranching ?? 3
    const advancedTargets = scored.slice(0, branch)
    advancedTargets.forEach(move => {
      const bonus = lookaheadAdjustment(
        board,
        move.x,
        move.y,
        aiSymbol,
        opponentSymbol,
        profile.lookaheadDepth!,
        profile.lookaheadBranching
      )
      move.score += bonus
    })
    scored.sort((a, b) => b.score - a.score)
  }
  const top = scored[0]
  if (!top) return null

  // Occasionally pick among the top 2-3 moves for lower tiers to feel more human
  if (difficulty !== 'nghich-thien') {
    const jitter = difficulty === 'nhap-mon' ? 0.2 : 0.1
    const threshold = top.score * (1 - jitter)
    const filtered = scored.filter(move => move.score >= threshold)
    const choice = filtered[Math.floor(Math.random() * filtered.length)]
    return choice ?? top
  }

  return top
}

function buildRationale(attack: number, defense: number, style: DifficultyTuning['style']): string {
  if (style === 'offense' && attack >= defense) return 'pressing advantage'
  if (style === 'defense' && defense > attack) return 'blocking threat'
  if (Math.abs(attack - defense) < 100) return 'positional balance'
  return attack > defense ? 'attack window' : 'safety first'
}

function collectCandidateCells(board: BoardMatrix, radius: number) {
  const size = board.length
  const candidates: Array<{ x: number; y: number }> = []
  const seen = new Set<string>()
  let hasStone = false

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!board[y][x]) continue
      hasStone = true
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
          if (board[ny][nx] !== null) continue
          const key = `${nx}_${ny}`
          if (!seen.has(key)) {
            seen.add(key)
            candidates.push({ x: nx, y: ny })
          }
        }
      }
    }
  }

  if (!hasStone) {
    const mid = Math.floor(size / 2)
    return [{ x: mid, y: mid }]
  }

  return candidates
}

function findFallbackCell(board: BoardMatrix) {
  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      if (board[y][x] === null) {
        return { x, y }
      }
    }
  }
  return null
}

function evaluatePotential(board: BoardMatrix, x: number, y: number, symbol: 'X' | 'O'): number {
  let total = 0

  for (const dir of directions) {
    const { count, openEnds } = countDirection(board, x, y, symbol, dir)
    const capped = Math.min(count, 5)
    const base = patternScores[capped] ?? 0
    if (base === 0) continue
    const openFactor = openEnds === 2 ? 2 : openEnds === 1 ? 0.85 : 0.1
    total += base * openFactor
  }

  return total
}

function countDirection(board: BoardMatrix, x: number, y: number, symbol: 'X' | 'O', dir: Direction) {
  const size = board.length
  let count = 1
  let openEnds = 0

  let step = 1
  while (true) {
    const nx = x + dir[0] * step
    const ny = y + dir[1] * step
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) break
    const cell = board[ny][nx]
    if (cell === symbol) {
      count += 1
      step += 1
      continue
    }
    if (cell === null) openEnds += 1
    break
  }

  step = 1
  while (true) {
    const nx = x - dir[0] * step
    const ny = y - dir[1] * step
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) break
    const cell = board[ny][nx]
    if (cell === symbol) {
      count += 1
      step += 1
      continue
    }
    if (cell === null) openEnds += 1
    break
  }

  return { count, openEnds }
}

function countNeighbors(board: BoardMatrix, x: number, y: number) {
  const size = board.length
  let tally = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
      if (board[ny][nx] !== null) {
        tally += 1
      }
    }
  }
  return tally
}

export function describeDifficulty(difficulty: TrainingDifficulty) {
  return difficultyProfiles[difficulty]
}

function lookaheadAdjustment(
  board: BoardMatrix,
  moveX: number,
  moveY: number,
  aiSymbol: 'X' | 'O',
  opponentSymbol: 'X' | 'O',
  depth: number,
  branching?: number
) {
  const cloned = cloneBoard(board)
  cloned[moveY][moveX] = aiSymbol
  return minimaxEvaluate(cloned, depth - 1, false, aiSymbol, opponentSymbol, branching ?? 3)
}

function cloneBoard(board: BoardMatrix): BoardMatrix {
  return board.map(row => [...row])
}

function minimaxEvaluate(
  board: BoardMatrix,
  depth: number,
  maximizing: boolean,
  aiSymbol: 'X' | 'O',
  opponentSymbol: 'X' | 'O',
  branching: number
): number {
  const baseEval = evaluateBoardState(board, aiSymbol, opponentSymbol)
  if (depth <= 0) return baseEval

  const symbol = maximizing ? aiSymbol : opponentSymbol
  const candidates = collectCandidateCells(board, 3)
  if (!candidates.length) return baseEval

  const limited = candidates.slice(0, branching)
  if (!limited.length) return baseEval

  if (maximizing) {
    let best = -Infinity
    for (const { x, y } of limited) {
      const next = cloneBoard(board)
      next[y][x] = symbol
      const score = minimaxEvaluate(next, depth - 1, false, aiSymbol, opponentSymbol, branching)
      if (score > best) best = score
    }
    return best
  }

  let best = Infinity
  for (const { x, y } of limited) {
    const next = cloneBoard(board)
    next[y][x] = symbol
    const score = minimaxEvaluate(next, depth - 1, true, aiSymbol, opponentSymbol, branching)
    if (score < best) best = score
  }
  return best
}

function evaluateBoardState(board: BoardMatrix, aiSymbol: 'X' | 'O', opponentSymbol: 'X' | 'O') {
  let bestAttack = 0
  let bestDefense = 0
  let oppAttack = 0
  let oppDefense = 0

  for (let y = 0; y < board.length; y++) {
    for (let x = 0; x < board[y].length; x++) {
      if (board[y][x] !== null) continue
      const aiAttack = evaluatePotential(board, x, y, aiSymbol)
      const aiDefense = evaluatePotential(board, x, y, opponentSymbol)
      const opponentAttack = evaluatePotential(board, x, y, opponentSymbol)
      const opponentDefense = evaluatePotential(board, x, y, aiSymbol)
      if (aiAttack > bestAttack) bestAttack = aiAttack
      if (aiDefense > bestDefense) bestDefense = aiDefense
      if (opponentAttack > oppAttack) oppAttack = opponentAttack
      if (opponentDefense > oppDefense) oppDefense = opponentDefense
    }
  }

  return (bestAttack + bestDefense * 0.7) - (oppAttack + oppDefense * 0.7)
}
