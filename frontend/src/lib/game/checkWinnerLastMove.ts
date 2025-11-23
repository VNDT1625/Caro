// checkWinnerLastMove.ts
// Fast check: given board and last move (x0,y0), check only lines through that cell.
export function checkWinnerLastMove(
  board: Record<string, string>,
  x0: number,
  y0: number
): 'X' | 'O' | null {
  const positions: Record<string, Record<string, boolean>> = { X: {}, O: {} };
  for (const key in board) {
    const val = board[key];
    if (val !== 'X' && val !== 'O') continue;
    const parts = key.split('_');
    if (parts.length !== 2) continue;
    const x = parseInt(parts[0], 10);
    const y = parseInt(parts[1], 10);
    positions[val][`${x}_${y}`] = true;
  }

  const keyLast = `${x0}_${y0}`;
  let player: 'X' | 'O' | null = null;
  if (positions['X'][keyLast]) player = 'X';
  else if (positions['O'][keyLast]) player = 'O';
  else return null;

  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  const set = positions[player];
  for (const d of dirs) {
    const dx = d[0];
    const dy = d[1];
    let count = 1;

    let i = 1;
    while (set[`${x0 + dx * i}_${y0 + dy * i}`]) {
      count++;
      i++;
    }

    i = 1;
    while (set[`${x0 - dx * i}_${y0 - dy * i}`]) {
      count++;
      i++;
    }

    if (count >= 5) return player;
  }

  return null;
}
