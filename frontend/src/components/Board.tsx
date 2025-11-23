import React, { useState } from 'react'
import { checkWinnerLastMove } from '../lib/game/checkWinnerLastMove'

type Cell = 'X' | 'O' | null

const SIZE = 15 // default board size for demo

export default function Board() {
  const [board, setBoard] = useState<Record<string, string>>({})
  const [current, setCurrent] = useState<'X' | 'O'>('X')
  const [winner, setWinner] = useState<Cell>(null)

  function handleClick(x: number, y: number) {
    if (winner) return
    const key = `${x}_${y}`
    if (board[key]) return

    const next = { ...board, [key]: current }
    setBoard(next)

    if (Object.keys(next).length >= 5) {
      const w = checkWinnerLastMove(next, x, y)
      if (w) setWinner(w as Cell)
    }

    setCurrent(current === 'X' ? 'O' : 'X')
  }

  function renderCell(x: number, y: number) {
    const key = `${x}_${y}`
    const val = board[key] || ''
    const classes = ['cell']
    if (val === 'X') classes.push('X')
    if (val === 'O') classes.push('O')
    if (val) classes.push('disabled')

    return (
      <div key={key} className={classes.join(' ')} onClick={() => !val && !winner && handleClick(x, y)}>
        {val}
      </div>
    )
  }

  return (
    <div className="board-wrap">
      <div className="board-info">Current: {current} {winner ? `— Winner: ${winner}` : ''}</div>
      <div className="board-grid">
        {Array.from({ length: SIZE }).map((_, y) =>
          Array.from({ length: SIZE }).map((_, x) => renderCell(x, y))
        )}
      </div>
    </div>
  )
}
