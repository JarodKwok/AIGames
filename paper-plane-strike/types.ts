
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface Point {
  x: number;
  y: number;
}

export interface Plane {
  id: string;
  head: Point;
  direction: Direction;
  cells: Point[];
  isDestroyed: boolean;
}

export enum CellStatus {
  EMPTY = 'EMPTY',
  MISS = 'MISS',
  HIT = 'HIT',
  KILL = 'KILL'
}

export interface CellState {
  status: CellStatus;
  planeId?: string;
  isHead?: boolean;
}

export type BoardData = CellState[][];

export interface GameState {
  playerBoard: BoardData;
  enemyBoard: BoardData;
  playerPlanes: Plane[];
  enemyPlanes: Plane[];
  isPlayerTurn: boolean;
  gameStatus: 'SETUP' | 'PLAYING' | 'PLAYER_WON' | 'ENEMY_WON';
  message: string;
}
