// きょうどうパズル(ソコバン風) - 純粋なゲームロジック関数群。
// 2人のプレイヤーが同じ盤面を共有し、箱(B)を目的地(T)まで押していく。
// スイッチ(小文字)は「プレイヤーか箱がその上にいる間だけ」対応する扉(同じ文字の大文字)を開く。
// 盤面はグリッド文字列の配列で表現し、毎回パースするので状態(state)には含めない
// (Firestoreへ書き込むデータを最小限にするため)。

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const LEVELS = [
  {
    id: 1,
    name: "そうさになれよう",
    hint: "矢印キー/WASDで移動。箱に向かって進むと押せるよ。",
    rows: ["#######", "#.....#", "#.1.2.#", "#..B..#", "#..T..#", "#######"],
  },
  {
    id: 2,
    name: "きょうりょくのとびら",
    hint: "スイッチ(a)に誰かが乗っている間だけ、扉(A)が開く。",
    rows: ["#########", "#...#.2.#", "#.1BA..T#", "#...#.a.#", "#########"],
  },
  {
    id: 3,
    name: "ふたつのはこ",
    hint: "扉は同じ記号どうしで連動するよ。ふたつの箱を運びきろう。",
    rows: [
      "#########",
      "#...#.2.#",
      "#.1BA..T#",
      "#..BA..T#",
      "#...#...#",
      "#...#.a.#",
      "#########",
    ],
  },
];

function key(x, y) {
  return `${x},${y}`;
}

export function parseLevel(levelId) {
  const def = LEVELS.find((l) => l.id === levelId) || LEVELS[0];
  const rows = def.rows;
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const walls = new Set();
  const targets = new Set();
  const switches = new Map();
  const doors = new Map();
  const boxesStart = [];
  const players = { 0: null, 1: null };

  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      const ch = row[x] || "#";
      if (ch === "#") { walls.add(key(x, y)); continue; }
      if (ch === "T") { targets.add(key(x, y)); continue; }
      if (ch === "B") { boxesStart.push({ x, y }); continue; }
      if (ch === "1") { players[0] = { x, y }; continue; }
      if (ch === "2") { players[1] = { x, y }; continue; }
      if (ch >= "a" && ch <= "z") { switches.set(key(x, y), ch); continue; }
      if (ch >= "A" && ch <= "Z") { doors.set(key(x, y), ch.toLowerCase()); continue; }
      // '.' やその他は素通りできる床として扱う
    }
  }

  return { id: def.id, name: def.name, hint: def.hint, width, height, walls, targets, switches, doors, boxesStart, players };
}

export function getLevelList() {
  return LEVELS.map((l) => ({ id: l.id, name: l.name, hint: l.hint }));
}

function inBounds(level, x, y) {
  return x >= 0 && y >= 0 && x < level.width && y < level.height;
}

export function isSwitchActive(level, state, switchId) {
  for (const [posKey, id] of level.switches) {
    if (id !== switchId) continue;
    const [sx, sy] = posKey.split(",").map(Number);
    if (state.players[0] && state.players[0].x === sx && state.players[0].y === sy) return true;
    if (state.players[1] && state.players[1].x === sx && state.players[1].y === sy) return true;
    if (state.boxes.some((b) => b.x === sx && b.y === sy)) return true;
  }
  return false;
}

export function isDoorOpen(level, state, x, y) {
  const doorId = level.doors.get(key(x, y));
  if (!doorId) return null;
  return isSwitchActive(level, state, doorId);
}

function isBlockedByDoor(level, state, x, y) {
  const doorId = level.doors.get(key(x, y));
  if (!doorId) return false;
  return !isSwitchActive(level, state, doorId);
}

export function createInitialState(levelId) {
  const level = parseLevel(levelId);
  return {
    levelId: level.id,
    players: { 0: { ...level.players[0] }, 1: { ...level.players[1] } },
    boxes: level.boxesStart.map((b) => ({ ...b })),
    moves: 0,
    solved: false,
  };
}

export function checkSolved(state, level) {
  if (level.targets.size === 0) return false;
  for (const t of level.targets) {
    const [tx, ty] = t.split(",").map(Number);
    if (!state.boxes.some((b) => b.x === tx && b.y === ty)) return false;
  }
  return true;
}

// プレイヤーを1マス動かす。押せる箱があれば一緒に押す。stateは直接書き換える。
// 戻り値: 実際に動けたかどうか(false なら壁/扉/相方/箱づまりで無効な手だった)
export function movePlayer(state, level, playerIdx, dir) {
  if (state.solved) return false;
  const d = DIRS[dir];
  const p = state.players[playerIdx];
  if (!d || !p) return false;

  const nx = p.x + d.dx;
  const ny = p.y + d.dy;
  if (!inBounds(level, nx, ny)) return false;
  if (level.walls.has(key(nx, ny))) return false;
  if (isBlockedByDoor(level, state, nx, ny)) return false;

  const otherIdx = playerIdx === 0 ? 1 : 0;
  const other = state.players[otherIdx];

  const boxIdx = state.boxes.findIndex((b) => b.x === nx && b.y === ny);
  if (boxIdx >= 0) {
    const bx = nx + d.dx;
    const by = ny + d.dy;
    if (!inBounds(level, bx, by)) return false;
    if (level.walls.has(key(bx, by))) return false;
    if (isBlockedByDoor(level, state, bx, by)) return false;
    if (state.boxes.some((b, i) => i !== boxIdx && b.x === bx && b.y === by)) return false;
    if (other && other.x === bx && other.y === by) return false;
    state.boxes[boxIdx] = { x: bx, y: by };
  } else if (other && other.x === nx && other.y === ny) {
    return false;
  }

  p.x = nx;
  p.y = ny;
  state.moves += 1;
  state.solved = checkSolved(state, level);
  return true;
}
