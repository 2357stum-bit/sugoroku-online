// おもちゃ箱シューティングギャラリー - 純粋なゲームロジック関数群。
// 「射的ギャラリー系のライド」をオマージュし、複数のテーマステージを順番に遊び、
// 制限時間内にどれだけ的を撃ち抜けるかでスコアを競う。
// 的の出現スケジュールは完全に決定的(Math.randomを使わない)にしてあるので、
// 2人が同時にプレイしても全く同じ的の並びで公平に競争できる
// (2人ともローカルでこのエンジンを実行し、スコアだけをFirestoreに送り合う)。

export const FIELD_W = 360;
export const FIELD_H = 640;
export const HIT_RADIUS = 30;
export const FIRE_COOLDOWN_MS = 90;

const STAGE_DURATION = 30000; // 各ステージ30秒

function genStage1() {
  // もくばのまと: 3x4のマス目にポップアップする木馬の的
  const cols = [90, 180, 270];
  const rows = [150, 260, 370, 480];
  const duration = STAGE_DURATION;
  const interval = 2200;
  const ttl = 1500;
  const spawns = [];
  let idx = 0;
  for (const y of rows) {
    for (const x of cols) {
      const phase = (idx % 6) * 350;
      let n = 0;
      for (let t = phase; t < duration - ttl; t += interval) {
        const small = (n + idx) % 4 === 0;
        spawns.push({ t, x, y, r: small ? 12 : 20, points: small ? 280 : 100, ttl, vx: 0, vy: 0, kind: "pop" });
        n++;
      }
      idx++;
    }
  }
  spawns.sort((a, b) => a.t - b.t);
  return { duration, spawns };
}

function genStage2() {
  // ロボットたいせん: 左右から流れてくる的。だんだん間隔が短くなる
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
    const travelMs = ((FIELD_W + 40) / speed) * 1000;
    const small = i % 3 === 0;
    spawns.push({
      t, x: startX, y: row, r: small ? 13 : 19,
      points: small ? 220 : 120, ttl: travelMs,
      vx: (dir * speed) / 1000, vy: 0, kind: "slide",
    });
    t += Math.max(420, 900 - i * 8);
    i++;
  }
  spawns.sort((a, b) => a.t - b.t);
  return { duration, spawns };
}

function genStage3() {
  // きょうりゅうのふうせん: 下から昇ってくる風船 + ラスト6秒はフィナーレ(ビッグターゲット+ボーナスの雨)
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
  return { duration, spawns };
}

const RAW_STAGES = [
  { id: 1, name: "もくばのまと", hint: "ポップアップする的をどんどん撃とう！", ...genStage1() },
  { id: 2, name: "ロボットたいせん", hint: "左右から流れてくる的を狙い撃て！", ...genStage2() },
  { id: 3, name: "きょうりゅうのふうせん", hint: "上昇する風船を撃て。ラストはフィナーレ！", ...genStage3() },
];

// 各的に一意なIDを振っておく。各ステージは「スタート」を押した瞬間から
// 独立して0msからカウントする(前のステージの時間を引きずらない)ので、
// 以前のような累積オフセット/全体タイムラインの計算は不要。
export const STAGES = RAW_STAGES.map((s) => ({
  ...s,
  spawns: s.spawns.map((sp, i) => ({ ...sp, id: `${s.id}-${i}` })),
}));

export const TOTAL_DURATION = STAGES.reduce((sum, s) => sum + s.duration, 0);

function targetPos(spawn, localElapsedMs) {
  const dt = localElapsedMs - spawn.t;
  return { x: spawn.x + (spawn.vx || 0) * dt, y: spawn.y + (spawn.vy || 0) * dt };
}

// 現在アクティブ(出現中かつ未撃破)な的の一覧を返す。hitIdsはSet<string>。
export function getActiveTargets(stage, localElapsedMs, hitIds) {
  const active = [];
  for (const sp of stage.spawns) {
    if (localElapsedMs < sp.t || localElapsedMs >= sp.t + sp.ttl) continue;
    if (hitIds.has(sp.id)) continue;
    const pos = targetPos(sp, localElapsedMs);
    if (pos.x < -60 || pos.x > FIELD_W + 60 || pos.y < -60 || pos.y > FIELD_H + 60) continue;
    active.push({ id: sp.id, x: pos.x, y: pos.y, r: sp.r, points: sp.points, kind: sp.kind });
  }
  return active;
}

// コンボ倍率(連続ヒット数に応じて 1.0x 〜 2.0x)
export function comboMultiplier(combo) {
  return Math.min(2, 1 + Math.floor(combo / 5) * 0.25);
}

// 狙撃地点(px,py)に最も近いアクティブな的を撃つ。命中すれば{id,points,combo,score加算分}を返す
export function tryHit(stage, localElapsedMs, hitIds, combo, px, py) {
  const active = getActiveTargets(stage, localElapsedMs, hitIds);
  let best = null;
  let bestDist = Infinity;
  for (const t of active) {
    const d = Math.hypot(t.x - px, t.y - py);
    if (d > HIT_RADIUS) continue;
    if (d < bestDist || (d === bestDist && best && t.points > best.points)) {
      best = t;
      bestDist = d;
    }
  }
  if (!best) return null;
  const nextCombo = combo + 1;
  const mult = comboMultiplier(nextCombo);
  const gained = Math.round(best.points * mult);
  return { id: best.id, points: best.points, combo: nextCombo, gained };
}
