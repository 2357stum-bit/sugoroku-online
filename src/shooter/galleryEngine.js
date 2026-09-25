// おもちゃ箱シューティングギャラリー - 純粋なゲームロジック関数群。
// 「射的ギャラリー系のライド」をオマージュし、複数のテーマステージを順番に遊び、
// 制限時間内にどれだけ的を撃ち抜けるかでスコアを競う。
// 的の出現スケジュールは完全に決定的(Math.randomを使わない)にしてあるので、
// 2人が同時にプレイしても全く同じ的の並びで公平に競争できる
// (2人ともローカルでこのエンジンを実行し、スコアだけをFirestoreに送り合う)。
//
// 全5ステージは、穏やかなステージから徐々にタップの頻度が増えていくよう
// 難易度順に並んでいる(風船→メリーゴーランド→ロボット→アヒル→木馬)。
// 木馬のポップアップ(もくばのまと)は同時に出現する的の数が最も多く、
// 全ステージ中もっとも忙しいので、あえて最後(フィナーレ)に置いている。
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

// 隠し的を撃った瞬間からの相対時間(tOffset)で湧く、高得点の的の連続ウェーブ。
// 位置は決定的な擬似散布(Math.random不使用)。全ステージ共通で使い回す。
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

// ラスト6秒に発生する「フィナーレ」(ビッグターゲット+ボーナスの雨)。もっとも
// 忙しい最終ステージ(木馬)の締めくくりとして使う。
function appendFinale(spawns, mainEnd, duration) {
  spawns.push({ t: mainEnd + 300, x: FIELD_W / 2, y: FIELD_H / 2, r: 46, points: 1500, ttl: 4800, vx: 0, vy: 0, kind: "finale" });
  let fi = 0;
  for (let ft = mainEnd + 600; ft < duration - 400; ft += 400) {
    const x = 40 + ((fi * 53) % (FIELD_W - 80));
    const y = 120 + ((fi * 77) % (FIELD_H - 240));
    spawns.push({ t: ft, x, y, r: 12, points: 300, ttl: 1100, vx: 0, vy: 0, kind: "bonus" });
    fi++;
  }
}

function genStageBalloon() {
  // ① きょうりゅうのふうせん: 下から昇ってくる風船。ゆったりペースの導入ステージ
  const duration = STAGE_DURATION;
  const cols = [60, 130, 200, 270, 330];
  const spawns = [];
  let t = 300;
  let i = 0;
  while (t < duration - 1500) {
    const x = cols[i % cols.length];
    const speed = 90 + (i % 3) * 12; // px/秒(画面に残りすぎて混雑しない程度の速さ)
    const travelMs = ((FIELD_H + 40) / speed) * 1000;
    const small = i % 5 === 2;
    spawns.push({
      t, x, y: FIELD_H + 20, r: small ? 15 : 21,
      points: small ? 240 : 110, ttl: travelMs,
      vx: 0, vy: -(speed / 1000), kind: "balloon",
      wobble: { amp: 16, freq: 0.5, axis: "x" },
    });
    t += 1200;
    i++;
  }
  spawns.sort((a, b) => a.t - b.t);
  return {
    duration,
    spawns,
    secret: { t: 15000, x: 200, y: 340, r: 13, ttl: 2400, points: 500 },
    bonusWave: makeBonusWave(),
  };
}

function genStageCarousel() {
  // ② メリーゴーランド: 2つの円軌道をゆっくり回る的。タイミングを合わせて撃とう
  const duration = STAGE_DURATION;
  const centers = [
    { cx: 110, cy: 260, radius: 65 },
    { cx: 250, cy: 420, radius: 65 },
  ];
  const spawns = [];
  let t = 400;
  let i = 0;
  const interval = 680;
  const ttl = 2000;
  while (t < duration - ttl) {
    const c = centers[i % centers.length];
    const angSpeed = 1.0 + (i % 2) * 0.25; // rad/秒
    const phase = (i * 1.7) % (Math.PI * 2);
    const small = i % 5 === 0;
    spawns.push({
      t, x: c.cx, y: c.cy, r: small ? 13 : 18,
      points: small ? 260 : 120, ttl,
      vx: 0, vy: 0, kind: "carousel",
      orbit: { cx: c.cx, cy: c.cy, radius: c.radius, angSpeed, phase },
    });
    t += interval;
    i++;
  }
  spawns.sort((a, b) => a.t - b.t);
  return {
    duration,
    spawns,
    secret: { t: 17000, x: 180, y: 560, r: 13, ttl: 2400, points: 500 },
    bonusWave: makeBonusWave(),
  };
}

function genStageRobot() {
  // ③ ロボットたいせん: 左右・斜めから流れてくる的。だんだん間隔が短くなる
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
    t += Math.max(300, 650 - i * 8);
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

function genStageDuck() {
  // ④ アヒルのぎょうれつ: 3〜4羽がひとまとまりの「列」になって、波状に左右から
  // やってくる。ロボットたいせん(1体ずつ・複数レーンにバラけて流れる)とは違い、
  // 群れごと連続で撃ち抜く「波」のリズムがこのステージの持ち味。
  // 列の先頭(進行方向側)は本体、最後尾は小さくて高得点。
  const duration = STAGE_DURATION;
  const rows = [220, 340, 460];
  const spawns = [];
  let t = 500;
  let wave = 0;
  while (t < duration - 1500) {
    const row = rows[wave % rows.length];
    const dir = wave % 2 === 0 ? 1 : -1;
    const speed = 150 + Math.min(wave, 10) * 7; // px/秒。波を重ねるごとに少しずつ速く
    const startX = dir === 1 ? -20 : FIELD_W + 20;
    const groupSize = wave % 3 === 2 ? 4 : 3;
    const gapPx = 44; // 列内の間隔
    const wobble = { amp: 10, freq: 1.6, axis: "y" }; // 同じtを共有するので群れ全体が同期して上下に揺れる
    for (let g = 0; g < groupSize; g++) {
      const offset = dir === 1 ? -g * gapPx : g * gapPx;
      const travelMs = ((FIELD_W + 40 + Math.abs(offset)) / speed) * 1000;
      const isLast = g === groupSize - 1;
      spawns.push({
        t, x: startX + offset, y: row, r: isLast ? 12 : 17,
        points: isLast ? 260 : 150, ttl: travelMs,
        vx: (dir * speed) / 1000, vy: 0, kind: "duck", wobble,
      });
    }
    t += Math.max(700, 1500 - wave * 60); // 波と波の間隔がだんだん短くなる
    wave++;
  }
  spawns.sort((a, b) => a.t - b.t);
  return {
    duration,
    spawns,
    secret: { t: 13000, x: 200, y: 330, r: 13, ttl: 2200, points: 500 },
    bonusWave: makeBonusWave(),
  };
}

function genStageHorse() {
  // ⑤ もくばのまと: 3x4のマス目にポップアップする木馬の的。全ステージ中もっとも
  // 同時出現数が多い、いちばん忙しいステージ。ラスト6秒はフィナーレ
  const cols = [90, 180, 270];
  const rows = [150, 260, 370, 480];
  const duration = STAGE_DURATION;
  const mainEnd = duration - 6000;
  const interval = 2200;
  const ttl = 1500;
  const spawns = [];
  let idx = 0;
  let seq = 0;
  for (const y of rows) {
    for (const x of cols) {
      const phase = (idx % 6) * 350;
      let n = 0;
      for (let t = phase; t < mainEnd - ttl; t += interval) {
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
  appendFinale(spawns, mainEnd, duration);
  spawns.sort((a, b) => a.t - b.t);
  return {
    duration,
    spawns,
    secret: { t: mainEnd - 4000, x: 180, y: 560, r: 13, ttl: 2200, points: 500 },
    bonusWave: makeBonusWave(),
  };
}

const RAW_STAGES = [
  { id: 1, name: "きょうりゅうのふうせん", hint: "やること: ゆっくり昇ってくる風船をねらって、まずは慣らし運転。光る隠し的◯を見つけるとボーナスチャンス！", ...genStageBalloon() },
  { id: 2, name: "メリーゴーランド", hint: "やること: 円をえがいてまわる的にタイミングを合わせて撃とう。光る隠し的を見つけるとボーナスチャンス！", ...genStageCarousel() },
  { id: 3, name: "ロボットたいせん", hint: "やること: 左右・斜めから流れてくる的を狙い撃て！光る隠し的を見つけるとボーナスチャンス！", ...genStageRobot() },
  { id: 4, name: "アヒルのぎょうれつ", hint: "やること: テンポの速いアヒルの行列をどんどん撃ち抜け！光る隠し的を見つけるとボーナスチャンス！", ...genStageDuck() },
  { id: 5, name: "もくばのまと", hint: "やること: 最大物量、木馬の的が一斉にポップアップ！光る隠し的でボーナスチャンス、ラストはフィナーレ！", ...genStageHorse() },
];

// 各的に一意なIDを振っておく。各ステージは「スタート」を押した瞬間から
// 独立して0msからカウントする(前のステージの時間は引き継がない)ので、
// 累積オフセット/全体タイムラインの計算は不要。
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
  if (spawn.orbit) {
    const { cx, cy, radius, angSpeed, phase } = spawn.orbit;
    const ang = phase + (angSpeed * dt) / 1000;
    return { x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) };
  }
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

// 全5ステージ通算スコアによる7段階ランク。閾値は「どのくらいの取り組み方で
// 届くか」を基準にシミュレーションで較正した:
//   ①②かけだし/みならい: 下手でもクリアできるレベル
//   ③一人前: 普通にプレイすれば届く
//   ④たつじん: コツ(隠し的を積極的に狙う、コンボを維持する)をつかめば届く
//   ⑤チャンピオン: しっかり頑張れば届く
//   ⑥スーパースター: 真剣に取り組めば届く
//   ⑦でんせつ: やり込んでほぼパーフェクトに近づけないと届かない
export const RANKS = [
  { min: 0, emoji: "🎈", title: "かけだし" },
  { min: 14000, emoji: "🎯", title: "みならい" },
  { min: 42000, emoji: "🥈", title: "一人前" },
  { min: 62000, emoji: "🥇", title: "たつじん" },
  { min: 82000, emoji: "🏆", title: "チャンピオン" },
  { min: 100000, emoji: "🌟", title: "スーパースター" },
  { min: 130000, emoji: "👑", title: "でんせつ" },
];

export function getRank(totalScore) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (totalScore >= r.min) rank = r;
  }
  return rank;
}
