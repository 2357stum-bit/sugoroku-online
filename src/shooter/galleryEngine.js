// おもちゃ箱シューティングギャラリー - 純粋なゲームロジック関数群。
// 「射的ギャラリー系のライド」をオマージュし、複数のテーマステージを順番に遊び、
// 制限時間内にどれだけ的を撃ち抜けるかでスコアを競う。
// 的の出現スケジュールは完全に決定的(Math.randomを使わない)にしてあるので、
// 2人が同時にプレイしても全く同じ的の並びで公平に競争できる
// (2人ともローカルでこのエンジンを実行し、スコアだけをFirestoreに送り合う)。
//
// 各ステージには「隠し的(secret)」が1つ紛れており、それを撃ち抜くと
// ボーナスウェーブ(bonusWave)が発生して高得点の的が連続で湧く。
// ボーナスウェーブの出現時刻は「隠し的を撃った瞬間からの相対時間(tOffset)」で
// 表現するので、いつ隠し的を見つけるかはプレイヤー次第でも、見つけた後の
// 展開自体は決定的(=公平)になる。

export const FIELD_W = 360;
export const FIELD_H = 640;
export const HIT_RADIUS = 30;
export const SECRET_HIT_RADIUS = 20; // 隠し的は少しだけシビアな判定にして「見つけた」感を出す
export const FIRE_COOLDOWN_MS = 90;

const STAGE_DURATION = 30000; // 各ステージ30秒

function genStage1() {
  // もくばのまと: 3x4のマス目にポップアップする木馬の的。5つに1つは横に揺れる
  const cols = [90, 180, 270];
  const rows = [150, 260, 370, 480];
  const duration = STAGE_DURATION;
  const interval = 2200;
  const ttl = 1500;
  const spawns = [];
  let idx = 0;
  let seq = 0;
  for (const y of rows) {
    for (const x of cols) {
      const phase = (idx % 6) * 350;
      let n = 0;
      for (let t = phase; t < duration - ttl; t += interval) {
        const small = (n + idx) % 4 === 0;
        const wobbly = seq % 5 === 0;
        spawns.push({
          t, x, y, r: small ? 12 : 20, points: small ? 280 : 100, ttl, vx: 0, vy: 0, kind: "pop",
          wobble: wobbly ? { amp: 10, freq: 2.2, axis: "x" } : null,
        });
        n++;
        seq++;
      }
      idx++;
    }
  }
  spawns.sort((a, b) => a.t - b.t);
  return {
    duration,
    spawns,
    secret: { t: 18000, x: 180, y: 560, r: 13, ttl: 2400, points: 500 },
    bonusWave: makeBonusWave(),
  };
}

function genStage2() {
  // ロボットたいせん: 左右から流れてくる的。だんだん間隔が短くなる。
  // 7回に1回は上下も動く斜め移動、3回に1回は上下にふわふわ揺れる
  const duration = STAGE_DURATION;
  const rows = [180, 280, 380, 480];
  const spawns = [];
  let t = 0;
  let i = 0;
  while (t < duration - 2000) {
    const row = rows[i % rows.length];
    const dir = i % 2 === 0 ? 1 : -1;
    const speed = 90 + (i % 5) * 18; // px/秒
    const startX = dir === 1 ? -20 : FIELD_W + 20;
    const small = i % 3 === 0;
    const isDiagonal = i % 7 === 6;
    const vyPerSec = isDiagonal ? (i % 2 === 0 ? 60 : -60) : 0;
    const travelMs = ((FIELD_W + 40) / speed) * 1000;
    spawns.push({
      t, x: startX, y: row, r: small ? 13 : 19,
      points: small ? 220 : 120, ttl: travelMs,
      vx: (dir * speed) / 1000, vy: vyPerSec / 1000, kind: isDiagonal ? "diagonal" : "slide",
      wobble: !isDiagonal && i % 3 === 0 ? { amp: 14, freq: 1.5, axis: "y" } : null,
    });
    t += Math.max(420, 900 - i * 8);
    i++;
  }
  spawns.sort((a, b) => a.t - b.t);
  return {
    duration,
    spawns,
    secret: { t: 16000, x: 180, y: 330, r: 13, ttl: 2200, points: 500 },
    bonusWave: makeBonusWave(),
  };
}

function genStage3() {
  // きょうりゅうのふうせん: 下から昇ってくる風船(左右にゆらゆら) + ラスト6秒はフィナーレ
  const duration = STAGE_DURATION;
  const cols = [60, 130, 200, 270, 330];
  const spawns = [];
  let t = 0;
  let i = 0;
  const mainEnd = duration - 6000;
  while (t < mainEnd) {
    const x = cols[i % cols.length];
    const speed = 70 + (i % 4) * 15; // px/秒
    const travelMs = ((FIELD_H + 40) / speed) * 1000;
    const small = i % 4 === 1;
    spawns.push({
      t, x, y: FIELD_H + 20, r: small ? 14 : 20,
      points: small ? 260 : 130, ttl: travelMs,
      vx: 0, vy: -(speed / 1000), kind: "balloon",
      wobble: { amp: 18, freq: 0.6, axis: "x" },
    });
    t += 650;
    i++;
  }
  const finaleStart = mainEnd;
  spawns.push({ t: finaleStart + 300, x: FIELD_W / 2, y: FIELD_H / 2, r: 46, points: 1500, ttl: 4800, vx: 0, vy: 0, kind: "finale" });
  let fi = 0;
  for (let ft = finaleStart + 600; ft < duration - 400; ft += 400) {
    const x = 40 + ((fi * 53) % (FIELD_W - 80));
    const y = 120 + ((fi * 77) % (FIELD_H - 240));
    spawns.push({ t: ft, x, y, r: 12, points: 300, ttl: 1100, vx: 0, vy: 0, kind: "bonus" });
    fi++;
  }
  spawns.sort((a, b) => a.t - b.t);
  return {
    duration,
    spawns,
    secret: { t: 11000, x: 200, y: 340, r: 13, ttl: 2400, points: 500 },
    bonusWave: makeBonusWave(),
  };
}

// 隠し的を撃った瞬間からの相対時間(tOffset)で湧く、高得点の的の連続ウェーブ。
// 位置は決定的な擬似散布(Math.random不使用)。
function makeBonusWave() {
  const wave = [];
  for (let i = 0; i < 9; i++) {
    const tOffset = 250 + i * 380;
    const x = 40 + ((i * 71 + 20) % (FIELD_W - 80));
    const y = 110 + ((i * 97 + 40) % (FIELD_H - 260));
    wave.push({ tOffset, x, y, r: 15, points: 400, ttl: 950, kind: "bonusWave" });
  }
  return wave;
}

const RAW_STAGES = [
  { id: 1, name: "もくばのまと", hint: "ポップアップする的をどんどん撃とう！光る隠し的を見つけるとボーナスチャンス！", ...genStage1() },
  { id: 2, name: "ロボットたいせん", hint: "左右・斜めから流れてくる的を狙い撃て！光る隠し的を見つけるとボーナスチャンス！", ...genStage2() },
  { id: 3, name: "きょうりゅうのふうせん", hint: "ゆらゆら揺れながら上昇する風船を撃て。光る隠し的を見つけるとボーナスチャンス！ラストはフィナーレ！", ...genStage3() },
];

// 各的に一意なIDを振っておく。各ステージは「スタート」を押した瞬間から
// 独立して0msからカウントする(前のステージの時間を引きずらない)ので、
// 以前のような累積オフセット/全体タイムラインの計算は不要。
export const STAGES = RAW_STAGES.map((s) => {
  const spawns = s.spawns.map((sp, i) => ({ ...sp, id: `${s.id}-${i}` }));
  const secret = s.secret ? { ...s.secret, id: `${s.id}-secret`, vx: 0, vy: 0, kind: "secret", wobble: null } : null;
  const bonusWave = (s.bonusWave || []).map((b, i) => ({ ...b, id: `${s.id}-bonus-${i}` }));
  return { ...s, spawns, secret, bonusWave };
});

export const TOTAL_DURATION = STAGES.reduce((sum, s) => sum + s.duration, 0);

// このステージのボーナスウェーブが、トリガーされてから何msで終わるか
export function getBonusWindow(stage) {
  if (!stage.bonusWave || stage.bonusWave.length === 0) return 0;
  return Math.max(...stage.bonusWave.map((b) => b.tOffset + b.ttl));
}

function targetPos(spawn, localElapsedMs) {
  const dt = localElapsedMs - spawn.t;
  let x = spawn.x + (spawn.vx || 0) * dt;
  let y = spawn.y + (spawn.vy || 0) * dt;
  if (spawn.wobble) {
    const { amp, freq, axis } = spawn.wobble;
    const off = amp * Math.sin((dt / 1000) * freq * Math.PI * 2);
    if (axis === "x") x += off;
    else y += off;
  }
  return { x, y };
}

function collectSpawn(list, sp, localElapsedMs, hitIds) {
  if (localElapsedMs < sp.t || localElapsedMs >= sp.t + sp.ttl) return;
  if (hitIds.has(sp.id)) return;
  const pos = targetPos(sp, localElapsedMs);
  if (pos.x < -60 || pos.x > FIELD_W + 60 || pos.y < -60 || pos.y > FIELD_H + 60) return;
  list.push({ id: sp.id, x: pos.x, y: pos.y, r: sp.r, points: sp.points, kind: sp.kind });
}

// 現在アクティブ(出現中かつ未撃破)な的の一覧を返す。hitIdsはSet<string>。
// bonusTriggeredAt: このステージで隠し的を撃った経過時間(ms)。まだなら null。
export function getActiveTargets(stage, localElapsedMs, hitIds, bonusTriggeredAt = null) {
  const active = [];
  for (const sp of stage.spawns) collectSpawn(active, sp, localElapsedMs, hitIds);
  if (stage.secret) collectSpawn(active, stage.secret, localElapsedMs, hitIds);
  if (bonusTriggeredAt != null && stage.bonusWave) {
    for (const b of stage.bonusWave) {
      const virtual = { ...b, t: bonusTriggeredAt + b.tOffset };
      collectSpawn(active, virtual, localElapsedMs, hitIds);
    }
  }
  return active;
}

// コンボ倍率(連続ヒット数に応じて 1.0x 〜 2.0x)
export function comboMultiplier(combo) {
  return Math.min(2, 1 + Math.floor(combo / 5) * 0.25);
}

// 狙撃地点(px,py)に最も近いアクティブな的を撃つ。命中すれば
// {id, points, combo, gained, kind, triggerBonus} を返す。
// triggerBonus:true は「今回の命中が隠し的で、ボーナスウェーブを開始すべき」という合図。
export function tryHit(stage, localElapsedMs, hitIds, combo, px, py, bonusTriggeredAt = null) {
  const active = getActiveTargets(stage, localElapsedMs, hitIds, bonusTriggeredAt);
  let best = null;
  let bestDist = Infinity;
  for (const t of active) {
    const radius = t.kind === "secret" ? SECRET_HIT_RADIUS : HIT_RADIUS;
    const d = Math.hypot(t.x - px, t.y - py);
    if (d > radius) continue;
    if (d < bestDist || (d === bestDist && best && t.points > best.points)) {
      best = t;
      bestDist = d;
    }
  }
  if (!best) return null;
  const nextCombo = combo + 1;
  const mult = comboMultiplier(nextCombo);
  const gained = Math.round(best.points * mult);
  return { id: best.id, points: best.points, combo: nextCombo, gained, kind: best.kind, triggerBonus: best.kind === "secret" };
}
