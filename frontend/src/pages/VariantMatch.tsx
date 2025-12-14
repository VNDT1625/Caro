import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useSwap2Local } from '../hooks/useSwap2Local'
import Swap2PhaseIndicator from '../components/swap2/Swap2PhaseIndicator'
import ColorChoiceModal from '../components/swap2/ColorChoiceModal'
import { supabase } from '../lib/supabase'
import { io, Socket } from 'socket.io-client'
import { Skill, getRandomSkillsForTurn, useSkillApi, SKILL_ICONS, RARITY_COLORS, LOCAL_SKILLS, getRandomLocalSkills, getSkillIcon, LocalSkill, getUserUnlockedSkills, getStarterSkills } from '../lib/skillApi'
import InGameSkillPanel from '../components/skill/InGameSkillPanel'
import { MobileBreadcrumb } from '../components/layout'

// Hook to detect mobile screen
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

// Type alias for skills used in this component (can be API Skill or LocalSkill)
type GameSkill = Skill | LocalSkill

type PlayerSide = 'X' | 'O'
type VariantType = 'custom' | 'hidden' | 'skill' | 'terrain'
type OpponentType = 'local' | 'online' | 'matchmaking'

// Standard settings for matchmaking per variant type (không chỉnh được)
const MATCHMAKING_CONFIGS: Record<VariantType, { boardSize: number; winLength: number; timePerMove: number; swap2Enabled: boolean }> = {
  custom: { boardSize: 15, winLength: 5, timePerMove: 30, swap2Enabled: true },  // Tùy chỉnh: có swap2
  hidden: { boardSize: 15, winLength: 5, timePerMove: 30, swap2Enabled: true },  // Caro Ẩn: có swap2
  skill: { boardSize: 15, winLength: 5, timePerMove: 30, swap2Enabled: false },  // Caro Skill: không swap2
  terrain: { boardSize: 15, winLength: 5, timePerMove: 30, swap2Enabled: false } // Địa hình: không swap2
}

// Use Skill type from skillApi (imported above)
// LocalSkill is used for local/offline mode fallback

interface CellState {
  player: PlayerSide | null
  moveIndex: number | null
  hidden: boolean // for Caro Ẩn mode
  terrain?: 'normal' | 'skill' | 'double' | 'block' | 'bomb' | 'freeze' | 'teleport' | 'shield' | 'mystery' | 'score'
  terrainRevealed?: boolean // for Caro Địa Hình - terrain only shows when stepped on
  skill?: Skill
  frozen?: number // số lượt còn bị đóng băng
  shielded?: boolean // quân cờ được bảo vệ
}

// Extended skill state with mana and effects from backend
interface SkillState {
  available: Skill[]
  cooldowns: Record<string, number>
  mana: number
  effects: any[]
  disabled: Record<string, string>
  holdCost: number
}

const HOLD_COST_BY_RARITY: Record<string, number> = {
  common: 1,
  rare: 2,
  epic: 2,
  legendary: 3
}

const TERRAIN_TYPES = [
  { type: 'skill', icon: '❓', color: 'rgba(168, 85, 247, 0.4)', descKey: 'variant.terrain.skill' },
  { type: 'double', icon: '⭐', color: 'rgba(234, 179, 8, 0.4)', descKey: 'variant.terrain.double' },
  { type: 'block', icon: '🚧', color: 'rgba(239, 68, 68, 0.4)', descKey: 'variant.terrain.block' },
  { type: 'teleport', icon: '🌀', color: 'rgba(6, 182, 212, 0.4)', descKey: 'variant.terrain.teleport' },
  { type: 'freeze', icon: '❄️', color: 'rgba(147, 197, 253, 0.4)', descKey: 'variant.terrain.freeze' },
  { type: 'bomb', icon: '💣', color: 'rgba(251, 146, 60, 0.4)', descKey: 'variant.terrain.bomb' },
  { type: 'shield', icon: '🛡️', color: 'rgba(34, 197, 94, 0.4)', descKey: 'variant.terrain.shield' },
  { type: 'mystery', icon: '🎁', color: 'rgba(236, 72, 153, 0.4)', descKey: 'variant.terrain.mystery' },
  { type: 'score', icon: '💎', color: 'rgba(139, 92, 246, 0.4)', descKey: 'variant.terrain.score' }
]

// Calculate longest chain for a player (for terrain mode scoring)
const calculateLongestChain = (board: CellState[][], player: PlayerSide, boardSize: number): number => {
  let maxChain = 0
  const directions = [
    [1, 0],   // horizontal
    [0, 1],   // vertical
    [1, 1],   // diagonal
    [1, -1]   // anti-diagonal
  ]
  
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      if (board[y][x].player !== player) continue
      
      for (const [dx, dy] of directions) {
        let count = 1
        // Count forward only (to avoid double counting)
        for (let i = 1; i < boardSize; i++) {
          const nx = x + dx * i
          const ny = y + dy * i
          if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize && board[ny][nx].player === player) {
            count++
          } else break
        }
        maxChain = Math.max(maxChain, count)
      }
    }
  }
  return maxChain
}

// Interface for chain info
interface ChainInfo {
  cells: string[]
  length: number
  direction: string
}

// Calculate total score for terrain mode with intersection bonus
// Rules: 
// - Each piece = 1 point base (single pieces count too!)
// - Each chain of n pieces (n>=2) = n points (e.g., xxx = 3pts, oo = 2pts)
// - If chains intersect at a point, bonus = sum of intersecting chain lengths (effectively x2)
// - Example: + shape (2 chains of 3 crossing) = 3 + 3 + bonus(3+3) = 12pts
const calculateTerrainScore = (board: CellState[][], player: PlayerSide, boardSize: number): { total: number; chains: ChainInfo[]; intersections: { cell: string; chains: number; bonus: number }[]; bonusPoints: number } => {
  const chains: ChainInfo[] = []
  const cellToChains: Map<string, number[]> = new Map() // cell -> chain indices
  const cellsInChains = new Set<string>() // Track cells that are part of chains >= 2
  
  const directions = [
    { dx: 1, dy: 0, name: 'h' },   // horizontal
    { dx: 0, dy: 1, name: 'v' },   // vertical
    { dx: 1, dy: 1, name: 'd1' },  // diagonal
    { dx: 1, dy: -1, name: 'd2' }  // anti-diagonal
  ]
  
  // Find all chains (length >= 2)
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      if (board[y][x].player !== player) continue
      
      for (const { dx, dy, name } of directions) {
        // Check if this is the start of a chain (no piece before)
        const prevX = x - dx
        const prevY = y - dy
        if (prevX >= 0 && prevX < boardSize && prevY >= 0 && prevY < boardSize && board[prevY]?.[prevX]?.player === player) {
          continue // Not the start of chain
        }
        
        // Count chain length
        const chainCells: string[] = [`${x},${y}`]
        for (let i = 1; i < boardSize; i++) {
          const nx = x + dx * i
          const ny = y + dy * i
          if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize && board[ny]?.[nx]?.player === player) {
            chainCells.push(`${nx},${ny}`)
          } else break
        }
        
        // Only count chains >= 2 for chain scoring
        if (chainCells.length >= 2) {
          const chainIndex = chains.length
          chains.push({ cells: chainCells, length: chainCells.length, direction: name })
          
          // Map cells to this chain and track them
          for (const cell of chainCells) {
            cellsInChains.add(cell)
            if (!cellToChains.has(cell)) {
              cellToChains.set(cell, [])
            }
            cellToChains.get(cell)!.push(chainIndex)
          }
        }
      }
    }
  }
  
  // Count single pieces (not part of any chain >= 2)
  let singlePieces = 0
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      if (board[y][x].player === player) {
        const cellKey = `${x},${y}`
        if (!cellsInChains.has(cellKey)) {
          singlePieces++
        }
      }
    }
  }
  
  // Find intersections and calculate bonus
  const intersections: { cell: string; chains: number; bonus: number }[] = []
  const chainBonusApplied = new Set<number>() // Track which chains got bonus
  
  for (const [cell, chainIndices] of cellToChains.entries()) {
    if (chainIndices.length >= 2) {
      // This cell is an intersection of multiple chains
      const intersectingChains = chainIndices.filter(i => !chainBonusApplied.has(i))
      if (intersectingChains.length >= 2) {
        // Calculate bonus: sum of chain lengths (this doubles the score for intersecting chains)
        const sumLengths = intersectingChains.reduce((sum, i) => sum + chains[i].length, 0)
        const bonus = sumLengths
        intersections.push({ cell, chains: intersectingChains.length, bonus })
        
        // Mark these chains as having bonus applied
        for (const i of intersectingChains) {
          chainBonusApplied.add(i)
        }
      }
    }
  }
  
  // Calculate total score
  let total = 0
  
  // Add chain scores
  for (let i = 0; i < chains.length; i++) {
    total += chains[i].length
  }
  
  // Add single piece scores (1 point each)
  total += singlePieces
  
  // Add intersection bonuses
  let bonusPoints = 0
  for (const intersection of intersections) {
    bonusPoints += intersection.bonus
  }
  total += bonusPoints
  
  return { total, chains, intersections, bonusPoints }
}

export default function VariantMatch() {
  const { t, language } = useLanguage()
  
  // Load config from localStorage
  const getInitialConfig = () => {
    try {
      const saved = localStorage.getItem('variantMatch')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {}
    return {
      boardSize: 15,
      winLength: 5,
      timePerMove: null,
      opponentType: 'local',
      variantType: 'custom',
      swap2Enabled: false
    }
  }
  
  const config = getInitialConfig()
  
  // Game settings
  const [boardSize, setBoardSize] = useState<number>(config.boardSize || 15)
  const [winLength, setWinLength] = useState<number>(config.winLength || 5)
  const [opponentType, setOpponentType] = useState<OpponentType>(config.opponentType === 'online' ? 'online' : 'local')
  const [variantType, setVariantType] = useState<VariantType>(config.variantType || 'custom')
  const [timePerMove, setTimePerMove] = useState<number | null>(config.timePerMove || null)
  const [swap2Enabled, setSwap2Enabled] = useState<boolean>(config.swap2Enabled || false)
  
  // Game state
  const [board, setBoard] = useState<CellState[][]>([])
  const [currentTurn, setCurrentTurn] = useState<PlayerSide>('X')
  const [moveHistory, setMoveHistory] = useState<Array<{ x: number; y: number; player: PlayerSide }>>([])
  const [winner, setWinner] = useState<PlayerSide | null>(null)
  const [isDraw, setIsDraw] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [showSetup, setShowSetup] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<number>(timePerMove || 30)
  const [scores, setScores] = useState<Record<PlayerSide, number>>({ X: 0, O: 0 })
  
  // Terrain mode: real-time chain scores with intersection details and bonus points
  const [terrainScores, setTerrainScores] = useState<Record<PlayerSide, { total: number; chains: ChainInfo[]; intersections: { cell: string; chains: number; bonus: number }[]; bonusPoints: number }>>({ 
    X: { total: 0, chains: [], intersections: [], bonusPoints: 0 }, 
    O: { total: 0, chains: [], intersections: [], bonusPoints: 0 } 
  })
  const [longestChains, setLongestChains] = useState<Record<PlayerSide, number>>({ X: 0, O: 0 })
  // Bonus points from special terrain tiles (💎 score tiles)
  const [terrainTileBonus, setTerrainTileBonus] = useState<Record<PlayerSide, number>>({ X: 0, O: 0 })
  
  // Skill state (for Caro Skill mode) - with mana/effects from backend
  const [playerSkills, setPlayerSkills] = useState<Record<PlayerSide, SkillState>>({
    X: { available: [], cooldowns: {}, mana: 5, effects: [], disabled: {}, holdCost: 0 },
    O: { available: [], cooldowns: {}, mana: 5, effects: [], disabled: {}, holdCost: 0 }
  })
  const [heldSkillIds, setHeldSkillIds] = useState<Record<PlayerSide, string[]>>({ X: [], O: [] })
  const [skillsUsedThisTurn, setSkillsUsedThisTurn] = useState<Record<PlayerSide, number>>({ X: 0, O: 0 })
  const [selectedSkill, setSelectedSkill] = useState<GameSkill | null>(null)
  const [skillMode, setSkillMode] = useState<string | null>(null) // 'swap-1', 'swap-2', 'block', etc.
  const [matchId, setMatchId] = useState<string>(`local_${Date.now()}`) // Match ID for skill API
  const [useApiSkills, setUseApiSkills] = useState<boolean>(false) // Whether to use API or local skills
  const [skillLoading, setSkillLoading] = useState<boolean>(false)
  
  // Deck selection state (for Caro Skill mode) - chọn 15 lá skill
  const [showDeckSelector, setShowDeckSelector] = useState<boolean>(false)
  const [selectedDeckX, setSelectedDeckX] = useState<LocalSkill[]>([]) // Deck của Player X (15 lá)
  const [selectedDeckO, setSelectedDeckO] = useState<LocalSkill[]>([]) // Deck của Player O (15 lá)
  const [deckSelectingFor, setDeckSelectingFor] = useState<PlayerSide>('X') // Đang chọn deck cho ai
  const [unlockedSkills, setUnlockedSkills] = useState<LocalSkill[]>([]) // Skill đã unlock từ database
  const [loadingSkills, setLoadingSkills] = useState<boolean>(false)
  
  // Terrain mode state (Caro Địa Hình)
  const [terrainNotification, setTerrainNotification] = useState<string>('')
  const [frozenPlayer, setFrozenPlayer] = useState<PlayerSide | null>(null) // Player who is frozen
  const [swapFirst, setSwapFirst] = useState<{ x: number; y: number } | null>(null)
  const [pushTarget, setPushTarget] = useState<{ x: number; y: number } | null>(null) // Target for push skill
  const [waveAnimation, setWaveAnimation] = useState<{ x: number; y: number; direction: string } | null>(null) // Wave animation for push
  
  // Hidden mode state
  const [revealTurns, setRevealTurns] = useState(0)
  
  // Track if player has moved this turn (for "End Turn" button)
  const [hasMovedThisTurn, setHasMovedThisTurn] = useState(false)
  
  // Extra turn for double terrain
  const [extraTurn, setExtraTurn] = useState(false)
  
  // Swap2 state
  const [swap2Completed, setSwap2Completed] = useState(false)
  const [playerSideMapping, setPlayerSideMapping] = useState<{ player1: PlayerSide; player2: PlayerSide }>({ player1: 'X', player2: 'O' })
  const [initialBoardAfterSwap2, setInitialBoardAfterSwap2] = useState<Record<string, PlayerSide> | undefined>(undefined)
  
  // Online mode state
  const [socket, setSocket] = useState<Socket | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [waitingForOpponent, setWaitingForOpponent] = useState(false)
  const [onlineOpponentName, setOnlineOpponentName] = useState<string>('')
  const [myOnlineSide, setMyOnlineSide] = useState<PlayerSide>('X')
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState<string>('')
  
  // Matchmaking state
  const [isMatchmaking, setIsMatchmaking] = useState(false)
  const [matchmakingTime, setMatchmakingTime] = useState(0)
  const [queuePosition, setQueuePosition] = useState(0)
  
  const boardRef = useRef<HTMLDivElement>(null)
  
  // Function to load unlocked skills
  const loadUnlockedSkills = async () => {
    setLoadingSkills(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      if (session?.session?.access_token) {
        const skills = await getUserUnlockedSkills(session.session.access_token)
        setUnlockedSkills(skills.length > 0 ? skills : getStarterSkills())
      } else {
        setUnlockedSkills(getStarterSkills())
      }
    } catch (err) {
      console.error('Error loading unlocked skills:', err)
      setUnlockedSkills(getStarterSkills())
    } finally {
      setLoadingSkills(false)
    }
  }

  // Load user and unlocked skills
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser(data.user)
        // Load username
        supabase.from('profiles').select('username, display_name').eq('user_id', data.user.id).single()
          .then(({ data: profile }) => {
            if (profile) setUsername(profile.display_name || profile.username || 'Player')
          })
        
        // Load unlocked skills từ database
        loadUnlockedSkills()
      } else {
        // Guest user - chỉ có starter skills
        setUnlockedSkills(getStarterSkills())
      }
    })
  }, [])

  // Listen for skills updated event (after purchasing packages)
  useEffect(() => {
    const handleSkillsUpdated = () => {
      console.log('Skills updated event received, reloading...')
      loadUnlockedSkills()
    }
    window.addEventListener('skillsUpdated', handleSkillsUpdated)
    return () => window.removeEventListener('skillsUpdated', handleSkillsUpdated)
  }, [])
  
  // Swap2 hook for local/bot modes
  const swap2 = useSwap2Local({
    enabled: swap2Enabled && !swap2Completed && opponentType !== 'online',
    player1Name: opponentType === 'local' ? 'Người chơi 1' : 'Bạn',
    player2Name: opponentType === 'local' ? 'Người chơi 2' : 'Bot',
    onComplete: (assignment) => {
      console.log('🎨 Swap2 complete:', assignment)
      setPlayerSideMapping({ player1: assignment.player1Side, player2: assignment.player2Side })
      
      // Convert tentative stones to board state
      const boardState: Record<string, PlayerSide> = {}
      assignment.tentativeStones.forEach((stone) => {
        const key = `${stone.x}_${stone.y}`
        const isBlack = stone.placementOrder === 1 || stone.placementOrder === 3 || stone.placementOrder === 4
        boardState[key] = isBlack ? 'X' : 'O'
      })
      setInitialBoardAfterSwap2(boardState)
      setSwap2Completed(true)
      
      // Set turn based on number of stones placed
      // Gomoku alternates: B-W-B-W-B-W...
      // After 3 stones (2B+1W): next is White (O)
      // After 5 stones (3B+2W): next is White (O)
      // So after swap2, next turn is always O (White)
      setCurrentTurn('O')
    }
  })
  
  // Fetch skills from API for online/matchmaking mode (moved before initializeBoard to avoid temporal dead zone)
  const fetchApiSkills = useCallback(async (mId: string, turn: number, player: PlayerSide, heldIds: string[] = []) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.log('No auth token, using local skills')
        return
      }
      
      setSkillLoading(true)
      const cooldownIds = Object.entries(playerSkills[player].cooldowns)
        .filter(([_, cd]) => cd > 0)
        .map(([id]) => id)
      
      const result = await getRandomSkillsForTurn(
        session.access_token,
        mId,
        turn,
        cooldownIds,
        heldIds // held skills
      )
      
      setPlayerSkills(prev => ({
        ...prev,
        [player]: {
          available: result.skills,
          cooldowns: prev[player].cooldowns,
          mana: result.mana ?? prev[player].mana,
          effects: result.effects ?? [],
          disabled: result.disabled ?? {},
          holdCost: result.hold_cost ?? 0
        }
      }))
    } catch (err) {
      console.error('Failed to fetch API skills, using local:', err)
      // Fallback to local skills
      const localSkills = getRandomLocalSkills(3) as unknown as Skill[]
      setPlayerSkills(prev => ({
        ...prev,
        [player]: { ...prev[player], available: localSkills }
      }))
    } finally {
      setSkillLoading(false)
    }
  }, [playerSkills])
  
  // Initialize board
  const initializeBoard = useCallback(() => {
    const newBoard: CellState[][] = []
    for (let y = 0; y < boardSize; y++) {
      const row: CellState[] = []
      for (let x = 0; x < boardSize; x++) {
        let terrain: CellState['terrain'] = 'normal'
        
        // Add random terrain for terrain mode - terrain is HIDDEN until stepped on
        if (variantType === 'terrain') {
          const rand = Math.random()
          // ~20% chance for special terrain (hidden events)
          if (rand < 0.02) terrain = 'bomb'        // 2% - 💣 Xóa quân xung quanh
          else if (rand < 0.04) terrain = 'freeze' // 2% - ❄️ Đóng băng ô xung quanh 2 lượt
          else if (rand < 0.06) terrain = 'teleport' // 2% - 🌀 Di chuyển quân đến ô trống ngẫu nhiên
          else if (rand < 0.08) terrain = 'shield' // 2% - 🛡️ Bảo vệ quân không bị bomb/swap
          else if (rand < 0.10) terrain = 'skill'  // 2% - ❓ Nhận skill ngẫu nhiên
          else if (rand < 0.13) terrain = 'double' // 3% - ⭐ Đi thêm lượt
          else if (rand < 0.15) terrain = 'block'  // 2% - 🚧 Ô bị khóa (hiện luôn)
          else if (rand < 0.17) terrain = 'mystery' // 2% - 🎁 Hiệu ứng ngẫu nhiên (tốt hoặc xấu)
          else if (rand < 0.20) terrain = 'score'  // 3% - 💎 Cộng 1 điểm bonus
        }
        
        // Apply initial board from swap2 if available
        let initialPlayer: PlayerSide | null = null
        let initialMoveIndex: number | null = null
        if (initialBoardAfterSwap2) {
          const key = `${x}_${y}`
          if (initialBoardAfterSwap2[key]) {
            initialPlayer = initialBoardAfterSwap2[key]
            // Find move index from swap2 stones
            const stoneIndex = Object.keys(initialBoardAfterSwap2).indexOf(key)
            initialMoveIndex = stoneIndex + 1
          }
        }
        
        row.push({
          player: initialPlayer,
          moveIndex: initialMoveIndex,
          hidden: false,
          terrain,
          // Terrain is hidden until player steps on it - ALL terrain types are hidden including block
          terrainRevealed: terrain === 'normal'
        })
      }
      newBoard.push(row)
    }
    setBoard(newBoard)
    
    // Set move history from swap2 if available
    if (initialBoardAfterSwap2) {
      const history: Array<{ x: number; y: number; player: PlayerSide }> = []
      Object.entries(initialBoardAfterSwap2).forEach(([key, player]) => {
        const [x, y] = key.split('_').map(Number)
        history.push({ x, y, player })
      })
      setMoveHistory(history)
    } else {
      setMoveHistory([])
    }
    
    // Don't reset turn if swap2 already set it
    if (!swap2Completed) {
      setCurrentTurn('X')
    }
    setWinner(null)
    setIsDraw(false)
    setTimeRemaining(timePerMove || 30)
    setRevealTurns(0)
    setExtraTurn(false)
    setSelectedSkill(null)
    setSkillMode(null)
    setHeldSkillIds({ X: [], O: [] })
    setSkillsUsedThisTurn({ X: 0, O: 0 })
    setSwapFirst(null)
    setTerrainScores({ 
      X: { total: 0, chains: [], intersections: [], bonusPoints: 0 }, 
      O: { total: 0, chains: [], intersections: [], bonusPoints: 0 } 
    })
    setLongestChains({ X: 0, O: 0 })
    setTerrainTileBonus({ X: 0, O: 0 })
    
    // Generate new match ID for skill tracking
    const newMatchId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setMatchId(newMatchId)
    
    // Initialize skills for skill mode - use deck if selected, otherwise random
    if (variantType === 'skill') {
      // Nếu có deck đã chọn, random 3 skill từ deck đó
      // Nếu không có deck, random từ toàn bộ LOCAL_SKILLS
      const deckX = selectedDeckX.length >= 15 ? selectedDeckX : LOCAL_SKILLS
      const deckO = selectedDeckO.length >= 15 ? selectedDeckO : LOCAL_SKILLS
      
      const getRandomFromDeck = (deck: LocalSkill[], count: number): Skill[] => {
        const shuffled = [...deck].sort(() => Math.random() - 0.5)
        return shuffled.slice(0, count) as unknown as Skill[]
      }
      
      const initialSkillsX = getRandomFromDeck(deckX, 3)
      const initialSkillsO = getRandomFromDeck(deckO, 3)
      setPlayerSkills({
        X: { available: initialSkillsX, cooldowns: {}, mana: 5, effects: [], disabled: {}, holdCost: 0 },
        O: { available: initialSkillsO, cooldowns: {}, mana: 5, effects: [], disabled: {}, holdCost: 0 }
      })
      // Try to use API skills if user is logged in and online
      if (opponentType === 'online' || opponentType === 'matchmaking') {
        setUseApiSkills(true)
        fetchApiSkills(newMatchId, 1, 'X')
      } else {
        setUseApiSkills(false)
      }
    }
  }, [boardSize, variantType, timePerMove, initialBoardAfterSwap2, swap2Completed, opponentType, selectedDeckX, selectedDeckO, fetchApiSkills])
  
  // Handle remote move from opponent (moved up for dependency)
  const handleRemoteMove = useCallback((x: number, y: number, player: PlayerSide) => {
    setBoard(prev => {
      const newBoard = prev.map(row => [...row])
      const moveIndex = moveHistory.length + 1
      newBoard[y][x] = {
        ...newBoard[y][x],
        player,
        moveIndex,
        hidden: false
      }
      return newBoard
    })
    setMoveHistory(prev => [...prev, { x, y, player }])
    setCurrentTurn(player === 'X' ? 'O' : 'X')
    setTimeRemaining(timePerMove || 30)
  }, [moveHistory.length, timePerMove])
  
  // Start game
  const handleStartGame = () => {
    // Reset swap2 state for new game
    setSwap2Completed(false)
    setInitialBoardAfterSwap2(undefined)
    setPlayerSideMapping({ player1: 'X', player2: 'O' })
    
    if (opponentType === 'matchmaking') {
      // Join matchmaking queue with standard settings
      handleMatchmakingStart()
    } else if (opponentType === 'online') {
      // Connect to socket and create/join room
      handleOnlineStart()
    } else {
      initializeBoard()
      setGameStarted(true)
      setShowSetup(false)
    }
  }
  
  // Matchmaking mode: join queue to find opponent
  const handleMatchmakingStart = useCallback(() => {
    if (!user) {
      alert(t('variant.online.needLogin'))
      return
    }
    
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000'
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    })
    
    setSocket(newSocket)
    setIsMatchmaking(true)
    setMatchmakingTime(0)
    setShowSetup(false)
    
    newSocket.on('connect', () => {
      console.log('🔌 Connected to socket server for variant matchmaking')
      
      // Join variant matchmaking queue with standard config
      newSocket.emit('join_variant_queue', {
        userId: user.id,
        username: username,
        variantType: variantType,
        config: MATCHMAKING_CONFIGS[variantType]
      })
    })
    
    newSocket.on('variant_queue_waiting', (data: { position: number }) => {
      console.log('⏳ Waiting in variant queue, position:', data.position)
      setQueuePosition(data.position)
    })
    
    newSocket.on('variant_match_found', (data: { roomId: string; opponent: string; side: PlayerSide; config: any }) => {
      console.log('🎯 Variant match found!', data)
      setIsMatchmaking(false)
      setRoomId(data.roomId)
      setOnlineOpponentName(data.opponent)
      setMyOnlineSide(data.side)
      
      // Apply standard config
      setBoardSize(data.config.boardSize)
      setWinLength(data.config.winLength)
      setTimePerMove(data.config.timePerMove)
      setSwap2Enabled(data.config.swap2Enabled)
      
      // Start game
      initializeBoard()
      setGameStarted(true)
    })
    
    newSocket.on('variant_move', (data: { x: number; y: number; player: PlayerSide }) => {
      console.log('📍 Received move:', data)
      handleRemoteMove(data.x, data.y, data.player)
    })
    
    newSocket.on('variant_game_over', (data: { winner: PlayerSide | null; isDraw: boolean }) => {
      if (data.isDraw) {
        setIsDraw(true)
      } else if (data.winner) {
        setWinner(data.winner)
        setScores(prev => ({ ...prev, [data.winner!]: prev[data.winner!] + 1 }))
      }
    })
    
    newSocket.on('opponent_disconnected', () => {
      alert(t('variant.online.opponentDisconnected'))
      setIsMatchmaking(false)
      setGameStarted(false)
      setShowSetup(true)
    })
    
    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
      alert(t('variant.online.connectionError'))
      setIsMatchmaking(false)
      setShowSetup(true)
    })
  }, [user, username, variantType, t, initializeBoard, handleRemoteMove])
  
  // Matchmaking timer
  useEffect(() => {
    if (!isMatchmaking) return
    
    const timer = setInterval(() => {
      setMatchmakingTime(prev => prev + 1)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [isMatchmaking])
  
  // Cancel matchmaking
  const handleCancelMatchmaking = () => {
    if (socket) {
      socket.emit('leave_variant_queue', { variantType })
      socket.disconnect()
    }
    setIsMatchmaking(false)
    setShowSetup(true)
  }
  
  // Online mode: connect to socket server
  const handleOnlineStart = useCallback(() => {
    if (!user) {
      alert(t('variant.online.needLogin'))
      return
    }
    
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000'
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    })
    
    setSocket(newSocket)
    setWaitingForOpponent(true)
    setShowSetup(false)
    
    // Generate room ID for variant mode
    const variantRoomId = `variant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setRoomId(variantRoomId)
    setIsHost(true)
    setMyOnlineSide('X')
    
    newSocket.on('connect', () => {
      console.log('🔌 Connected to socket server for variant mode')
      
      // Create variant room
      newSocket.emit('create_variant_room', {
        roomId: variantRoomId,
        userId: user.id,
        username: username,
        config: {
          boardSize,
          winLength,
          variantType,
          timePerMove,
          swap2Enabled
        }
      })
    })
    
    newSocket.on('variant_opponent_joined', (data: any) => {
      console.log('👥 Opponent joined variant room:', data)
      setOnlineOpponentName(data.username || 'Đối thủ')
      setWaitingForOpponent(false)
      initializeBoard()
      setGameStarted(true)
    })
    
    newSocket.on('variant_move', (data: { x: number; y: number; player: PlayerSide }) => {
      console.log('📍 Received move:', data)
      handleRemoteMove(data.x, data.y, data.player)
    })
    
    newSocket.on('variant_game_over', (data: { winner: PlayerSide | null; isDraw: boolean }) => {
      if (data.isDraw) {
        setIsDraw(true)
      } else if (data.winner) {
        setWinner(data.winner)
        setScores(prev => ({ ...prev, [data.winner!]: prev[data.winner!] + 1 }))
      }
    })
    
    newSocket.on('opponent_disconnected', () => {
      alert(t('variant.online.opponentDisconnected'))
      setWaitingForOpponent(false)
      setGameStarted(false)
      setShowSetup(true)
    })
    
    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
      alert(t('variant.online.connectionError'))
      setWaitingForOpponent(false)
      setShowSetup(true)
    })
  }, [user, username, boardSize, winLength, variantType, timePerMove, swap2Enabled, t, initializeBoard])
  
  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [socket])
  
  // Check winner
  const checkWinner = useCallback((b: CellState[][], x: number, y: number, player: PlayerSide): boolean => {
    const directions = [
      [1, 0],   // horizontal
      [0, 1],   // vertical
      [1, 1],   // diagonal
      [1, -1]   // anti-diagonal
    ]
    
    for (const [dx, dy] of directions) {
      let count = 1
      
      // Count forward
      for (let i = 1; i < winLength; i++) {
        const nx = x + dx * i
        const ny = y + dy * i
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize && b[ny][nx].player === player) {
          count++
        } else break
      }
      
      // Count backward
      for (let i = 1; i < winLength; i++) {
        const nx = x - dx * i
        const ny = y - dy * i
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize && b[ny][nx].player === player) {
          count++
        } else break
      }
      
      if (count >= winLength) return true
    }
    
    return false
  }, [boardSize, winLength])
  
  // Apply hidden effect (Caro Ẩn)
  const applyHiddenEffect = useCallback((b: CellState[][], moveCount: number) => {
    if (variantType !== 'hidden') return b
    
    // Every 3 moves, hide old pieces
    if (moveCount > 0 && moveCount % 3 === 0) {
      const newBoard = b.map(row => row.map(cell => ({
        ...cell,
        hidden: cell.player !== null && cell.moveIndex !== null && cell.moveIndex < moveCount - 2
      })))
      return newBoard
    }
    return b
  }, [variantType])
  
  // Handle cell click
  const handleCellClick = (x: number, y: number) => {
    console.log('🖱️ Cell clicked:', x, y, 'skillMode:', skillMode, 'currentTurn:', currentTurn)
    console.log('📋 Cell state:', board[y]?.[x])
    
    if (winner || isDraw || !gameStarted) {
      console.log('❌ Click blocked - winner/draw/not started')
      return
    }
    
    // Online mode: only allow moves on your turn
    if (opponentType === 'online' && currentTurn !== myOnlineSide) return
    
    // Handle swap2 placement phase
    if (swap2Enabled && !swap2Completed && swap2.isSwap2Active) {
      if (swap2.currentPhase === 'swap2_placement' || swap2.currentPhase === 'swap2_extra') {
        swap2.placeStone(x, y)
      }
      return
    }
    
    // Handle skill mode
    if (skillMode === 'swap-1') {
      if (board[y][x].player !== null) {
        setSwapFirst({ x, y })
        setSkillMode('swap-2')
      }
      return
    }
    
    if (skillMode === 'swap-2' && swapFirst && selectedSkill) {
      if (board[y][x].player !== null && (x !== swapFirst.x || y !== swapFirst.y)) {
        // Perform swap
        const newBoard = [...board.map(row => [...row])]
        const temp = newBoard[y][x].player
        newBoard[y][x].player = newBoard[swapFirst.y][swapFirst.x].player
        newBoard[swapFirst.y][swapFirst.x].player = temp
        setBoard(newBoard)
        
        // Apply cooldown and mana cost properly
        const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
        applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
        
        setSkillMode(null)
        setSwapFirst(null)
        setSelectedSkill(null)
        
        // KHÔNG chuyển lượt - chờ user ấn nút "Qua lượt"
      }
      return
    }
    
    if (skillMode === 'block') {
      if (board[y][x].player === null && board[y][x].terrain !== 'block') {
        const newBoard = [...board.map(row => [...row])]
        newBoard[y][x].terrain = 'block'
        newBoard[y][x].terrainRevealed = true
        setBoard(newBoard)
        setSkillMode('block-move') // Chuyển sang chế độ đánh quân sau khi block
        setSelectedSkill(null)
        
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: {
            ...prev[currentTurn],
            cooldowns: { ...prev[currentTurn].cooldowns, block: 4 }
          }
        }))
        // KHÔNG chuyển lượt - người dùng skill được đánh tiếp
      }
      return
    }
    
    // Sau khi đặt block, người chơi được đánh 1 quân
    if (skillMode === 'block-move') {
      if (board[y][x].player === null && board[y][x].terrain !== 'block') {
        const newBoard = [...board.map(row => [...row])]
        const moveIndex = moveHistory.length + 1
        newBoard[y][x] = {
          ...newBoard[y][x],
          player: currentTurn,
          moveIndex,
          hidden: false
        }
        setBoard(newBoard)
        setMoveHistory([...moveHistory, { x, y, player: currentTurn }])
        setSkillMode(null)
        
        // Check winner sau khi đánh
        if (checkWinner(newBoard, x, y, currentTurn)) {
          setWinner(currentTurn)
          setScores(prev => ({ ...prev, [currentTurn]: prev[currentTurn] + 1 }))
          return
        }
        
        // Đã đánh quân - cho phép ấn nút "Qua lượt"
        setHasMovedThisTurn(true)
        // KHÔNG tự động chuyển lượt - chờ user ấn nút "Qua lượt"
      }
      return
    }
    
    // === SKILL MODE: destroy - Phá hủy 1 quân địch ===
    if (skillMode === 'destroy' && selectedSkill) {
      const enemySide = currentTurn === 'X' ? 'O' : 'X'
      console.log('🎯 Destroy mode - checking cell:', x, y, 'enemySide:', enemySide, 'cellPlayer:', board[y][x].player, 'shielded:', board[y][x].shielded)
      if (board[y][x].player === enemySide && !board[y][x].shielded) {
        console.log('✅ Destroying enemy piece at', x, y)
        const newBoard = [...board.map(row => [...row])]
        newBoard[y][x] = { ...newBoard[y][x], player: null, moveIndex: null }
        setBoard(newBoard)
        
        // Apply cooldown
        const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
        applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
        
        setSkillMode(null)
        setSelectedSkill(null)
        // KHÔNG chuyển lượt - chờ user ấn nút "Qua lượt"
      } else {
        console.log('❌ Cannot destroy - not enemy or shielded')
      }
      return
    }
    
    // === SKILL MODE: push-select - Bước 1: Chọn quân địch để đẩy ===
    if (skillMode === 'push-select' && selectedSkill) {
      const enemySide = currentTurn === 'X' ? 'O' : 'X'
      if (board[y][x].player === enemySide && !board[y][x].shielded) {
        setPushTarget({ x, y })
        setSkillMode('push-direction') // Chuyển sang bước 2: chọn hướng
      }
      return
    }
    
    // === SKILL MODE: push-direction - Bước 2: Chọn hướng đẩy ===
    if (skillMode === 'push-direction' && selectedSkill && pushTarget) {
      // Tính hướng đẩy dựa trên vị trí click so với target
      const dx = x - pushTarget.x
      const dy = y - pushTarget.y
      
      // Chỉ cho phép 4 hướng chính (↑↓←→)
      let pushDx = 0, pushDy = 0
      if (Math.abs(dx) > Math.abs(dy)) {
        pushDx = dx > 0 ? 1 : -1
      } else if (Math.abs(dy) > Math.abs(dx)) {
        pushDy = dy > 0 ? 1 : -1
      } else {
        // Click vào chính target hoặc đường chéo - hủy
        return
      }
      
      const enemySide = currentTurn === 'X' ? 'O' : 'X'
      const newBoard = [...board.map(row => [...row])]
      
      // Thực hiện đẩy chuỗi (push_chain) - đẩy tất cả quân theo hướng
      // Bắt đầu từ quân xa nhất theo hướng đẩy, di chuyển về phía target
      const piecesToPush: { x: number; y: number; player: PlayerSide }[] = []
      let checkX = pushTarget.x
      let checkY = pushTarget.y
      
      // Thu thập tất cả quân trên đường đẩy
      while (checkX >= 0 && checkX < boardSize && checkY >= 0 && checkY < boardSize) {
        const cellPlayer = newBoard[checkY][checkX].player
        if (cellPlayer) {
          piecesToPush.push({ x: checkX, y: checkY, player: cellPlayer })
        }
        checkX += pushDx
        checkY += pushDy
      }
      
      // Đẩy từ quân xa nhất trước (để không bị đè)
      let canPush = true
      for (let i = piecesToPush.length - 1; i >= 0; i--) {
        const piece = piecesToPush[i]
        const newX = piece.x + pushDx
        const newY = piece.y + pushDy
        
        // Kiểm tra có thể đẩy không
        if (newX < 0 || newX >= boardSize || newY < 0 || newY >= boardSize || 
            newBoard[newY][newX].terrain === 'block') {
          canPush = false
          break
        }
        
        // Di chuyển quân
        if (newBoard[newY][newX].player === null) {
          newBoard[newY][newX] = { ...newBoard[newY][newX], player: piece.player, moveIndex: newBoard[piece.y][piece.x].moveIndex }
          newBoard[piece.y][piece.x] = { ...newBoard[piece.y][piece.x], player: null, moveIndex: null }
        }
      }
      
      if (canPush) {
        // Hiển thị animation sóng 🌊
        const directionName = pushDx > 0 ? 'right' : pushDx < 0 ? 'left' : pushDy > 0 ? 'down' : 'up'
        setWaveAnimation({ x: pushTarget.x, y: pushTarget.y, direction: directionName })
        setTimeout(() => setWaveAnimation(null), 1500)
        
        setBoard(newBoard)
      }
      
      // Apply cooldown
      const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
      applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
      
      setSkillMode(null)
      setSelectedSkill(null)
      setPushTarget(null)
      // KHÔNG chuyển lượt - chờ user ấn nút "Qua lượt"
      return
    }
    
    // === SKILL MODE: area - Chọn tâm vùng 3x3 ===
    if (skillMode === 'area' && selectedSkill) {
      const effectType = selectedSkill.effect_type
      const newBoard = [...board.map(row => [...row])]
      
      // Áp dụng effect lên vùng 3x3
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            if (effectType === 'chaos_move') {
              // Di chuyển ngẫu nhiên - shuffle các quân trong vùng
              // Đã xử lý ở handleUseSkill
            } else if (effectType === 'burn_area') {
              // Đốt vùng - xóa tất cả quân trong vùng (trừ quân có shield)
              if (newBoard[ny][nx].player !== null && !newBoard[ny][nx].shielded) {
                newBoard[ny][nx] = { ...newBoard[ny][nx], player: null, moveIndex: null }
              }
            } else if (effectType === 'reset_area') {
              // Reset vùng về trống (trừ quân có shield)
              if (!newBoard[ny][nx].shielded) {
                newBoard[ny][nx] = { ...newBoard[ny][nx], player: null, moveIndex: null }
              }
            } else if (effectType === 'shuffle_area') {
              // Shuffle - sẽ xử lý sau khi collect tất cả
            }
          }
        }
      }
      
      // Nếu là chaos_move hoặc shuffle_area, shuffle các quân trong vùng
      if (effectType === 'chaos_move' || effectType === 'shuffle_area') {
        const piecesInArea: { x: number; y: number; player: PlayerSide }[] = []
        const emptyInArea: { x: number; y: number }[] = []
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
              if (newBoard[ny][nx].player) {
                piecesInArea.push({ x: nx, y: ny, player: newBoard[ny][nx].player })
              } else if (newBoard[ny][nx].terrain !== 'block') {
                emptyInArea.push({ x: nx, y: ny })
              }
            }
          }
        }
        
        // Shuffle positions
        const allPositions = [...piecesInArea.map(p => ({ x: p.x, y: p.y })), ...emptyInArea]
        const shuffled = allPositions.sort(() => Math.random() - 0.5)
        
        // Clear và đặt lại
        piecesInArea.forEach(p => {
          newBoard[p.y][p.x] = { ...newBoard[p.y][p.x], player: null, moveIndex: null }
        })
        piecesInArea.forEach((piece, i) => {
          const newPos = shuffled[i]
          newBoard[newPos.y][newPos.x] = { ...newBoard[newPos.y][newPos.x], player: piece.player, moveIndex: i + 1 }
        })
      }
      
      setBoard(newBoard)
      
      // Apply cooldown
      const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
      applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
      
      setSkillMode(null)
      setSelectedSkill(null)
      // KHÔNG chuyển lượt - chờ user ấn nút "Qua lượt"
      return
    }
    
    // === SKILL MODE: shield - Bảo vệ 1 quân ===
    if (skillMode === 'shield' && selectedSkill) {
      if (board[y][x].player === currentTurn) {
        const newBoard = [...board.map(row => [...row])]
        newBoard[y][x] = { ...newBoard[y][x], shielded: true }
        setBoard(newBoard)
        
        // Apply cooldown
        const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
        applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
        
        setSkillMode(null)
        setSelectedSkill(null)
        // KHÔNG chuyển lượt - chờ user ấn nút "Qua lượt"
      }
      return
    }
    
    // === SKILL MODE: teleport - Di chuyển quân ===
    if (skillMode === 'teleport-1') {
      if (board[y][x].player === currentTurn) {
        setSwapFirst({ x, y })
        setSkillMode('teleport-2')
      }
      return
    }
    
    if (skillMode === 'teleport-2' && swapFirst && selectedSkill) {
      if (board[y][x].player === null && board[y][x].terrain !== 'block') {
        const newBoard = [...board.map(row => [...row])]
        newBoard[y][x] = { ...newBoard[y][x], player: newBoard[swapFirst.y][swapFirst.x].player, moveIndex: newBoard[swapFirst.y][swapFirst.x].moveIndex }
        newBoard[swapFirst.y][swapFirst.x] = { ...newBoard[swapFirst.y][swapFirst.x], player: null, moveIndex: null }
        setBoard(newBoard)
        
        // Apply cooldown
        const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
        applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
        
        setSkillMode(null)
        setSwapFirst(null)
        setSelectedSkill(null)
        // KHÔNG tự động chuyển lượt - chờ user ấn nút "Qua lượt"
      }
      return
    }
    
    // === SKILL MODE: clone - Nhân bản quân ===
    if (skillMode === 'clone' && selectedSkill) {
      if (board[y][x].player === null && board[y][x].terrain !== 'block') {
        // Tìm quân gần nhất của mình để clone
        let nearestPiece: { x: number; y: number } | null = null
        let minDist = Infinity
        board.forEach((row, py) => row.forEach((cell, px) => {
          if (cell.player === currentTurn) {
            const dist = Math.abs(px - x) + Math.abs(py - y)
            if (dist < minDist && dist <= 2) { // Chỉ clone trong phạm vi 2 ô
              minDist = dist
              nearestPiece = { x: px, y: py }
            }
          }
        }))
        
        if (nearestPiece) {
          const newBoard = [...board.map(row => [...row])]
          newBoard[y][x] = { ...newBoard[y][x], player: currentTurn, moveIndex: moveHistory.length + 1 }
          setBoard(newBoard)
          setMoveHistory([...moveHistory, { x, y, player: currentTurn }])
        }
        
        // Apply cooldown
        const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
        applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
        
        setSkillMode(null)
        setSelectedSkill(null)
        // KHÔNG tự động chuyển lượt - chờ user ấn nút "Qua lượt"
      }
      return
    }
    
    // === SKILL MODE: bomb - Nổ vùng 3x3 ===
    if (skillMode === 'bomb' && selectedSkill) {
      const newBoard = [...board.map(row => [...row])]
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            if (newBoard[ny][nx].player !== null && !newBoard[ny][nx].shielded) {
              newBoard[ny][nx] = { ...newBoard[ny][nx], player: null, moveIndex: null }
            }
          }
        }
      }
      setBoard(newBoard)
      
      // Apply cooldown
      const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
      applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
      
      setSkillMode(null)
      setSelectedSkill(null)
      // KHÔNG tự động chuyển lượt - chờ user ấn nút "Qua lượt"
      return
    }
    
    // === SKILL MODE: fake - Đặt quân giả ===
    if (skillMode === 'fake' && selectedSkill) {
      if (board[y][x].player === null && board[y][x].terrain !== 'block') {
        const newBoard = [...board.map(row => [...row])]
        // Quân giả - sẽ biến mất sau 5 lượt (đánh dấu bằng frozen = -5)
        newBoard[y][x] = { ...newBoard[y][x], player: currentTurn, moveIndex: moveHistory.length + 1, frozen: -5 }
        setBoard(newBoard)
        
        // Apply cooldown
        const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
        applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
        
        setSkillMode(null)
        setSelectedSkill(null)
        // KHÔNG tự động chuyển lượt - chờ user ấn nút "Qua lượt"
      }
      return
    }
    
    // === SKILL MODE: reflect-trap - Đặt bẫy phản ===
    if (skillMode === 'reflect-trap' && selectedSkill) {
      if (board[y][x].player === null) {
        // Đánh dấu ô này là bẫy (sử dụng terrain tạm)
        const newBoard = [...board.map(row => [...row])]
        newBoard[y][x] = { ...newBoard[y][x], terrain: 'mystery' as any, terrainRevealed: false }
        setBoard(newBoard)
        
        // Apply cooldown
        const manaCost = 'mana_cost' in selectedSkill ? (selectedSkill as any).mana_cost : 0
        applySkillCooldownAndMana(selectedSkill.id, selectedSkill.cooldown, manaCost)
        
        setSkillMode(null)
        setSelectedSkill(null)
        // KHÔNG tự động chuyển lượt - chờ user ấn nút "Qua lượt"
      }
      return
    }
    
    // Normal move
    if (board[y][x].player !== null) return
    
    // Mode SKILL: Đã đánh quân rồi - không cho đánh thêm, phải ấn "Qua lượt"
    // Các mode khác tự động qua lượt nên không cần check này
    if (variantType === 'skill' && hasMovedThisTurn) return
    
    // Handle hidden block terrain - reveal it and lose turn
    if (board[y][x].terrain === 'block') {
      if (!board[y][x].terrainRevealed) {
        // Block was hidden - reveal it and player loses turn
        const newBoard = [...board.map(row => [...row])]
        newBoard[y][x].terrainRevealed = true
        setBoard(newBoard)
        
        // Show notification
        setTerrainNotification('🚧 Ô bị khóa! Mất lượt!')
        setTimeout(() => setTerrainNotification(''), 2000)
        
        // Switch turn (player loses their turn)
        if (!extraTurn) {
          const nextPlayer = currentTurn === 'X' ? 'O' : 'X'
          setCurrentTurn(nextPlayer)
          setTimeRemaining(timePerMove || 30)
        } else {
          setExtraTurn(false)
        }
      }
      // Block already revealed - can't place here
      return
    }
    
    const newBoard = [...board.map(row => [...row])]
    const moveIndex = moveHistory.length + 1
    
    // REVEAL hidden terrain when stepping on it (Caro Địa Hình feature)
    const cellTerrain = newBoard[y][x].terrain
    const wasHiddenTerrain = !newBoard[y][x].terrainRevealed && cellTerrain !== 'normal'
    
    newBoard[y][x] = {
      ...newBoard[y][x],
      player: currentTurn,
      moveIndex,
      hidden: false,
      terrainRevealed: true // Now revealed!
    }
    
    // Check terrain effects - ONLY trigger when terrain was hidden (surprise!)
    let grantExtraTurn = false
    let skipOpponentTurn = false // For freeze effect
    let terrainMessage = '' // Show what terrain was triggered
    let terrainTileBonusGained = 0 // Track bonus gained this turn for immediate calculation
    
    if (variantType === 'terrain' && wasHiddenTerrain) {
      switch (cellTerrain) {
        case 'skill':
          // Grant random skill
          const randomSkill = LOCAL_SKILLS[Math.floor(Math.random() * LOCAL_SKILLS.length)] as unknown as Skill
          setPlayerSkills(prev => ({
            ...prev,
            [currentTurn]: {
              ...prev[currentTurn],
              available: [...prev[currentTurn].available, randomSkill]
            }
          }))
          terrainMessage = `❓ Nhận skill: ${getSkillIcon(randomSkill)}`
          break
          
        case 'double':
          grantExtraTurn = true
          terrainMessage = '⭐ Được đi thêm 1 lượt!'
          break
          
        case 'bomb':
          // Remove all pieces in 3x3 area around this cell (except this one)
          terrainMessage = '💣 BOM! Xóa quân xung quanh!'
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue // Keep current piece
              const nx = x + dx
              const ny = y + dy
              if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                if (newBoard[ny][nx].player !== null && !newBoard[ny][nx].terrain?.includes('shield')) {
                  newBoard[ny][nx] = { ...newBoard[ny][nx], player: null, moveIndex: null }
                }
              }
            }
          }
          break
          
        case 'freeze':
          // Opponent loses next turn
          skipOpponentTurn = true
          terrainMessage = '❄️ Đóng băng! Đối thủ mất lượt!'
          break
          
        case 'teleport':
          // Find a random empty cell to teleport to
          terrainMessage = '🌀 Dịch chuyển!'
          const emptyCells: {ex: number, ey: number}[] = []
          for (let ey = 0; ey < boardSize; ey++) {
            for (let ex = 0; ex < boardSize; ex++) {
              if (newBoard[ey][ex].player === null && newBoard[ey][ex].terrain !== 'block' && (ex !== x || ey !== y)) {
                emptyCells.push({ex, ey})
              }
            }
          }
          if (emptyCells.length > 0) {
            const target = emptyCells[Math.floor(Math.random() * emptyCells.length)]
            // Move piece to new location
            newBoard[target.ey][target.ex] = {
              ...newBoard[target.ey][target.ex],
              player: currentTurn,
              moveIndex: moveIndex,
              terrainRevealed: true
            }
            // Clear original (but keep terrain revealed)
            newBoard[y][x] = { ...newBoard[y][x], player: null, moveIndex: null }
          }
          break
          
        case 'shield':
          // This piece is protected from bomb effects (handled in bomb case)
          newBoard[y][x].shielded = true
          terrainMessage = '🛡️ Quân được bảo vệ!'
          break
          
        case 'mystery':
          // Random effect - can be good or bad!
          const mysteryEffects = ['skill', 'double', 'bomb', 'freeze', 'teleport', 'nothing', 'steal']
          const mysteryEffect = mysteryEffects[Math.floor(Math.random() * mysteryEffects.length)]
          terrainMessage = '🎁 Hộp bí ẩn: '
          
          switch (mysteryEffect) {
            case 'skill':
              const rndSkill = LOCAL_SKILLS[Math.floor(Math.random() * LOCAL_SKILLS.length)] as unknown as Skill
              setPlayerSkills(prev => ({
                ...prev,
                [currentTurn]: {
                  ...prev[currentTurn],
                  available: [...prev[currentTurn].available, rndSkill]
                }
              }))
              terrainMessage += `Nhận skill ${getSkillIcon(rndSkill)}!`
              break
            case 'double':
              grantExtraTurn = true
              terrainMessage += 'Đi thêm lượt!'
              break
            case 'bomb':
              terrainMessage += 'BOM! 💥'
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue
                  const nx = x + dx, ny = y + dy
                  if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                    if (newBoard[ny][nx].player !== null && !newBoard[ny][nx].shielded) {
                      newBoard[ny][nx] = { ...newBoard[ny][nx], player: null, moveIndex: null }
                    }
                  }
                }
              }
              break
            case 'freeze':
              skipOpponentTurn = true
              terrainMessage += 'Đóng băng đối thủ!'
              break
            case 'teleport':
              const emptyForMystery: {ex: number, ey: number}[] = []
              for (let ey = 0; ey < boardSize; ey++) {
                for (let ex = 0; ex < boardSize; ex++) {
                  if (newBoard[ey][ex].player === null && newBoard[ey][ex].terrain !== 'block' && (ex !== x || ey !== y)) {
                    emptyForMystery.push({ex, ey})
                  }
                }
              }
              if (emptyForMystery.length > 0) {
                const tgt = emptyForMystery[Math.floor(Math.random() * emptyForMystery.length)]
                newBoard[tgt.ey][tgt.ex] = { ...newBoard[tgt.ey][tgt.ex], player: currentTurn, moveIndex, terrainRevealed: true }
                newBoard[y][x] = { ...newBoard[y][x], player: null, moveIndex: null }
                terrainMessage += 'Dịch chuyển!'
              } else {
                terrainMessage += 'Không có chỗ dịch chuyển!'
              }
              break
            case 'steal':
              // Steal a random skill from opponent
              const opponent = currentTurn === 'X' ? 'O' : 'X'
              const opponentSkills = playerSkills[opponent].available
              if (opponentSkills.length > 0) {
                const stolenSkill = opponentSkills[Math.floor(Math.random() * opponentSkills.length)]
                setPlayerSkills(prev => ({
                  ...prev,
                  [currentTurn]: { ...prev[currentTurn], available: [...prev[currentTurn].available, stolenSkill] },
                  [opponent]: { ...prev[opponent], available: prev[opponent].available.filter(s => s.id !== stolenSkill.id) }
                }))
                terrainMessage += `Cướp skill ${getSkillIcon(stolenSkill)}!`
              } else {
                terrainMessage += 'Không có gì để cướp!'
              }
              break
            default:
              terrainMessage += 'Không có gì xảy ra!'
          }
          break
          
        case 'score':
          // Grant bonus point for terrain mode - track locally for immediate use
          terrainTileBonusGained = 1
          setTerrainTileBonus(prev => ({ ...prev, [currentTurn]: prev[currentTurn] + 1 }))
          terrainMessage = '💎 +1 điểm bonus!'
          break
      }
      
      // Show terrain effect notification
      if (terrainMessage) {
        setTerrainNotification(terrainMessage)
        setTimeout(() => setTerrainNotification(''), 2000)
      }
    } else if (cellTerrain === 'double' && newBoard[y][x].terrainRevealed) {
      // Already revealed double terrain still grants extra turn
      grantExtraTurn = true
    }
    
    // Apply hidden effect
    const boardAfterHidden = applyHiddenEffect(newBoard, moveIndex)
    
    // Decrease reveal turns
    if (revealTurns > 0) {
      setRevealTurns(prev => prev - 1)
    }
    
    setBoard(boardAfterHidden)
    setMoveHistory([...moveHistory, { x, y, player: currentTurn }])
    setHasMovedThisTurn(true) // Mark that player has moved this turn
    
    // Emit move to socket for online mode
    if (opponentType === 'online' && socket && roomId) {
      socket.emit('variant_move', {
        roomId,
        x,
        y,
        player: currentTurn
      })
    }
    
    // Terrain mode: update scores after each move (include tile bonus)
    if (variantType === 'terrain') {
      const xScore = calculateTerrainScore(boardAfterHidden, 'X', boardSize)
      const oScore = calculateTerrainScore(boardAfterHidden, 'O', boardSize)
      const xLongest = calculateLongestChain(boardAfterHidden, 'X', boardSize)
      const oLongest = calculateLongestChain(boardAfterHidden, 'O', boardSize)
      // Add terrain tile bonus (💎 score tiles) to total - include bonus gained this turn
      const xTileBonus = terrainTileBonus.X + (currentTurn === 'X' ? terrainTileBonusGained : 0)
      const oTileBonus = terrainTileBonus.O + (currentTurn === 'O' ? terrainTileBonusGained : 0)
      setTerrainScores({ 
        X: { ...xScore, total: xScore.total + xTileBonus }, 
        O: { ...oScore, total: oScore.total + oTileBonus } 
      })
      setLongestChains({ X: xLongest, O: oLongest })
    }
    
    // Check for winner - terrain mode uses scoring, others use 5-in-a-row
    if (variantType !== 'terrain') {
      if (checkWinner(boardAfterHidden, x, y, currentTurn)) {
        setWinner(currentTurn)
        setScores(prev => ({ ...prev, [currentTurn]: prev[currentTurn] + 1 }))
        
        // Notify online opponent
        if (opponentType === 'online' && socket && roomId) {
          socket.emit('variant_game_over', { roomId, winner: currentTurn, isDraw: false })
        }
        return
      }
    }
    
    // Check for draw / game end
    const filledCells = boardAfterHidden.flat().filter(c => c.player !== null).length
    const blockedCells = boardAfterHidden.flat().filter(c => c.terrain === 'block' && c.terrainRevealed).length
    const availableCells = boardSize * boardSize - blockedCells
    
    if (filledCells >= availableCells) {
      // Game over - for terrain mode, determine winner by score
      if (variantType === 'terrain') {
        const xScoreData = calculateTerrainScore(boardAfterHidden, 'X', boardSize)
        const oScoreData = calculateTerrainScore(boardAfterHidden, 'O', boardSize)
        // Include terrain tile bonus in final score (including bonus gained this turn)
        const xTileBonus = terrainTileBonus.X + (currentTurn === 'X' ? terrainTileBonusGained : 0)
        const oTileBonus = terrainTileBonus.O + (currentTurn === 'O' ? terrainTileBonusGained : 0)
        const xFinalScore = xScoreData.total + xTileBonus
        const oFinalScore = oScoreData.total + oTileBonus
        
        if (xFinalScore > oFinalScore) {
          setWinner('X')
          setScores(prev => ({ ...prev, X: prev.X + 1 }))
        } else if (oFinalScore > xFinalScore) {
          setWinner('O')
          setScores(prev => ({ ...prev, O: prev.O + 1 }))
        } else {
          // Tie - check longest chain
          const xLongest = calculateLongestChain(boardAfterHidden, 'X', boardSize)
          const oLongest = calculateLongestChain(boardAfterHidden, 'O', boardSize)
          if (xLongest > oLongest) {
            setWinner('X')
            setScores(prev => ({ ...prev, X: prev.X + 1 }))
          } else if (oLongest > xLongest) {
            setWinner('O')
            setScores(prev => ({ ...prev, O: prev.O + 1 }))
          } else {
            setIsDraw(true)
          }
        }
      } else {
        setIsDraw(true)
      }
      return
    }
    
    // Reduce cooldowns
    setPlayerSkills(prev => {
      const newCooldowns: Record<string, number> = {}
      Object.entries(prev[currentTurn].cooldowns).forEach(([skillId, cd]) => {
        if (cd > 1) newCooldowns[skillId] = cd - 1
      })
      return {
        ...prev,
        [currentTurn]: { ...prev[currentTurn], cooldowns: newCooldowns }
      }
    })
    
    // Handle special turn effects (extra turn, freeze)
    if (grantExtraTurn) {
      setExtraTurn(true)
    } else if (skipOpponentTurn) {
      // Freeze effect: opponent loses their turn, current player goes again
      setFrozenPlayer(currentTurn === 'X' ? 'O' : 'X')
      setExtraTurn(true) // Current player gets another turn
      setTimeout(() => setFrozenPlayer(null), 2000) // Clear frozen indicator
    }
    
    // Mode SKILL: Chờ user ấn nút "Qua lượt" để có thể dùng skill trước khi kết thúc lượt
    // Các mode khác (custom, hidden, terrain): Tự động chuyển lượt ngay sau khi đặt quân
    if (variantType !== 'skill') {
      // Tự động chuyển lượt cho các mode không phải skill
      const nextTurnNum = moveHistory.length + 2 // +2 vì moveHistory chưa được update trong state
      
      if (!grantExtraTurn && !skipOpponentTurn) {
        // Chuyển lượt bình thường
        const nextPlayer = currentTurn === 'X' ? 'O' : 'X'
        setCurrentTurn(nextPlayer)
        setTimeRemaining(timePerMove || 30)
        setHasMovedThisTurn(false)
      } else {
        // extraTurn hoặc skipOpponentTurn: Người chơi được đi thêm 1 lượt
        setExtraTurn(false)
        setTimeRemaining(timePerMove || 30)
        setHasMovedThisTurn(false)
      }
    }
    // Mode skill: Không tự động chuyển lượt - chờ user ấn nút "Qua lượt"
  }
  
  // Handle "End Turn" button - chuyển lượt khi user ấn nút
  const handleEndTurn = () => {
    if (!hasMovedThisTurn && timeRemaining > 0) return // Chưa đánh quân và chưa hết giờ
    
    // Reduce cooldowns
    setPlayerSkills(prev => {
      const newCooldowns: Record<string, number> = {}
      Object.entries(prev[currentTurn].cooldowns).forEach(([skillId, cd]) => {
        if (cd > 1) newCooldowns[skillId] = cd - 1
      })
      return {
        ...prev,
        [currentTurn]: { ...prev[currentTurn], cooldowns: newCooldowns }
      }
    })
    
    const nextTurnNum = moveHistory.length + 1
    
    // Hồi mana cho người chơi HIỆN TẠI (vừa đi xong) - +3 mana mỗi lượt
    if (variantType === 'skill') {
      setPlayerSkills(prev => ({
        ...prev,
        [currentTurn]: {
          ...prev[currentTurn],
          mana: Math.min(15, prev[currentTurn].mana + 3)
        }
      }))
    }
    
    if (!extraTurn) {
      // Chuyển lượt bình thường
      const nextPlayer = currentTurn === 'X' ? 'O' : 'X'
      setCurrentTurn(nextPlayer)
      setTimeRemaining(timePerMove || 30)
      setHasMovedThisTurn(false) // Reset for next player
      setSkillsUsedThisTurn(prev => ({ ...prev, [currentTurn]: 0 })) // Reset skill usage
      // Random 3 skill mới cho người chơi tiếp theo (KHÔNG hồi mana - đã hồi ở trên)
      if (variantType === 'skill') {
        refreshSkillsForPlayer(nextPlayer, nextTurnNum, false) // false = không hồi mana
      }
    } else {
      // extraTurn = true: Người chơi được đi thêm 1 lượt
      setExtraTurn(false)
      setTimeRemaining(timePerMove || 30)
      setHasMovedThisTurn(false) // Reset for extra turn
      // Random 3 skill mới cho người chơi hiện tại (KHÔNG hồi mana - đã hồi ở trên)
      if (variantType === 'skill') {
        refreshSkillsForPlayer(currentTurn, nextTurnNum, false) // false = không hồi mana
      }
    }
  }
  
  // Helper functions for skill cost calculation (moved before refreshSkillsForPlayer to avoid temporal dead zone)
  const getSkillUseLimit = (effects: any[] = []) => effects.some(e => e.type === 'two_skills_next_turn') ? 2 : 1
  const getHoldCostForSkill = (skill: GameSkill) => HOLD_COST_BY_RARITY[skill.rarity] ?? 1
  const calculateHoldCost = (ids: string[], available: GameSkill[]) => {
    return ids.reduce((sum, id) => {
      const found = available.find(s => s.id === id)
      return sum + (found ? getHoldCostForSkill(found) : 0)
    }, 0)
  }
  
  // Helper: Refresh skills for a player (API or local, using deck if available)
  // regenMana: false = không hồi mana (mana đã được hồi riêng trong handleEndTurn)
  const refreshSkillsForPlayer = useCallback((player: PlayerSide, turn: number, regenMana: boolean = false) => {
    const heldIds = heldSkillIds[player] || []
    setSkillsUsedThisTurn(prev => ({ ...prev, [player]: 0 }))

    if (useApiSkills) {
      setHeldSkillIds(prev => ({ ...prev, [player]: [] }))
      fetchApiSkills(matchId, turn, player, heldIds)
    } else {
      const availablePool = playerSkills[player].available as GameSkill[]
      const heldSkills = availablePool.filter(s => heldIds.includes(s.id))
      const holdCost = calculateHoldCost(heldIds, availablePool)
      const canAffordHold = holdCost <= playerSkills[player].mana
      const appliedHeld = canAffordHold ? heldSkills : []
      const manaAfterHold = Math.max(0, playerSkills[player].mana - (canAffordHold ? holdCost : 0))

      const deck = player === 'X' 
        ? (selectedDeckX.length >= 15 ? selectedDeckX : LOCAL_SKILLS)
        : (selectedDeckO.length >= 15 ? selectedDeckO : LOCAL_SKILLS)
      
      const pool = deck.filter(s => !appliedHeld.some(h => h.id === s.id))
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      const need = Math.max(0, 3 - appliedHeld.length)
      const localSkills = [...appliedHeld, ...shuffled.slice(0, need)] as unknown as Skill[]
      // Chỉ hồi mana nếu regenMana = true (mặc định false vì đã hồi trong handleEndTurn)
      const newMana = regenMana ? Math.min(15, manaAfterHold + 3) : manaAfterHold

      setPlayerSkills(prev => ({
        ...prev,
        [player]: { 
          ...prev[player], 
          available: localSkills,
          mana: newMana,
          holdCost: canAffordHold ? holdCost : 0
        }
      }))
      setHeldSkillIds(prev => ({ ...prev, [player]: [] }))
    }
  }, [useApiSkills, matchId, fetchApiSkills, selectedDeckX, selectedDeckO, heldSkillIds, playerSkills, calculateHoldCost])
  
  const toggleHoldSkill = (skill: GameSkill) => {
    setHeldSkillIds(prev => {
      const currentIds = prev[currentTurn] || []
      const isHeld = currentIds.includes(skill.id)
      if (isHeld) {
        return { ...prev, [currentTurn]: currentIds.filter(id => id !== skill.id) }
      }
      if (currentIds.length >= 3) return prev
      const newIds = [...currentIds, skill.id]
      const totalCost = calculateHoldCost(newIds, playerSkills[currentTurn].available)
      if (totalCost > playerSkills[currentTurn].mana) return prev
      return { ...prev, [currentTurn]: newIds }
    })
  }
  
  // Use skill - supports both API skills and local skills
  const handleUseSkill = (skill: GameSkill) => {
    console.log('🎯 handleUseSkill called:', skill.id, skill.effect_type)
    const skillId = skill.id
    const cooldown = playerSkills[currentTurn].cooldowns[skillId]
    const disabled = playerSkills[currentTurn].disabled[skillId]
    
    // Check if skill is disabled (cooldown, deck_lock, etc.)
    if ((cooldown && cooldown > 0) || disabled) {
      console.log('❌ Skill blocked - cooldown:', cooldown, 'disabled:', disabled)
      return
    }
    
    const useLimit = getSkillUseLimit(playerSkills[currentTurn].effects || [])
    console.log('📊 Skill usage:', skillsUsedThisTurn[currentTurn], '/', useLimit)
    if (skillsUsedThisTurn[currentTurn] >= useLimit) {
      console.log('❌ Skill limit reached')
      return
    }
    
    // Check mana cost (for API skills)
    const manaCost = 'mana_cost' in skill ? (skill as any).mana_cost : 0
    if (manaCost > 0 && playerSkills[currentTurn].mana < manaCost) {
      console.log('❌ Not enough mana:', playerSkills[currentTurn].mana, '<', manaCost)
      return
    }
    
    console.log('✅ Skill passed all checks, effect_type:', skill.effect_type)
    
    // If skill đang được đánh dấu giữ, bỏ giữ vì đã dùng
    setHeldSkillIds(prev => ({
      ...prev,
      [currentTurn]: prev[currentTurn]?.filter(id => id !== skillId) || []
    }))
    
    setSelectedSkill(skill)
    
    // Get effect_type from skill (API skill has effect_type, local has it too)
    const effectType = skill.effect_type || skillId
    
    // Handle skill based on effect_type
    switch (effectType) {
      case 'swap_own':
      case 'swap':
      case 'swap_pieces':
        setSkillMode('swap-1')
        break
      case 'block_cell':
      case 'block':
        setSkillMode('block')
        break
      case 'ai_analyze':
      case 'reveal':
      case 'reveal_area':
        // Reveal all hidden pieces for 2 turns
        setRevealTurns(2)
        const revealed = board.map(row => row.map(cell => ({ ...cell, hidden: false })))
        setBoard(revealed)
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      case 'undo_enemy':
      case 'undo':
        // Remove last opponent move
        if (moveHistory.length > 0) {
          const lastMove = moveHistory[moveHistory.length - 1]
          if (lastMove.player !== currentTurn) {
            const newBoard = [...board.map(row => [...row])]
            newBoard[lastMove.y][lastMove.x] = { ...newBoard[lastMove.y][lastMove.x], player: null, moveIndex: null }
            setBoard(newBoard)
            setMoveHistory(moveHistory.slice(0, -1))
            applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
          }
        }
        setSelectedSkill(null)
        break
      case 'place_double':
      case 'double':
      case 'extra_turn':
        setExtraTurn(true)
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      case 'freeze_skills':
      case 'freeze':
      case 'silence_all': {
        // Freeze opponent skills for 2 turns
        const opponent = currentTurn === 'X' ? 'O' : 'X'
        setPlayerSkills(prev => ({
          ...prev,
          [opponent]: { ...prev[opponent], effects: [...prev[opponent].effects, { type: 'freeze_skills', duration: 2 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      case 'bomb_area':
      case 'bomb':
        setSkillMode('bomb')
        break
      case 'shield_area':
      case 'shield':
      case 'immunity_area':
      case 'protect_piece':
      case 'permanent_protect':
        setSkillMode('shield')
        break
      case 'teleport_piece':
      case 'teleport':
        setSkillMode('teleport-1')
        break
      case 'clone_piece':
      case 'clone':
        setSkillMode('clone')
        break
      
      // === ATTACK SKILLS - Cần chọn target ===
      case 'destroy_piece':
      case 'temp_remove':
      case 'convert_piece':
      case 'immobilize':
      case 'anchor_piece':
        setSkillMode('destroy') // Chọn 1 quân địch
        break
      
      case 'push_enemy':
      case 'push_chain':
      case 'break_chain':
        setSkillMode('push-select') // Bước 1: Chọn quân địch để đẩy
        setPushTarget(null)
        break
      
      // === AREA SKILLS - Cần chọn vùng ===
      case 'chaos_move':
      case 'burn_area':
      case 'reset_area':
      case 'shuffle_area':
        setSkillMode('area') // Chọn tâm vùng 3x3
        break
      
      // === LINE SKILLS - Phá hủy theo đường ===
      case 'line_destroy': {
        // Chọn ngẫu nhiên 1 đường (hàng hoặc cột) và phá hủy quân địch trên đó
        const enemySide = currentTurn === 'X' ? 'O' : 'X'
        const isRow = Math.random() > 0.5
        const lineIndex = Math.floor(Math.random() * boardSize)
        const newBoard = board.map((row, y) => row.map((cell, x) => {
          if (isRow && y === lineIndex && cell.player === enemySide) {
            return { ...cell, player: null, moveIndex: null }
          }
          if (!isRow && x === lineIndex && cell.player === enemySide) {
            return { ...cell, player: null, moveIndex: null }
          }
          return cell
        }))
        setBoard(newBoard)
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      // === UTILITY SKILLS - Tự động áp dụng ===
      case 'reduce_cooldown': {
        // Giảm CD tất cả skill đi một nửa
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: {
            ...prev[currentTurn],
            cooldowns: Object.fromEntries(
              Object.entries(prev[currentTurn].cooldowns).map(([k, v]) => [k, Math.floor(v / 2)])
            )
          }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'restore_mana': {
        // Mana về 15
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: { ...prev[currentTurn], mana: 15 }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, 0) // Không tốn mana
        setSelectedSkill(null)
        break
      }
      
      case 'double_next': {
        // Tăng gấp đôi skill tiếp theo
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: { ...prev[currentTurn], effects: [...prev[currentTurn].effects, { type: 'double_next', duration: 1 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'double_skill': {
        // Lượt sau dùng 2 skill cùng lúc
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: { ...prev[currentTurn], effects: [...prev[currentTurn].effects, { type: 'two_skills_next_turn', duration: 1 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'chaos_jump':
      case 'chaos_all':
      case 'chaos_board': {
        // Tất cả quân nhảy ngẫu nhiên
        const allPieces: { x: number; y: number; player: PlayerSide }[] = []
        const allEmpty: { x: number; y: number }[] = []
        board.forEach((row, y) => row.forEach((cell, x) => {
          if (cell.player) allPieces.push({ x, y, player: cell.player })
          else if (cell.terrain !== 'block') allEmpty.push({ x, y })
        }))
        // Shuffle positions
        const allPositions = [...allPieces.map(p => ({ x: p.x, y: p.y })), ...allEmpty]
        const shuffled = allPositions.sort(() => Math.random() - 0.5)
        const newBoard = board.map(row => row.map(cell => ({ ...cell, player: null as PlayerSide | null, moveIndex: null as number | null })))
        allPieces.forEach((piece, i) => {
          const newPos = shuffled[i]
          newBoard[newPos.y][newPos.x] = { ...newBoard[newPos.y][newPos.x], player: piece.player, moveIndex: i + 1 }
        })
        setBoard(newBoard)
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'clear_all_effects':
      case 'remove_debuff': {
        // Xóa tất cả hiệu ứng
        setPlayerSkills(prev => ({
          X: { ...prev.X, effects: [] },
          O: { ...prev.O, effects: [] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'protect_all': {
        // Bảo vệ tất cả quân ta 5 lượt
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: { ...prev[currentTurn], effects: [...prev[currentTurn].effects, { type: 'protect_all', duration: 5 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'attack_buff': {
        // Tăng 50% skill tấn công tiếp
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: { ...prev[currentTurn], effects: [...prev[currentTurn].effects, { type: 'attack_buff', multiplier: 1.5, duration: 1 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'luck_buff': {
        // Tăng 10% may mắn
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: { ...prev[currentTurn], effects: [...prev[currentTurn].effects, { type: 'luck_buff', amount: 0.1, duration: 99 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'buff_immunity': {
        // Vô hiệu buff trong 3 lượt tới
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: { ...prev[currentTurn], effects: [...prev[currentTurn].effects, { type: 'buff_immunity', duration: 3 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'dodge_next': {
        // Vô hiệu 1 skill tấn công địch
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: { ...prev[currentTurn], effects: [...prev[currentTurn].effects, { type: 'dodge_next', count: 1 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'reflect_trap':
      case 'reflect_trap_delayed': {
        // Đặt bẫy phản skill
        setSkillMode('reflect-trap')
        break
      }
      
      case 'fake_piece': {
        // Tạo quân giả
        setSkillMode('fake')
        break
      }
      
      case 'hide_pieces': {
        // Ẩn 5 quân của mình
        const myPieces: { x: number; y: number }[] = []
        board.forEach((row, y) => row.forEach((cell, x) => {
          if (cell.player === currentTurn) myPieces.push({ x, y })
        }))
        const toHide = myPieces.sort(() => Math.random() - 0.5).slice(0, 5)
        const newBoard = board.map((row, y) => row.map((cell, x) => {
          if (toHide.some(p => p.x === x && p.y === y)) {
            return { ...cell, hidden: true }
          }
          return cell
        }))
        setBoard(newBoard)
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'restore_piece': {
        // Hồi 1 quân bị phá trong 3 lượt gần nhất
        // Tìm quân bị xóa gần nhất của mình
        const recentMoves = moveHistory.slice(-6) // 3 lượt = 6 nước
        const myRemovedPiece = recentMoves.find(m => m.player === currentTurn)
        if (myRemovedPiece && board[myRemovedPiece.y][myRemovedPiece.x].player === null) {
          const newBoard = board.map((row, y) => row.map((cell, x) => {
            if (x === myRemovedPiece.x && y === myRemovedPiece.y) {
              return { ...cell, player: currentTurn, moveIndex: moveHistory.length + 1 }
            }
            return cell
          }))
          setBoard(newBoard)
        }
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'extend_buffs': {
        // Tăng 1 lượt cho tất cả buff
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: {
            ...prev[currentTurn],
            effects: prev[currentTurn].effects.map(e => ({ ...e, duration: (e.duration || 0) + 1 }))
          }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'turn_manipulation': {
        // 50/50 đi 2 lượt hoặc địch đi 2
        if (Math.random() > 0.5) {
          setExtraTurn(true) // Mình đi thêm
        } else {
          // Địch đi thêm - skip lượt này
          setCurrentTurn(currentTurn === 'X' ? 'O' : 'X')
        }
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'disable_skills': {
        // Loại bỏ 5 skill địch 5 lượt
        const opponent = currentTurn === 'X' ? 'O' : 'X'
        setPlayerSkills(prev => ({
          ...prev,
          [opponent]: { ...prev[opponent], effects: [...prev[opponent].effects, { type: 'disable_skills', count: 5, duration: 5 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'remove_immobilize': {
        // Giải trạng thái Cố Định
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: {
            ...prev[currentTurn],
            effects: prev[currentTurn].effects.filter(e => e.type !== 'immobilize')
          }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'reuse_skill': {
        // Dùng lại 1 skill đã dùng - reset CD của skill cuối
        const lastUsedSkillId = Object.keys(playerSkills[currentTurn].cooldowns).find(
          id => playerSkills[currentTurn].cooldowns[id] > 0
        )
        if (lastUsedSkillId) {
          setPlayerSkills(prev => ({
            ...prev,
            [currentTurn]: {
              ...prev[currentTurn],
              cooldowns: { ...prev[currentTurn].cooldowns, [lastUsedSkillId]: 0 }
            }
          }))
        }
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'random_skill': {
        // Random skill bất kỳ - chọn ngẫu nhiên 1 effect và thực hiện
        const randomEffects = ['extra_turn', 'reduce_cooldown', 'restore_mana', 'double_next']
        const randomEffect = randomEffects[Math.floor(Math.random() * randomEffects.length)]
        // Đệ quy gọi lại với effect ngẫu nhiên
        handleUseSkill({ ...skill, effect_type: randomEffect })
        return // Không apply cooldown ở đây vì đã apply trong đệ quy
      }
      
      // === SPREAD EFFECTS - Lan tỏa ===
      case 'fire_spread':
      case 'ice_spread':
      case 'root_spread':
      case 'stone_spread':
      case 'rust_spread': {
        const spreadType = effectType.replace('_spread', '')
        const opponent = currentTurn === 'X' ? 'O' : 'X'
        setPlayerSkills(prev => ({
          ...prev,
          [opponent]: { ...prev[opponent], effects: [...prev[opponent].effects, { type: spreadType, duration: 5, count: 5 }] }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      // === COUNTER ELEMENTS ===
      case 'counter_metal':
      case 'counter_fire':
      case 'counter_earth':
      case 'counter_water':
      case 'counter_wood': {
        const elementToCounter = effectType.replace('counter_', '')
        // Xóa hiệu ứng element tương ứng
        setPlayerSkills(prev => ({
          X: { ...prev.X, effects: prev.X.effects.filter(e => e.type !== elementToCounter) },
          O: { ...prev.O, effects: prev.O.effects.filter(e => e.type !== elementToCounter) }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      // === MISSING SKILLS - Thêm các skill còn thiếu ===
      case 'mutual_protect': {
        // Cả 2 chọn 1 quân bảo hộ 5 lượt - tạm thời bảo vệ quân cuối của mỗi bên
        const newBoard = [...board.map(row => [...row])]
        // Tìm quân cuối của mỗi bên và shield
        for (let i = moveHistory.length - 1; i >= 0; i--) {
          const move = moveHistory[i]
          if (move.player === 'X' && !newBoard[move.y][move.x].shielded) {
            newBoard[move.y][move.x].shielded = true
            newBoard[move.y][move.x].frozen = 5 // Dùng frozen để track duration
            break
          }
        }
        for (let i = moveHistory.length - 1; i >= 0; i--) {
          const move = moveHistory[i]
          if (move.player === 'O' && !newBoard[move.y][move.x].shielded) {
            newBoard[move.y][move.x].shielded = true
            newBoard[move.y][move.x].frozen = 5
            break
          }
        }
        setBoard(newBoard)
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'protect_line': {
        // Bảo vệ 1 hàng quân 2 lượt - chọn hàng có nhiều quân nhất
        const newBoard = [...board.map(row => [...row])]
        let bestRow = 0
        let maxPieces = 0
        for (let y = 0; y < boardSize; y++) {
          const count = newBoard[y].filter(c => c.player === currentTurn).length
          if (count > maxPieces) {
            maxPieces = count
            bestRow = y
          }
        }
        for (let x = 0; x < boardSize; x++) {
          if (newBoard[bestRow][x].player === currentTurn) {
            newBoard[bestRow][x].shielded = true
            newBoard[bestRow][x].frozen = 2
          }
        }
        setBoard(newBoard)
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'destroy_immunity': {
        // Bảo vệ 1 quân khỏi phá hủy - chọn quân cuối
        setSkillMode('shield')
        break
      }
      
      case 'redirect_damage': {
        // Chuyển sát thương sang ô khác - thêm effect
        setPlayerSkills(prev => ({
          ...prev,
          [currentTurn]: {
            ...prev[currentTurn],
            effects: [...prev[currentTurn].effects, { type: 'redirect_damage', duration: 1 }]
          }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'remove_enemy_skill': {
        // Xóa 1 skill địch, hy sinh 1 skill của mình
        const opponent = currentTurn === 'X' ? 'O' : 'X'
        const opponentSkills = playerSkills[opponent].available
        const mySkills = playerSkills[currentTurn].available
        if (opponentSkills.length > 0 && mySkills.length > 1) {
          // Xóa skill đầu tiên của địch và skill cuối của mình
          setPlayerSkills(prev => ({
            ...prev,
            [opponent]: { ...prev[opponent], available: prev[opponent].available.slice(1) },
            [currentTurn]: { ...prev[currentTurn], available: prev[currentTurn].available.slice(0, -1) }
          }))
        }
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'force_move_fixed': {
        // Di chuyển quân bị Cố Định - teleport quân có immobilize
        setSkillMode('teleport-1')
        break
      }
      
      case 'force_reveal': {
        // Ép địch chọn trước ô đặt quân - thêm effect cho địch
        const opponent = currentTurn === 'X' ? 'O' : 'X'
        setPlayerSkills(prev => ({
          ...prev,
          [opponent]: {
            ...prev[opponent],
            effects: [...prev[opponent].effects, { type: 'force_reveal', duration: 1 }]
          }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'seal_buff': {
        // Ngăn quân địch nhận buff 3 lượt
        const opponent = currentTurn === 'X' ? 'O' : 'X'
        setPlayerSkills(prev => ({
          ...prev,
          [opponent]: {
            ...prev[opponent],
            effects: [...prev[opponent].effects, { type: 'seal_buff', duration: 3 }]
          }
        }))
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      case 'steal_skill': {
        // Lấy 1 skill hiếm/cực hiếm từ địch
        const opponent = currentTurn === 'X' ? 'O' : 'X'
        const rareSkills = playerSkills[opponent].available.filter(
          s => s.rarity === 'rare' || s.rarity === 'legendary'
        )
        if (rareSkills.length > 0) {
          const stolenSkill = rareSkills[0]
          setPlayerSkills(prev => ({
            ...prev,
            [opponent]: { ...prev[opponent], available: prev[opponent].available.filter(s => s.id !== stolenSkill.id) },
            [currentTurn]: { ...prev[currentTurn], available: [...prev[currentTurn].available, stolenSkill] }
          }))
        }
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
        break
      }
      
      default:
        // For other skills, just apply cooldown
        console.log(`Skill effect_type "${effectType}" not implemented, applying cooldown only`)
        applySkillCooldownAndMana(skillId, skill.cooldown, manaCost)
        setSelectedSkill(null)
    }
  }
  
  // Helper: Apply cooldown and deduct mana
  const applySkillCooldownAndMana = (skillId: string, cooldown: number, manaCost: number) => {
    const nextUsed = skillsUsedThisTurn[currentTurn] + 1
    setSkillsUsedThisTurn(prev => ({ ...prev, [currentTurn]: nextUsed }))
    setPlayerSkills(prev => ({
      ...prev,
      [currentTurn]: {
        ...prev[currentTurn],
        cooldowns: { ...prev[currentTurn].cooldowns, [skillId]: cooldown },
        mana: Math.max(0, prev[currentTurn].mana - manaCost),
        effects: nextUsed >= getSkillUseLimit(prev[currentTurn].effects || [])
          ? (prev[currentTurn].effects || []).filter(e => e.type !== 'two_skills_next_turn')
          : prev[currentTurn].effects
      }
    }))
  }
  
  // Timer
  useEffect(() => {
    if (!gameStarted || winner || isDraw || !timePerMove) return
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - other player wins
          const loser = currentTurn
          const winnerPlayer = loser === 'X' ? 'O' : 'X'
          setWinner(winnerPlayer)
          setScores(prev => ({ ...prev, [winnerPlayer]: prev[winnerPlayer] + 1 }))
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [gameStarted, winner, isDraw, timePerMove, currentTurn])
  
  // Mobile detection
  const isMobile = useIsMobile()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [tapHighlight, setTapHighlight] = useState<{x: number, y: number} | null>(null)
  
  // Calculate board size to always be 1:1 square and fit screen
  const [boardPixelSize, setBoardPixelSize] = useState(400)
  
  useEffect(() => {
    const updateBoardSize = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (isMobile) {
        // Mobile: container padding 8px * 2 = 16px, thêm margin an toàn
        const availableWidth = vw - 24 // 8px padding mỗi bên + 4px margin
        const availableHeight = vh - 200 // header + controls + margin
        const size = Math.min(availableWidth, availableHeight)
        setBoardPixelSize(Math.max(240, Math.min(380, size)))
      } else {
        // Desktop: side panels + padding
        const padding = 60
        const headerSpace = 200
        const maxSize = Math.min(vw - padding, vh - headerSpace)
        setBoardPixelSize(Math.max(280, Math.min(560, maxSize)))
      }
    }
    updateBoardSize()
    window.addEventListener('resize', updateBoardSize)
    return () => window.removeEventListener('resize', updateBoardSize)
  }, [isMobile])
  
  const cellSize = Math.floor(boardPixelSize / boardSize)
  
  // Variant type labels - use translation keys
  const getVariantLabel = (type: VariantType) => ({
    name: t(`variant.type.${type}.name`),
    desc: t(`variant.type.${type}.desc`),
    icon: type === 'custom' ? '⚙️' : type === 'hidden' ? '👁️' : type === 'skill' ? '⚡' : '🗺️'
  })
  
  return (
    <div style={{
      minHeight: '100vh',
      maxWidth: '100vw',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      color: '#e2e8f0',
      padding: isMobile ? '8px' : '16px',
      boxSizing: 'border-box',
      overflowX: 'hidden',
      overflowY: 'auto'
    }}>
      {/* Mobile Breadcrumb - Simple inline style */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span 
            style={{ fontSize: 13, color: '#94A3B8', cursor: 'pointer' }}
            onClick={() => window.location.hash = '#home'}
          >
            {t('breadcrumb.home')}
          </span>
          <span style={{ color: '#94A3B8' }}>›</span>
          <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>
            {getVariantLabel(variantType).name}
          </span>
        </div>
      )}
      {/* Header */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <nav className="desktop-breadcrumb" style={{ marginBottom: 12, fontSize: 13, color: '#94A3B8' }}>
          <a href="#home" style={{ color: '#60A5FA', textDecoration: 'none' }}>{t('breadcrumb.home')}</a>
          <span style={{ margin: '0 8px' }}>›</span>
          <span>{t('variant.setup.variantLabel')}</span>
        </nav>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              {getVariantLabel(variantType).icon} {getVariantLabel(variantType).name}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8' }}>{getVariantLabel(variantType).desc}</p>
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            {variantType === 'terrain' && gameStarted ? (
              <>
                <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', fontWeight: 700 }}>
                  ⚫ {terrainScores.X.total} điểm 
                  {(terrainScores.X.bonusPoints > 0 || terrainTileBonus.X > 0) && (
                    <span style={{ fontSize: 11, opacity: 0.8 }}>
                      {terrainScores.X.bonusPoints > 0 && ` +${terrainScores.X.bonusPoints} giao`}
                      {terrainTileBonus.X > 0 && ` +${terrainTileBonus.X} 💎`}
                    </span>
                  )}
                </div>
                <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontWeight: 700 }}>
                  ⚪ {terrainScores.O.total} điểm 
                  {(terrainScores.O.bonusPoints > 0 || terrainTileBonus.O > 0) && (
                    <span style={{ fontSize: 11, opacity: 0.8 }}>
                      {terrainScores.O.bonusPoints > 0 && ` +${terrainScores.O.bonusPoints} giao`}
                      {terrainTileBonus.O > 0 && ` +${terrainTileBonus.O} 💎`}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60A5FA', fontWeight: 700 }}>
                  X: {scores.X}
                </div>
                <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#F87171', fontWeight: 700 }}>
                  O: {scores.O}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Setup Modal */}
      {showSetup && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 500,
            width: '90%',
            border: '1px solid rgba(148,163,184,0.2)'
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 800 }}>{t('variant.setup.title')}</h2>
            
            {/* Variant Type Selection */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8, display: 'block' }}>{t('variant.setup.variantLabel')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {(['custom', 'hidden', 'skill', 'terrain'] as VariantType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      setVariantType(type)
                      // Reset swap2 khi chuyển sang mode không hỗ trợ (chỉ custom và hidden có swap2)
                      if (type !== 'custom' && type !== 'hidden') setSwap2Enabled(false)
                    }}
                    style={{
                      padding: '12px',
                      borderRadius: 10,
                      border: variantType === type ? '2px solid #60A5FA' : '1px solid rgba(148,163,184,0.3)',
                      background: variantType === type ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.5)',
                      color: '#E2E8F0',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                      {getVariantLabel(type).icon} {getVariantLabel(type).name}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{getVariantLabel(type).desc}</div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Board Size - hidden for matchmaking */}
            {opponentType !== 'matchmaking' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8, display: 'block' }}>{t('variant.setup.boardSize', { size: boardSize })}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[3, 5, 9, 11, 15, 19].map(size => (
                    <button
                      key={size}
                      onClick={() => {
                        setBoardSize(size)
                        if (winLength > size) setWinLength(Math.min(5, size))
                      }}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: 8,
                        border: boardSize === size ? '2px solid #60A5FA' : '1px solid rgba(148,163,184,0.3)',
                        background: boardSize === size ? 'rgba(59,130,246,0.15)' : 'transparent',
                        color: '#E2E8F0',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Win Length - hidden for matchmaking */}
            {opponentType !== 'matchmaking' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8, display: 'block' }}>{t('variant.setup.winLength', { count: winLength })}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[3, 4, 5, 6].filter(len => len <= boardSize).map(len => (
                    <button
                      key={len}
                      onClick={() => setWinLength(len)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: 8,
                        border: winLength === len ? '2px solid #22C55E' : '1px solid rgba(148,163,184,0.3)',
                        background: winLength === len ? 'rgba(34,197,94,0.15)' : 'transparent',
                        color: '#E2E8F0',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Opponent */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8, display: 'block' }}>{t('variant.setup.opponentLabel')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setOpponentType('local')}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '10px',
                    borderRadius: 8,
                    border: opponentType === 'local' ? '2px solid #A855F7' : '1px solid rgba(148,163,184,0.3)',
                    background: opponentType === 'local' ? 'rgba(168,85,247,0.15)' : 'transparent',
                    color: '#E2E8F0',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  👥 {t('variant.setup.opponentLocal')}
                </button>
                <button
                  onClick={() => setOpponentType('matchmaking')}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '10px',
                    borderRadius: 8,
                    border: opponentType === 'matchmaking' ? '2px solid #10B981' : '1px solid rgba(148,163,184,0.3)',
                    background: opponentType === 'matchmaking' ? 'rgba(16,185,129,0.15)' : 'transparent',
                    color: '#E2E8F0',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🎯 {t('variant.setup.opponentMatchmaking')}
                </button>
                <button
                  onClick={() => setOpponentType('online')}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '10px',
                    borderRadius: 8,
                    border: opponentType === 'online' ? '2px solid #22D3EE' : '1px solid rgba(148,163,184,0.3)',
                    background: opponentType === 'online' ? 'rgba(34,211,238,0.15)' : 'transparent',
                    color: '#E2E8F0',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🌐 {t('variant.setup.opponentOnline')}
                </button>
              </div>
            </div>
            
            {/* Matchmaking notice - standard settings */}
            {opponentType === 'matchmaking' && (
              <div style={{ 
                marginBottom: 16, 
                padding: '12px', 
                borderRadius: 10, 
                background: 'rgba(16,185,129,0.1)', 
                border: '1px solid rgba(16,185,129,0.3)' 
              }}>
                <div style={{ fontSize: 13, color: '#10B981', fontWeight: 600, marginBottom: 8 }}>
                  🎯 {t('variant.setup.matchmakingNotice')}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  {t('variant.setup.matchmakingDesc')}
                </div>
                <div style={{ 
                  marginTop: 10, 
                  padding: '8px 12px', 
                  borderRadius: 8, 
                  background: 'rgba(15,23,42,0.5)',
                  fontSize: 12,
                  color: '#CBD5E1'
                }}>
                  <div>📐 {t('variant.setup.standardBoard')}: {MATCHMAKING_CONFIGS[variantType].boardSize}x{MATCHMAKING_CONFIGS[variantType].boardSize}</div>
                  <div>🎯 {t('variant.setup.standardWin')}: {MATCHMAKING_CONFIGS[variantType].winLength} {t('variant.game.win')}</div>
                  <div>⏱️ {t('variant.setup.standardTime')}: {MATCHMAKING_CONFIGS[variantType].timePerMove}s</div>
                  {MATCHMAKING_CONFIGS[variantType].swap2Enabled && (
                    <div style={{ color: '#10B981', fontWeight: 600 }}>🔄 Swap 2: {t('variant.setup.swap2On')}</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Swap2 Toggle - only show for custom and hidden modes */}
            {(variantType === 'custom' || variantType === 'hidden') && opponentType !== 'matchmaking' && (
              <div style={{ marginBottom: 16 }}>
                <label 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    cursor: 'pointer',
                    padding: '12px',
                    borderRadius: 10,
                    border: swap2Enabled ? '2px solid #10B981' : '1px solid rgba(148,163,184,0.3)',
                    background: swap2Enabled ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.5)'
                  }}
                  onClick={() => setSwap2Enabled(!swap2Enabled)}
                >
                  <input 
                    type="checkbox" 
                    checked={swap2Enabled} 
                    onChange={() => setSwap2Enabled(!swap2Enabled)}
                    style={{ width: 18, height: 18, accentColor: '#10B981' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, color: '#E2E8F0' }}>🔄 Swap 2 Opening</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{t('variant.setup.swap2Desc')}</div>
                  </div>
                </label>
              </div>
            )}
            
            {/* Deck Selection for Skill mode - hiển thị cho tất cả opponent types */}
            {variantType === 'skill' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8, display: 'block' }}>
                  🃏 {t('variant.setup.deckLabel') || 'Chọn Bộ Bài (Deck)'}
                </label>
                
                {/* Online/Matchmaking: chỉ hiển thị My Deck */}
                {opponentType !== 'local' && (
                  <div style={{ 
                    padding: '12px', 
                    borderRadius: 10, 
                    background: 'rgba(168,85,247,0.1)', 
                    border: '1px solid rgba(168,85,247,0.3)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#A855F7' }}>
                        🃏 {t('variant.setup.myDeck') || 'Deck của bạn'} - {selectedDeckX.length}/15 {t('variant.setup.cards') || 'lá'}
                      </span>
                      <button
                        onClick={() => { setDeckSelectingFor('X'); setShowDeckSelector(true) }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid rgba(168,85,247,0.5)',
                          background: 'rgba(168,85,247,0.2)',
                          color: '#A855F7',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {selectedDeckX.length >= 15 ? '✏️ ' + (t('common.edit') || 'Sửa') : '➕ ' + (t('variant.setup.selectDeck') || 'Chọn 15 lá')}
                      </button>
                    </div>
                    {selectedDeckX.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {selectedDeckX.slice(0, 8).map(skill => (
                          <span key={skill.id} style={{ fontSize: 16 }} title={skill.name_vi}>
                            {getSkillIcon(skill)}
                          </span>
                        ))}
                        {selectedDeckX.length > 8 && (
                          <span style={{ fontSize: 12, color: '#94A3B8' }}>+{selectedDeckX.length - 8}</span>
                        )}
                      </div>
                    )}
                    {selectedDeckX.length === 0 && (
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>
                        {t('variant.setup.noDeckSelected') || 'Chưa chọn deck - sẽ random từ tất cả skill'}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Local mode: hiển thị cả 2 deck */}
                {opponentType === 'local' && (
                  <>
                    {/* Player X Deck */}
                    <div style={{ 
                      padding: '12px', 
                      borderRadius: 10, 
                      background: 'rgba(59,130,246,0.1)', 
                      border: '1px solid rgba(59,130,246,0.3)',
                      marginBottom: 8
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#60A5FA' }}>
                          ⚫ {t('variant.game.playerX')} - {selectedDeckX.length}/15 {t('variant.setup.cards') || 'lá'}
                        </span>
                        <button
                          onClick={() => { setDeckSelectingFor('X'); setShowDeckSelector(true) }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(59,130,246,0.5)',
                            background: 'rgba(59,130,246,0.2)',
                            color: '#60A5FA',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {selectedDeckX.length >= 15 ? '✏️ ' + (t('common.edit') || 'Sửa') : '➕ ' + (t('variant.setup.selectDeck') || 'Chọn 15 lá')}
                        </button>
                      </div>
                      {selectedDeckX.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {selectedDeckX.slice(0, 8).map(skill => (
                            <span key={skill.id} style={{ fontSize: 16 }} title={skill.name_vi}>
                              {getSkillIcon(skill)}
                            </span>
                          ))}
                          {selectedDeckX.length > 8 && (
                            <span style={{ fontSize: 12, color: '#94A3B8' }}>+{selectedDeckX.length - 8}</span>
                          )}
                        </div>
                      )}
                      {selectedDeckX.length === 0 && (
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>
                          {t('variant.setup.noDeckSelected') || 'Chưa chọn deck - sẽ random từ tất cả skill'}
                        </div>
                      )}
                    </div>
                    
                    {/* Player O Deck */}
                    <div style={{ 
                      padding: '12px', 
                      borderRadius: 10, 
                      background: 'rgba(239,68,68,0.1)', 
                      border: '1px solid rgba(239,68,68,0.3)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#F87171' }}>
                          ⚪ {t('variant.game.playerO')} - {selectedDeckO.length}/15 {t('variant.setup.cards') || 'lá'}
                        </span>
                        <button
                          onClick={() => { setDeckSelectingFor('O'); setShowDeckSelector(true) }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(239,68,68,0.5)',
                            background: 'rgba(239,68,68,0.2)',
                            color: '#F87171',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {selectedDeckO.length >= 15 ? '✏️ ' + (t('common.edit') || 'Sửa') : '➕ ' + (t('variant.setup.selectDeck') || 'Chọn 15 lá')}
                        </button>
                      </div>
                      {selectedDeckO.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {selectedDeckO.slice(0, 8).map(skill => (
                            <span key={skill.id} style={{ fontSize: 16 }} title={skill.name_vi}>
                              {getSkillIcon(skill)}
                            </span>
                          ))}
                          {selectedDeckO.length > 8 && (
                            <span style={{ fontSize: 12, color: '#94A3B8' }}>+{selectedDeckO.length - 8}</span>
                          )}
                        </div>
                      )}
                      {selectedDeckO.length === 0 && (
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>
                          {t('variant.setup.noDeckSelected') || 'Chưa chọn deck - sẽ random từ tất cả skill'}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Online mode notice */}
            {opponentType === 'online' && (
              <div style={{ 
                marginBottom: 16, 
                padding: '12px', 
                borderRadius: 10, 
                background: 'rgba(34,211,238,0.1)', 
                border: '1px solid rgba(34,211,238,0.3)' 
              }}>
                <div style={{ fontSize: 13, color: '#22D3EE', fontWeight: 600 }}>
                  🌐 {t('variant.setup.onlineNotice')}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                  {t('variant.setup.onlineDesc')}
                </div>
              </div>
            )}
            
            {/* Time Limit - hidden for matchmaking */}
            {opponentType !== 'matchmaking' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8, display: 'block' }}>{t('variant.setup.timePerMove')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[null, 15, 30, 60].map(time => (
                    <button
                      key={time ?? 'none'}
                      onClick={() => setTimePerMove(time)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: 8,
                        border: timePerMove === time ? '2px solid #F59E0B' : '1px solid rgba(148,163,184,0.3)',
                        background: timePerMove === time ? 'rgba(245,158,11,0.15)' : 'transparent',
                        color: '#E2E8F0',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {time ? `${time}s` : t('variant.setup.timeNone')}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => window.location.hash = '#home'}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'transparent',
                  color: '#94A3B8',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {t('variant.setup.back')}
              </button>
              <button
                onClick={handleStartGame}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                {t('variant.setup.start')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Waiting for Opponent Overlay (Online mode) */}
      {waitingForOpponent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            borderRadius: 20,
            padding: 40,
            textAlign: 'center',
            border: '1px solid rgba(34,211,238,0.3)'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 2s infinite' }}>🌐</div>
            <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: '#22D3EE' }}>
              {t('variant.online.waiting')}
            </h2>
            <p style={{ margin: '0 0 8px', color: '#94A3B8', fontSize: 14 }}>
              {t('variant.online.shareCode')}
            </p>
            <div style={{ 
              padding: '12px 24px', 
              background: 'rgba(34,211,238,0.1)', 
              borderRadius: 10, 
              border: '1px solid rgba(34,211,238,0.3)',
              fontFamily: 'monospace',
              fontSize: 18,
              fontWeight: 700,
              color: '#22D3EE',
              marginBottom: 20
            }}>
              {roomId}
            </div>
            <button
              onClick={() => {
                if (socket) socket.disconnect()
                setWaitingForOpponent(false)
                setShowSetup(true)
              }}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.5)',
                background: 'rgba(239,68,68,0.15)',
                color: '#F87171',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
      
      {/* Matchmaking Overlay */}
      {isMatchmaking && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            borderRadius: 20,
            padding: 40,
            textAlign: 'center',
            border: '1px solid rgba(16,185,129,0.3)',
            maxWidth: 400
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              <span style={{ animation: 'spin 2s linear infinite', display: 'inline-block' }}>🎯</span>
            </div>
            <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: '#10B981' }}>
              {t('variant.matchmaking.searching')}
            </h2>
            <p style={{ margin: '0 0 16px', color: '#94A3B8', fontSize: 14 }}>
              {t('variant.matchmaking.findingOpponent')}
            </p>
            
            {/* Timer */}
            <div style={{ 
              padding: '12px 24px', 
              background: 'rgba(16,185,129,0.1)', 
              borderRadius: 10, 
              border: '1px solid rgba(16,185,129,0.3)',
              marginBottom: 16
            }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
                {Math.floor(matchmakingTime / 60).toString().padStart(2, '0')}:{(matchmakingTime % 60).toString().padStart(2, '0')}
              </div>
              {queuePosition > 0 && (
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                  {t('variant.matchmaking.queuePosition', { position: queuePosition })}
                </div>
              )}
            </div>
            
            {/* Mode info */}
            <div style={{ 
              padding: '10px 16px', 
              background: 'rgba(15,23,42,0.5)', 
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 12,
              color: '#CBD5E1',
              textAlign: 'left'
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#E2E8F0' }}>
                {getVariantLabel(variantType).icon} {getVariantLabel(variantType).name}
              </div>
              <div>📐 15x15 • 🎯 5 {t('variant.game.win')} • ⏱️ 30s</div>
            </div>
            
            <button
              onClick={handleCancelMatchmaking}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.5)',
                background: 'rgba(239,68,68,0.15)',
                color: '#F87171',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
      
      {/* Swap2 Choice Modal */}
      {swap2.shouldShowChoiceModal && swap2.currentPhase && (
        <ColorChoiceModal
          phase={swap2.currentPhase as 'swap2_choice' | 'swap2_final_choice'}
          onChoice={(choice) => swap2.makeChoice(choice)}
          tentativeStones={swap2.tentativeStones}
        />
      )}
      
      {/* Game Area */}
      {gameStarted && (
        <div style={{ 
          maxWidth: 1200, 
          margin: '0 auto', 
          padding: 0,
          boxSizing: 'border-box',
          width: '100%',
          display: isMobile ? 'flex' : 'grid', 
          flexDirection: isMobile ? 'column' : undefined,
          alignItems: isMobile ? 'center' : undefined,
          gridTemplateColumns: isMobile ? undefined : '1fr auto 1fr', 
          gap: isMobile ? 12 : 20 
        }}>
          {/* Left Panel - Player X */}
          <div style={{ display: isMobile ? 'none' : 'flex', flexDirection: 'column', gap: 12, order: isMobile ? 2 : undefined }}>
            <div style={{
              padding: 16,
              borderRadius: 12,
              background: currentTurn === 'X' ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.6)',
              border: currentTurn === 'X' ? '2px solid #3B82F6' : '1px solid rgba(148,163,184,0.2)'
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                ⚫ {opponentType === 'online' && myOnlineSide === 'X' ? username : t('variant.game.playerX')}
              </div>
              {currentTurn === 'X' && (
                <div style={{ fontSize: 13, color: '#60A5FA', fontWeight: 600 }}>⚡ {t('variant.game.yourTurn')}</div>
              )}
              {timePerMove && currentTurn === 'X' && (
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: timeRemaining <= 5 ? '#EF4444' : '#E2E8F0' }}>
                  ⏱ {timeRemaining}s
                </div>
              )}
            </div>
            
            {/* Skills for Player X (Skill mode) - with mana display */}
            {variantType === 'skill' && currentTurn === 'X' && (
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8' }}>⚡ {t('variant.game.skills')}</span>
                  <span style={{ fontSize: 12, color: '#60A5FA', fontWeight: 600 }}>💧 {playerSkills.X.mana}/15</span>
                </div>
                {skillLoading ? (
                  <div style={{ textAlign: 'center', padding: 16, color: '#94A3B8' }}>Loading...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#A855F7', marginBottom: 2 }}>
                      <span>Giữ: {calculateHoldCost(heldSkillIds.X, playerSkills.X.available as GameSkill[])} mana</span>
                      <span>Giữ tối đa 3 lá</span>
                    </div>
                    {playerSkills.X.available.map(skill => {
                      const limitReached = skillsUsedThisTurn.X >= getSkillUseLimit(playerSkills.X.effects || [])
                      const cd = playerSkills.X.cooldowns[skill.id] || 0
                      const disabled = playerSkills.X.disabled[skill.id]
                      const isDisabled = cd > 0 || !!disabled || skillMode === 'block-move' || limitReached
                      const icon = getSkillIcon(skill)
                      const name = language === 'vi' ? skill.name_vi : (skill.name_en || skill.name_vi)
                      const desc = language === 'vi' ? skill.description_vi : (skill.description_en || skill.description_vi)
                      const isHeld = heldSkillIds.X.includes(skill.id)
                      const holdCost = getHoldCostForSkill(skill)
                      const manaCost = 'mana_cost' in skill ? (skill as any).mana_cost : 0
                      const baseCooldown = skill.cooldown || 0
                      return (
                        <div
                          key={skill.id}
                          role="button"
                          tabIndex={isDisabled ? -1 : 0}
                          onClick={() => !isDisabled && handleUseSkill(skill)}
                          onKeyDown={(e) => { if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) handleUseSkill(skill) }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: selectedSkill?.id === skill.id
                              ? '2px solid #A855F7'
                              : isHeld
                                ? '2px dashed #22C55E'
                                : `1px solid ${RARITY_COLORS[skill.rarity] || 'rgba(148,163,184,0.3)'}`,
                            background: isDisabled ? 'rgba(100,100,100,0.3)' : 'rgba(168,85,247,0.1)',
                            color: isDisabled ? '#666' : '#E2E8F0',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            position: 'relative',
                            opacity: isDisabled ? 0.6 : 1
                          }}
                          >
                            {isDisabled && (
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                                {disabled || cd}
                              </div>
                          )}
                          <span style={{ fontSize: 18 }}>{icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                              <span>{name}</span>
                              <span style={{ color: RARITY_COLORS[skill.rarity], fontSize: 10, textTransform: 'uppercase' }}>{skill.rarity}</span>
                            </div>
                            <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{desc}</div>
                            <div style={{ fontSize: 10, display: 'flex', gap: 8, marginBottom: 4 }}>
                              <span style={{ color: manaCost > playerSkills.X.mana ? '#F87171' : '#60A5FA' }}>💧 {manaCost}</span>
                              <span style={{ color: cd > 0 ? '#F87171' : '#94A3B8' }}>⏱️ {cd > 0 ? `${cd}/${baseCooldown}` : baseCooldown}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10, color: '#CBD5E1' }}>
                                {isHeld ? `Đang giữ (-${holdCost})` : `Giữ -${holdCost}`}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleHoldSkill(skill) }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  border: isHeld ? '1px solid #22C55E' : '1px solid rgba(148,163,184,0.4)',
                                  background: isHeld ? 'rgba(34,197,94,0.15)' : 'rgba(15,23,42,0.4)',
                                  color: isHeld ? '#22C55E' : '#E2E8F0',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: isDisabled ? 'not-allowed' : 'pointer'
                                }}
                                disabled={isDisabled}
                              >
                                {isHeld ? 'Bỏ giữ' : 'Giữ'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Center - Board */}
          <div style={{ 
            order: isMobile ? 1 : undefined, 
            width: '100%',
            maxWidth: isMobile ? '100%' : undefined,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Mobile Player Info Bar */}
            {isMobile && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: 12,
                padding: '8px 12px',
                background: 'rgba(15,23,42,0.8)',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.2)',
                width: boardPixelSize,
                maxWidth: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{ 
                  padding: '6px 12px', 
                  borderRadius: 8, 
                  background: currentTurn === 'X' ? 'rgba(59,130,246,0.2)' : 'transparent',
                  border: currentTurn === 'X' ? '2px solid #3B82F6' : '1px solid transparent'
                }}>
                  <span style={{ fontWeight: 700 }}>⚫ X</span>
                  {timePerMove && currentTurn === 'X' && (
                    <span style={{ marginLeft: 8, color: timeRemaining <= 5 ? '#EF4444' : '#60A5FA', fontWeight: 700 }}>
                      {timeRemaining}s
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, color: '#94A3B8' }}>VS</div>
                <div style={{ 
                  padding: '6px 12px', 
                  borderRadius: 8, 
                  background: currentTurn === 'O' ? 'rgba(239,68,68,0.2)' : 'transparent',
                  border: currentTurn === 'O' ? '2px solid #EF4444' : '1px solid transparent'
                }}>
                  <span style={{ fontWeight: 700 }}>⚪ O</span>
                  {timePerMove && currentTurn === 'O' && (
                    <span style={{ marginLeft: 8, color: timeRemaining <= 5 ? '#EF4444' : '#F87171', fontWeight: 700 }}>
                      {timeRemaining}s
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Swap2 Phase Indicator */}
            {swap2Enabled && swap2.isSwap2Active && (
              <div style={{ marginBottom: 12, width: '100%', maxWidth: boardPixelSize }}>
                <Swap2PhaseIndicator
                  phase={swap2.currentPhase!}
                  activePlayerName={swap2.getActivePlayerName()}
                  isCurrentUserActive={true}
                  stonesPlaced={swap2.stonesPlaced}
                  stonesRequired={swap2.stonesRequired}
                />
              </div>
            )}
            
            {/* Status */}
            <div style={{ textAlign: 'center', marginBottom: 12, width: '100%', maxWidth: boardPixelSize }}>
              {skillMode && (
                <div style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(168,85,247,0.2)', color: '#A855F7', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  <span>
                    {skillMode === 'swap-1' && `🔄 ${t('variant.game.swapFirst')}`}
                    {skillMode === 'swap-2' && `🔄 ${t('variant.game.swapSecond')}`}
                    {skillMode === 'block' && `🚫 ${t('variant.game.blockCell')}`}
                    {skillMode === 'block-move' && `🚫 ${t('variant.game.blockMove') || 'Đặt quân cờ của bạn'}`}
                    {skillMode === 'destroy' && '⚡ Chọn 1 quân địch để phá hủy'}
                    {skillMode === 'push-select' && '🌊 Chọn 1 quân địch để đẩy'}
                    {skillMode === 'push-direction' && '🌊 Chọn hướng đẩy (↑↓←→)'}
                    {skillMode === 'area' && '🎯 Chọn tâm vùng 3x3'}
                    {skillMode === 'shield' && '🛡️ Chọn 1 quân của bạn để bảo vệ'}
                    {skillMode === 'teleport-1' && '🌀 Chọn quân của bạn để di chuyển'}
                    {skillMode === 'teleport-2' && '🌀 Chọn ô trống để đặt quân'}
                    {skillMode === 'clone' && '👥 Chọn ô trống gần quân của bạn'}
                    {skillMode === 'bomb' && '💣 Chọn tâm vùng nổ 3x3'}
                    {skillMode === 'fake' && '👻 Chọn ô để đặt quân giả'}
                    {skillMode === 'reflect-trap' && '🪤 Chọn ô để đặt bẫy phản'}
                  </span>
                  {skillMode !== 'block-move' && (
                    <button
                      onClick={() => {
                        setSkillMode(null)
                        setSelectedSkill(null)
                        setSwapFirst(null)
                      }}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(239,68,68,0.5)',
                        background: 'rgba(239,68,68,0.2)',
                        color: '#F87171',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      Hủy
                    </button>
                  )}
                </div>
              )}
              {extraTurn && (
                <div style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(234,179,8,0.2)', color: '#F59E0B', fontWeight: 700, display: 'inline-block' }}>
                  ✌️ {t('variant.game.extraTurn')}
                </div>
              )}
              
              {/* End Turn Button - CHỈ hiện cho mode SKILL khi đã đánh quân hoặc hết thời gian */}
              {/* Các mode khác (custom, hidden, terrain) tự động qua lượt khi đặt quân */}
              {gameStarted && !winner && !isDraw && !skillMode && variantType === 'skill' && (hasMovedThisTurn || timeRemaining <= 0) && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={handleEndTurn}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    ➡️ Qua lượt
                  </button>
                </div>
              )}
              
              {/* Terrain Event Notification - shows when hidden terrain is triggered */}
              {terrainNotification && (
                <div style={{ 
                  padding: '10px 20px', 
                  borderRadius: 10, 
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))', 
                  border: '2px solid rgba(139,92,246,0.5)',
                  color: '#E2E8F0', 
                  fontWeight: 700, 
                  fontSize: 16,
                  display: 'inline-block',
                  animation: 'pulse 0.5s ease-in-out',
                  marginTop: 8
                }}>
                  🎲 {terrainNotification}
                </div>
              )}
              
              {/* Frozen Player Indicator */}
              {frozenPlayer && (
                <div style={{ 
                  padding: '8px 16px', 
                  borderRadius: 8, 
                  background: 'rgba(147,197,253,0.2)', 
                  border: '1px solid rgba(147,197,253,0.5)',
                  color: '#93C5FD', 
                  fontWeight: 700, 
                  display: 'inline-block',
                  marginTop: 8
                }}>
                  ❄️ {frozenPlayer === 'X' ? t('variant.game.playerX') : t('variant.game.playerO')} bị đóng băng!
                </div>
              )}
            </div>
            
            {/* Board Grid - PlayOK style responsive */}
            <div 
              ref={boardRef}
              style={{
                width: boardPixelSize,
                height: boardPixelSize,
                display: 'grid',
                gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
                gridTemplateRows: `repeat(${boardSize}, 1fr)`,
                background: 'linear-gradient(135deg, #d4a574, #c49563)',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                position: 'relative',
                touchAction: 'none',
                userSelect: 'none',
                margin: '0 auto'
              }}>
              {/* Grid lines overlay - cell borders style (like Hotseat) */}
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
                <svg width="100%" height="100%" style={{ position: 'absolute' }}>
                  {/* Vertical lines - cell borders */}
                  {Array.from({ length: boardSize + 1 }).map((_, i) => (
                    <line
                      key={`v${i}`}
                      x1={`${i * (100 / boardSize)}%`}
                      y1="0%"
                      x2={`${i * (100 / boardSize)}%`}
                      y2="100%"
                      stroke="#8b6f47"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Horizontal lines - cell borders */}
                  {Array.from({ length: boardSize + 1 }).map((_, i) => (
                    <line
                      key={`h${i}`}
                      x1="0%"
                      y1={`${i * (100 / boardSize)}%`}
                      x2="100%"
                      y2={`${i * (100 / boardSize)}%`}
                      stroke="#8b6f47"
                      strokeWidth="1"
                    />
                  ))}
                  {/* Star points - at cell centers */}
                  {boardSize === 15 && [[3,3],[3,11],[11,3],[11,11],[7,7],[3,7],[11,7],[7,3],[7,11]].map(([sx, sy]) => (
                    <circle
                      key={`star${sx}${sy}`}
                      cx={`${(sx + 0.5) * (100 / boardSize)}%`}
                      cy={`${(sy + 0.5) * (100 / boardSize)}%`}
                      r="3"
                      fill="#8b6f47"
                    />
                  ))}
                </svg>
              </div>
              {board.map((row, y) =>
                row.map((cell, x) => {
                  const isLastMove = moveHistory.length > 0 && 
                    moveHistory[moveHistory.length - 1].x === x && 
                    moveHistory[moveHistory.length - 1].y === y
                  
                  const showPiece = cell.player && (!cell.hidden || revealTurns > 0)
                  
                  // Terrain background - only show if revealed (ALL terrain hidden until stepped on)
                  let bgColor = '#d4a84b'
                  const showTerrain = cell.terrainRevealed
                  if (showTerrain && cell.terrain !== 'normal') {
                    const terrainInfo = TERRAIN_TYPES.find(t => t.type === cell.terrain)
                    if (terrainInfo) bgColor = terrainInfo.color
                  }
                  
                  const isTapHighlighted = tapHighlight && tapHighlight.x === x && tapHighlight.y === y
                  
                  // Determine if cell is clickable based on current mode
                  // - Normal mode: only empty cells (not blocked)
                  // - Skill modes that target enemy pieces: destroy, push, convert, immobilize
                  // - Skill modes that target own pieces: shield, teleport, clone, swap
                  // - Skill modes that target any cell: area, block, fake
                  const enemySide = currentTurn === 'X' ? 'O' : 'X'
                  const isSkillTargetMode = ['destroy', 'push-select', 'push-direction', 'shield', 'teleport-1', 'teleport-2', 'clone', 'swap-1', 'swap-2', 'area', 'block', 'fake', 'reflect-trap', 'bomb'].includes(skillMode || '')
                  const isEnemyTargetMode = ['destroy', 'push-select'].includes(skillMode || '')
                  const isDirectionMode = skillMode === 'push-direction'
                  const isOwnTargetMode = ['shield', 'teleport-1', 'clone', 'reflect-trap'].includes(skillMode || '')
                  const isAnyTargetMode = ['area', 'block', 'fake', 'bomb', 'swap-1', 'swap-2', 'teleport-2'].includes(skillMode || '')
                  
                  let canClick = false
                  let shouldHighlight = false // Separate flag for visual highlight
                  if (isSkillTargetMode) {
                    if (isEnemyTargetMode && cell.player === enemySide && !cell.shielded) {
                      canClick = true // Can click enemy pieces for destroy/push-select
                      shouldHighlight = true
                    } else if (isDirectionMode && pushTarget) {
                      // Push direction mode - highlight 4 directions from target
                      const isDirectionCell = (x === pushTarget.x && y !== pushTarget.y) || (y === pushTarget.y && x !== pushTarget.x)
                      canClick = true // Allow click anywhere to select direction
                      shouldHighlight = isDirectionCell
                    } else if (isOwnTargetMode && cell.player === currentTurn) {
                      canClick = true // Can click own pieces for shield/teleport/clone
                      shouldHighlight = true
                    } else if (isAnyTargetMode) {
                      // For area/bomb modes, only highlight empty cells or cells without shield
                      const isValidTarget = skillMode === 'block' || skillMode === 'fake' || skillMode === 'reflect-trap'
                        ? cell.player === null && cell.terrain !== 'block' // Empty cells only
                        : true // Area/bomb can target any cell
                      canClick = true // Allow click anywhere for area selection
                      shouldHighlight = isValidTarget && (skillMode === 'area' || skillMode === 'bomb') // Only highlight center candidates
                    } else if (skillMode === 'swap-1' || skillMode === 'swap-2') {
                      canClick = cell.player !== null // Can click any piece for swap
                      shouldHighlight = cell.player !== null
                    }
                  } else {
                    // Normal mode - only empty cells that aren't blocked
                    canClick = !cell.player && !(cell.terrain === 'block' && cell.terrainRevealed)
                  }
                  
                  return (
                    <div
                      key={`${x}-${y}`}
                      onClick={() => {
                        // Always allow click in skill target mode, let handleCellClick validate
                        if (!canClick && !isSkillTargetMode) return
                        setTapHighlight({ x, y })
                        setTimeout(() => setTapHighlight(null), 200)
                        handleCellClick(x, y)
                      }}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: showTerrain && cell.terrain !== 'normal' ? bgColor : 'transparent',
                        cursor: canClick ? 'pointer' : 'default',
                        zIndex: 2
                      }}
                    >
                      {/* Skill target highlight - show which cells can be clicked */}
                      {isSkillTargetMode && shouldHighlight && (
                        <div style={{
                          position: 'absolute',
                          inset: 2,
                          background: isEnemyTargetMode ? 'rgba(239, 68, 68, 0.4)' : isOwnTargetMode ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.3)',
                          borderRadius: 4,
                          border: `2px dashed ${isEnemyTargetMode ? '#EF4444' : isOwnTargetMode ? '#22C55E' : '#3B82F6'}`,
                          pointerEvents: 'none',
                          animation: 'pulse 1s infinite'
                        }} />
                      )}
                      
                      {/* Last move highlight */}
                      {isLastMove && !isSkillTargetMode && (
                        <div style={{
                          position: 'absolute',
                          inset: 2,
                          background: 'rgba(34, 197, 94, 0.3)',
                          borderRadius: 4,
                          pointerEvents: 'none'
                        }} />
                      )}
                      
                      {/* Tap highlight */}
                      {isTapHighlighted && (
                        <div style={{
                          position: 'absolute',
                          width: cellSize * 0.6,
                          height: cellSize * 0.6,
                          borderRadius: '50%',
                          border: '2px solid rgba(59, 130, 246, 0.8)',
                          animation: 'tapPulse 0.3s ease-out',
                          pointerEvents: 'none'
                        }} />
                      )}
                      {/* Terrain icon - HIDDEN until revealed (except block) */}
                      {!cell.player && cell.terrain !== 'normal' && showTerrain && (
                        <span style={{ 
                          position: 'absolute',
                          fontSize: cellSize * 0.4, 
                          opacity: 0.6,
                          pointerEvents: 'none'
                        }}>
                          {TERRAIN_TYPES.find(t => t.type === cell.terrain)?.icon || '❓'}
                        </span>
                      )}
                      
                      {/* Hidden terrain - NO indicator, looks like normal empty cell */}
                      
                      {/* Push target highlight */}
                      {pushTarget && pushTarget.x === x && pushTarget.y === y && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(6, 182, 212, 0.5)',
                          borderRadius: 4,
                          border: '3px solid #06B6D4',
                          pointerEvents: 'none',
                          animation: 'pulse 0.8s infinite'
                        }} />
                      )}
                      
                      {/* Wave animation for push skill */}
                      {waveAnimation && waveAnimation.x === x && waveAnimation.y === y && (
                        <div style={{
                          position: 'absolute',
                          fontSize: cellSize * 0.8,
                          animation: `waveMove${waveAnimation.direction} 1.5s ease-out`,
                          pointerEvents: 'none',
                          zIndex: 10
                        }}>
                          🌊
                        </div>
                      )}
                      
                      {/* Piece */}
                      {showPiece && (
                        <div style={{
                          position: 'absolute',
                          width: cellSize * 0.7,
                          height: cellSize * 0.7,
                          borderRadius: '50%',
                          background: cell.player === 'X'
                            ? 'radial-gradient(circle at 30% 30%, #4a4a4a, #000)'
                            : 'radial-gradient(circle at 30% 30%, #fff, #d1d1d1)',
                          border: `2px solid ${cell.player === 'X' ? '#3B82F6' : '#EF4444'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: cellSize * 0.35,
                          fontWeight: 800,
                          color: cell.player === 'X' ? '#fff' : '#000',
                          opacity: cell.hidden && revealTurns > 0 ? 0.5 : 1,
                          boxShadow: isLastMove ? '0 0 10px rgba(34,197,94,0.5)' : 'none'
                        }}>
                          {cell.player}
                        </div>
                      )}
                      
                      {/* Tentative stone during Swap2 */}
                      {swap2Enabled && swap2.isSwap2Active && (() => {
                        const tentative = swap2.tentativeStones.find(s => s.x === x && s.y === y)
                        if (!tentative) return null
                        const isBlack = tentative.placementOrder === 1 || tentative.placementOrder === 3 || tentative.placementOrder === 4
                        return (
                          <div style={{
                            position: 'absolute',
                            width: cellSize * 0.7,
                            height: cellSize * 0.7,
                            borderRadius: '50%',
                            background: isBlack
                              ? 'radial-gradient(circle at 30% 30%, #4a4a4a, #000)'
                              : 'radial-gradient(circle at 30% 30%, #fff, #d1d1d1)',
                            border: `3px dashed ${isBlack ? '#22D3EE' : '#F59E0B'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: cellSize * 0.35,
                            fontWeight: 800,
                            color: isBlack ? '#fff' : '#000',
                            opacity: 0.8
                          }}>
                            {tentative.placementOrder}
                          </div>
                        )
                      })()}
                      
                      {/* Hidden piece indicator */}
                      {cell.player && cell.hidden && revealTurns === 0 && (
                        <div style={{
                          position: 'absolute',
                          width: cellSize * 0.5,
                          height: cellSize * 0.5,
                          borderRadius: '50%',
                          background: 'rgba(148,163,184,0.3)',
                          border: '2px dashed rgba(148,163,184,0.5)'
                        }} />
                      )}
                      
                      {/* Move index */}
                      {showPiece && cell.moveIndex && cellSize >= 30 && (
                        <span style={{
                          position: 'absolute',
                          bottom: 1,
                          right: 2,
                          fontSize: 8,
                          color: 'rgba(148,163,184,0.6)'
                        }}>
                          {cell.moveIndex}
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            
            <style>{`
              @keyframes tapPulse {
                0% { transform: scale(1); opacity: 0.8; }
                100% { transform: scale(1.5); opacity: 0; }
              }
            `}</style>
            
            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16, width: '100%', maxWidth: boardPixelSize }}>
              <button
                onClick={() => { setShowSetup(true); setGameStarted(false) }}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'transparent',
                  color: '#94A3B8',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⚙️ {t('variant.game.settings')}
              </button>
              <button
                onClick={initializeBoard}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🔄 {t('variant.game.newGame')}
              </button>
            </div>
          </div>
          
          {/* Right Panel - Player O */}
          <div style={{ display: isMobile ? 'none' : 'flex', flexDirection: 'column', gap: 12, order: isMobile ? 3 : undefined }}>
            <div style={{
              padding: 16,
              borderRadius: 12,
              background: currentTurn === 'O' ? 'rgba(239,68,68,0.15)' : 'rgba(15,23,42,0.6)',
              border: currentTurn === 'O' ? '2px solid #EF4444' : '1px solid rgba(148,163,184,0.2)'
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                ⚪ {opponentType === 'online' 
                  ? (myOnlineSide === 'O' ? username : onlineOpponentName || t('variant.game.playerO'))
                  : t('variant.game.playerO')}
              </div>
              {currentTurn === 'O' && (
                <div style={{ fontSize: 13, color: '#F87171', fontWeight: 600 }}>
                  {opponentType === 'online' && myOnlineSide !== 'O' 
                    ? `🤔 ${t('variant.game.thinking')}`
                    : `⚡ ${t('variant.game.yourTurn')}`}
                </div>
              )}
              {timePerMove && currentTurn === 'O' && (opponentType === 'local' || (opponentType === 'online' && myOnlineSide === 'O')) && (
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, color: timeRemaining <= 5 ? '#EF4444' : '#E2E8F0' }}>
                  ⏱ {timeRemaining}s
                </div>
              )}
            </div>
            
            {/* Skills for Player O (Skill mode, local only) - with mana display */}
            {variantType === 'skill' && currentTurn === 'O' && opponentType === 'local' && (
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8' }}>⚡ {t('variant.game.skills')}</span>
                  <span style={{ fontSize: 12, color: '#F87171', fontWeight: 600 }}>💧 {playerSkills.O.mana}/15</span>
                </div>
                {skillLoading ? (
                  <div style={{ textAlign: 'center', padding: 16, color: '#94A3B8' }}>Loading...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#F87171', marginBottom: 2 }}>
                      <span>Giữ: {calculateHoldCost(heldSkillIds.O, playerSkills.O.available as GameSkill[])} mana</span>
                      <span>Giữ tối đa 3 lá</span>
                    </div>
                    {playerSkills.O.available.map(skill => {
                      const limitReached = skillsUsedThisTurn.O >= getSkillUseLimit(playerSkills.O.effects || [])
                      const cd = playerSkills.O.cooldowns[skill.id] || 0
                      const disabled = playerSkills.O.disabled[skill.id]
                      const isDisabled = cd > 0 || !!disabled || skillMode === 'block-move' || limitReached
                      const icon = getSkillIcon(skill)
                      const name = language === 'vi' ? skill.name_vi : (skill.name_en || skill.name_vi)
                      const desc = language === 'vi' ? skill.description_vi : (skill.description_en || skill.description_vi)
                      const isHeld = heldSkillIds.O.includes(skill.id)
                      const holdCost = getHoldCostForSkill(skill)
                      const manaCost = 'mana_cost' in skill ? (skill as any).mana_cost : 0
                      const baseCooldown = skill.cooldown || 0
                      return (
                        <div
                          key={skill.id}
                          role="button"
                          tabIndex={isDisabled ? -1 : 0}
                          onClick={() => !isDisabled && handleUseSkill(skill)}
                          onKeyDown={(e) => { if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) handleUseSkill(skill) }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: selectedSkill?.id === skill.id
                              ? '2px solid #A855F7'
                              : isHeld
                                ? '2px dashed #22C55E'
                                : `1px solid ${RARITY_COLORS[skill.rarity] || 'rgba(148,163,184,0.3)'}`,
                            background: isDisabled ? 'rgba(100,100,100,0.3)' : 'rgba(168,85,247,0.1)',
                            color: isDisabled ? '#666' : '#E2E8F0',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            position: 'relative',
                            opacity: isDisabled ? 0.6 : 1
                          }}
                        >
                          {isDisabled && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                              {disabled || cd}
                            </div>
                          )}
                          <span style={{ fontSize: 18 }}>{icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                              <span>{name}</span>
                              <span style={{ color: RARITY_COLORS[skill.rarity], fontSize: 10, textTransform: 'uppercase' }}>{skill.rarity}</span>
                            </div>
                            <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{desc}</div>
                            <div style={{ fontSize: 10, display: 'flex', gap: 8, marginBottom: 4 }}>
                              <span style={{ color: manaCost > playerSkills.O.mana ? '#F87171' : '#60A5FA' }}>💧 {manaCost}</span>
                              <span style={{ color: cd > 0 ? '#F87171' : '#94A3B8' }}>⏱️ {cd > 0 ? `${cd}/${baseCooldown}` : baseCooldown}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10, color: '#CBD5E1' }}>
                                {isHeld ? `Đang giữ (-${holdCost})` : `Giữ -${holdCost}`}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleHoldSkill(skill) }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  border: isHeld ? '1px solid #22C55E' : '1px solid rgba(148,163,184,0.4)',
                                  background: isHeld ? 'rgba(34,197,94,0.15)' : 'rgba(15,23,42,0.4)',
                                  color: isHeld ? '#22C55E' : '#E2E8F0',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: isDisabled ? 'not-allowed' : 'pointer'
                                }}
                                disabled={isDisabled}
                              >
                                {isHeld ? 'Bỏ giữ' : 'Giữ'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            
            {/* Game Info */}
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#94A3B8' }}>📊 {t('variant.game.info')}</div>
              <div style={{ fontSize: 12, color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>{t('variant.game.board')}: {boardSize}x{boardSize}</div>
                <div>{t('variant.game.win')}: {variantType === 'terrain' ? 'Tính điểm' : winLength}</div>
                <div>{t('variant.game.turn')}: {moveHistory.length}</div>
                <div>{t('variant.game.mode')}: {getVariantLabel(variantType).name}</div>
              </div>
            </div>
            
            {/* Terrain Score Explanation Panel */}
            {variantType === 'terrain' && (
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#A78BFA' }}>📖 Cách tính điểm</div>
                <div style={{ fontSize: 11, color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ padding: '4px 8px', background: 'rgba(15,23,42,0.5)', borderRadius: 6 }}>
                    <span style={{ color: '#10B981' }}>●</span> Hàng n quân = n điểm
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>VD: xxx = 3đ, oo = 2đ</div>
                  </div>
                  <div style={{ padding: '4px 8px', background: 'rgba(15,23,42,0.5)', borderRadius: 6 }}>
                    <span style={{ color: '#F59E0B' }}>●</span> Giao nhau = x2 điểm
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>VD: + (3+3)×2 = 12đ</div>
                  </div>
                </div>
                
                {/* Live score breakdown */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(139,92,246,0.2)' }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>Chi tiết điểm:</div>
                  
                  {/* Player X breakdown */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#60A5FA', fontWeight: 600 }}>⚫ X: {terrainScores.X.total}đ</div>
                    {terrainScores.X.chains.length > 0 && (
                      <div style={{ fontSize: 10, color: '#94A3B8', marginLeft: 12 }}>
                        {terrainScores.X.chains.map((c, i) => `${c.length}`).join(' + ')} = {terrainScores.X.chains.reduce((s, c) => s + c.length, 0)}đ
                        {terrainScores.X.intersections.length > 0 && (
                          <span style={{ color: '#F59E0B' }}> +{terrainScores.X.intersections.reduce((s, i) => s + i.bonus, 0)}đ (x2)</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Player O breakdown */}
                  <div>
                    <div style={{ fontSize: 11, color: '#F87171', fontWeight: 600 }}>⚪ O: {terrainScores.O.total}đ</div>
                    {terrainScores.O.chains.length > 0 && (
                      <div style={{ fontSize: 10, color: '#94A3B8', marginLeft: 12 }}>
                        {terrainScores.O.chains.map((c, i) => `${c.length}`).join(' + ')} = {terrainScores.O.chains.reduce((s, c) => s + c.length, 0)}đ
                        {terrainScores.O.intersections.length > 0 && (
                          <span style={{ color: '#F59E0B' }}> +{terrainScores.O.intersections.reduce((s, i) => s + i.bonus, 0)}đ (x2)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Winner/Draw Modal */}
      {(winner || isDraw) && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            borderRadius: 20,
            padding: 32,
            textAlign: 'center',
            border: `2px solid ${winner === 'X' ? '#3B82F6' : winner === 'O' ? '#EF4444' : '#F59E0B'}`
          }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>
              {isDraw ? '🤝' : winner === 'X' ? '🏆' : '🎉'}
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800 }}>
              {isDraw ? t('variant.end.draw') : `${winner === 'X' ? t('variant.game.playerX') : t('variant.game.playerO')} ${t('variant.end.win')}`}
            </h2>
            
            {/* Terrain mode: show final scores */}
            {variantType === 'terrain' && (
              <div style={{ 
                margin: '16px 0', 
                padding: '16px', 
                borderRadius: 12, 
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.2)'
              }}>
                <div style={{ fontSize: 14, color: '#94A3B8', marginBottom: 8 }}>📊 Kết quả điểm số</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#60A5FA' }}>{terrainScores.X.total}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>⚫ X ({terrainScores.X.chains.length} hàng)</div>
                    {terrainScores.X.bonusPoints > 0 && (
                      <div style={{ fontSize: 11, color: '#22C55E' }}>+{terrainScores.X.bonusPoints} giao điểm</div>
                    )}
                    {terrainTileBonus.X > 0 && (
                      <div style={{ fontSize: 11, color: '#A855F7' }}>+{terrainTileBonus.X} 💎 ô đặc biệt</div>
                    )}
                  </div>
                  <div style={{ fontSize: 24, color: '#475569', alignSelf: 'center' }}>vs</div>
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#F87171' }}>{terrainScores.O.total}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>⚪ O ({terrainScores.O.chains.length} hàng)</div>
                    {terrainScores.O.bonusPoints > 0 && (
                      <div style={{ fontSize: 11, color: '#22C55E' }}>+{terrainScores.O.bonusPoints} giao điểm</div>
                    )}
                    {terrainTileBonus.O > 0 && (
                      <div style={{ fontSize: 11, color: '#A855F7' }}>+{terrainTileBonus.O} 💎 ô đặc biệt</div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <p style={{ margin: '0 0 24px', color: '#94A3B8' }}>
              {isDraw ? t('variant.end.drawDesc') : (
                variantType === 'terrain' 
                  ? `Thắng với ${winner === 'X' ? terrainScores.X.total : terrainScores.O.total} điểm!`
                  : t('variant.end.movesCount', { count: moveHistory.length })
              )}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => { setShowSetup(true); setGameStarted(false); setWinner(null); setIsDraw(false) }}
                style={{
                  padding: '12px 24px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'transparent',
                  color: '#94A3B8',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ⚙️ {t('variant.end.changeSettings')}
              </button>
              <button
                onClick={() => { initializeBoard(); setWinner(null); setIsDraw(false) }}
                style={{
                  padding: '12px 24px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🔄 {t('variant.end.playAgain')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Deck Selector Modal */}
      {showDeckSelector && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 700,
            width: '95%',
            maxHeight: '90vh',
            overflow: 'auto',
            border: `2px solid ${deckSelectingFor === 'X' ? 'rgba(59,130,246,0.5)' : 'rgba(239,68,68,0.5)'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: deckSelectingFor === 'X' ? '#60A5FA' : '#F87171' }}>
                🃏 {t('variant.setup.selectDeckFor') || 'Chọn Deck cho'} {deckSelectingFor === 'X' ? t('variant.game.playerX') : t('variant.game.playerO')}
              </h2>
              <span style={{ 
                padding: '6px 12px', 
                borderRadius: 8, 
                background: (deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO).length >= 15 ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)',
                color: (deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO).length >= 15 ? '#22C55E' : '#F59E0B',
                fontWeight: 700,
                fontSize: 14
              }}>
                {(deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO).length}/15
              </span>
            </div>
            
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94A3B8' }}>
              {t('variant.setup.deckDesc') || 'Chọn 15 lá skill để tạo bộ bài. Mỗi lượt sẽ random 3 lá từ bộ bài này.'}
            </p>
            
            {/* Selected deck preview */}
            <div style={{ 
              marginBottom: 16, 
              padding: '12px', 
              borderRadius: 10, 
              background: 'rgba(15,23,42,0.6)',
              border: '1px solid rgba(148,163,184,0.2)'
            }}>
              <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>
                {t('variant.setup.selectedCards') || 'Đã chọn'}:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 40 }}>
                {(deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO).map(skill => (
                  <button
                    key={skill.id}
                    onClick={() => {
                      if (deckSelectingFor === 'X') {
                        setSelectedDeckX(prev => prev.filter(s => s.id !== skill.id))
                      } else {
                        setSelectedDeckO(prev => prev.filter(s => s.id !== skill.id))
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: `1px solid ${RARITY_COLORS[skill.rarity]}`,
                      background: 'rgba(15,23,42,0.8)',
                      color: '#E2E8F0',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title={`${skill.name_vi} - Click để bỏ`}
                  >
                    <span>{getSkillIcon(skill)}</span>
                    <span style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name_vi}</span>
                    <span style={{ color: '#EF4444', marginLeft: 2 }}>×</span>
                  </button>
                ))}
                {(deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO).length === 0 && (
                  <span style={{ color: '#64748B', fontSize: 12 }}>{t('variant.setup.noCardsSelected') || 'Chưa chọn lá nào'}</span>
                )}
              </div>
            </div>
            
            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => {
                  // Random 15 skills từ skill đã unlock
                  const availablePool = unlockedSkills.length > 0 ? unlockedSkills : LOCAL_SKILLS.filter(s => s.is_starter)
                  const shuffled = [...availablePool].sort(() => Math.random() - 0.5).slice(0, 15)
                  if (deckSelectingFor === 'X') {
                    setSelectedDeckX(shuffled)
                  } else {
                    setSelectedDeckO(shuffled)
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(168,85,247,0.5)',
                  background: 'rgba(168,85,247,0.15)',
                  color: '#A855F7',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🎲 {t('variant.setup.randomDeck') || 'Random 15 lá'}
              </button>
              <button
                onClick={() => {
                  if (deckSelectingFor === 'X') {
                    setSelectedDeckX([])
                  } else {
                    setSelectedDeckO([])
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.5)',
                  background: 'rgba(239,68,68,0.15)',
                  color: '#F87171',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🗑️ {t('variant.setup.clearDeck') || 'Xóa hết'}
              </button>
              <button
                onClick={() => {
                  // Select all starter skills first từ pool đã unlock
                  const availablePool = unlockedSkills.length > 0 ? unlockedSkills : LOCAL_SKILLS.filter(s => s.is_starter)
                  const starters = availablePool.filter(s => s.is_starter)
                  const nonStarters = availablePool.filter(s => !s.is_starter).sort(() => Math.random() - 0.5)
                  const balanced = [...starters, ...nonStarters].slice(0, 15)
                  if (deckSelectingFor === 'X') {
                    setSelectedDeckX(balanced)
                  } else {
                    setSelectedDeckO(balanced)
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(34,197,94,0.5)',
                  background: 'rgba(34,197,94,0.15)',
                  color: '#22C55E',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⚖️ {t('variant.setup.balancedDeck') || 'Deck cân bằng'}
              </button>
            </div>
            
            {/* Info về skill đã unlock */}
            <div style={{ 
              marginBottom: 12, 
              padding: '8px 12px', 
              borderRadius: 8, 
              background: 'rgba(168,85,247,0.1)', 
              border: '1px solid rgba(168,85,247,0.3)',
              fontSize: 12,
              color: '#A855F7'
            }}>
              {loadingSkills ? '⏳ Đang tải skill đã sưu tầm...' : 
                `🎴 Bạn có ${unlockedSkills.length > 0 ? unlockedSkills.length : LOCAL_SKILLS.filter(s => s.is_starter).length}/${LOCAL_SKILLS.length} skill. Mua gói skill trong Shop để mở thêm!`}
            </div>
            
            {/* Skills grid - chỉ hiển thị skill đã unlock */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: 8,
              maxHeight: 400,
              overflow: 'auto',
              padding: 4
            }}>
              {/* Hiển thị skills đã unlock (hoặc starter skills nếu chưa có) */}
              {(unlockedSkills.length > 0 ? unlockedSkills : LOCAL_SKILLS.filter(s => s.is_starter)).map(skill => {
                const isUnlocked = true // Chỉ hiển thị skills đã unlock nên luôn true
                const currentDeck = deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO
                const isSelected = currentDeck.some(s => s.id === skill.id)
                const isFull = currentDeck.length >= 15
                const isDisabled = (!isSelected && isFull) || !isUnlocked
                
                return (
                  <button
                    key={skill.id}
                    onClick={() => {
                      if (!isUnlocked) return
                      if (isSelected) {
                        if (deckSelectingFor === 'X') {
                          setSelectedDeckX(prev => prev.filter(s => s.id !== skill.id))
                        } else {
                          setSelectedDeckO(prev => prev.filter(s => s.id !== skill.id))
                        }
                      } else if (!isFull) {
                        if (deckSelectingFor === 'X') {
                          setSelectedDeckX(prev => [...prev, skill])
                        } else {
                          setSelectedDeckO(prev => [...prev, skill])
                        }
                      }
                    }}
                    disabled={isDisabled}
                    style={{
                      padding: '10px',
                      borderRadius: 10,
                      border: isSelected 
                        ? `2px solid ${RARITY_COLORS[skill.rarity]}` 
                        : !isUnlocked ? '1px solid rgba(100,100,100,0.3)' : '1px solid rgba(148,163,184,0.2)',
                      background: isSelected 
                        ? `${RARITY_COLORS[skill.rarity]}20` 
                        : !isUnlocked ? 'rgba(50,50,50,0.4)' : 'rgba(15,23,42,0.6)',
                      color: !isUnlocked ? '#666' : '#E2E8F0',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      opacity: isDisabled ? 0.5 : 1,
                      position: 'relative'
                    }}
                  >
                    {/* Skill đã unlock - không cần icon khóa */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#22C55E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12
                      }}>✓</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20, filter: !isUnlocked ? 'grayscale(1)' : 'none' }}>{getSkillIcon(skill)}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{skill.name_vi}</div>
                        <div style={{ fontSize: 10, color: !isUnlocked ? '#666' : RARITY_COLORS[skill.rarity], textTransform: 'uppercase' }}>
                          {skill.rarity} • {skill.category === 'attack' ? '⚔️' : skill.category === 'defense' ? '🛡️' : skill.category === 'utility' ? '🔧' : '✨'}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: !isUnlocked ? '#555' : '#94A3B8', lineHeight: 1.3 }}>
                      {!isUnlocked ? 'Mua gói skill để mở khóa' : skill.description_vi}
                    </div>
                    <div style={{ fontSize: 9, color: '#64748B', marginTop: 4 }}>
                      CD: {skill.cooldown} lượt
                    </div>
                  </button>
                )
              })}
            </div>
            
            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => setShowDeckSelector(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'transparent',
                  color: '#94A3B8',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => setShowDeckSelector(false)}
                disabled={(deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO).length < 15}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  background: (deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO).length >= 15 
                    ? 'linear-gradient(135deg, #22C55E, #16A34A)' 
                    : 'rgba(100,100,100,0.3)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: (deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO).length >= 15 ? 'pointer' : 'not-allowed'
                }}
              >
                ✓ {t('variant.setup.confirmDeck') || 'Xác nhận'} ({(deckSelectingFor === 'X' ? selectedDeckX : selectedDeckO).length}/15)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
