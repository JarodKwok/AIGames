const GRID_SIZE = 10;
const PLANE_COUNT = 3;
const DIRECTIONS = ["UP", "DOWN", "LEFT", "RIGHT"];
const CellStatus = {
  EMPTY: "EMPTY",
  MISS: "MISS",
  HIT: "HIT",
  KILL: "KILL"
};

module.exports = {
  GRID_SIZE,
  PLANE_COUNT,
  DIRECTIONS,
  CellStatus
};

