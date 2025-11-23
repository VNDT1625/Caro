// Minimal JS port of the checkWinner algorithm used by frontend/backend.
// board: object with keys like "x_y" -> 'X'|'O'
function checkWinner(board) {
  if (!board || Object.keys(board).length === 0) return null;

  const positions = { X: new Set(), O: new Set() };
  for (const k of Object.keys(board)) {
    const v = board[k];
    if (v === 'X' || v === 'O') positions[v].add(k);
  }

  const dirs = [ [1,0], [0,1], [1,1], [1,-1] ];
  for (const player of ['X','O']) {
    const set = positions[player];
    for (const key of set) {
      const [xs, ys] = key.split('_');
      const x0 = parseInt(xs,10); const y0 = parseInt(ys,10);
      for (const d of dirs) {
        const dx = d[0], dy = d[1];
        let count = 1;
        let i = 1;
        while (set.has(`${x0 + dx*i}_${y0 + dy*i}`)) { count++; i++; }
        i = 1;
        while (set.has(`${x0 - dx*i}_${y0 - dy*i}`)) { count++; i++; }
        if (count >= 5) return player;
      }
    }
  }

  return null;
}

module.exports = { checkWinner };
