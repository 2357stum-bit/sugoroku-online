import { useEffect, useRef, useState } from "react";
import { FIELD_W, FIELD_H, STAGES, getActiveTargets, tryHit, getBonusWindow, FIRE_COOLDOWN_MS } from "./galleryEngine.js";
import { publishScore, markFinished } from "./galleryRoom.js";
import { setBgmStage, setBgmMode, sfxHit, sfxMiss, sfxSecretFound, sfxStageClear } from "./galleryAudio.js";

const PUBLISH_MS = 250;
const RETICLE_KEY_SPEED = 340; // px/秒(キーボード操作時)
const PROJECTILE_MS = 110;
const GUN_ORIGIN = { x: FIELD_W / 2, y: FIELD_H - 6 };

const STAGE_THEME = {
  1: { icon: "🎈", small: "⭐", grad: ["#1c2f52", "#ffb37a"] },
  2: { icon: "🎠", small: "✨", grad: ["#3a1a3a", "#180c1c"] },
  3: { icon: "🤖", small: "🛸", grad: ["#0c1c2e", "#050b16"] },
  4: { icon: "🦆", small: "🎯", grad: ["#123a2a", "#0a1c14"] },
  5: { icon: "🐴", small: "🎯", grad: ["#3a2a1a", "#1c130c"] },
};
const KIND_ICON = { finale: "🦖", bonus: "⭐", bonusWave: "⭐" };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function fillGradient(ctx, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
}

function drawCloud(ctx, x, y, scale) {
  ctx.beginPath();
  ctx.ellipse(x, y, 30 * scale, 11 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 18 * scale, y - 4 * scale, 18 * scale, 9 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 16 * scale, y + 2 * scale, 16 * scale, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ① きょうりゅうのふうせん: 夕焼け空にゆったり流れる雲
function drawSkyBackground(ctx, t) {
  const theme = STAGE_THEME[1];
  fillGradient(ctx, theme.grad[0], theme.grad[1]);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 0; i < 5; i++) {
    const y = 70 + i * 95;
    const speed = 6 + (i % 3) * 3;
    const x = ((i * 130 + t * speed * 0.001) % (FIELD_W + 160)) - 80;
    drawCloud(ctx, x, y, 0.8 + (i % 2) * 0.4);
  }
}

// ② メリーゴーランド: サーカステントのストライプ + 豆電球
function drawCarnivalBackground(ctx, t) {
  const theme = STAGE_THEME[2];
  fillGradient(ctx, theme.grad[0], theme.grad[1]);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  const stripeW = 40;
  for (let x = -stripeW; x < FIELD_W + stripeW; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - 30, FIELD_H);
    ctx.lineTo(x - 30, FIELD_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#ffd166";
  for (let i = 0; i < 14; i++) {
    const x = 20 + ((i * 24) % (FIELD_W - 40));
    const y = 24 + (i % 3) * 200;
    const blink = 0.5 + 0.5 * Math.sin(t / 260 + i);
    ctx.globalAlpha = 0.4 + blink * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ③ ロボットたいせん: 光る回路網(グリッド+発光ノード)
function drawTechBackground(ctx, t) {
  const theme = STAGE_THEME[3];
  fillGradient(ctx, theme.grad[0], theme.grad[1]);
  ctx.strokeStyle = "rgba(93,195,255,0.12)";
  ctx.lineWidth = 1;
  const spacing = 40;
  const offset = (t * 0.01) % spacing;
  for (let x = -spacing; x < FIELD_W + spacing; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x + offset, FIELD_H);
    ctx.stroke();
  }
  for (let y = 0; y < FIELD_H; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD_W, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(93,195,255,0.4)";
  for (let i = 0; i < 8; i++) {
    const x = (i * 53 + 20) % FIELD_W;
    const y = (i * 91 + 30) % FIELD_H;
    ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t / 500 + i);
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ④ アヒルのぎょうれつ: 池の水面と葦
function drawPondBackground(ctx, t) {
  const theme = STAGE_THEME[4];
  fillGradient(ctx, theme.grad[0], theme.grad[1]);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = 90 + i * 95;
    ctx.beginPath();
    for (let x = 0; x <= FIELD_W; x += 12) {
      const yy = y + Math.sin(x / 26 + t / 900 + i) * 5;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let i = 0; i < 10; i++) {
    const x = (i * 41 + 10) % FIELD_W;
    const h = 40 + (i % 3) * 20;
    ctx.fillRect(x, FIELD_H - h, 3, h);
  }
}

// ⑤ もくばのまと: 木の看板+あたたかい電飾(フィナーレらしい賑やかさ)
function drawWoodBackground(ctx, t) {
  const theme = STAGE_THEME[5];
  fillGradient(ctx, theme.grad[0], theme.grad[1]);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  for (let x = 30; x < FIELD_W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD_H);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffd166";
  for (let i = 0; i < 10; i++) {
    const x = 20 + (i * 37) % (FIELD_W - 40);
    const y = 18 + (i % 2) * 8;
    const blink = 0.5 + 0.5 * Math.sin(t / 300 + i * 1.3);
    ctx.globalAlpha = 0.35 + blink * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const BACKGROUND_BY_STAGE = {
  1: drawSkyBackground,
  2: drawCarnivalBackground,
  3: drawTechBackground,
  4: drawPondBackground,
  5: drawWoodBackground,
};

function drawBackground(ctx, stageId, t) {
  const draw = BACKGROUND_BY_STAGE[stageId] || drawSkyBackground;
  draw(ctx, t);
}

function drawTarget(ctx, stageId, target, elapsedForPulse) {
  if (target.kind === "secret") {
    const pulse = 1 + 0.18 * Math.sin(elapsedForPulse / 130);
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.beginPath();
    ctx.arc(0, 0, target.r * pulse + 7, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 209, 102, 0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, target.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 209, 102, 0.35)";
    ctx.fill();
    ctx.font = `${Math.round(target.r * 1.4)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎁", 0, 1);
    ctx.restore();
    return;
  }
  const theme = STAGE_THEME[stageId] || STAGE_THEME[1];
  const icon = KIND_ICON[target.kind] || (target.points >= 250 ? theme.small : theme.icon);
  let r = target.r;
  if (target.kind === "finale") r *= 1 + 0.05 * Math.sin(elapsedForPulse / 150);
  const isBonus = target.kind === "bonusWave";
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = target.kind === "finale" || isBonus ? "rgba(255, 209, 102, 0.28)" : "rgba(255,255,255,0.14)";
  ctx.fill();
  ctx.strokeStyle = isBonus ? "rgba(255, 209, 102, 0.85)" : "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `${Math.round(r * 1.3)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, 0, 1);
  ctx.restore();
}

function drawFx(ctx, list, now) {
  for (const p of list) {
    const age = now - p.bornAt;
    if (age > p.durMs) continue;
    const t = age / p.durMs;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.width;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r0 + t * p.grow, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawProjectiles(ctx, list, now) {
  for (const p of list) {
    const age = now - p.bornAt;
    if (age > PROJECTILE_MS) continue;
    const t = age / PROJECTILE_MS;
    const x = p.fromX + (p.toX - p.fromX) * t;
    const y = p.fromY + (p.toY - p.fromY) * t;
    ctx.fillStyle = "#9ee047";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBonusBanner(ctx, bornAt, now) {
  if (bornAt == null) return;
  const age = now - bornAt;
  if (age > 1400) return;
  const alpha = age < 200 ? age / 200 : age > 1100 ? Math.max(0, (1400 - age) / 300) : 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255, 209, 102, 0.95)";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🎉 ボーナスチャンス！", FIELD_W / 2, 86);
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
  const fxRef = useRef([]); // 命中/ハズレの演出(リング)
  const projectilesRef = useRef([]); // 発射の演出(実際の命中判定とは独立した見た目だけの弾)
  const bonusTriggeredAtRef = useRef(null); // このステージの隠し的を撃った経過時間(ms)。まだなら null
  const bonusBannerAtRef = useRef(null); // ボーナスバナーを表示し始めたperformance.now()
  const lastFireRef = useRef(-Infinity);
  const lastPublishRef = useRef(0);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const [stageIdx, setStageIdx] = useState(0);
  const [phase, setPhase] = useState("ready"); // "ready" | "playing" | "cleared"
  const [hud, setHud] = useState({ score: 0, combo: 0, timeLeftMs: STAGES[0].duration, opponentScore: null, bonusActive: false });

  const stage = STAGES[stageIdx];
  const isLastStage = stageIdx === STAGES.length - 1;

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    setBgmStage(stage.id);
  }, [stage.id]);

  useEffect(() => {
    setBgmMode(phase === "playing" ? "play" : "ambient");
  }, [phase]);

  function currentElapsed() {
    if (!stageStartRef.current) return null;
    return performance.now() - stageStartRef.current;
  }

  function startStage() {
    hitIdsRef.current = new Set();
    comboRef.current = 0;
    bonusTriggeredAtRef.current = null;
    bonusBannerAtRef.current = null;
    popupsRef.current = [];
    fxRef.current = [];
    projectilesRef.current = [];
    lastFireRef.current = -Infinity;
    lastTsRef.current = null;
    stageStartRef.current = performance.now();
    setHud((h) => ({ score: scoreRef.current, combo: 0, timeLeftMs: stage.duration, opponentScore: h.opponentScore, bonusActive: false }));
    setPhase("playing");
  }

  function fireAt(px, py, now) {
    if (phase !== "playing") return;
    const elapsed = currentElapsed();
    if (elapsed == null) return;
    if (now - lastFireRef.current < FIRE_COOLDOWN_MS) return;
    lastFireRef.current = now;
    projectilesRef.current.push({ fromX: GUN_ORIGIN.x, fromY: GUN_ORIGIN.y, toX: px, toY: py, bornAt: now });
    const result = tryHit(stage, elapsed, hitIdsRef.current, comboRef.current, px, py, bonusTriggeredAtRef.current);
    if (result) {
      hitIdsRef.current.add(result.id);
      comboRef.current = result.combo;
      scoreRef.current += result.gained;
      popupsRef.current.push({ x: px, y: py, text: `+${result.gained}`, bornAt: now });
      fxRef.current.push({ x: px, y: py, bornAt: now, color: "#ffd166", width: 3, r0: 8, grow: 22, durMs: 380 });
      if (result.triggerBonus) {
        bonusTriggeredAtRef.current = elapsed;
        bonusBannerAtRef.current = now;
        sfxSecretFound();
      } else {
        sfxHit();
      }
    } else {
      comboRef.current = 0;
      fxRef.current.push({ x: px, y: py, bornAt: now, color: "rgba(200,200,200,0.7)", width: 2, r0: 4, grow: 10, durMs: 220 });
      sfxMiss();
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
        } else {
          sfxStageClear();
        }
        setPhase("cleared");
        return;
      }

      const bonusTriggeredAt = bonusTriggeredAtRef.current;
      drawBackground(ctx, stage.id, elapsed);
      const active = getActiveTargets(stage, elapsed, hitIdsRef.current, bonusTriggeredAt);
      for (const t of active) drawTarget(ctx, stage.id, t, elapsed);
      const now = performance.now();
      drawProjectiles(ctx, projectilesRef.current, now);
      projectilesRef.current = projectilesRef.current.filter((p) => now - p.bornAt < PROJECTILE_MS);
      drawFx(ctx, fxRef.current, now);
      fxRef.current = fxRef.current.filter((p) => now - p.bornAt < p.durMs);
      drawPopups(ctx, popupsRef.current, now);
      popupsRef.current = popupsRef.current.filter((p) => now - p.bornAt < 700);
      drawReticle(ctx, reticleRef.current.x, reticleRef.current.y);
      drawBonusBanner(ctx, bonusBannerAtRef.current, now);

      if (ts - lastPublishRef.current >= PUBLISH_MS) {
        lastPublishRef.current = ts;
        publishScore(code, uid, scoreRef.current).catch(() => {});
      }

      const bonusActive = bonusTriggeredAt != null && elapsed < bonusTriggeredAt + getBonusWindow(stage);
      const currentRoom = roomRef.current;
      const otherUid = currentRoom.hostUid === uid ? currentRoom.guestUid : currentRoom.hostUid;
      setHud({
        score: scoreRef.current,
        combo: comboRef.current,
        timeLeftMs: stage.duration - elapsed,
        opponentScore: otherUid ? currentRoom.scores?.[otherUid] ?? 0 : null,
        bonusActive,
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
        {hud.bonusActive && <span className="gly-bonus-tag"> 🎉ボーナス中！</span>}
      </div>
      {opponentScore != null && <div className="gly-opponent">相手のスコア {opponentScore.toLocaleString()}</div>}
      <canvas ref={canvasRef} width={FIELD_W} height={FIELD_H} className="gly-canvas" />
      <p className="gly-hint">狙った場所をタップ/クリック、または矢印キー+スペースで発射</p>
    </div>
  );
}
