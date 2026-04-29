const { GRID_SIZE, PLANE_COUNT, CellStatus } = require("../../utils/constants.js");
const { generateRandomPlanes, getPlaneCells, getNextAIShot, isValidPlacement, makeId } = require("../../utils/gameLogic.js");
const { translations, viewCopy } = require("../../utils/translations.js");
const audio = require("../../utils/audio.js");

const RESULT_STORAGE_KEY = "paper-plane-strike-results-v1";

function createEmptyBoard() {
  const board = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    const row = [];
    for (let x = 0; x < GRID_SIZE; x += 1) {
      row.push({ status: CellStatus.EMPTY });
    }
    board.push(row);
  }
  return board;
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => Object.assign({}, cell)));
}

function clonePlanes(planes) {
  return planes.map((plane) => ({
    id: plane.id,
    head: { x: plane.head.x, y: plane.head.y },
    direction: plane.direction,
    cells: plane.cells.map((cell) => ({ x: cell.x, y: cell.y })),
    isDestroyed: plane.isDestroyed
  }));
}

function findPlaneAt(planes, x, y) {
  for (let i = 0; i < planes.length; i += 1) {
    const plane = planes[i];
    for (let c = 0; c < plane.cells.length; c += 1) {
      if (plane.cells[c].x === x && plane.cells[c].y === y) return plane;
    }
  }
  return null;
}

function findPlaneIndexAt(planes, x, y) {
  for (let i = 0; i < planes.length; i += 1) {
    const plane = planes[i];
    for (let c = 0; c < plane.cells.length; c += 1) {
      if (plane.cells[c].x === x && plane.cells[c].y === y) return i;
    }
  }
  return -1;
}

function prependLog(logs, message) {
  return [message].concat(logs).slice(0, 4);
}

function normalizeBattleRecords(records) {
  if (!Array.isArray(records)) return [];
  return records
    .filter((record) => record && (record.winner === "PLAYER" || record.winner === "ENEMY"))
    .slice(0, 10);
}

function readBattleRecords() {
  if (typeof wx === "undefined" || typeof wx.getStorageSync !== "function") return [];
  try {
    return normalizeBattleRecords(wx.getStorageSync(RESULT_STORAGE_KEY));
  } catch (error) {
    return [];
  }
}

function saveBattleRecords(records) {
  if (typeof wx === "undefined" || typeof wx.setStorageSync !== "function") return;
  try {
    wx.setStorageSync(RESULT_STORAGE_KEY, records);
  } catch (error) {
    // Ignore storage errors; the current game result still shows in memory.
  }
}

function calculateRecentStats(records) {
  const stats = {
    playerWins: 0,
    enemyWins: 0,
    total: records.length
  };

  records.forEach((record) => {
    if (record.winner === "PLAYER") stats.playerWins += 1;
    if (record.winner === "ENEMY") stats.enemyWins += 1;
  });

  return stats;
}

function buildCells(board, options) {
  const playerPlanes = options.playerPlanes || [];
  const selectedPlaneId = options.selectedPlaneId || "";
  const isSetup = !!options.isSetup;
  const isPlayerBoard = !!options.isPlayerBoard;
  const cells = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const status = board[y][x].status;
      const plane = findPlaneAt(playerPlanes, x, y);
      const isPlayerPlanePart = !!plane;
      const isPlayerHead = !!plane && plane.head.x === x && plane.head.y === y;
      const isSelected = !!plane && plane.id === selectedPlaneId;
      const isConfirmed = isPlayerPlanePart && !isSelected;
      const classList = ["cell"];

      if (status === CellStatus.MISS) {
        classList.push("cell-miss");
      } else if (status === CellStatus.HIT) {
        classList.push("cell-hit");
      } else if (status === CellStatus.KILL) {
        classList.push("cell-kill");
      } else if (isPlayerPlanePart) {
        if (plane.isDestroyed) {
          classList.push("plane-destroyed");
        } else if (isSelected) {
          classList.push(isPlayerHead ? "plane-head-selected" : "plane-body-selected");
        } else if (isConfirmed) {
          classList.push(isPlayerHead ? "plane-head-confirmed" : "plane-body-confirmed");
        } else {
          classList.push(isPlayerHead ? "plane-head" : "plane-body");
        }
      } else {
        classList.push("cell-empty");
      }

      if (isSetup || (!isPlayerBoard && status === CellStatus.EMPTY)) classList.push("tapable");

      cells.push({
        key: `${x}-${y}`,
        x,
        y,
        status,
        classes: classList.join(" "),
        miss: status === CellStatus.MISS,
        hit: status === CellStatus.HIT,
        kill: status === CellStatus.KILL,
        isSelected,
        showHeadRing: isPlayerHead && status === CellStatus.EMPTY,
        showBodyRing: isSelected && isPlayerPlanePart && !isPlayerHead && status === CellStatus.EMPTY
      });
    }
  }

  return cells;
}

function planeDots(planes, side) {
  return planes.map((plane, index) => ({
    key: `${side}-${index}`,
    classes: `plane-dot ${side} ${plane.isDestroyed ? "destroyed" : ""}`
  }));
}

function makeDirections(copy) {
  return [
    { key: "UP", label: copy.up },
    { key: "DOWN", label: copy.down },
    { key: "LEFT", label: copy.left },
    { key: "RIGHT", label: copy.right }
  ];
}

function makeDifficultyOptions(copy) {
  return [
    { key: "EASY", label: copy.difficultyEasy },
    { key: "MEDIUM", label: copy.difficultyMedium },
    { key: "HARD", label: copy.difficultyHard }
  ];
}

function getDifficultyLabel(copy, difficulty) {
  const option = makeDifficultyOptions(copy).find((item) => item.key === difficulty);
  return option ? option.label : copy.difficultyMedium;
}

function enrichState(state) {
  const next = Object.assign({}, state);
  next.t = viewCopy(next.lang);
  next.directions = makeDirections(next.t);
  next.difficultyOptions = makeDifficultyOptions(next.t);
  next.difficultyName = getDifficultyLabel(next.t, next.difficulty);
  next.canStart = next.playerPlanes.length === PLANE_COUNT && !next.selectedPlaneId;
  next.playerCells = buildCells(next.playerBoard, {
    playerPlanes: next.playerPlanes,
    selectedPlaneId: next.selectedPlaneId,
    isSetup: next.gameStatus === "SETUP",
    isPlayerBoard: true
  });
  next.enemyCells = buildCells(next.enemyBoard, {
    isPlayerBoard: false
  });
  next.playerPlaneDots = planeDots(next.playerPlanes, "own");
  next.enemyPlaneDots = planeDots(next.enemyPlanes, "enemy");
  return next;
}

function initialState() {
  const battleRecords = readBattleRecords();
  return enrichState({
    lang: "zh",
    gridSize: GRID_SIZE,
    planeCount: PLANE_COUNT,
    playerPlanes: [],
    enemyPlanes: [],
    playerBoard: createEmptyBoard(),
    enemyBoard: createEmptyBoard(),
    isPlayerTurn: true,
    gameStatus: "WELCOME",
    hasFinished: false,
    winner: null,
    logs: [],
    battleRecords,
    recentStats: calculateRecentStats(battleRecords),
    currentDir: "UP",
    difficulty: "MEDIUM",
    aiLastHits: [],
    selectedPlaneId: null
  });
}

Page({
  data: initialState(),

  onShow() {
    this.syncAmbientAudio(this.data.gameStatus);
  },

  onHide() {
    audio.pauseBgm();
    audio.stopResultMusic();
  },

  onUnload() {
    audio.destroy();
  },

  getT() {
    return translations[this.data.lang] || translations.zh;
  },

  syncAmbientAudio(status) {
    if (status === "WELCOME" || status === "SETUP") {
      audio.startBgm();
      return;
    }
    audio.stopBgm();
  },

  commit(patch) {
    const next = Object.assign({}, this.data, patch);
    this.setData(enrichState(next));
    this.syncAmbientAudio(next.gameStatus);
  },

  playFeedback(kind) {
    audio.play(kind);
    if (typeof wx === "undefined" || !wx.vibrateShort) return;
    const type = kind === "kill" || kind === "victory" || kind === "defeat" ? "heavy" : "light";
    try {
      wx.vibrateShort({ type });
    } catch (error) {
      wx.vibrateShort();
    }
  },

  toggleLang() {
    this.playFeedback("tap");
    this.commit({ lang: this.data.lang === "zh" ? "en" : "zh" });
  },

  startSetup() {
    const t = this.getT();
    this.playFeedback("confirm");
    this.commit({
      playerPlanes: [],
      enemyPlanes: [],
      playerBoard: createEmptyBoard(),
      enemyBoard: createEmptyBoard(),
      isPlayerTurn: true,
      gameStatus: "SETUP",
      hasFinished: false,
      winner: null,
      logs: [t.logFirstPlane],
      currentDir: "UP",
      aiLastHits: [],
      selectedPlaneId: null
    });
  },

  randomizePlayer() {
    const t = this.getT();
    this.playFeedback("deploy");
    this.commit({
      playerPlanes: generateRandomPlanes(),
      selectedPlaneId: null,
      logs: prependLog(this.data.logs, t.logRandomDone)
    });
  },

  onSetupCellTap(event) {
    const x = Number(event.currentTarget.dataset.x);
    const y = Number(event.currentTarget.dataset.y);
    this.handleManualPlace(x, y);
  },

  handleManualPlace(x, y) {
    if (this.data.hasFinished) return;

    const t = this.getT();
    const existingHead = this.data.playerPlanes.find((plane) => plane.head.x === x && plane.head.y === y);
    if (existingHead) {
      this.playFeedback("tap");
      this.commit({
        selectedPlaneId: existingHead.id,
        currentDir: existingHead.direction
      });
      return;
    }

    if (this.data.selectedPlaneId) {
      const otherPlanes = this.data.playerPlanes.filter((plane) => plane.id !== this.data.selectedPlaneId);
      const newCells = getPlaneCells({ x, y }, this.data.currentDir);
      if (isValidPlacement(newCells, otherPlanes)) {
        const playerPlanes = this.data.playerPlanes.map((plane) => {
          if (plane.id !== this.data.selectedPlaneId) return plane;
          return Object.assign({}, plane, {
            head: { x, y },
            direction: this.data.currentDir,
            cells: newCells
          });
        });
        this.playFeedback("deploy");
        this.commit({ playerPlanes });
      } else {
        this.playFeedback("miss");
        this.commit({ logs: prependLog(this.data.logs, t.logInvalidPos) });
      }
      return;
    }

    if (this.data.playerPlanes.length < PLANE_COUNT) {
      const head = { x, y };
      const cells = getPlaneCells(head, this.data.currentDir);
      if (isValidPlacement(cells, this.data.playerPlanes)) {
        const plane = {
          id: makeId(),
          head,
          direction: this.data.currentDir,
          cells,
          isDestroyed: false
        };
        const nextPlanes = this.data.playerPlanes.concat(plane);
        this.playFeedback("deploy");
        this.commit({
          playerPlanes: nextPlanes,
          selectedPlaneId: plane.id,
          logs: prependLog(this.data.logs, t.logDeployed(nextPlanes.length))
        });
      } else {
        this.playFeedback("miss");
        this.commit({ logs: prependLog(this.data.logs, t.logInvalidPos) });
      }
    }
  },

  confirmPlane() {
    const t = this.getT();
    const nextLog = this.data.playerPlanes.length < PLANE_COUNT
      ? t.logNextPlane(this.data.playerPlanes.length + 1)
      : t.logReady;
    this.playFeedback("confirm");
    this.commit({
      selectedPlaneId: null,
      logs: prependLog(this.data.logs, nextLog)
    });
  },

  deleteSelected() {
    if (!this.data.selectedPlaneId) return;
    this.playFeedback("miss");
    this.commit({
      playerPlanes: this.data.playerPlanes.filter((plane) => plane.id !== this.data.selectedPlaneId),
      selectedPlaneId: null
    });
  },

  changeDirection(event) {
    const direction = event.currentTarget.dataset.dir;
    const patch = { currentDir: direction };
    const t = this.getT();
    this.playFeedback("tap");

    if (this.data.selectedPlaneId) {
      const selected = this.data.playerPlanes.find((plane) => plane.id === this.data.selectedPlaneId);
      if (selected) {
        const otherPlanes = this.data.playerPlanes.filter((plane) => plane.id !== this.data.selectedPlaneId);
        const newCells = getPlaneCells(selected.head, direction);
        if (isValidPlacement(newCells, otherPlanes)) {
          patch.playerPlanes = this.data.playerPlanes.map((plane) => {
            if (plane.id !== this.data.selectedPlaneId) return plane;
            return Object.assign({}, plane, {
              direction,
              cells: newCells
            });
          });
        } else {
          this.playFeedback("miss");
          patch.logs = prependLog(this.data.logs, t.logInvalidPos);
        }
      }
    }

    this.commit(patch);
  },

  changeDifficulty(event) {
    const difficulty = event.currentTarget.dataset.difficulty;
    if (!difficulty || difficulty === this.data.difficulty) return;
    const t = this.getT();
    this.playFeedback("tap");
    this.commit({
      difficulty,
      logs: prependLog(this.data.logs, t.logDifficultyChanged)
    });
  },

  clearAirspace() {
    this.playFeedback("miss");
    this.commit({
      playerPlanes: [],
      selectedPlaneId: null
    });
  },

  startGame() {
    if (!this.data.canStart) return;
    const t = this.getT();
    this.playFeedback("confirm");
    audio.stopBgm();
    this.commit({
      enemyPlanes: generateRandomPlanes(),
      enemyBoard: createEmptyBoard(),
      playerBoard: createEmptyBoard(),
      gameStatus: "PLAYING",
      isPlayerTurn: true,
      hasFinished: false,
      winner: null,
      aiLastHits: [],
      logs: prependLog(this.data.logs, `${t.logBattleStart} ${t.difficultyTitle}: ${this.data.difficultyName}`)
    });
  },

  onEnemyCellTap(event) {
    if (!this.data.isPlayerTurn || this.data.gameStatus !== "PLAYING" || this.data.hasFinished) return;
    const x = Number(event.currentTarget.dataset.x);
    const y = Number(event.currentTarget.dataset.y);
    if (this.data.enemyBoard[y][x].status !== CellStatus.EMPTY) return;

    const won = this.processAttack(x, y, "PLAYER");
    if (!won) {
      this.commit({ isPlayerTurn: false });
      setTimeout(() => this.handleEnemyTurn(), 800);
    }
  },

  handleEnemyTurn() {
    if (this.data.gameStatus !== "PLAYING" || this.data.hasFinished) return;
    const shot = getNextAIShot(this.data.playerBoard, this.data.aiLastHits, this.data.difficulty);
    this.processAttack(shot.x, shot.y, "ENEMY");
    this.commit({ isPlayerTurn: true });
  },

  processAttack(x, y, attacker) {
    const isEnemyAttacking = attacker === "ENEMY";
    const currentBoard = isEnemyAttacking ? this.data.playerBoard : this.data.enemyBoard;
    const nextBoard = cloneBoard(currentBoard);
    if (nextBoard[y][x].status !== CellStatus.EMPTY) return false;

    const nextPlayerPlanes = isEnemyAttacking ? clonePlanes(this.data.playerPlanes) : this.data.playerPlanes;
    const nextEnemyPlanes = isEnemyAttacking ? this.data.enemyPlanes : clonePlanes(this.data.enemyPlanes);
    const targetPlanes = isEnemyAttacking ? nextPlayerPlanes : nextEnemyPlanes;
    const hitIndex = findPlaneIndexAt(targetPlanes, x, y);
    let status = CellStatus.MISS;
    let killed = false;

    if (hitIndex >= 0) {
      const plane = targetPlanes[hitIndex];
      if (plane.head.x === x && plane.head.y === y) {
        status = CellStatus.KILL;
        plane.isDestroyed = true;
        killed = true;
        this.playFeedback("kill");
      } else {
        status = CellStatus.HIT;
        this.playFeedback("hit");
      }
    } else {
      this.playFeedback("miss");
    }

    nextBoard[y][x].status = status;
    if (killed && hitIndex >= 0) {
      targetPlanes[hitIndex].cells.forEach((cell) => {
        nextBoard[cell.y][cell.x].status = CellStatus.KILL;
      });
    }

    const t = this.getT();
    const attackerName = isEnemyAttacking ? t.attackerEnemy : t.attackerPlayer;
    const statusText = status === CellStatus.KILL ? t.logHitHead : status === CellStatus.HIT ? t.logHitBody : t.logMiss;
    const patch = {
      logs: prependLog(this.data.logs, `${attackerName}: ${statusText}`)
    };

    if (isEnemyAttacking) {
      patch.playerBoard = nextBoard;
      patch.playerPlanes = nextPlayerPlanes;
      if (status === CellStatus.HIT) patch.aiLastHits = this.data.aiLastHits.concat({ x, y });
      if (status === CellStatus.KILL) patch.aiLastHits = [];
    } else {
      patch.enemyBoard = nextBoard;
      patch.enemyPlanes = nextEnemyPlanes;
    }

    const allDestroyed = targetPlanes.every((plane) => plane.isDestroyed);
    if (allDestroyed) {
      const nextRecords = this.recordBattleResult(attacker);
      patch.winner = attacker;
      patch.hasFinished = true;
      patch.battleRecords = nextRecords;
      patch.recentStats = calculateRecentStats(nextRecords);
      setTimeout(() => {
        audio.playResult(attacker);
        this.playFeedback(attacker === "PLAYER" ? "victory" : "defeat");
      }, 260);
    }

    this.commit(patch);
    return allDestroyed;
  },

  recordBattleResult(winner) {
    const nextRecords = [{
      winner,
      difficulty: this.data.difficulty,
      time: Date.now()
    }].concat(this.data.battleRecords || []).slice(0, 10);

    saveBattleRecords(nextRecords);
    return nextRecords;
  },

  viewReport() {
    this.playFeedback("tap");
    this.commit({ gameStatus: "OVER" });
  },

  returnBase() {
    this.playFeedback("confirm");
    this.commit({
      gameStatus: "WELCOME",
      hasFinished: false,
      winner: null,
      selectedPlaneId: null
    });
  }
});
