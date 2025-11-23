import { checkWinner } from './checkWinner'

test('no winner on empty board', () => {
  expect(checkWinner({})).toBeNull()
})

test('horizontal win for X', () => {
  const b: Record<string, string> = {
    '0_0': 'X',
    '1_0': 'X',
    '2_0': 'X',
    '3_0': 'X',
    '4_0': 'X',
  }
  expect(checkWinner(b)).toBe('X')
})
