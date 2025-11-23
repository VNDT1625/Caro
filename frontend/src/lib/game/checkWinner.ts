// checkWinner.ts
// Simple TypeScript port of server GameEngine::checkWinner
export function checkWinner(board: Record<string, string>): 'X' | 'O' | null {
  if (!board || Object.keys(board).length === 0) return null;

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

  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (const player of ['X', 'O']) {
    const set = positions[player];
    for (const key in set) {
      const parts = key.split('_');
      const x0 = parseInt(parts[0], 10);
      const y0 = parseInt(parts[1], 10);

      for (const d of dirs) {
        const dx = d[0];
        const dy = d[1];
        let count = 1;

        // forward
        let i = 1;
        while (set[`${x0 + dx * i}_${y0 + dy * i}`]) {
          count++;
          i++;
        }

        // backward
        i = 1;
        while (set[`${x0 - dx * i}_${y0 - dy * i}`]) {
          count++;
          i++;
        }

        if (count >= 5) return player as 'X' | 'O';
      }
    }
  }

  return null;
}
