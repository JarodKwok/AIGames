
import { Point, Direction, Plane } from '../types';
import { GRID_SIZE, PLANE_COUNT } from '../constants';

/**
 * Generates the full set of coordinates for a plane based on head position and direction.
 */
export const getPlaneCells = (head: Point, dir: Direction): Point[] => {
  const { x, y } = head;
  const cells: Point[] = [{ x, y }]; // Head

  if (dir === 'UP') {
    for (let i = -2; i <= 2; i++) cells.push({ x: x + i, y: y + 1 });
    cells.push({ x, y: y + 2 });
    for (let i = -1; i <= 1; i++) cells.push({ x: x + i, y: y + 3 });
  } else if (dir === 'DOWN') {
    for (let i = -2; i <= 2; i++) cells.push({ x: x + i, y: y - 1 });
    cells.push({ x, y: y - 2 });
    for (let i = -1; i <= 1; i++) cells.push({ x: x + i, y: y - 3 });
  } else if (dir === 'LEFT') {
    for (let i = -2; i <= 2; i++) cells.push({ x: x + 1, y: y + i });
    cells.push({ x: x + 2, y: y });
    for (let i = -1; i <= 1; i++) cells.push({ x: x + 3, y: y + i });
  } else if (dir === 'RIGHT') {
    for (let i = -2; i <= 2; i++) cells.push({ x: x - 1, y: y + i });
    cells.push({ x: x - 2, y: y });
    for (let i = -1; i <= 1; i++) cells.push({ x: x - 3, y: y + i });
  }

  return cells;
};

export const isWithinBounds = (p: Point): boolean => 
  p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE;

export const isValidPlacement = (newCells: Point[], existingPlanes: Plane[]): boolean => {
  if (!newCells.every(isWithinBounds)) return false;
  
  const allExistingCells = existingPlanes.flatMap(p => p.cells);
  return !newCells.some(nc => allExistingCells.some(ec => ec.x === nc.x && ec.y === nc.y));
};

export const generateRandomPlanes = (): Plane[] => {
  const planes: Plane[] = [];
  const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

  while (planes.length < PLANE_COUNT) {
    const head = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
    const dir = directions[Math.floor(Math.random() * directions.length)];
    const cells = getPlaneCells(head, dir);

    if (isValidPlacement(cells, planes)) {
      planes.push({
        id: Math.random().toString(36).substr(2, 9),
        head,
        direction: dir,
        cells,
        isDestroyed: false,
      });
    }
  }
  return planes;
};

/**
 * Smarter AI: If it has a "last hit" that wasn't a kill, it targets nearby.
 */
export const getNextAIShot = (board: any, lastHits: Point[]): Point => {
  if (lastHits.length > 0) {
    const base = lastHits[lastHits.length - 1];
    const neighbors = [
      { x: base.x + 1, y: base.y },
      { x: base.x - 1, y: base.y },
      { x: base.x, y: base.y + 1 },
      { x: base.x, y: base.y - 1 },
    ].filter(p => isWithinBounds(p) && board[p.y][p.x].status === 'EMPTY');

    if (neighbors.length > 0) {
      return neighbors[Math.floor(Math.random() * neighbors.length)];
    }
  }

  // Random fallback
  let x, y;
  do {
    x = Math.floor(Math.random() * GRID_SIZE);
    y = Math.floor(Math.random() * GRID_SIZE);
  } while (board[y][x].status !== 'EMPTY');
  return { x, y };
};

export const runDiagnostics = () => {
  console.log('--- RUNNING DIAGNOSTICS ---');
  const testHead: Point = { x: 5, y: 5 };
  const testDir: Direction = 'DOWN';
  const testCells = getPlaneCells(testHead, testDir);
  if (testCells.length !== 10) console.error('Plane size mismatch');
  console.log('--- DIAGNOSTICS COMPLETE ---');
};
