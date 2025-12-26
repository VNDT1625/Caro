import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'

export interface BoardCell {
  player: 'X' | 'O' | null
  moveIndex?: number | null
  // For variant modes
  hidden?: boolean
  terrain?: string
  terrainRevealed?: boolean
  frozen?: number
  shielded?: boolean
}

export interface PieceSkinConfig {
  black_stone?: string // URL to black stone image
  white_stone?: string // URL to white stone image
  stone?: string // Shared stone image for both colors
  black_color?: string // Fallback color for black
  white_color?: string // Fallback color for white
}

export interface BoardSkinConfig {
  background?: string // URL to background image or color
  grid_color?: string
  star_color?: string
  border_color?: string
}

export interface GomokuBoardProps {
  boardSize: number
  board: BoardCell[][] | (null | 'X' | 'O')[][]
  currentTurn: 'X' | 'O'
  playerSymbol?: 'X' | 'O'
  lastMove?: { x: number; y: number } | null
  onCellClick: (x: number, y: number) => void
  disabled?: boolean
  showMoveIndex?: boolean
  // Swap2 support
  tentativeStones?: Array<{ x: number; y: number; placementOrder: number }>
  // Magnifier
  enableMagnifier?: boolean
  // Theme
  theme?: 'wood' | 'dark' | 'light'
  // Custom cell renderer
  renderCellOverlay?: (x: number, y: number, cell: BoardCell) => React.ReactNode
  // Skin customization
  pieceSkin?: PieceSkinConfig
  boardSkin?: BoardSkinConfig
}

// Hook to get viewport size
const useViewportSize = () => {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  
  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  return size
}

export default function GomokuBoard({
  boardSize,
  board,
  currentTurn,
  playerSymbol,
  lastMove,
  onCellClick,
  disabled = false,
  showMoveIndex = false,
  tentativeStones = [],
  enableMagnifier = true,
  theme = 'wood',
  renderCellOverlay,
  pieceSkin,
  boardSkin
}: GomokuBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { width: vw, height: vh } = useViewportSize()
  
  // Magnifier state
  const [magnifier, setMagnifier] = useState<{ x: number; y: number; cellX: number; cellY: number } | null>(null)
  const [tapHighlight, setTapHighlight] = useState<{ x: number; y: number } | null>(null)
  
  // Skin image cache
  const [skinImages, setSkinImages] = useState<{ black?: HTMLImageElement; white?: HTMLImageElement }>({})
  
  // Load skin images when pieceSkin changes
  useEffect(() => {
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
      })
    }
    
    const loadSkins = async () => {
      const sharedStone = pieceSkin?.stone || pieceSkin?.black_stone || pieceSkin?.white_stone
      const blackUrl = pieceSkin?.black_stone || sharedStone
      const whiteUrl = pieceSkin?.white_stone || sharedStone
      
      const newImages: { black?: HTMLImageElement; white?: HTMLImageElement } = {}
      
      if (blackUrl) {
        try {
          newImages.black = await loadImage(blackUrl)
        } catch (e) {
          console.warn('[GomokuBoard] Failed to load black stone skin:', blackUrl)
        }
      }
      
      if (whiteUrl) {
        try {
          newImages.white = await loadImage(whiteUrl)
        } catch (e) {
          console.warn('[GomokuBoard] Failed to load white stone skin:', whiteUrl)
        }
      }
      
      setSkinImages(newImages)
    }
    
    if (pieceSkin?.black_stone || pieceSkin?.white_stone || pieceSkin?.stone) {
      loadSkins()
    } else {
      setSkinImages({})
    }
  }, [pieceSkin?.black_stone, pieceSkin?.white_stone, pieceSkin?.stone])
  
  // Calculate board size to fit viewport (1:1 square, smaller dimension)
  const boardPixelSize = useMemo(() => {
    const padding = 32 // padding around board
    const maxSize = Math.min(vw - padding, vh - 200) // leave space for UI
    return Math.max(280, Math.min(600, maxSize))
  }, [vw, vh])
  
  const cellSize = boardPixelSize / boardSize
  const stoneRadius = cellSize * 0.42
  
  // Theme colors
  const colors = useMemo(() => {
    switch (theme) {
      case 'dark':
        return {
          bg: '#1e293b',
          grid: 'rgba(148, 163, 184, 0.4)',
          gridStrong: 'rgba(148, 163, 184, 0.6)',
          black: '#000',
          white: '#fff',
          lastMove: 'rgba(34, 197, 94, 0.5)',
          highlight: 'rgba(59, 130, 246, 0.3)'
        }
      case 'light':
        return {
          bg: '#f5f5dc',
          grid: 'rgba(0, 0, 0, 0.3)',
          gridStrong: 'rgba(0, 0, 0, 0.5)',
          black: '#000',
          white: '#fff',
          lastMove: 'rgba(34, 197, 94, 0.5)',
          highlight: 'rgba(59, 130, 246, 0.3)'
        }
      default: // wood
        return {
          bg: '#d4a84b',
          grid: 'rgba(0, 0, 0, 0.35)',
          gridStrong: 'rgba(0, 0, 0, 0.5)',
          black: '#1a1a1a',
          white: '#f5f5f5',
          lastMove: 'rgba(34, 197, 94, 0.4)',
          highlight: 'rgba(59, 130, 246, 0.25)'
        }
    }
  }, [theme])


  // Normalize board to BoardCell format
  const normalizedBoard = useMemo((): BoardCell[][] => {
    return board.map(row => 
      row.map(cell => {
        if (cell === null || cell === 'X' || cell === 'O') {
          return { player: cell }
        }
        return cell as BoardCell
      })
    )
  }, [board])
  
  // Draw board on canvas
  const drawBoard = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const dpr = window.devicePixelRatio || 1
    canvas.width = boardPixelSize * dpr
    canvas.height = boardPixelSize * dpr
    ctx.scale(dpr, dpr)
    
    // Clear and fill background with gradient (like Hotseat)
    const bgGradient = ctx.createLinearGradient(0, 0, boardPixelSize, boardPixelSize)
    bgGradient.addColorStop(0, '#d4a574')
    bgGradient.addColorStop(1, '#c49563')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, boardPixelSize, boardPixelSize)
    
    // Draw cell borders (like Hotseat CSS grid with border)
    ctx.strokeStyle = '#8b6f47'
    ctx.lineWidth = 1
    
    // Draw each cell border
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }
    
    // Center of cell offset (stones placed at cell center)
    const centerOffset = cellSize / 2
    
    // Draw star points (for 15x15 board) - at cell centers
    if (boardSize === 15) {
      ctx.fillStyle = '#8b6f47'
      const starPoints = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7], [3, 7], [11, 7], [7, 3], [7, 11]]
      const starDot = Math.max(4, Math.round(cellSize * 0.15))
      for (const [x, y] of starPoints) {
        ctx.beginPath()
        ctx.arc(x * cellSize + centerOffset, y * cellSize + centerOffset, starDot, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    
    // Draw last move highlight
    if (lastMove) {
      ctx.fillStyle = colors.lastMove
      ctx.fillRect(
        lastMove.x * cellSize + 2,
        lastMove.y * cellSize + 2,
        cellSize - 4,
        cellSize - 4
      )
    }
    
    // Draw tap highlight
    if (tapHighlight) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(
        tapHighlight.x * cellSize + centerOffset,
        tapHighlight.y * cellSize + centerOffset,
        cellSize * 0.4,
        0,
        Math.PI * 2
      )
      ctx.stroke()
    }
    
    // Draw stones (at cell centers)
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        const cell = normalizedBoard[y]?.[x]
        if (!cell?.player) continue
        
        const cx = x * cellSize + centerOffset
        const cy = y * cellSize + centerOffset
        
        // Check if we have skin image for this stone
        const skinImg = cell.player === 'X' ? skinImages.black : skinImages.white
        
        if (skinImg) {
          // Draw skin image - fill the cell area with rounded corners effect
          const imgSize = stoneRadius * 2.2 // Slightly larger to fill cell nicely
          const imgX = cx - imgSize / 2
          const imgY = cy - imgSize / 2
          
          // Save context for clipping
          ctx.save()
          
          // Create rounded rect clip path
          const cornerRadius = imgSize * 0.15
          ctx.beginPath()
          ctx.moveTo(imgX + cornerRadius, imgY)
          ctx.lineTo(imgX + imgSize - cornerRadius, imgY)
          ctx.quadraticCurveTo(imgX + imgSize, imgY, imgX + imgSize, imgY + cornerRadius)
          ctx.lineTo(imgX + imgSize, imgY + imgSize - cornerRadius)
          ctx.quadraticCurveTo(imgX + imgSize, imgY + imgSize, imgX + imgSize - cornerRadius, imgY + imgSize)
          ctx.lineTo(imgX + cornerRadius, imgY + imgSize)
          ctx.quadraticCurveTo(imgX, imgY + imgSize, imgX, imgY + imgSize - cornerRadius)
          ctx.lineTo(imgX, imgY + cornerRadius)
          ctx.quadraticCurveTo(imgX, imgY, imgX + cornerRadius, imgY)
          ctx.closePath()
          ctx.clip()
          
          // Draw the image
          ctx.drawImage(skinImg, imgX, imgY, imgSize, imgSize)
          
          ctx.restore()
          
          // Add subtle border for visibility
          ctx.strokeStyle = cell.player === 'X' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(imgX + cornerRadius, imgY)
          ctx.lineTo(imgX + imgSize - cornerRadius, imgY)
          ctx.quadraticCurveTo(imgX + imgSize, imgY, imgX + imgSize, imgY + cornerRadius)
          ctx.lineTo(imgX + imgSize, imgY + imgSize - cornerRadius)
          ctx.quadraticCurveTo(imgX + imgSize, imgY + imgSize, imgX + imgSize - cornerRadius, imgY + imgSize)
          ctx.lineTo(imgX + cornerRadius, imgY + imgSize)
          ctx.quadraticCurveTo(imgX, imgY + imgSize, imgX, imgY + imgSize - cornerRadius)
          ctx.lineTo(imgX, imgY + cornerRadius)
          ctx.quadraticCurveTo(imgX, imgY, imgX + cornerRadius, imgY)
          ctx.closePath()
          ctx.stroke()
        } else {
          // Fallback to gradient stone (default behavior)
          const blackColor = pieceSkin?.black_color || colors.black
          const whiteColor = pieceSkin?.white_color || colors.white
          
          const gradient = ctx.createRadialGradient(
            cx - stoneRadius * 0.3,
            cy - stoneRadius * 0.3,
            0,
            cx,
            cy,
            stoneRadius
          )
          
          if (cell.player === 'X') {
            const baseColor = blackColor === colors.black ? '#4a4a4a' : blackColor
            gradient.addColorStop(0, baseColor)
            gradient.addColorStop(1, blackColor)
          } else {
            const baseColor = whiteColor === colors.white ? '#ffffff' : whiteColor
            gradient.addColorStop(0, baseColor)
            gradient.addColorStop(1, whiteColor === '#fff' || whiteColor === '#ffffff' || whiteColor === colors.white ? '#d1d1d1' : whiteColor)
          }
          
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2)
          ctx.fill()
          
          // Stone border
          ctx.strokeStyle = cell.player === 'X' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
        
        // Move index (show on top of skin or gradient)
        if (showMoveIndex && cell.moveIndex) {
          ctx.fillStyle = cell.player === 'X' ? '#fff' : '#000'
          ctx.font = `bold ${cellSize * 0.3}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(cell.moveIndex), cx, cy)
        }
      }
    }
    
    // Draw tentative stones (Swap2) - at cell centers
    for (const stone of tentativeStones) {
      const cx = stone.x * cellSize + centerOffset
      const cy = stone.y * cellSize + centerOffset
      const isBlack = [1, 3, 4].includes(stone.placementOrder)
      
      ctx.strokeStyle = isBlack ? '#22D3EE' : '#F59E0B'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      
      // Fill with semi-transparent
      ctx.fillStyle = isBlack ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)'
      ctx.beginPath()
      ctx.arc(cx, cy, stoneRadius * 0.8, 0, Math.PI * 2)
      ctx.fill()
      
      // Order number
      ctx.fillStyle = isBlack ? '#fff' : '#000'
      ctx.font = `bold ${cellSize * 0.35}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(stone.placementOrder), cx, cy)
    }
  }, [boardPixelSize, boardSize, cellSize, colors, lastMove, normalizedBoard, showMoveIndex, stoneRadius, tapHighlight, tentativeStones, pieceSkin, boardSkin, skinImages])
  
  // Redraw on changes
  useEffect(() => {
    requestAnimationFrame(drawBoard)
  }, [drawBoard])


  // Get cell from pixel coordinates
  const getCellFromPixel = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    
    const rect = canvas.getBoundingClientRect()
    const scaleX = boardPixelSize / rect.width
    const scaleY = boardPixelSize / rect.height
    
    const px = (clientX - rect.left) * scaleX
    const py = (clientY - rect.top) * scaleY
    
    const x = Math.floor(px / cellSize)
    const y = Math.floor(py / cellSize)
    
    if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return null
    return { x, y }
  }, [boardPixelSize, boardSize, cellSize])
  
  // Handle touch/click
  const handleInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return
    
    let clientX: number, clientY: number
    
    if ('touches' in e) {
      if (e.touches.length === 0) return
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    
    const cell = getCellFromPixel(clientX, clientY)
    if (!cell) return
    
    // Show tap highlight
    setTapHighlight(cell)
    setTimeout(() => setTapHighlight(null), 200)
    
    // Show magnifier on touch devices
    if (enableMagnifier && 'touches' in e) {
      setMagnifier({ x: clientX, y: clientY - 80, cellX: cell.x, cellY: cell.y })
    }
  }, [disabled, enableMagnifier, getCellFromPixel])
  
  // Handle touch end - confirm move
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled) return
    
    if (magnifier) {
      // Confirm the move at magnifier position
      const cell = normalizedBoard[magnifier.cellY]?.[magnifier.cellX]
      if (!cell?.player) {
        onCellClick(magnifier.cellX, magnifier.cellY)
      }
      setMagnifier(null)
    }
  }, [disabled, magnifier, normalizedBoard, onCellClick])
  
  // Handle click (desktop)
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    
    const cell = getCellFromPixel(e.clientX, e.clientY)
    if (!cell) return
    
    const boardCell = normalizedBoard[cell.y]?.[cell.x]
    if (boardCell?.player) return // Cell occupied
    
    onCellClick(cell.x, cell.y)
  }, [disabled, getCellFromPixel, normalizedBoard, onCellClick])
  
  // Cancel magnifier on touch move away
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!magnifier || !enableMagnifier) return
    
    const touch = e.touches[0]
    const cell = getCellFromPixel(touch.clientX, touch.clientY)
    
    if (cell && (cell.x !== magnifier.cellX || cell.y !== magnifier.cellY)) {
      // Moved to different cell, update magnifier
      setMagnifier({ x: touch.clientX, y: touch.clientY - 80, cellX: cell.x, cellY: cell.y })
    }
  }, [enableMagnifier, getCellFromPixel, magnifier])
  
  return (
    <div 
      ref={containerRef}
      className="gomoku-board-container"
      style={{
        position: 'relative',
        width: boardPixelSize,
        height: boardPixelSize,
        margin: '0 auto',
        touchAction: 'none', // Prevent iOS Safari issues
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: boardPixelSize,
          height: boardPixelSize,
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          cursor: disabled ? 'default' : 'pointer'
        }}
        onClick={handleClick}
        onTouchStart={handleInteraction}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      
      {/* Magnifier overlay */}
      {magnifier && enableMagnifier && (
        <div
          style={{
            position: 'fixed',
            left: magnifier.x - 50,
            top: magnifier.y - 50,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: colors.bg,
            border: '3px solid #3B82F6',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          <div style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: normalizedBoard[magnifier.cellY]?.[magnifier.cellX]?.player 
              ? (normalizedBoard[magnifier.cellY][magnifier.cellX].player === 'X' ? '#1a1a1a' : '#f5f5f5')
              : 'transparent',
            border: `3px solid ${currentTurn === 'X' ? '#3B82F6' : '#EF4444'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: '#fff'
          }}>
            {!normalizedBoard[magnifier.cellY]?.[magnifier.cellX]?.player && (
              <span style={{ color: currentTurn === 'X' ? '#3B82F6' : '#EF4444' }}>
                {magnifier.cellX},{magnifier.cellY}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Custom overlays */}
      {renderCellOverlay && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {normalizedBoard.map((row, y) =>
            row.map((cell, x) => (
              <div
                key={`${x}-${y}`}
                style={{
                  position: 'absolute',
                  left: x * cellSize,
                  top: y * cellSize,
                  width: cellSize,
                  height: cellSize
                }}
              >
                {renderCellOverlay(x, y, cell)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
