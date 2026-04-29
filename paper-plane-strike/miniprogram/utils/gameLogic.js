const { GRID_SIZE, PLANE_COUNT, DIRECTIONS, CellStatus } = require("./constants.js");

function getPlaneCells(head, dir) {
  const x = head.x;
  const y = head.y;
  const cells = [{ x, y }];

  if (dir === "UP") {
    for (let i = -2; i <= 2; i += 1) cells.push({ x: x + i, y: y + 1 });
    cells.push({ x, y: y + 2 });
    for (let i = -1; i <= 1; i += 1) cells.push({ x: x + i, y: y + 3 });
  } else if (dir === "DOWN") {
    for (let i = -2; i <= 2; i += 1) cells.push({ x: x + i, y: y - 1 });
    cells.push({ x, y: y - 2 });
    for (let i = -1; i <= 1; i += 1) cells.push({ x: x + i, y: y - 3 });
  } else if (dir === "LEFT") {
    for (let i = -2; i <= 2; i += 1) cells.push({ x: x + 1, y: y + i });
    cells.push({ x: x + 2, y });
    for (let i = -1; i <= 1; i += 1) cells.push({ x: x + 3, y: y + i });
  } else if (dir === "RIGHT") {
    for (let i = -2; i <= 2; i += 1) cells.push({ x: x - 1, y: y + i });
    cells.push({ x: x - 2, y });
    for (let i = -1; i <= 1; i += 1) cells.push({ x: x - 3, y: y + i });
  }

  return cells;
}

function isWithinBounds(point) {
  return point.x >= 0 && point.x < GRID_SIZE && point.y >= 0 && point.y < GRID_SIZE;
}

function isValidPlacement(newCells, existingPlanes) {
  if (!newCells.every(isWithinBounds)) return false;

  for (let i = 0; i < newCells.length; i += 1) {
    const cell = newCells[i];
    for (let p = 0; p < existingPlanes.length; p += 1) {
      const planeCells = existingPlanes[p].cells;
      for (let c = 0; c < planeCells.length; c += 1) {
        if (planeCells[c].x === cell.x && planeCells[c].y === cell.y) return false;
      }
    }
  }

  return true;
}

function makeId() {
  return Math.random().toString(36).slice(2, 11);
}

function generateRandomPlanes() {
  const planes = [];
  let attempts = 0;

  while (planes.length < PLANE_COUNT && attempts < 10000) {
    attempts += 1;
    const head = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const cells = getPlaneCells(head, direction);

    if (isValidPlacement(cells, planes)) {
      planes.push({
        id: makeId(),
        head,
        direction,
        cells,
        isDestroyed: false
      });
    }
  }

  return planes;
}

function getOpenCells(board) {
  const openCells = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (board[y][x].status === CellStatus.EMPTY) openCells.push({ x, y });
    }
  }
  return openCells;
}

function chooseRandom(cells) {
  if (cells.length === 0) return { x: 0, y: 0 };
  return cells[Math.floor(Math.random() * cells.length)];
}

function getEasyAIShot(board) {
  return chooseRandom(getOpenCells(board));
}

function getMediumAIShot(board, lastHits) {
  if (lastHits.length > 0) {
    const base = lastHits[lastHits.length - 1];
    const neighbors = [
      { x: base.x + 1, y: base.y },
      { x: base.x - 1, y: base.y },
      { x: base.x, y: base.y + 1 },
      { x: base.x, y: base.y - 1 }
    ].filter((point) => isWithinBounds(point) && board[point.y][point.x].status === CellStatus.EMPTY);

    if (neighbors.length > 0) {
      return neighbors[Math.floor(Math.random() * neighbors.length)];
    }
  }

  return getEasyAIShot(board);
}

function getActiveHits(board) {
  const hits = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (board[y][x].status === CellStatus.HIT) hits.push({ x, y });
    }
  }
  return hits;
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

function getHardAIShot(board) {
  const scores = {};
  const activeHits = getActiveHits(board);

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      for (let i = 0; i < DIRECTIONS.length; i += 1) {
        const head = { x, y };
        const cells = getPlaneCells(head, DIRECTIONS[i]);
        if (!cells.every(isWithinBounds)) continue;

        let blocked = false;
        let hitsCovered = 0;
        for (let c = 0; c < cells.length; c += 1) {
          const cell = cells[c];
          const status = board[cell.y][cell.x].status;
          if (status === CellStatus.MISS || status === CellStatus.KILL) {
            blocked = true;
            break;
          }
          if (status === CellStatus.HIT) hitsCovered += 1;
        }
        if (blocked) continue;

        const hasHitContext = activeHits.length > 0;
        if (hasHitContext && hitsCovered === 0) continue;

        const headStatus = board[head.y][head.x].status;
        if (headStatus === CellStatus.EMPTY) {
          const key = `${head.x},${head.y}`;
          scores[key] = (scores[key] || 0) + 6 + hitsCovered * 18;
        }

        if (!hasHitContext) {
          cells.forEach((cell) => {
            if (board[cell.y][cell.x].status !== CellStatus.EMPTY) return;
            const key = `${cell.x},${cell.y}`;
            scores[key] = (scores[key] || 0) + 1;
          });
        } else {
          cells.forEach((cell) => {
            if (board[cell.y][cell.x].status !== CellStatus.EMPTY) return;
            const nearHit = activeHits.some((hit) => Math.abs(hit.x - cell.x) + Math.abs(hit.y - cell.y) === 1);
            if (!nearHit || activeHits.some((hit) => samePoint(hit, cell))) return;
            const key = `${cell.x},${cell.y}`;
            scores[key] = (scores[key] || 0) + hitsCovered * 4;
          });
        }
      }
    }
  }

  let bestScore = -1;
  let bestCells = [];
  Object.keys(scores).forEach((key) => {
    const score = scores[key];
    if (score > bestScore) {
      bestScore = score;
      bestCells = [key];
    } else if (score === bestScore) {
      bestCells.push(key);
    }
  });

  if (bestCells.length > 0) {
    const key = chooseRandom(bestCells).split(",");
    return { x: Number(key[0]), y: Number(key[1]) };
  }

  return getMediumAIShot(board, activeHits);
}

function getNextAIShot(board, lastHits, difficulty) {
  if (difficulty === "EASY") return getEasyAIShot(board);
  if (difficulty === "HARD") return getHardAIShot(board);
  return getMediumAIShot(board, lastHits);
}

module.exports = {
  getPlaneCells,
  isValidPlacement,
  generateRandomPlanes,
  getNextAIShot,
  makeId
};
