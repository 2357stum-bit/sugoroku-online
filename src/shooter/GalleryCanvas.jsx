import { useEffect, useRef, useState } from "react";
import {
  FIELD_W,
  FIELD_H,
  STAGES,
  TOTAL_DURATION,
  getStageAt,
  getActiveTargets,
  tryHit,
  FIRE_COOLDOWN_MS,
} from "./galleryEngine.js";
import { publishScore, markFinished } from "./galleryRoom.js";

const PUBLISH_MS = 250;
const RETICLE_KEY_SPEED = 340; // px/秒(キーボード操作時)

const STAGE_THEME = {
  1: { icon: "🐴", small: "🎯", grad: ["#3a2a1a", "#1c130c"] },
  2: { icon: "🤖", small: "🛸", grad: ["#0c1c2e", "#050b16"] },
  3: { icon: "🎈", small: "⭐", grad: ["#123", "#0a1024"] },
};
const KIND_ICON = { finale: "🦖", bonus: "⭐" };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function drawBackground(ctx, stageId, t) {
  const theme = STAGE_THEME[stageId] || STAGE_THEME[1];
  const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  g.addColorStop(0, theme.grad[0]);
  g.addColorStop(1, theme.grad[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 24; i++) {
    const x = (i * 61 + 13) % FIELD_W;
    const y = ((i * 89 + t * 0.02) % (FIELD_H + 20)) - 10;
    ctx.globalAlpha = 0.08 + (i % 4) * 0.03;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function drawTarget(ctx, stageId, target, elapsedForPulse) {
  const theme = STAGE_THEME[stageId] || STAGE_THEME[1];
  const icon = KIND_ICON[target.kind] || (target.points >= 250 ? theme.small : theme.icon);
  let r = target.r;
  if (target.kind === "finale") r *= 1 + 0.05 * Math.sin(elapsedForPulse / 150);
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = target.kind === "finale" ? "rgba(255, 209, 102, 0.28)" : "rgba(255,255,255,0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `${Math.round(r * 1.3)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, 0, 1);
  ctx.restore();
}

function drawReticle(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#9ee047";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-24, 0); ctx.lineTo(-8, 0);
  ctx.moveTo(8, 0); ctx.lineTo(24, 0);
  ctx.moveTo(0, -24); ctx.lineTo(0, -8);
  ctx.moveTo(0, 8); ctx.lineTo(0, 24);
  ctx.stroke();
  ctx.restore();
}

function drawPopups(ctx, popups, now) {
  ctx.textAlign = "center";
  for (const p of popups) {
    const age = now - p.bornAt;
    if (age > 700) continue;
    const alpha = 1 - age / 700;
    const dy = -age * 0.04;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(p.text, p.x, p.y + dy);
  }
  ctx.globalAlpha = 1;
}

export default function GalleryCanvas({ room, code, uid, onFinished }) {
  const canvasRef = useRef(null);
  const roomRef = useRef(room);
  // 経過時間は端末のシステム時計(Date.now())をサーバーのタイムスタンプと突き合わせて
  // 毎フレーム計算するのではなく、ゲーム開始を検知した瞬間に一度だけ基準点(anchor)を
  // 決め、以後は端末内で単調増加するperformance.now()の差分だけで進める。
  // こうすることで、端末の時計がずれている(実時刻と合っていない)場合でも、
  // 「開始した瞬間からの経過時間」自体は正しく計測できる。
  const anchorRef = useRef(null); // { baseElapsedMs, baseLocalTime }
  const reticleRef = useRef({ x: FIELD_W / 2, y: FIELD_H / 2 });
  const keysRef = useRef({});
  const hitIdsRef = useRef(new Set());
  const comboRef = useRef(0);
  const scoreRef = useRef(0);
  const popupsRef = useRef([]);
  const lastFireRef = useRef(-Infinity);
  const lastPublishRef = useRef(0);
  const finishedRef = useRef(false);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const [hud, setHud] = useState({ score: 0, combo: 0, stageIdx: 0, stageName: "", timeLeftMs: TOTAL_DURATION, opponentScore: null });

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (anchorRef.current) return; // 基準点は最初の1回だけ決める
    let baseElapsedMs = 0;
    if (room.startedAt && typeof room.startedAt.toMillis === "function") {
      // 再読み込みなどで既に始まっている試合に戻ってきた場合は、サーバー時刻を
      // 目安にどこまで進んでいたかを推定する(あくまで初期値。端末時計がずれて
      // いても、0〜制限時間の範囲にクランプするので暴走はしない)。
      const guess = Date.now() - room.startedAt.toMillis();
      if (Number.isFinite(guess)) baseElapsedMs = clamp(guess, 0, TOTAL_DURATION - 1);
    }
    anchorRef.current = { baseElapsedMs, baseLocalTime: performance.now() };
  }, [room.startedAt]);

  function currentElapsed() {
    if (!anchorRef.current) return null;
    return anchorRef.current.baseElapsedMs + (performance.now() - anchorRef.current.baseLocalTime);
  }

  function fireAt(px, py, now) {
    const elapsed = currentElapsed();
    if (elapsed == null) return;
    if (now - lastFireRef.current < FIRE_COOLDOWN_MS) return;
    lastFireRef.current = now;
    const info = getStageAt(elapsed);
    if (!info) return;
    const result = tryHit(info.stage, info.localElapsed, hitIdsRef.current, comboRef.current, px, py);
    if (result) {
      hitIdsRef.current.add(result.id);
      comboRef.current = result.combo;
      scoreRef.current += result.gained;
      popupsRef.current.push({ x: px, y: py, text: `+${result.gained}`, bornAt: performance.now() });
    } else {
      comboRef.current = 0;
    }
  }

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const toField = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      return {
        x: clamp(((clientX - rect.left) / rect.width) * FIELD_W, 0, FIELD_W),
        y: clamp(((clientY - rect.top) / rect.height) * FIELD_H, 0, FIELD_H),
      };
    };
    const onMove = (e) => {
      reticleRef.current = toField(e.clientX, e.clientY);
    };
    const onDown = (e) => {
      const pos = toField(e.clientX, e.clientY);
      reticleRef.current = pos;
      fireAt(pos.x, pos.y, performance.now());
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        fireAt(reticleRef.current.x, reticleRef.current.y, performance.now());
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        keysRef.current[e.code] = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");

    const loop = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min(50, ts - lastTsRef.current);
      lastTsRef.current = ts;

      const k = keysRef.current;
      if (k.ArrowUp || k.KeyW || k.ArrowDown || k.KeyS || k.ArrowLeft || k.KeyA || k.ArrowRight || k.KeyD) {
        const dist = (RETICLE_KEY_SPEED * dt) / 1000;
        let { x, y } = reticleRef.current;
        if (k.ArrowUp || k.KeyW) y -= dist;
        if (k.ArrowDown || k.KeyS) y += dist;
        if (k.ArrowLeft || k.KeyA) x -= dist;
        if (k.ArrowRight || k.KeyD) x += dist;
        reticleRef.current = { x: clamp(x, 0, FIELD_W), y: clamp(y, 0, FIELD_H) };
      }

      const elapsed = currentElapsed();
      if (elapsed == null) {
        ctx.fillStyle = "#0a0e13";
        ctx.fillRect(0, 0, FIELD_W, FIELD_H);
        ctx.fillStyle = "#eef1ff";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("準備中…", FIELD_W / 2, FIELD_H / 2);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const info = getStageAt(elapsed);

      if (!info) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          markFinished(code, uid, scoreRef.current).catch(() => {});
          onFinished(scoreRef.current);
        }
        return;
      }

      drawBackground(ctx, info.stage.id, elapsed);
      const active = getActiveTargets(info.stage, info.localElapsed, hitIdsRef.current);
      for (const t of active) drawTarget(ctx, info.stage.id, t, info.localElapsed);
      drawPopups(ctx, popupsRef.current, performance.now());
      popupsRef.current = popupsRef.current.filter((p) => performance.now() - p.bornAt < 700);
      drawReticle(ctx, reticleRef.current.x, reticleRef.current.y);

      if (ts - lastPublishRef.current >= PUBLISH_MS) {
        lastPublishRef.current = ts;
        publishScore(code, uid, scoreRef.current).catch(() => {});
      }

      const currentRoom = roomRef.current;
      const otherUid = currentRoom.hostUid === uid ? currentRoom.guestUid : currentRoom.hostUid;
      const stageIdx = STAGES.findIndex((s) => s.id === info.stage.id);
      setHud({
        score: scoreRef.current,
        combo: comboRef.current,
        stageIdx,
        stageName: info.stage.name,
        timeLeftMs: TOTAL_DURATION - elapsed,
        opponentScore: otherUid ? currentRoom.scores?.[otherUid] ?? 0 : null,
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, uid]);

  const stageTimeLeft = Math.max(0, hud.timeLeftMs);
  const secLeft = Math.ceil(stageTimeLeft / 1000);

  return (
    <div className="gly-wrap">
      <div className="gly-hud">
        <span>スコア {hud.score.toLocaleString()}</span>
        {hud.combo >= 3 && <span className="gly-combo">combo x{hud.combo}</span>}
        <span>のこり {secLeft}秒</span>
      </div>
      <div className="gly-stage-label">
        ステージ {Math.max(hud.stageIdx, 0) + 1}/{STAGES.length}: {hud.stageName}
      </div>
      {hud.opponentScore != null && (
        <div className="gly-opponent">相手のスコア {hud.opponentScore.toLocaleString()}</div>
      )}
      <canvas ref={canvasRef} width={FIELD_W} height={FIELD_H} className="gly-canvas" />
      <p className="gly-hint">狙った場所をタップ/クリック、または矢印キー+スペースで発射</p>
    </div>
  );
}
