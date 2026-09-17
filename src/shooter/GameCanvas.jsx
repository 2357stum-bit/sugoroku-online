import { useEffect, useRef, useState } from "react";
import { createInitialState, advanceShooter, FIELD_W, FIELD_H, BOSS_MAX_HP } from "./shooterEngine.js";
import { publishHostState, publishGuestInput, endGame } from "./shooterRoom.js";

const PLAYER_SPEED = 220; // px/秒(ローカル入力での移動速度)
const HOST_PUBLISH_MS = 90;
const GUEST_PUBLISH_MS = 70;

const KEY_MAP = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function drawStarfield(ctx, t) {
  ctx.fillStyle = "#050818";
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 40; i++) {
    const x = (i * 53 + 17) % FIELD_W;
    const speed = 40 + (i % 5) * 20;
    const y = ((i * 97 + t * speed * 0.001) % (FIELD_H + 20)) - 10;
    const size = i % 3 === 0 ? 2 : 1;
    ctx.globalAlpha = 0.3 + (i % 4) * 0.15;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx, x, y, color, flicker) {
  if (flicker) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(9, 10);
  ctx.lineTo(0, 5);
  ctx.lineTo(-9, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = e.type === "weaver" ? "#ff7ad9" : "#ff5470";
  ctx.beginPath();
  ctx.arc(0, 0, e.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(e.type === "weaver" ? "❄" : "▲", 0, 3);
  ctx.restore();
}

function drawBoss(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = "#b388ff";
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "26px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("👹", 0, 9);
  ctx.restore();
}

function drawBullet(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function render(ctx, state, uid, guestUid, t) {
  drawStarfield(ctx, t);

  state.enemies.forEach((e) => drawEnemy(ctx, e));
  if (state.boss) drawBoss(ctx, state.boss);

  state.enemyBullets.forEach((b) => drawBullet(ctx, b.x, b.y, 5, "#ffcc4d"));
  state.playerBullets.forEach((b) => drawBullet(ctx, b.x, b.y, 4, "#34e0ff"));

  Object.entries(state.players).forEach(([pid, p]) => {
    if (!p.alive) return;
    const flicker = state.elapsed < p.invulnUntil && Math.floor(state.elapsed / 100) % 2 === 0;
    const color = pid === uid ? "#7cffb2" : pid === guestUid ? "#ffd166" : "#5dc3ff";
    drawShip(ctx, p.x, p.y, color, flicker);
  });

  if (state.boss) {
    const w = FIELD_W - 40;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(20, 14, w, 8);
    ctx.fillStyle = "#b388ff";
    ctx.fillRect(20, 14, w * Math.max(0, state.boss.hp / state.boss.maxHp), 8);
  }
}

export default function GameCanvas({ room, code, uid, isHost, onResult }) {
  const canvasRef = useRef(null);
  const hostStateRef = useRef(null);
  const localPosRef = useRef({ x: FIELD_W / 2, y: FIELD_H - 70 });
  const keysRef = useRef({});
  const draggingRef = useRef(false);
  const roomRef = useRef(room);
  const lastPublishRef = useRef(0);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const [hud, setHud] = useState({ score: 0, hp: 3, lives: 3, bossHp: null, bossMaxHp: BOSS_MAX_HP, stage: "wave" });

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // ホストは自分のuidの初期位置から、ゲストは受信済みの自分の位置(なければ初期値)から始める
  useEffect(() => {
    const me = room.hostState?.players?.[uid];
    if (me) localPosRef.current = { x: me.x, y: me.y };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isHost && !hostStateRef.current) {
      const uids = [room.hostUid, room.guestUid].filter(Boolean);
      hostStateRef.current = room.hostState || createInitialState(uids);
    }
  }, [isHost, room.hostUid, room.guestUid, room.hostState]);

  // キーボード入力
  useEffect(() => {
    const onDown = (e) => {
      if (KEY_MAP[e.code]) {
        keysRef.current[KEY_MAP[e.code]] = true;
        e.preventDefault();
      }
    };
    const onUp = (e) => {
      if (KEY_MAP[e.code]) {
        keysRef.current[KEY_MAP[e.code]] = false;
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // タッチ/マウスのドラッグ操作
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const toField = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      return {
        x: clamp(((clientX - rect.left) / rect.width) * FIELD_W, 10, FIELD_W - 10),
        y: clamp(((clientY - rect.top) / rect.height) * FIELD_H, 10, FIELD_H - 10),
      };
    };
    const onPointerDown = (e) => {
      draggingRef.current = true;
      localPosRef.current = toField(e.clientX, e.clientY);
    };
    const onPointerMove = (e) => {
      if (!draggingRef.current) return;
      localPosRef.current = toField(e.clientX, e.clientY);
    };
    const onPointerUp = () => {
      draggingRef.current = false;
    };
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");

    const loop = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min(50, ts - lastTsRef.current);
      lastTsRef.current = ts;

      // キーボード移動をローカル位置に反映(ドラッグ中でなければ)
      if (!draggingRef.current) {
        const k = keysRef.current;
        const dist = (PLAYER_SPEED * dt) / 1000;
        let { x, y } = localPosRef.current;
        if (k.up) y -= dist;
        if (k.down) y += dist;
        if (k.left) x -= dist;
        if (k.right) x += dist;
        localPosRef.current = { x: clamp(x, 10, FIELD_W - 10), y: clamp(y, 10, FIELD_H - 10) };
      }

      const currentRoom = roomRef.current;
      let displayState;

      if (isHost) {
        const positions = { [uid]: localPosRef.current };
        if (currentRoom.guestUid && currentRoom.guestInput) {
          positions[currentRoom.guestUid] = { x: currentRoom.guestInput.x, y: currentRoom.guestInput.y };
        }
        hostStateRef.current = advanceShooter(hostStateRef.current, dt, positions);
        displayState = hostStateRef.current;

        if (ts - lastPublishRef.current >= HOST_PUBLISH_MS) {
          lastPublishRef.current = ts;
          publishHostState(code, hostStateRef.current).catch(() => {});
          if (hostStateRef.current.result && currentRoom.status === "playing") {
            endGame(code).catch(() => {});
          }
        }
      } else {
        displayState = currentRoom.hostState;
        if (ts - lastPublishRef.current >= GUEST_PUBLISH_MS) {
          lastPublishRef.current = ts;
          publishGuestInput(code, localPosRef.current.x, localPosRef.current.y).catch(() => {});
        }
      }

      if (displayState) {
        const renderState = isHost
          ? displayState
          : { ...displayState, players: { ...displayState.players, [uid]: { ...displayState.players[uid], ...localPosRef.current, alive: displayState.players[uid]?.alive ?? true } } };
        render(ctx, renderState, uid, currentRoom.guestUid, displayState.elapsed || 0);
        const me = renderState.players[uid];
        setHud({
          score: displayState.score || 0,
          hp: me?.hp ?? 0,
          lives: me?.lives ?? 0,
          bossHp: displayState.boss ? displayState.boss.hp : null,
          bossMaxHp: displayState.boss ? displayState.boss.maxHp : BOSS_MAX_HP,
          stage: displayState.stage,
        });
        if (displayState.result) {
          onResult(displayState.result, displayState.score || 0);
          return;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, uid, code]);

  return (
    <div className="sgt-canvas-wrap">
      <div className="sgt-hud">
        <span>❤️{Math.max(0, hud.hp)} / 🎯{hud.lives}</span>
        <span>スコア {hud.score}</span>
      </div>
      {hud.bossHp != null && (
        <div className="sgt-boss-label">👹 ボスHP {Math.max(0, hud.bossHp)}/{hud.bossMaxHp}</div>
      )}
      <canvas ref={canvasRef} width={FIELD_W} height={FIELD_H} className="sgt-canvas" />
      <div className="sgt-hint">矢印キー/WASD、またはドラッグで移動（弾は自動発射）</div>
    </div>
  );
}
