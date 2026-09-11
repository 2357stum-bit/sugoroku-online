// マネー双六 - ボード・ルールの定義（フレームワーク非依存の純粋なデータ/関数群）
// 各クライアントが同じ入力から同じ盤面を再現できるよう、決定論的に構築する。

export const TOKENS = ["🐰", "🦊", "🐢", "🐸"];
export const MAX_PLAYERS = 4;
export const START_MONEY = 500;
export const BOARD_SIZE = 100;
export const LAST = BOARD_SIZE - 1;
export const GRID_COLS = 7;
export const ROW_HEIGHT = 38;
export const LANE_OFFSET = 9.5;

export const JOBS = [
  { id: "company", name: "会社員", icon: "💼", desc: "安定した収入でコツコツ堅実に", mult: { income: 1.0, bonus: 1.0, accident: 1.0, salary: 1.0 } },
  { id: "doctor", name: "医者", icon: "🩺", desc: "高収入だがハードワーク", mult: { income: 1.6, bonus: 1.0, accident: 1.2, salary: 1.7 } },
  { id: "civil", name: "公務員", icon: "🏛️", desc: "収入控えめだが安定重視", mult: { income: 0.85, bonus: 0.8, accident: 0.7, salary: 0.9 } },
  { id: "freelance", name: "フリーランス", icon: "🎨", desc: "当たれば大きいが波がある", mult: { income: 0.9, bonus: 1.6, accident: 1.3, salary: 0.8 } },
  { id: "entrepreneur", name: "起業家", icon: "🚀", desc: "ハイリスク・ハイリターン", mult: { income: 1.2, bonus: 1.8, accident: 1.8, salary: 1.3 } },
  { id: "celebrity", name: "芸能人", icon: "🎤", desc: "人気次第で収入が乱高下", mult: { income: 0.8, bonus: 2.0, accident: 1.6, salary: 1.1 } },
];
export const BASE_SALARY = 90;
export const PART_TIME_RATE = 0.4;

export const HOME_OPTIONS = [
  { id: "mansion", label: "大豪邸", icon: "🏰", cost: -700, baseValue: 700, desc: "憧れの大豪邸。値は張るが資産価値も大きい" },
  { id: "house", label: "一戸建て", icon: "🏡", cost: -380, baseValue: 380, desc: "庭付きの一戸建て。堅実な資産に" },
  { id: "condo", label: "マンション", icon: "🏢", cost: -250, baseValue: 250, desc: "利便性の高いマンション暮らし" },
  { id: "rent", label: "賃貸アパート", icon: "🏠", cost: -30, baseValue: 0, desc: "身軽な賃貸暮らし。資産にはならない" },
];

export const NEWS = [
  { text: "景気拡大のニュースが流れ、株価が大きく上昇", pct: 12 },
  { text: "世界的な株安で市場に激震が走る", pct: -10 },
  { text: "好決算ラッシュで相場が堅調に推移", pct: 7 },
  { text: "金利上昇への懸念から株価が下落", pct: -8 },
  { text: "新技術への期待から株価が急騰", pct: 15 },
  { text: "大手企業の不祥事発覚で市場が急落", pct: -14 },
  { text: "為替の影響で輸出関連株が上昇", pct: 6 },
  { text: "中央銀行の利下げ観測で市場が活気づく", pct: 9 },
  { text: "地政学リスクの高まりで様子見ムードが広がる", pct: -5 },
  { text: "景気後退懸念がじわじわと広がる", pct: -6 },
  { text: "消費が上向き小売関連株が買われる", pct: 5 },
  { text: "原油高でエネルギー関連株が急伸", pct: 8 },
];

export const DESC = {
  income: ["査定で高評価を受け賞与が上乗せされた", "在宅勤務手当がついた", "資格試験に合格し資格手当がついた", "深夜残業が続き残業代がしっかりついた", "担当プロジェクトが成功しインセンティブが出た", "出張先での成果が認められ特別手当が出た", "人事評価で昇給が決まった", "会社の業績好調で決算賞与が出た", "後輩の指導が評価され手当がついた"],
  expense: ["別荘の固定資産税を払う", "愛車の車検代を支払う", "親族の結婚式のご祝儀を包む", "冷蔵庫が故障し買い替えた", "確定申告で追加の納税が発生した", "火災保険の更新料を支払う", "ペットの手術費用がかかった", "実家の屋根の修理費を負担した", "マンションの管理費が値上がりした"],
  bonus: ["フリマアプリでブランド品が高値で売れた", "副業のライティングで臨時収入", "懸賞でギフト券が当たった", "昔貸したお金が友人から返ってきた", "ポイント還元キャンペーンで得をした", "仮想通貨の含み益を確定させた", "空き部屋を民泊で貸して収入を得た", "実家の蔵から骨董品が見つかり売却できた", "株主優待の商品券を換金した"],
  accident: ["財布を落として現金ごと紛失した", "仕手株に手を出して大きく損をした", "架空請求に騙されて支払ってしまった", "駅で傘を忘れて新しいものを買った", "スピード違反で反則金を取られた", "スマホの画面を割って修理に出した", "衝動買いでブランドバッグを購入した", "飲み会で盛り上がりすぎて散財した", "友人の結婚祝いで予想外の出費"],
  rest: ["繁忙期で休日出勤が続き一回休み", "風邪をこじらせて自宅療養、一回休み", "海外出張が長引き一回休み", "大事なプレゼン準備で一回休み", "引っ越し作業に追われて一回休み"],
  treasure: ["ダイヤの指輪", "金の延べ棒", "年代物のアンティーク時計", "幻の宝石", "骨董品の壺", "海賊の秘宝", "希少な記念コイン", "美術館級の絵画", "蔵から出てきた掛け軸"],
};

export const RANGE_ENDPOINTS = {
  income: { early: [20, 40], late: [200, 400] },
  expense: { early: [-40, -20], late: [-400, -200] },
  bonus: { early: [10, 50], late: [500, 1000] },
  accident: { early: [-50, -10], late: [-1000, -500] },
  treasure: { early: [30, 80], late: [300, 800] },
};

export const ICON = {
  income: "💰", expense: "💸", bonus: "🎁", accident: "⚡", rest: "💤",
  treasure: "💎", job: "🏢", salary: "💴", lifeevent: "💍",
  childevent: "👶", homepurchase: "🏘️", lottery: "🎫",
};

export const PATTERN = ["income", "bonus", "expense", "treasure", "rest", "accident",
  "income", "expense", "bonus", "treasure", "accident", "income"];

export const LIFEEVENTS = [
  { idx: 14, icon: "💍", label: "婚約", desc: "恋人と婚約した！指輪や式場の準備で家計が動く", base: 120 },
  { idx: 26, icon: "💒", label: "結婚式", desc: "結婚式を挙げた！費用とご祝儀、差し引きはいかに", base: 220 },
  { idx: 78, icon: "🔁", label: "転職", desc: "転職に挑戦した！新しい職場での評価は…", base: 550 },
  { idx: 92, icon: "🚀", label: "独立", desc: "独立して起業した！滑り出しの調子は…", base: 850 },
];
export const LIFEEVENT_MAP = {};
LIFEEVENTS.forEach((ev) => (LIFEEVENT_MAP[ev.idx] = ev));
export const LIFEEVENT_ROLL_MULT = { 1: -1.5, 2: -1.0, 3: -0.4, 4: 0.4, 5: 1.0, 6: 1.5 };

export const CHILDEVENTS = [
  { idx: 40, label: "第一子", cost: -150 },
  { idx: 84, label: "第二子", cost: -130 },
];
export const CHILDEVENT_MAP = {};
CHILDEVENTS.forEach((ev) => (CHILDEVENT_MAP[ev.idx] = ev));
export const CHILD_GIFT_TOTAL = 300;

export const HOME_IDX = 52;
export const LOTTERY_IDX = [16, 32, 46, 76, 88, 94];
export const LOTTERY_SET = new Set(LOTTERY_IDX);
export const SALARY_IDX = [8, 20, 34, 48, 74, 82, 90, 96];
export const SALARY_SET = new Set(SALARY_IDX);

export const FINISH_BONUS = [500, 300, 150, 80];
export const LOTTERY_REWARD = { 4: 2000, 3: 500, 2: 100, 1: 20, 0: 0 };
export const LOTTERY_RANK_LABEL = { 4: "特等", 3: "1等", 2: "2等", 1: "3等", 0: "ハズレ" };

export const FORK_LEN = 15;
export const FORKS = [55];
const RISK_TEMPLATE = [
  { type: "bonus", desc: "一攫千金を狙って大勝負に出た", amount: [100, 300] },
  { type: "accident", desc: "危険な近道で痛い目にあった", amount: [-200, -60] },
  { type: "bonus", desc: "裏路地で怪しい大取引がまとまった", amount: [80, 250] },
  { type: "accident", desc: "一か八かの賭けに敗れた", amount: [-180, -50] },
  { type: "bonus", desc: "闇市場で掘り出し物を安く仕入れた", amount: [90, 280] },
  { type: "accident", desc: "危険な賭場ですってしまった", amount: [-220, -70] },
  { type: "bonus", desc: "裏で聞いた儲け話に賭けて的中させた", amount: [110, 320] },
  { type: "accident", desc: "調子に乗って大きく踏み外した", amount: [-240, -80] },
];
const SAFE_TEMPLATE = [
  { type: "income", desc: "安全な道を選び着実に依頼をこなした", amount: [50, 90] },
  { type: "income", desc: "堅実に荷運びの仕事をこなした", amount: [40, 80] },
  { type: "income", desc: "地道な依頼で確実な報酬を得た", amount: [50, 90] },
  { type: "income", desc: "安全第一で慎重に旅を進めた", amount: [40, 80] },
  { type: "income", desc: "信頼できる商人と手堅い取引をした", amount: [50, 90] },
  { type: "income", desc: "コツコツ働いて確実に貯金を増やした", amount: [40, 80] },
  { type: "income", desc: "評判のいい仕事をきっちりこなした", amount: [50, 90] },
  { type: "income", desc: "無理せず着実に歩を進めた", amount: [40, 80] },
];

export const FORK_OPTIONS = [
  { id: "risk", label: "一攫千金コース", icon: "💀", desc: "荒れた道。大勝ちも大負けもある波乱の数マス" },
  { id: "safe", label: "堅実コース", icon: "🛡️", desc: "落ち着いた道。少しずつ確実にお金が増える" },
];

export const BRANCH_MAP = {};
FORKS.forEach((forkIdx) => {
  for (let k = 0; k < FORK_LEN; k++) {
    const idx = forkIdx + 1 + k;
    const riskT = RISK_TEMPLATE[k % RISK_TEMPLATE.length];
    const safeT = SAFE_TEMPLATE[k % SAFE_TEMPLATE.length];
    BRANCH_MAP[idx] = {
      forkIdx,
      risk: { type: "bonus_or_accident", realType: riskT.type, icon: ICON[riskT.type], desc: riskT.desc, amount: riskT.amount },
      safe: { type: "income", icon: ICON.income, desc: safeT.desc, amount: safeT.amount },
    };
  }
});

export function isForkIdx(idx) {
  return FORKS.indexOf(idx) !== -1;
}
export function isBranchIdx(idx) {
  return !!BRANCH_MAP[idx];
}

export function scaleRange(type, idx) {
  const t = idx / LAST;
  const curve = Math.pow(t, 1.8);
  const ep = RANGE_ENDPOINTS[type];
  const lo = ep.early[0] + (ep.late[0] - ep.early[0]) * curve;
  const hi = ep.early[1] + (ep.late[1] - ep.early[1]) * curve;
  const round10 = (n) => Math.round(n / 10) * 10;
  return [round10(lo), round10(hi)];
}
export function scaleFlat(base, idx) {
  const scale = 1 + (idx / LAST) * 1.2;
  return Math.round((base * scale) / 10) * 10;
}
export function pickAmount(range, rng = Math.random) {
  const [min, max] = range;
  return min + Math.floor(rng() * (max - min + 1));
}
export function randomTicket(rng = Math.random) {
  return String(Math.floor(rng() * 10000)).padStart(4, "0");
}

// ---- 100マスの盤面を一度だけ生成する（全クライアント共通・決定論的） ----
function buildSquares() {
  const SQUARES = [];
  const descCounter = {};
  function nextDesc(type) {
    descCounter[type] = (descCounter[type] || 0) + 1;
    const pool = DESC[type];
    return pool[(descCounter[type] - 1) % pool.length];
  }

  SQUARES[0] = { type: "start", label: "スタート", icon: "🏠" };
  SQUARES[4] = { type: "job", icon: ICON.job, desc: "就職先を選ぼう", forcedStop: true };
  let patternIdx = 0;
  for (let i = 1; i < LAST; i++) {
    if (i === 4) continue;
    if (isForkIdx(i)) {
      SQUARES[i] = { type: "fork", icon: "🔀", desc: "進む道を選ぼう", forcedStop: true };
      continue;
    }
    if (isBranchIdx(i)) {
      SQUARES[i] = { type: "branch" };
      continue;
    }
    if (LIFEEVENT_MAP[i]) {
      const ev = LIFEEVENT_MAP[i];
      SQUARES[i] = { type: "lifeevent", icon: ev.icon, label: ev.label, desc: ev.desc, baseMagnitude: ev.base, forcedStop: true };
      continue;
    }
    if (CHILDEVENT_MAP[i]) {
      const ev = CHILDEVENT_MAP[i];
      SQUARES[i] = { type: "childevent", icon: ICON.childevent, label: ev.label, childCost: ev.cost, forcedStop: true };
      continue;
    }
    if (i === HOME_IDX) {
      SQUARES[i] = { type: "homepurchase", icon: ICON.homepurchase, desc: "マイホームを選ぼう", forcedStop: true };
      continue;
    }
    if (LOTTERY_SET.has(i)) {
      SQUARES[i] = { type: "lottery", icon: ICON.lottery, desc: "宝くじをゲット" };
      continue;
    }
    if (SALARY_SET.has(i)) {
      SQUARES[i] = { type: "salary", icon: ICON.salary, desc: "給料日がやってきた" };
      continue;
    }
    const type = PATTERN[patternIdx % PATTERN.length];
    patternIdx++;
    const sq = { type, icon: ICON[type], desc: nextDesc(type) };
    if (type === "income" || type === "expense" || type === "bonus" || type === "accident" || type === "treasure") {
      sq.amount = scaleRange(type, i);
    }
    SQUARES[i] = sq;
  }
  SQUARES[LAST] = { type: "goal", label: "ゴール", icon: "🏁" };
  return SQUARES;
}

export const SQUARES = buildSquares();

// player: プレイヤーごとの分岐選択(routeChoice)に応じて実際に止まるマス内容を解決する
export function getSquare(player, idx) {
  const sq = SQUARES[idx];
  if (sq.type === "branch") {
    const bd = BRANCH_MAP[idx];
    const choice = (player.routeChoice && player.routeChoice[bd.forkIdx]) || "safe";
    const picked = choice === "risk" ? bd.risk : bd.safe;
    return { type: picked.realType || picked.type, icon: picked.icon, desc: picked.desc, amount: picked.amount };
  }
  return sq;
}

export function isForcedStop(player, idx) {
  return !!(getSquare(player, idx).forcedStop || SQUARES[idx].forcedStop);
}

// ---- 盤面レイアウト（曲がり道のグリッド + ジッター） ----
export function basePoint(idx) {
  const row = Math.floor(idx / GRID_COLS);
  const colInRow = idx % GRID_COLS;
  const col = row % 2 === 0 ? colInRow : GRID_COLS - 1 - colInRow;
  const slotX = ((col + 0.5) / GRID_COLS) * 100;
  const slotY = row * ROW_HEIGHT + 20;

  const jx = 2.6 * Math.sin(idx * 0.9 + 1.3) + 1.3 * Math.sin(idx * 2.3 + 0.4);
  const jy = 2.8 * Math.sin(idx * 1.6 + 2.1) + 1.3 * Math.sin(idx * 3.1 + 0.9);

  let x = slotX + jx;
  if (x < 5) x = 5;
  if (x > 95) x = 95;
  return { xPct: x, y: slotY + jy };
}

export function createPlayer(id, idx, name) {
  return {
    id,
    token: TOKENS[idx],
    name: name || `プレイヤー${idx + 1}`,
    pos: 0,
    rest: 0,
    money: START_MONEY,
    finished: false,
    job: null,
    cards: [],
    invested: 0,
    investPayout: 0,
    investGain: 0,
    home: null,
    homeSaleValue: 0,
    treasureSum: 0,
    lotteryTickets: [],
    lotteryReward: 0,
    finishBonus: 0,
    routeChoice: {},
    connected: true,
  };
}
