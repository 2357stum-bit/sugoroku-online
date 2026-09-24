import { useEffect, useMemo, useRef, useState } from "react";
import { parseLevel, isDoorOpen } from "./puzzleEngine.js";
import { move as moveOnServer } from "./puzzleRoom.js";

const KEY_MAP = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

const SWITCH_KEYS = new Set(["Tab", "KeyQ"]);

function cellInfo(level, game, x, y) {
  const k = `${x},${y}`;
  if (level.walls.has(k)) return { type: "wall" };
  const isTarget = level.targets.has(k);
  const switchId = level.switches.get(k);
  const doorId = level.doors.get(k);
  const box = game.boxes.find((b) => b.x === x && b.y === y);
  const p0 = game.players[0].x === x && game.players[0].y === y;
  const p1 = game.players[1].x === x && game.players[1].y === y;
  return {
    type: "floor",
    isTarget,
    switchId,
    doorId,
    doorOpen: doorId ? isDoorOpen(level, game, x, y) : null,
    box: box ? (isTarget ? "box-on-target" : "box") : null,
    p0,
    p1,
  };
}

// isSolo: ゲスト不在(ひとりプレイ)の場合、自分でp0/p1を切り替えながら両方を操作する。
export default function PuzzleBoard({ room, code, uid, myIdx, isSolo, hint }) {
  const game = room.game;
  const level = useMemo(() => parseLevel(game.levelId), [game.levelId]);
  const pendingRef = useRef(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const controlledIdx = isSolo ? activeIdx : myIdx;

  async function sendMove(dir) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    try {
      await moveOnServer(code, uid, dir, isSolo ? activeIdx : undefined);
    } catch {
      // 通信エラー時は次のキー入力で再試行されるので、ここでは無視する
    } finally {
      pendingRef.current = false;
    }
  }

  function toggleActive() {
    setActiveIdx((i) => (i === 0 ? 1 : 0));
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isSolo && SWITCH_KEYS.has(e.code)) {
        e.preventDefault();
        toggleActive();
        return;
      }
      const dir = KEY_MAP[e.code];
      if (!dir) return;
      e.preventDefault();
      sendMove(dir);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, uid, isSolo, activeIdx]);

  const rows = [];
  for (let y = 0; y < level.height; y++) {
    const cells = [];
    for (let x = 0; x < level.width; x++) {
      const info = cellInfo(level, game, x, y);
      if (info.type === "wall") {
        cells.push(<div key={x} className="pzl-cell pzl-wall" />);
        continue;
      }
      const classes = ["pzl-cell", "pzl-floor"];
      if (info.isTarget) classes.push("pzl-target");
      if (info.doorId) classes.push(info.doorOpen ? "pzl-door-open" : "pzl-door-closed");
      cells.push(
        <div key={x} className={classes.join(" ")}>
          {info.switchId && <span className="pzl-switch-mark">◆</span>}
          {info.box && <span className={"pzl-box" + (info.box === "box-on-target" ? " pzl-box-placed" : "")}>📦</span>}
          {info.p0 && <span className={"pzl-player pzl-player-0" + (controlledIdx === 0 ? " pzl-me" : "")}>🧑</span>}
          {info.p1 && <span className={"pzl-player pzl-player-1" + (controlledIdx === 1 ? " pzl-me" : "")}>🧑‍🦰</span>}
        </div>
      );
    }
    rows.push(
      <div className="pzl-row" key={y}>
        {cells}
      </div>
    );
  }

  return (
    <div className="pzl-wrap">
      <div className="pzl-topbar">
        <span>てかず {game.moves}</span>
      </div>
      <div className="pzl-board" style={{ "--pzl-cols": level.width, "--pzl-rows": level.height }}>
        {rows}
      </div>
      <p className="pzl-hint">{hint}</p>
      {isSolo && (
        <button className="sgr-btn sgr-secondary pzl-switch-btn" onClick={toggleActive}>
          {activeIdx === 0 ? "🧑" : "🧑‍🦰"} を操作中(タップかTab/Qキーで切り替え)
        </button>
      )}
      <div className="pzl-dpad" aria-hidden="false">
        <button className="pzl-dpad-btn pzl-dpad-up" onClick={() => sendMove("up")} aria-label="上へ">▲</button>
        <button className="pzl-dpad-btn pzl-dpad-left" onClick={() => sendMove("left")} aria-label="左へ">◀</button>
        <button className="pzl-dpad-btn pzl-dpad-right" onClick={() => sendMove("right")} aria-label="右へ">▶</button>
        <button className="pzl-dpad-btn pzl-dpad-down" onClick={() => sendMove("down")} aria-label="下へ">▼</button>
      </div>
    </div>
  );
}
