import { useEffect, useRef, useState } from "react";
import { FIELD_W, FIELD_H, STAGES, getActiveTargets, tryHit, FIRE_COOLDOWN_MS } from "./galleryEngine.js";
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

// 各ステージは「スタート」ボタンを押した瞬間からそのステージだけの時間を計測する
// (前のステージの時間は引き継がない)。phase: "ready"(開始待ち) -> "playing"(プレイ中)
// -> "cleared"(結果表示、次へボタン待ち)。
export default function GalleryCanvas({ room, code, uid, onFinished }) {
  const canvasRef = useRef(null);
  const roomRef = useRef(room);
  const stageStartRef = useRef(null); // このステージを開始したperformance.now()
  const reticleRef = useRef({ x: FIELD_W / 2, y: FIELD_H / 2 });
  const keysRef = useRef({});
  const hitIdsRef = useRef(new Set());
  const comboRef = useRef(0);
  const scoreRef = useRef(0); // 全ステージ通算スコア
  const popupsRef = useRef([]);
  const lastFireRef = useRef(-Infinity);
  const lastPublishRef = useRef(0);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const [stageIdx, setStageIdx] = useState(0);
  const [phase, setPhase] = useState("ready"); // "ready" | "playing" | "cleared"
  const [hud, setHud] = useState({ score: 0, combo: 0, timeLeftMs: STAGES[0].duration, opponentScore: null });

  const stage = STAGES[stageIdx];
  const isLastStage = stageIdx === STAGES.length - 1;

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  function currentElapsed() {
    if (!stageStartRef.current) return null;
    return performance.now() - stageStartRef.current;
  }

  function startStage() {
    hitIdsRef.current = new Set();
    comboRef.current = 0;
    lastFireRef.current = -Infinity;
    lastTsRef.current = null;
    stageStartRef.current = performance.now();
    setHud((h) => ({ score: scoreRef.current, combo: 0, timeLeftMs: stage.duration, opponentScore: h.opponentScore }));
    setPhase("playing");
  }

  function fireAt(px, py, now) {
    if (phase !== "playing") return;
    const elapsed = currentElapsed();
    if (elapsed == null) return;
    if (now - lastFireRef.current < FIRE_COOLDOWN_MS) return;
    lastFireRef.current = now;
    const result = tryHit(stage, elapsed, hitIdsRef.current, comboRef.current, px, py);
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
  }, [phase, stageIdx]);

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
  }, [phase, stageIdx]);

  useEffect(() => {
    if (phase !== "playing") return;
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

      if (elapsed >= stage.duration) {
        publishScore(code, uid, scoreRef.current).catch(() => {});
        if (isLastStage) {
          markFinished(code, uid, scoreRef.current).catch(() => {});
          onFinished(scoreRef.current);
        }
        setPhase("cleared");
        return;
      }

      drawBackground(ctx, stage.id, elapsed);
      const active = getActiveTargets(stage, elapsed, hitIdsRef.current);
      for (const t of active) drawTarget(ctx, stage.id, t, elapsed);
      drawPopups(ctx, popupsRef.current, performance.now());
      popupsRef.current = popupsRef.current.filter((p) => performance.now() - p.bornAt < 700);
      drawReticle(ctx, reticleRef.current.x, reticleRef.current.y);

      if (ts - lastPublishRef.current >= PUBLISH_MS) {
        lastPublishRef.current = ts;
        publishScore(code, uid, scoreRef.current).catch(() => {});
      }

      const currentRoom = roomRef.current;
      const otherUid = currentRoom.hostUid === uid ? currentRoom.guestUid : currentRoom.hostUid;
      setHud({
        score: scoreRef.current,
        combo: comboRef.current,
        timeLeftMs: stage.duration - elapsed,
        opponentScore: otherUid ? currentRoom.scores?.[otherUid] ?? 0 : null,
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stageIdx]);

  function handleNextStage() {
    if (isLastStage) return;
    setStageIdx((i) => i + 1);
    setPhase("ready");
  }

  const secLeft = Math.ceil(Math.max(0, hud.timeLeftMs) / 1000);
  const opponentScore = hud.opponentScore ?? (room.hostUid === uid ? room.scores?.[room.guestUid] : room.scores?.[room.hostUid]);

  if (phase === "ready") {
    return (
      <div className="sgr-card gly-stage-card">
        <div className="gly-stage-icon">{STAGE_THEME[stage.id]?.icon || "🎯"}</div>
        <h2 className="gly-stage-title">
          ステージ {stageIdx + 1}/{STAGES.length}: {stage.name}
        </h2>
        <p className="gly-hint-text">{stage.hint}</p>
        <p className="gly-hint-text">制限時間 {stage.duration / 1000}秒 ／ これまでのスコア {scoreRef.current.toLocaleString()}</p>
        <button className="sgr-btn" onClick={startStage}>
          スタート
        </button>
      </div>
    );
  }

  if (phase === "cleared") {
    return (
      <div className="sgr-card gly-stage-card">
        <div className="gly-stage-icon">✅</div>
        <h2 className="gly-stage-title">ステージ{stageIdx + 1} クリア！</h2>
        <p className="gly-hint-text">通算スコア {scoreRef.current.toLocaleString()}</p>
        {opponentScore != null && <p className="gly-hint-text">相手のスコア {opponentScore.toLocaleString()}</p>}
        {!isLastStage ? (
          <button className="sgr-btn" onClick={handleNextStage}>
            つぎのステージへ
          </button>
        ) : (
          <p className="gly-hint-text">けっかを集計しています…</p>
        )}
      </div>
    );
  }

  return (
    <div className="gly-wrap">
      <div className="gly-hud">
        <span>スコア {hud.score.toLocaleString()}</span>
        {hud.combo >= 3 && <span className="gly-combo">combo x{hud.combo}</span>}
        <span>のこり {secLeft}秒</span>
      </div>
      <div className="gly-stage-label">
        ステージ {stageIdx + 1}/{STAGES.length}: {stage.name}
      </div>
      {opponentScore != null && <div className="gly-opponent">相手のスコア {opponentScore.toLocaleString()}</div>}
      <canvas ref={canvasRef} width={FIELD_W} height={FIELD_H} className="gly-canvas" />
      <p className="gly-hint">狙った場所をタップ/クリック、または矢印キー+スペースで発射</p>
    </div>
  );
}
