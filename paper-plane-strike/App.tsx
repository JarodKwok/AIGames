
import React, { useState, useEffect, useCallback } from 'react';
import { 
  CellStatus, 
  BoardData, 
  Plane, 
  Point,
  Direction
} from './types';
import {
  GRID_SIZE,
  PLANE_COUNT
} from './constants';
import { 
  generateRandomPlanes, 
  runDiagnostics, 
  getPlaneCells,
  isValidPlacement,
  getNextAIShot
} from './utils/gameLogic';
import { audio } from './utils/audio';
import { translations } from './translations';

const createEmptyBoard = (): BoardData => 
  Array(GRID_SIZE).fill(null).map(() => 
    Array(GRID_SIZE).fill(null).map(() => ({ status: CellStatus.EMPTY }))
  );

const App: React.FC = () => {
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = translations[lang];

  const [playerPlanes, setPlayerPlanes] = useState<Plane[]>([]);
  const [enemyPlanes, setEnemyPlanes] = useState<Plane[]>([]);
  const [playerBoard, setPlayerBoard] = useState<BoardData>(createEmptyBoard());
  const [enemyBoard, setEnemyBoard] = useState<BoardData>(createEmptyBoard());
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameStatus, setGameStatus] = useState<'WELCOME' | 'SETUP' | 'PLAYING' | 'OVER'>('WELCOME');
  const [hasFinished, setHasFinished] = useState(false);
  const [winner, setWinner] = useState<'PLAYER' | 'ENEMY' | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const [currentDir, setCurrentDir] = useState<Direction>('UP');
  const [aiLastHits, setAiLastHits] = useState<Point[]>([]);
  const [selectedPlaneId, setSelectedPlaneId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 4));
  };

  const startSetup = () => {
    setPlayerPlanes([]);
    setEnemyPlanes([]);
    setPlayerBoard(createEmptyBoard());
    setEnemyBoard(createEmptyBoard());
    setGameStatus('SETUP');
    setHasFinished(false);
    setSelectedPlaneId(null);
    addLog(t.logFirstPlane);
  };

  const handleRandomizePlayer = () => {
    const randomPlanes = generateRandomPlanes();
    setPlayerPlanes(randomPlanes);
    setSelectedPlaneId(null);
    audio.playHit();
    addLog(t.logRandomDone);
  };

  const handleManualPlace = (x: number, y: number) => {
    if (hasFinished) return;

    const existingPlane = playerPlanes.find(p => p.head.x === x && p.head.y === y);
    if (existingPlane) {
      setSelectedPlaneId(existingPlane.id);
      setCurrentDir(existingPlane.direction);
      setIsDragging(true);
      return;
    }

    if (selectedPlaneId) {
      const otherPlanes = playerPlanes.filter(p => p.id !== selectedPlaneId);
      const newCells = getPlaneCells({ x, y }, currentDir);
      
      if (isValidPlacement(newCells, otherPlanes)) {
        setPlayerPlanes(prev => prev.map(p => 
          p.id === selectedPlaneId ? { ...p, head: { x, y }, cells: newCells } : p
        ));
        audio.playHit();
      } else {
        addLog(t.logInvalidPos);
      }
      return;
    }

    if (playerPlanes.length < PLANE_COUNT) {
      const head = { x, y };
      const cells = getPlaneCells(head, currentDir);
      
      if (isValidPlacement(cells, playerPlanes)) {
        const newPlane: Plane = {
          id: Math.random().toString(36).substr(2, 9),
          head,
          direction: currentDir,
          cells,
          isDestroyed: false
        };
        setPlayerPlanes([...playerPlanes, newPlane]);
        setSelectedPlaneId(newPlane.id);
        audio.playHit();
        addLog(t.logDeployed(playerPlanes.length + 1));
      }
    }
  };

  const handleConfirmPlane = () => {
    setSelectedPlaneId(null);
    audio.playHit();
    if (playerPlanes.length < PLANE_COUNT) {
      addLog(t.logDeployed(playerPlanes.length + 1));
    } else {
      addLog(t.logReady);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPlaneId) {
      setPlayerPlanes(prev => prev.filter(p => p.id !== selectedPlaneId));
      setSelectedPlaneId(null);
      audio.playMiss();
      addLog(t.withdraw);
    }
  };

  const handleChangeDirection = (dir: Direction) => {
    setCurrentDir(dir);
    if (selectedPlaneId) {
      const plane = playerPlanes.find(p => p.id === selectedPlaneId);
      if (plane) {
        const otherPlanes = playerPlanes.filter(p => p.id !== selectedPlaneId);
        const newCells = getPlaneCells(plane.head, dir);
        if (isValidPlacement(newCells, otherPlanes)) {
          setPlayerPlanes(prev => prev.map(p => 
            p.id === selectedPlaneId ? { ...p, direction: dir, cells: newCells } : p
          ));
          audio.playHit();
        }
      }
    }
  };

  const startGame = () => {
    if (playerPlanes.length < PLANE_COUNT) return;
    setEnemyPlanes(generateRandomPlanes());
    setGameStatus('PLAYING');
    setIsPlayerTurn(true);
    setHasFinished(false);
    addLog(t.logBattleStart);
    audio.playKill();
  };

  const processAttack = useCallback((x: number, y: number, attacker: 'PLAYER' | 'ENEMY'): boolean => {
    const isEnemyAttacking = attacker === 'ENEMY';
    const currentBoard = isEnemyAttacking ? playerBoard : enemyBoard;
    const targetPlanes = isEnemyAttacking ? playerPlanes : enemyPlanes;
    
    if (currentBoard[y][x].status !== CellStatus.EMPTY) return false;

    const hitPlane = targetPlanes.find(p => p.cells.some(c => c.x === x && c.y === y));
    let status = CellStatus.MISS;
    let killed = false;

    if (hitPlane) {
      if (hitPlane.head.x === x && hitPlane.head.y === y) {
        status = CellStatus.KILL;
        hitPlane.isDestroyed = true;
        killed = true;
        audio.playKill();
      } else {
        status = CellStatus.HIT;
        audio.playHit();
      }
    } else {
      audio.playMiss();
    }

    const nextBoard = currentBoard.map((row, ry) => row.map((cell, cx) => {
      if (ry === y && cx === x) return { ...cell, status };
      if (killed && hitPlane?.cells.some(c => c.x === cx && c.y === ry)) return { ...cell, status: CellStatus.KILL };
      return cell;
    }));

    if (isEnemyAttacking) {
      setPlayerBoard(nextBoard);
      if (status === CellStatus.HIT) setAiLastHits(prev => [...prev, { x, y }]);
      if (status === CellStatus.KILL) setAiLastHits([]);
    } else {
      setEnemyBoard(nextBoard);
    }

    const attackerName = isEnemyAttacking ? t.attackerEnemy : t.attackerPlayer;
    const statusText = status === CellStatus.KILL ? t.logHitHead : status === CellStatus.HIT ? t.logHitBody : t.logMiss;
    addLog(`${attackerName}: ${statusText}`);

    const allDestroyed = targetPlanes.every(p => p.isDestroyed);
    if (allDestroyed) {
      setWinner(attacker);
      setHasFinished(true); // Stop interactions but keep status as PLAYING for analysis
      return true;
    }

    return false;
  }, [playerBoard, enemyBoard, playerPlanes, enemyPlanes, t]);

  const handleEnemyTurn = useCallback(() => {
    setTimeout(() => {
      const { x, y } = getNextAIShot(playerBoard, aiLastHits);
      processAttack(x, y, 'ENEMY');
      setIsPlayerTurn(true);
    }, 1200);
  }, [playerBoard, aiLastHits, processAttack]);

  const handleAttack = (x: number, y: number) => {
    if (!isPlayerTurn || gameStatus !== 'PLAYING' || hasFinished) return;
    if (enemyBoard[y][x].status !== CellStatus.EMPTY) return;

    const win = processAttack(x, y, 'PLAYER');
    if (!win) {
      setIsPlayerTurn(false);
      handleEnemyTurn();
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 p-4 flex flex-col items-center max-w-4xl mx-auto font-sans text-slate-800 select-none pb-12">
      <header className="w-full flex justify-between items-center py-6 px-4">
        <div className="flex-1" />
        <div className="text-center flex-[2]">
          <h1 className="text-4xl font-black text-sky-900 tracking-tight uppercase italic drop-shadow-sm">{t.title}</h1>
          <div className="h-1.5 w-16 bg-sky-400 mx-auto mt-2 rounded-full" />
        </div>
        <div className="flex-1 flex justify-end">
          <button 
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="bg-white px-3 py-1.5 rounded-full border border-sky-100 shadow-sm text-xs font-bold text-sky-600 hover:bg-sky-50 transition-colors"
          >
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
      </header>

      {gameStatus === 'WELCOME' && (
        <div className="flex flex-col items-center justify-center flex-1 space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-4 border-white text-center max-w-sm">
             <span className="text-6xl mb-4 block">🛩️</span>
             <h2 className="text-2xl font-bold text-slate-800 mb-2">{t.welcomeTitle}</h2>
             <p className="text-slate-500 mb-8 font-medium leading-relaxed">{t.welcomeDesc}</p>
             <button onClick={startSetup} className="w-full bg-sky-600 hover:bg-sky-700 text-white font-black py-5 rounded-2xl shadow-lg transition-all active:scale-95 text-lg">{t.enterReadiness}</button>
          </div>
        </div>
      )}

      {gameStatus === 'SETUP' && (
        <div className="w-full space-y-4 max-w-md animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-sky-100 relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg text-slate-700 uppercase tracking-wide">{t.setupTitle}</h2>
              <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold">{t.planeCount} {playerPlanes.length} / {PLANE_COUNT}</span>
            </div>
            
            <Board 
              data={playerBoard} 
              onCellClick={handleManualPlace}
              onCellPointerMove={(x, y) => isDragging && handleManualPlace(x, y)}
              onPointerUp={() => setIsDragging(false)}
              playerPlanes={playerPlanes}
              selectedPlaneId={selectedPlaneId}
              isSetup
            />

            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {([['UP', t.up], ['DOWN', t.down], ['LEFT', t.left], ['RIGHT', t.right]] as [Direction, string][]).map(([d, label]) => (
                <button 
                  key={d}
                  onClick={() => handleChangeDirection(d)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${currentDir === d ? 'bg-sky-600 text-white border-sky-700 shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {selectedPlaneId ? (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={handleDeleteSelected} className="bg-rose-50 text-rose-500 font-bold py-3 rounded-xl hover:bg-rose-100 transition-all text-sm uppercase border-2 border-rose-100">{t.withdraw}</button>
                  <button onClick={handleConfirmPlane} className="bg-emerald-500 text-white font-black py-3 rounded-xl hover:bg-emerald-600 shadow-md transition-all text-sm uppercase">{t.confirmPos}</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={handleRandomizePlayer} className="bg-slate-50 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-100 transition-all text-sm uppercase border-2 border-slate-100">{t.smartDeploy}</button>
                  <button 
                    onClick={startGame} 
                    disabled={playerPlanes.length < PLANE_COUNT || selectedPlaneId !== null}
                    className={`font-black py-3 rounded-xl shadow-lg transition-all text-sm uppercase ${playerPlanes.length === PLANE_COUNT && !selectedPlaneId ? 'bg-sky-600 text-white hover:bg-sky-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    {t.startBattle}
                  </button>
                </div>
              )}
            </div>

            <p className="text-[10px] text-center mt-4 text-slate-400 font-medium">
              {selectedPlaneId ? t.tipAdjust : t.tipNext}
            </p>

            <button onClick={() => { setPlayerPlanes([]); setSelectedPlaneId(null); audio.playMiss(); }} className="w-full mt-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest py-2 hover:text-rose-400 transition-colors">
              {t.clearAirspace}
            </button>
          </div>
        </div>
      )}

      {gameStatus === 'PLAYING' && (
        <div className="w-full grid md:grid-cols-2 gap-8 items-start animate-in fade-in duration-500">
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                <span className={`w-2 h-2 bg-rose-500 rounded-full ${!hasFinished ? 'animate-ping' : ''}`} /> {t.enemyAirspace}
              </h3>
              <div className="flex gap-1">
                {enemyPlanes.map((p, i) => (
                  <div key={i} className={`w-3 h-3 rounded-full transition-all duration-500 ${p.isDestroyed ? 'bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.5)]' : 'bg-rose-100 border border-rose-200'}`} />
                ))}
              </div>
            </div>
            <Board 
              data={enemyBoard} 
              onCellClick={handleAttack} 
              isInteractable={isPlayerTurn && !hasFinished} 
            />
            {hasFinished ? (
               <div className="bg-amber-100 text-amber-800 p-4 rounded-2xl text-center shadow-inner border border-amber-200 flex flex-col gap-3 animate-in slide-in-from-top-4">
                 <p className="font-black text-sm uppercase tracking-wider">{t.combatEnded}</p>
                 <button onClick={() => setGameStatus('OVER')} className="bg-amber-600 text-white font-bold py-2 px-6 rounded-xl hover:bg-amber-700 transition-all text-xs uppercase shadow-md">
                   {t.viewReport}
                 </button>
               </div>
            ) : (
              <div className={`text-center py-2 rounded-xl font-black text-sm uppercase tracking-widest transition-colors ${isPlayerTurn ? 'text-sky-600' : 'text-slate-400'}`}>
                {isPlayerTurn ? t.yourTurn : t.enemyThinking}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xs font-black text-sky-500 uppercase tracking-widest">{t.myFleet}</h3>
              <div className="flex gap-1">
                {playerPlanes.map((p, i) => (
                  <div key={i} className={`w-3 h-3 rounded-full transition-all duration-500 ${p.isDestroyed ? 'bg-sky-600 shadow-[0_0_8px_rgba(2,132,199,0.5)]' : 'bg-sky-100 border border-sky-200'}`} />
                ))}
              </div>
            </div>
            <Board 
              data={playerBoard} 
              playerPlanes={playerPlanes}
              isPlayerBoard
            />
            <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 min-h-[120px]">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">{t.radarLog}</h4>
              {logs.map((log, i) => (
                <div key={i} className={`text-xs ${i === 0 ? 'text-slate-800 font-bold' : 'text-slate-400'} py-0.5 border-b border-slate-50 last:border-0`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {gameStatus === 'OVER' && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-[3rem] p-10 text-center shadow-2xl max-w-sm w-full animate-in zoom-in-50 duration-300">
            <div className={`text-7xl mb-6 ${winner === 'PLAYER' ? 'text-sky-500' : 'text-rose-500'}`}>
              {winner === 'PLAYER' ? '🏆' : '🏳️'}
            </div>
            <h2 className="text-4xl font-black mb-2 text-slate-800 italic uppercase">
              {winner === 'PLAYER' ? t.victory : t.defeat}
            </h2>
            <p className="text-slate-500 mb-10 font-medium leading-relaxed">
              {winner === 'PLAYER' ? t.victoryDesc : t.defeatDesc}
            </p>
            <button 
              onClick={() => { setGameStatus('WELCOME'); audio.playKill(); }}
              className="w-full bg-sky-600 text-white font-black py-5 rounded-2xl shadow-lg hover:bg-sky-700 transition-all active:scale-95"
            >
              {t.returnBase}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface BoardProps {
  data: BoardData;
  onCellClick?: (x: number, y: number) => void;
  onCellPointerMove?: (x: number, y: number) => void;
  onPointerUp?: () => void;
  isInteractable?: boolean;
  isPlayerBoard?: boolean;
  playerPlanes?: Plane[];
  selectedPlaneId?: string | null;
  isSetup?: boolean;
}

const Board: React.FC<BoardProps> = ({ 
  data, onCellClick, onCellPointerMove, onPointerUp, isInteractable = true, isPlayerBoard, playerPlanes, selectedPlaneId, isSetup 
}) => {
  return (
    <div 
      className="grid grid-cols-10 gap-0.5 bg-sky-100 p-0.5 rounded-xl shadow-inner aspect-square w-full border-2 border-sky-100 overflow-hidden touch-none"
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {data.map((row, y) => 
        row.map((cell, x) => {
          const plane = playerPlanes?.find(p => p.cells.some(c => c.x === x && c.y === y));
          const isPlayerPlanePart = !!plane;
          const isPlayerHead = plane?.head.x === x && plane?.head.y === y;
          const isDestroyed = plane?.isDestroyed;
          const isSelected = plane?.id === selectedPlaneId;
          const isOtherConfirmedPlane = isPlayerPlanePart && !isSelected;
          
          return (
            <Cell 
              key={`${x}-${y}`} 
              status={cell.status} 
              isPlayerPlanePart={isPlayerPlanePart}
              isPlayerHead={isPlayerHead}
              isDestroyed={isDestroyed}
              isSelected={isSelected}
              isConfirmed={isOtherConfirmedPlane}
              onClick={() => onCellClick?.(x, y)}
              onPointerEnter={() => onCellPointerMove?.(x, y)}
              disabled={!isInteractable}
              isSetup={isSetup}
            />
          );
        })
      )}
    </div>
  );
};

interface CellProps {
  status: CellStatus;
  isPlayerPlanePart?: boolean;
  isPlayerHead?: boolean;
  isDestroyed?: boolean;
  isSelected?: boolean;
  isConfirmed?: boolean;
  onClick: () => void;
  onPointerEnter?: () => void;
  disabled?: boolean;
  isSetup?: boolean;
}

const Cell: React.FC<CellProps> = ({ 
  status, isPlayerPlanePart, isPlayerHead, isDestroyed, isSelected, isConfirmed, onClick, onPointerEnter, disabled, isSetup 
}) => {
  let bgColor = 'bg-white';

  if (status === CellStatus.MISS) bgColor = 'bg-slate-200';
  if (status === CellStatus.HIT) bgColor = 'bg-orange-400';
  if (status === CellStatus.KILL) bgColor = 'bg-rose-600';

  if (isPlayerPlanePart && status === CellStatus.EMPTY) {
    if (isDestroyed) {
       bgColor = 'bg-slate-400';
    } else {
       if (isSelected) {
         bgColor = isPlayerHead ? 'bg-sky-600' : 'bg-sky-300';
       } else if (isConfirmed) {
         bgColor = isPlayerHead ? 'bg-sky-400/80' : 'bg-sky-100/80';
       } else {
         bgColor = isPlayerHead ? 'bg-sky-400' : 'bg-sky-100';
       }
    }
  }

  return (
    <button
      onPointerDown={(e) => {
        if (isSetup) e.currentTarget.releasePointerCapture(e.pointerId);
        onClick();
      }}
      onPointerEnter={onPointerEnter}
      disabled={(!isSetup && disabled) || (!isSetup && status !== CellStatus.EMPTY)}
      className={`grid-cell w-full transition-all duration-200 relative ${bgColor} ${!disabled && status === CellStatus.EMPTY ? 'hover:brightness-95 active:scale-90' : ''} flex items-center justify-center rounded-[2px]`}
    >
      {status === CellStatus.MISS && <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />}
      {status === CellStatus.HIT && <div className="w-2.5 h-2.5 bg-orange-100/50 rounded-sm rotate-45 animate-pulse" />}
      {status === CellStatus.KILL && <div className="text-white text-[10px] font-black">×</div>}
      {isPlayerHead && !status && (
        <div className={`absolute inset-0 border-2 ${isSelected ? 'border-sky-800 animate-pulse' : isConfirmed ? 'border-sky-600/30' : 'border-white/40'} rounded-sm`} />
      )}
      {isSelected && isPlayerPlanePart && !isPlayerHead && (
        <div className="absolute inset-0 border border-sky-400/20" />
      )}
    </button>
  );
};

export default App;
