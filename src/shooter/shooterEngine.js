// 縦スクロールシューティング(協力ボス戦) - 純粋なシミュレーション関数群。
// ホスト端末だけがこのファイルを毎フレーム呼んで「正」の状態を進め、
// Firestoreにスナップショットとして書き出す(ゲスト側はそれを読んで描画するだけ)。
// 状態はプレーンオブジェクトで、常にJSON化可能(Firestoreにそのまま保存できる)。

export const FIELD_W = 360;
export const FIELD_H = 640;

const PLAYER_R = 10;
const PLAYER_MAX_HP = 3;
const PLAYER_LIVES = 3;
const PLAYER_INVULN_MS = 1500;
const HIT_INVULN_MS = 900;
const PLAYER_FIRE_INTERVAL = 220;
const PLAYER_BULLET_SPEED = 480;
const PLAYER_BULLET_R = 4;
const RESPAWN_DELAY = 2000;

const ENEMY_BULLET_R = 5;
const BOSS_R = 34;
export const BOSS_MAX_HP = 90;

// 出現スケジュール(ステージ開始からの経過ミリ秒)。最後に "boss" でボス戦へ移行する。
const WAVE = [
  { t: 800, type: "straight", x: 70 },
  { t: 800, type: "straight", x: 290 },
  { t: 3000, type: "weaver", x: 180 },
  { t: 5200, type: "straight", x: 110 },
  { t: 5200, type: "straight", x: 250 },
  { t: 7600, type: "weaver", x: 90 },
  { t: 7600, type: "weaver", x: 270 },
  { t: 10200, type: "straight", x: 60 },
  { t: 10200, type: "straight", x: 180 },
  { t: 10200, type: "straight", x: 300 },
  { t: 13200, type: "weaver", x: 130 },
  { t: 13200, type: "weaver", x: 230 },
  { t: 16500, type: "boss" },
];

const ENEMY_DEFS = {
  straight: { hp: 2, r: 12, speed: 90, score: 100, fireInterval: 2200, bulletSpeed: 170 },
  weaver: { hp: 3, r: 13, speed: 80, score: 150, fireInterval: 2600, bulletSpeed: 180 },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
function nid(state) {
  return state.nextId++;
}

function freshPlayer(x, y) {
  return { x, y, hp: PLAYER_MAX_HP, lives: PLAYER_LIVES, alive: true, invulnUntil: PLAYER_INVULN_MS, lastFireAt: -9999, respawnAt: 0 };
}

// uids: [hostUid, guestUid?] の順で初期配置する。
export function createInitialState(uids) {
  const players = {};
  uids.forEach((uid, i) => {
    const x = uids.length > 1 ? FIELD_W / 2 + (i === 0 ? -30 : 30) : FIELD_W / 2;
    players[uid] = freshPlayer(x, FIELD_H - 70);
  });
  return {
    elapsed: 0,
    stage: "wave",
    nextSpawnIndex: 0,
    players,
    enemies: [],
    boss: null,
    playerBullets: [],
    enemyBullets: [],
    score: 0,
    nextId: 1,
    result: null,
  };
}

function spawnEnemy(state, type, x) {
  const def = ENEMY_DEFS[type];
  state.enemies.push({
    id: nid(state),
    type,
    x,
    y: -20,
    hp: def.hp,
    r: def.r,
    phase: Math.random() * Math.PI * 2,
    lastFireAt: state.elapsed + Math.random() * 800,
  });
}

function spawnBoss(state) {
  state.boss = {
    hp: BOSS_MAX_HP,
    maxHp: BOSS_MAX_HP,
    phase: 1,
    x: FIELD_W / 2,
    y: -60,
    targetY: 100,
    entering: true,
    dir: 1,
    lastAttackAt: state.elapsed,
    lastAimedAt: state.elapsed,
  };
  state.stage = "boss";
}

function firePlayerBullet(state, uid, x, y) {
  state.playerBullets.push({ id: nid(state), x, y: y - 14, vy: -PLAYER_BULLET_SPEED, ownerUid: uid });
}

function fireAimedBullet(state, fromX, fromY, targetX, targetY, speed) {
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  state.enemyBullets.push({ id: nid(state), x: fromX, y: fromY, vx: (dx / len) * speed, vy: (dy / len) * speed });
}

function fireSpread(state, fromX, fromY, count, speed, spreadDeg) {
  const spread = (spreadDeg * Math.PI) / 180;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const ang = Math.PI / 2 + t * spread;
    state.enemyBullets.push({ id: nid(state), x: fromX, y: fromY, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed });
  }
}

function fireRing(state, fromX, fromY, count, speed) {
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    state.enemyBullets.push({ id: nid(state), x: fromX, y: fromY, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed });
  }
}

function alivePlayers(state) {
  return Object.entries(state.players).filter(([, p]) => p.alive);
}

function nearestPlayer(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const [uid, p] of alivePlayers(state)) {
    const d = dist2(x, y, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = { uid, p };
    }
  }
  return best;
}

function damagePlayer(state, p) {
  p.hp -= 1;
  if (p.hp <= 0) {
    p.lives -= 1;
    p.alive = false;
    if (p.lives > 0) p.respawnAt = state.elapsed + RESPAWN_DELAY;
  } else {
    p.invulnUntil = state.elapsed + HIT_INVULN_MS;
  }
}

// 1フレーム分、状態を進める。positions は { uid: {x,y} } で、その時点で分かっている
// 各プレイヤーの位置(ホストは自分のローカル入力、ゲストの分は最後に受信した値)。
export function advanceShooter(state, dtMs, positions) {
  if (state.result) return state;
  const dt = dtMs / 1000;
  state.elapsed += dtMs;

  for (const uid of Object.keys(state.players)) {
    const p = state.players[uid];
    if (!p.alive) {
      if (p.lives > 0 && state.elapsed >= p.respawnAt) {
        p.alive = true;
        p.hp = PLAYER_MAX_HP;
        p.invulnUntil = state.elapsed + PLAYER_INVULN_MS;
        p.x = FIELD_W / 2;
        p.y = FIELD_H - 70;
      }
      continue;
    }
    const pos = positions[uid];
    if (pos) {
      p.x = clamp(pos.x, PLAYER_R, FIELD_W - PLAYER_R);
      p.y = clamp(pos.y, PLAYER_R, FIELD_H - PLAYER_R);
    }
    if (state.elapsed - p.lastFireAt >= PLAYER_FIRE_INTERVAL) {
      p.lastFireAt = state.elapsed;
      firePlayerBullet(state, uid, p.x, p.y);
    }
  }

  if (state.stage === "wave") {
    while (state.nextSpawnIndex < WAVE.length && WAVE[state.nextSpawnIndex].t <= state.elapsed) {
      const w = WAVE[state.nextSpawnIndex];
      state.nextSpawnIndex++;
      if (w.type === "boss") spawnBoss(state);
      else spawnEnemy(state, w.type, w.x);
    }
  }

  state.enemies.forEach((e) => {
    const def = ENEMY_DEFS[e.type];
    e.y += def.speed * dt;
    if (e.type === "weaver") {
      e.x += Math.sin(state.elapsed / 500 + e.phase) * 60 * dt;
      e.x = clamp(e.x, 16, FIELD_W - 16);
    }
    if (state.elapsed - e.lastFireAt >= def.fireInterval) {
      const target = nearestPlayer(state, e.x, e.y);
      if (target) {
        e.lastFireAt = state.elapsed;
        fireAimedBullet(state, e.x, e.y, target.p.x, target.p.y, def.bulletSpeed);
      }
    }
  });
  state.enemies = state.enemies.filter((e) => e.y < FIELD_H + 30 && e.hp > 0);

  if (state.boss) {
    const b = state.boss;
    if (b.entering) {
      b.y += 60 * dt;
      if (b.y >= b.targetY) {
        b.y = b.targetY;
        b.entering = false;
      }
    } else {
      b.x += b.dir * 40 * dt;
      if (b.x < 60) {
        b.x = 60;
        b.dir = 1;
      }
      if (b.x > FIELD_W - 60) {
        b.x = FIELD_W - 60;
        b.dir = -1;
      }

      const hpFrac = b.hp / b.maxHp;
      b.phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;

      const spreadInterval = b.phase === 1 ? 1200 : b.phase === 2 ? 1000 : 800;
      if (state.elapsed - b.lastAttackAt >= spreadInterval) {
        b.lastAttackAt = state.elapsed;
        if (b.phase < 3) fireSpread(state, b.x, b.y, 5, 160, 70);
        else fireRing(state, b.x, b.y, 12, 150);
      }
      if (b.phase >= 2 && state.elapsed - b.lastAimedAt >= 900) {
        b.lastAimedAt = state.elapsed;
        const target = nearestPlayer(state, b.x, b.y);
        if (target) fireAimedBullet(state, b.x, b.y, target.p.x, target.p.y, 220);
      }
    }
  }

  state.playerBullets.forEach((b) => {
    b.y += b.vy * dt;
  });
  state.playerBullets = state.playerBullets.filter((b) => b.y > -20);
  state.enemyBullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  state.enemyBullets = state.enemyBullets.filter((b) => b.x > -20 && b.x < FIELD_W + 20 && b.y > -20 && b.y < FIELD_H + 20);

  // 当たり判定: 自機弾 → 敵/ボス
  state.playerBullets = state.playerBullets.filter((bullet) => {
    for (const e of state.enemies) {
      if (dist2(bullet.x, bullet.y, e.x, e.y) <= (e.r + PLAYER_BULLET_R) ** 2) {
        e.hp -= 1;
        if (e.hp <= 0) state.score += ENEMY_DEFS[e.type].score;
        return false;
      }
    }
    if (state.boss && !state.boss.entering) {
      const b = state.boss;
      if (dist2(bullet.x, bullet.y, b.x, b.y) <= (BOSS_R + PLAYER_BULLET_R) ** 2) {
        b.hp = Math.max(0, b.hp - 1);
        return false;
      }
    }
    return true;
  });
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // 当たり判定: 敵弾/敵本体/ボス → プレイヤー
  for (const uid of Object.keys(state.players)) {
    const p = state.players[uid];
    if (!p.alive || state.elapsed < p.invulnUntil) continue;
    let hit = false;
    state.enemyBullets = state.enemyBullets.filter((b) => {
      if (!hit && dist2(b.x, b.y, p.x, p.y) <= (PLAYER_R + ENEMY_BULLET_R) ** 2) {
        hit = true;
        return false;
      }
      return true;
    });
    if (!hit) {
      for (const e of state.enemies) {
        if (dist2(e.x, e.y, p.x, p.y) <= (PLAYER_R + e.r) ** 2) {
          hit = true;
          break;
        }
      }
    }
    if (!hit && state.boss && !state.boss.entering) {
      if (dist2(state.boss.x, state.boss.y, p.x, p.y) <= (PLAYER_R + BOSS_R) ** 2) hit = true;
    }
    if (hit) damagePlayer(state, p);
  }

  if (state.boss && state.boss.hp <= 0 && state.stage === "boss") {
    state.stage = "victory";
    state.result = "victory";
    state.score += 2000;
  }
  const anyoneLeft = Object.values(state.players).some((p) => p.alive || p.lives > 0);
  if (!anyoneLeft) {
    state.stage = "gameover";
    state.result = "gameover";
  }

  return state;
}
