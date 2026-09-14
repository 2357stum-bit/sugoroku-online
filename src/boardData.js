// マネー双六 - ボード・ルールの定義（フレームワーク非依存の純粋なデータ/関数群）
// 複数の「マップ(テーマ)」に対応するため、盤面の構造(マス数・イベントの位置・分岐など)は
// 全テーマ共通の定数として持ち、見た目・フレーバーテキスト(職業・拠点・ニュース・アイコン等)
// だけをテーマごとに切り替える。各クライアントが同じ入力から同じ盤面を再現できるよう、
// 全て決定論的に構築する。

export const MAX_PLAYERS = 4;
export const START_MONEY = 500;
export const BOARD_SIZE = 100;
export const LAST = BOARD_SIZE - 1;
export const GRID_COLS = 7;
export const ROW_HEIGHT = 38;
export const LANE_OFFSET = 9.5;

export const BASE_SALARY = 90;
export const PART_TIME_RATE = 0.4;

export const RANGE_ENDPOINTS = {
  income: { early: [20, 40], late: [200, 400] },
  expense: { early: [-25, -12], late: [-220, -110] },
  bonus: { early: [10, 50], late: [500, 1000] },
  accident: { early: [-30, -8], late: [-500, -250] },
  treasure: { early: [30, 80], late: [300, 800] },
};

// マイナスマス(expense/accident)は少なめに・プラス系マスを多めに配置する
export const PATTERN = ["income", "bonus", "expense", "treasure", "rest", "income",
  "bonus", "treasure", "accident", "income", "bonus", "income"];

export const LIFEEVENT_ROLL_MULT = { 1: -0.8, 2: -0.5, 3: -0.2, 4: 0.4, 5: 1.0, 6: 1.5 };
export const CHILD_GIFT_TOTAL = 300;

export const HOME_IDX = 52;
export const LOTTERY_IDX = [16, 32, 46, 76, 88, 94];
export const LOTTERY_SET = new Set(LOTTERY_IDX);
export const SALARY_IDX = [8, 20, 34, 48, 74, 82, 90, 96];
export const SALARY_SET = new Set(SALARY_IDX);

export const FINISH_BONUS = [500, 300, 150, 80];
export const LOTTERY_REWARD = { 4: 2000, 3: 500, 2: 100, 1: 20, 0: 0 };

export const FORK_LEN = 15;
export const FORKS = [55];

// 「二択マス」: 立ち止まって2つの選択肢からどちらかを選ぶ、より軽量な決断ポイント。
// 全テーマ共通の位置(構造)で、内容(文言・金額)だけテーマごとに変わる。
export const CHOICE_IDX = [6, 18, 30, 42, 72, 80, 87, 95];

export function isForkIdx(idx) {
  return FORKS.indexOf(idx) !== -1;
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
// income/expense/bonus/accident/treasure/rest マスの文言を、着地するたびにテーマの
// 文言プールからランダムに1つ選ぶ(固定の順送りにしない)。
export function randomDesc(theme, type, rng = Math.random) {
  const pool = theme.desc[type];
  return pool[Math.floor(rng() * pool.length)];
}
export function randomTicket(rng = Math.random) {
  return String(Math.floor(rng() * 10000)).padStart(4, "0");
}

// ============================================================
// テーマ定義: 「マネー双六」(money) と「冒険者双六」(adventure)
// ============================================================

const MONEY_THEME_CFG = {
  id: "money",
  name: "マネー双六",
  tagline: "100マスの人生を歩みながら、お金を稼いで、増やして、使おう。",
  eyebrowIcon: "💰",
  css: "money",
  tokens: ["🐰", "🦊", "🐢", "🐸"],
  currencyUnit: "万円",
  startLabel: "スタート",
  startIcon: "🏠",
  goalLabel: "ゴール",
  goalIcon: "🏁",
  labels: {
    jobSquareName: "職業",
    jobGachaTitle: "就職ガチャ！",
    salaryName: "給料日",
    investVerb: "投資",
    homeSquareName: "マイホーム",
    homeVerb: "購入",
    lotteryItemName: "宝くじ",
    lotteryFinaleName: "宝くじ抽選会",
    lotteryFinaleVerb: "抽選",
    childEventVerb: "子作り",
    childGiftLabel: "お祝い金",
    goalName: "ゴール",
    winningLabel: "当選番号",
  },
  jobs: [
    { id: "company", name: "会社員", icon: "💼", desc: "安定した収入でコツコツ堅実に", mult: { income: 1.0, bonus: 1.0, accident: 1.0, salary: 1.0 } },
    { id: "doctor", name: "医者", icon: "🩺", desc: "高収入だがハードワーク", mult: { income: 1.6, bonus: 1.0, accident: 1.2, salary: 1.7 } },
    { id: "civil", name: "公務員", icon: "🏛️", desc: "収入控えめだが安定重視", mult: { income: 0.85, bonus: 0.8, accident: 0.7, salary: 0.9 } },
    { id: "freelance", name: "フリーランス", icon: "🎨", desc: "当たれば大きいが波がある", mult: { income: 0.9, bonus: 1.6, accident: 1.3, salary: 0.8 } },
    { id: "entrepreneur", name: "起業家", icon: "🚀", desc: "ハイリスク・ハイリターン", mult: { income: 1.2, bonus: 1.8, accident: 1.8, salary: 1.3 } },
    { id: "celebrity", name: "芸能人", icon: "🎤", desc: "人気次第で収入が乱高下", mult: { income: 0.8, bonus: 2.0, accident: 1.6, salary: 1.1 } },
  ],
  homeOptions: [
    { id: "mansion", label: "大豪邸", icon: "🏰", cost: -700, baseValue: 700, desc: "憧れの大豪邸。値は張るが資産価値も大きい" },
    { id: "house", label: "一戸建て", icon: "🏡", cost: -380, baseValue: 380, desc: "庭付きの一戸建て。堅実な資産に" },
    { id: "condo", label: "マンション", icon: "🏢", cost: -250, baseValue: 250, desc: "利便性の高いマンション暮らし" },
    { id: "rent", label: "賃貸アパート", icon: "🏠", cost: -30, baseValue: 0, desc: "身軽な賃貸暮らし。資産にはならない" },
  ],
  news: [
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
  ],
  desc: {
    income: ["査定で高評価を受け賞与が上乗せされた", "在宅勤務手当がついた", "資格試験に合格し資格手当がついた", "深夜残業が続き残業代がしっかりついた", "担当プロジェクトが成功しインセンティブが出た", "出張先での成果が認められ特別手当が出た", "人事評価で昇給が決まった", "会社の業績好調で決算賞与が出た", "後輩の指導が評価され手当がついた"],
    expense: ["別荘の固定資産税を払う", "愛車の車検代を支払う", "親族の結婚式のご祝儀を包む", "冷蔵庫が故障し買い替えた", "確定申告で追加の納税が発生した", "火災保険の更新料を支払う", "ペットの手術費用がかかった", "実家の屋根の修理費を負担した", "マンションの管理費が値上がりした"],
    bonus: ["フリマアプリでブランド品が高値で売れた", "副業のライティングで臨時収入", "懸賞でギフト券が当たった", "昔貸したお金が友人から返ってきた", "ポイント還元キャンペーンで得をした", "仮想通貨の含み益を確定させた", "空き部屋を民泊で貸して収入を得た", "実家の蔵から骨董品が見つかり売却できた", "株主優待の商品券を換金した"],
    accident: ["財布を落として現金ごと紛失した", "仕手株に手を出して大きく損をした", "架空請求に騙されて支払ってしまった", "駅で傘を忘れて新しいものを買った", "スピード違反で反則金を取られた", "スマホの画面を割って修理に出した", "衝動買いでブランドバッグを購入した", "飲み会で盛り上がりすぎて散財した", "友人の結婚祝いで予想外の出費"],
    rest: ["繁忙期で休日出勤が続き一回休み", "風邪をこじらせて自宅療養、一回休み", "海外出張が長引き一回休み", "大事なプレゼン準備で一回休み", "引っ越し作業に追われて一回休み"],
    treasure: ["ダイヤの指輪", "金の延べ棒", "年代物のアンティーク時計", "幻の宝石", "骨董品の壺", "海賊の秘宝", "希少な記念コイン", "美術館級の絵画", "蔵から出てきた掛け軸"],
  },
  icon: {
    income: "💰", expense: "💸", bonus: "🎁", accident: "⚡", rest: "💤",
    treasure: "💎", job: "🏢", salary: "💴", lifeevent: "💍",
    childevent: "👶", homepurchase: "🏘️", lottery: "🎫", choice: "🤔",
  },
  squareDesc: {
    job: "就職先を選ぼう",
    home: "マイホームを選ぼう",
    fork: "進む道を選ぼう",
    lottery: "宝くじをゲット",
    salary: "給料日がやってきた",
  },
  lifeEvents: [
    { idx: 14, icon: "💍", label: "婚約", desc: "恋人と婚約した！指輪や式場の準備で家計が動く", base: 120 },
    { idx: 26, icon: "💒", label: "結婚式", desc: "結婚式を挙げた！費用とご祝儀、差し引きはいかに", base: 220 },
    { idx: 78, icon: "🔁", label: "転職", desc: "転職に挑戦した！新しい職場での評価は…", base: 550 },
    { idx: 92, icon: "🚀", label: "独立", desc: "独立して起業した！滑り出しの調子は…", base: 850 },
  ],
  childEvents: [
    { idx: 40, label: "第一子", cost: -150 },
    { idx: 84, label: "第二子", cost: -130 },
  ],
  choices: [
    { idx: 6, squareDesc: "臨時ボーナスの使い道", options: [
      { id: "a", label: "貯金する", desc: "手堅く将来に備える", amount: [20, 30] },
      { id: "b", label: "パーッと使う", desc: "気分次第で得することも損することも", amount: [-15, 80] },
    ] },
    { idx: 18, squareDesc: "副業の誘い", options: [
      { id: "a", label: "断る", desc: "今の生活を大事にする", amount: [10, 20] },
      { id: "b", label: "受ける", desc: "うまくいけば大きいが空振りもある", amount: [-25, 150] },
    ] },
    { idx: 30, squareDesc: "お金の使い道", options: [
      { id: "a", label: "定期預金にする", desc: "コツコツ堅実に増やす", amount: [30, 50] },
      { id: "b", label: "怪しい儲け話に乗る", desc: "一攫千金か、大損か", amount: [-70, 250] },
    ] },
    { idx: 42, squareDesc: "転職エージェントからの連絡", options: [
      { id: "a", label: "今の職場に残る", desc: "安定を選ぶ", amount: [40, 70] },
      { id: "b", label: "転職する", desc: "環境が変わり運命が動く", amount: [-100, 300] },
    ] },
    { idx: 72, squareDesc: "起業のお誘い", options: [
      { id: "a", label: "見送る", desc: "今のままで手堅く", amount: [60, 100] },
      { id: "b", label: "起業する", desc: "大きなリターンとリスクが両方待つ", amount: [-180, 600] },
    ] },
    { idx: 80, squareDesc: "大きな買い物", options: [
      { id: "a", label: "我慢する", desc: "節約して貯蓄にまわす", amount: [80, 120] },
      { id: "b", label: "思い切って買う", desc: "散財するか、資産価値が上がるか", amount: [-140, 400] },
    ] },
    { idx: 87, squareDesc: "遺産相続の選択", options: [
      { id: "a", label: "現金で受け取る", desc: "手堅く確実に", amount: [100, 150] },
      { id: "b", label: "不動産で受け取る", desc: "化けるかもしれないが手間もかかる", amount: [-90, 500] },
    ] },
    { idx: 95, squareDesc: "人生最後の大勝負", options: [
      { id: "a", label: "手堅く終える", desc: "安定志向で締めくくる", amount: [150, 200] },
      { id: "b", label: "一発逆転を狙う", desc: "すべてを賭けた大博打", amount: [-250, 900] },
    ] },
  ],
  forkOptions: [
    { id: "risk", label: "一攫千金コース", icon: "💀", desc: "荒れた道。大勝ちも大負けもある波乱の数マス" },
    { id: "safe", label: "堅実コース", icon: "🛡️", desc: "落ち着いた道。少しずつ確実にお金が増える" },
  ],
  riskTemplate: [
    { type: "bonus", desc: "一攫千金を狙って大勝負に出た", amount: [100, 300] },
    { type: "accident", desc: "危険な近道で痛い目にあった", amount: [-100, -30] },
    { type: "bonus", desc: "裏路地で怪しい大取引がまとまった", amount: [80, 250] },
    { type: "accident", desc: "一か八かの賭けに敗れた", amount: [-90, -25] },
    { type: "bonus", desc: "闇市場で掘り出し物を安く仕入れた", amount: [90, 280] },
    { type: "accident", desc: "危険な賭場ですってしまった", amount: [-110, -35] },
    { type: "bonus", desc: "裏で聞いた儲け話に賭けて的中させた", amount: [110, 320] },
    { type: "accident", desc: "調子に乗って大きく踏み外した", amount: [-120, -40] },
  ],
  safeTemplate: [
    { type: "income", desc: "安全な道を選び着実に依頼をこなした", amount: [50, 90] },
    { type: "income", desc: "堅実に荷運びの仕事をこなした", amount: [40, 80] },
    { type: "income", desc: "地道な依頼で確実な報酬を得た", amount: [50, 90] },
    { type: "income", desc: "安全第一で慎重に旅を進めた", amount: [40, 80] },
    { type: "income", desc: "信頼できる商人と手堅い取引をした", amount: [50, 90] },
    { type: "income", desc: "コツコツ働いて確実に貯金を増やした", amount: [40, 80] },
    { type: "income", desc: "評判のいい仕事をきっちりこなした", amount: [50, 90] },
    { type: "income", desc: "無理せず着実に歩を進めた", amount: [40, 80] },
  ],
  rules: [
    { icon: "🏢", label: "就職マス", text: "サイコロで職業がランダムに決定" },
    { icon: "💴", label: "給料日マス", text: "全員が同時に投資額を決める（他のプレイヤーの決定を待ちます）" },
    { icon: "💍", label: "人生の一大イベントマス", text: "結婚・転職・独立など、出目で家計が変わる" },
    { icon: "👶", label: "子作りマス", text: "五分五分の運。成功すると他の全員からお祝い金がもらえる" },
    { icon: "🔀", label: "分かれ道マス", text: "一攫千金コースか堅実コースを選べる" },
    { icon: "🏘️", label: "マイホームマス", text: "ゴール後に売却して精算" },
    { icon: "🎫💎", label: "宝くじマス／お宝マス", text: "ゴール後の抽選・換金でお楽しみ" },
  ],
};

const ADVENTURE_THEME_CFG = {
  id: "adventure",
  name: "冒険者双六",
  tagline: "100マスの冒険路を進み、クラスを選び、仲間を集めて王城を目指そう。",
  eyebrowIcon: "⚔️",
  css: "adventure",
  tokens: ["🗡️", "🛡️", "🏹", "🔮"],
  currencyUnit: "G",
  startLabel: "出発の村",
  startIcon: "🏕️",
  goalLabel: "王城",
  goalIcon: "🏰",
  labels: {
    jobSquareName: "クラス",
    jobGachaTitle: "クラス選択ガチャ！",
    salaryName: "ギルド報酬日",
    investVerb: "強化",
    homeSquareName: "拠点",
    homeVerb: "選択",
    lotteryItemName: "地図の欠片",
    lotteryFinaleName: "隠し財宝の扉",
    lotteryFinaleVerb: "扉を開く",
    childEventVerb: "仲間の勧誘",
    childGiftLabel: "歓迎の宴費用",
    goalName: "王城",
    winningLabel: "扉の暗号",
  },
  jobs: [
    { id: "warrior", name: "戦士", icon: "⚔️", desc: "バランス型。堅実に戦果を積み上げる", mult: { income: 1.0, bonus: 1.0, accident: 1.0, salary: 1.0 } },
    { id: "hunter", name: "狩人", icon: "🏹", desc: "高い成功報酬だが気の抜けない毎日", mult: { income: 1.6, bonus: 1.0, accident: 1.2, salary: 1.7 } },
    { id: "cleric", name: "僧侶", icon: "✨", desc: "報酬は控えめだが危険を避けて手堅い", mult: { income: 0.85, bonus: 0.8, accident: 0.7, salary: 0.9 } },
    { id: "rogue", name: "盗賊", icon: "🗡️", desc: "当たれば大きいが波が激しい", mult: { income: 0.9, bonus: 1.6, accident: 1.3, salary: 0.8 } },
    { id: "mage", name: "魔法使い", icon: "🔮", desc: "ハイリスク・ハイリターンな一撃", mult: { income: 1.2, bonus: 1.8, accident: 1.8, salary: 1.3 } },
    { id: "sage", name: "賢者", icon: "📜", desc: "幸運を引き寄せるが浮き沈みが激しい", mult: { income: 0.8, bonus: 2.0, accident: 1.6, salary: 1.1 } },
  ],
  homeOptions: [
    { id: "fortress", label: "大要塞", icon: "🏯", cost: -700, baseValue: 700, desc: "圧倒的な防御力を誇る要塞。資産価値も抜群" },
    { id: "cabin", label: "山小屋", icon: "🏔️", cost: -380, baseValue: 380, desc: "静かな山あいの拠点。堅実な資産に" },
    { id: "inn", label: "宿屋の一室", icon: "🏨", cost: -250, baseValue: 250, desc: "便利な街なかの拠点暮らし" },
    { id: "tent", label: "野営テント", icon: "⛺", cost: -30, baseValue: 0, desc: "身軽なテント暮らし。資産にはならない" },
  ],
  news: [
    { text: "伝説の鍛冶師が現れ、強化効果が跳ね上がっている", pct: 12 },
    { text: "魔力の嵐で素材価格が高騰し、強化が思うように進まない", pct: -10 },
    { text: "豊漁ならぬ豊鉱で鉱石が安定供給され相場が堅調", pct: 7 },
    { text: "王国の増税で武具の値段が下落している", pct: -8 },
    { text: "新素材「星屑鋼」の噂で相場が急騰", pct: 15 },
    { text: "大手工房の不正が発覚し信用が急落", pct: -14 },
    { text: "隣国との交易で希少素材が流入し相場が上昇", pct: 6 },
    { text: "ギルド本部の後押しで市場が活気づく", pct: 9 },
    { text: "魔物の大量発生で流通が滞り様子見ムード", pct: -5 },
    { text: "不況の噂がじわじわ広がっている", pct: -6 },
    { text: "冒険者の需要が高まり武具がよく売れている", pct: 5 },
    { text: "魔石の高騰でエンチャント関連が急伸", pct: 8 },
  ],
  desc: {
    income: ["町の依頼を達成し報酬を受け取った", "魔物退治の懸賞金を回収した", "商人の護衛任務が成功し謝礼をもらった", "迷宮の宝箱を見つけ換金した", "ギルドランクが上がり特別報酬が出た", "貴族から感謝の金一封を受け取った", "薬草採取の依頼で報酬を得た", "古い地図を売却できた", "討伐部隊への協力金が出た"],
    expense: ["鍛冶屋で剣の刃こぼれを修理した", "宿屋で少し良い部屋に泊まった", "毒消し草を大量に購入した", "馬車の車輪が壊れ修理費がかかった", "盗賊にわずかな路銀を奪われた", "教会でパーティ全員の祝福を受けた", "防具の手入れ代を支払った", "渡し船の高額な渡航料を払った", "関所の通行税を取られた"],
    bonus: ["道端で落とし物の財布を拾った", "商人と交渉して掘り出し物を安く買えた", "古代コインの収集品が高く売れた", "賭け事で思わぬ大勝ちをした", "旅人から餞別をもらった", "隠し部屋で金貨の山を発見した", "魔法の泉が願いを叶え金貨をくれた", "廃墟の宝物庫を発見した", "行商人から掘り出し物を譲られた"],
    accident: ["モンスターの奇襲を受け荷物を落とした", "毒沼にはまり薬代がかさんだ", "詐欺師に高額な魔法薬を売りつけられた", "崖から滑落し装備が壊れた", "呪いの罠にかかり出費がかさんだ", "酒場の喧嘩に巻き込まれ弁償させられた", "ならず者に因縁をつけられ金を渡した", "嵐で野営道具が流された", "霧に巻かれ遠回りして路銀を使った"],
    rest: ["長旅の疲れで一回休み", "モンスターの毒で一回休み", "吹雪に閉じ込められ一回休み", "馬が脚を痛め一回休み", "仲間の看病で一回休み"],
    treasure: ["伝説の聖剣", "古代竜のうろこ", "賢者の石", "呪われた指輪", "失われた王家の秘宝", "不死鳥の羽根", "古の魔導書", "妖精の涙の宝石", "巨人の財宝"],
  },
  icon: {
    income: "💰", expense: "💸", bonus: "🎁", accident: "⚡", rest: "🏕️",
    treasure: "💎", job: "⚔️", salary: "🛡️", lifeevent: "🔥",
    childevent: "🤝", homepurchase: "🏯", lottery: "🗺️", choice: "⚖️",
  },
  squareDesc: {
    job: "クラスを選ぼう",
    home: "拠点を選ぼう",
    fork: "進む道を選ぼう",
    lottery: "地図の欠片を発見",
    salary: "ギルド報酬日がやってきた",
  },
  lifeEvents: [
    { idx: 14, icon: "🗡️", label: "盗賊団との戦い", desc: "森で盗賊団に襲われた！応戦の結果は…", base: 120 },
    { idx: 26, icon: "🏛️", label: "古代遺跡の発見", desc: "古代遺跡を発見した！探索の成果はいかに…", base: 220 },
    { idx: 78, icon: "🐲", label: "竜の巣への迷い込み", desc: "ドラゴンの巣に迷い込んだ！運命の分かれ道…", base: 550 },
    { idx: 92, icon: "👹", label: "魔王軍幹部との一騎打ち", desc: "魔王軍の幹部と一騎打ちになった！勝敗のゆくえは…", base: 850 },
  ],
  childEvents: [
    { idx: 40, label: "第一の仲間", cost: -150 },
    { idx: 84, label: "第二の仲間", cost: -130 },
  ],
  choices: [
    { idx: 6, squareDesc: "臨時報酬の使い道", options: [
      { id: "a", label: "貯める", desc: "いざという時のために蓄える", amount: [20, 30] },
      { id: "b", label: "豪遊する", desc: "気分次第で得することも損することも", amount: [-15, 80] },
    ] },
    { idx: 18, squareDesc: "傭兵の誘い", options: [
      { id: "a", label: "断る", desc: "今のパーティで頑張る", amount: [10, 20] },
      { id: "b", label: "受ける", desc: "うまくいけば大金、しくじれば大損", amount: [-25, 150] },
    ] },
    { idx: 30, squareDesc: "資金の使い道", options: [
      { id: "a", label: "ギルドに預ける", desc: "手堅く利子を得る", amount: [30, 50] },
      { id: "b", label: "怪しい商人の話に乗る", desc: "一攫千金か、丸損か", amount: [-70, 250] },
    ] },
    { idx: 42, squareDesc: "別のギルドからの勧誘", options: [
      { id: "a", label: "今のギルドに残る", desc: "安定を選ぶ", amount: [40, 70] },
      { id: "b", label: "移籍する", desc: "環境が変わり運命が動く", amount: [-100, 300] },
    ] },
    { idx: 72, squareDesc: "独立開業のチャンス", options: [
      { id: "a", label: "見送る", desc: "今のままで手堅く", amount: [60, 100] },
      { id: "b", label: "自分の店を持つ", desc: "大きなリターンとリスクが両方待つ", amount: [-180, 600] },
    ] },
    { idx: 80, squareDesc: "伝説の武具の噂", options: [
      { id: "a", label: "我慢する", desc: "節約して蓄える", amount: [80, 120] },
      { id: "b", label: "思い切って買う", desc: "駄作か、伝説級の掘り出し物か", amount: [-140, 400] },
    ] },
    { idx: 87, squareDesc: "先代からの遺産", options: [
      { id: "a", label: "金貨で受け取る", desc: "手堅く確実に", amount: [100, 150] },
      { id: "b", label: "秘宝で受け取る", desc: "化けるかもしれないが手間もかかる", amount: [-90, 500] },
    ] },
    { idx: 95, squareDesc: "最後の大冒険", options: [
      { id: "a", label: "手堅く終える", desc: "安全策で締めくくる", amount: [150, 200] },
      { id: "b", label: "一発逆転を狙う", desc: "すべてを賭けた大博打", amount: [-250, 900] },
    ] },
  ],
  forkOptions: [
    { id: "risk", label: "一攫千金コース", icon: "💀", desc: "荒れた道。大勝ちも大負けもある波乱の数マス" },
    { id: "safe", label: "堅実コース", icon: "🛡️", desc: "落ち着いた道。少しずつ確実にゴールドが増える" },
  ],
  riskTemplate: [
    { type: "bonus", desc: "危険な近道で財宝の隠し部屋を見つけた", amount: [100, 300] },
    { type: "accident", desc: "モンスターの巣に迷い込み大怪我をした", amount: [-100, -30] },
    { type: "bonus", desc: "裏路地で怪しい大取引がまとまった", amount: [80, 250] },
    { type: "accident", desc: "一か八かの近道で罠にかかった", amount: [-90, -25] },
    { type: "bonus", desc: "廃坑で埋もれた財宝を掘り当てた", amount: [90, 280] },
    { type: "accident", desc: "野盗の待ち伏せに遭い身包み剥がされた", amount: [-110, -35] },
    { type: "bonus", desc: "古い地図を頼りに秘密の宝物庫を突き止めた", amount: [110, 320] },
    { type: "accident", desc: "調子に乗って危険な深部まで踏み込んだ", amount: [-120, -40] },
  ],
  safeTemplate: [
    { type: "income", desc: "安全な街道で着実に依頼をこなした", amount: [50, 90] },
    { type: "income", desc: "堅実に荷運びの仕事をこなした", amount: [40, 80] },
    { type: "income", desc: "地道な依頼で確実な報酬を得た", amount: [50, 90] },
    { type: "income", desc: "安全第一で慎重に旅を進めた", amount: [40, 80] },
    { type: "income", desc: "村人に頼まれた見回りで謝礼を得た", amount: [50, 90] },
    { type: "income", desc: "コツコツ薬草を集めて売りさばいた", amount: [40, 80] },
    { type: "income", desc: "安定した護衛依頼をきっちりこなした", amount: [50, 90] },
    { type: "income", desc: "無理せず着実に旅を進めた", amount: [40, 80] },
  ],
  rules: [
    { icon: "⚔️", label: "クラス選択マス", text: "サイコロでクラスがランダムに決定" },
    { icon: "🛡️", label: "ギルド報酬マス", text: "全員が同時に装備強化額を決める（他のプレイヤーの決定を待ちます）" },
    { icon: "🔥", label: "冒険のハプニングマス", text: "モンスター討伐や遺跡発見など、出目で財産が変わる" },
    { icon: "🤝", label: "仲間加入マス", text: "五分五分の運。成功すると他の全員から歓迎の宴費用がもらえる" },
    { icon: "🔀", label: "分かれ道マス", text: "一攫千金コースか堅実コースを選べる" },
    { icon: "🏯", label: "拠点選択マス", text: "ゴール後に売却して精算" },
    { icon: "🗺️💎", label: "地図の欠片マス／秘宝マス", text: "ゴール後の隠し財宝の扉・換金でお楽しみ" },
  ],
};

const IDOL_THEME_CFG = {
  id: "idol",
  name: "アイドル双六",
  tagline: "100マスのステージを駆け抜け、ジャンルを選び、ファンを増やして芸能界の頂点を目指そう。",
  eyebrowIcon: "🎤",
  css: "idol",
  tokens: ["🎤", "🎬", "🎸", "🌟"],
  currencyUnit: "万円",
  startLabel: "練習生スタート",
  startIcon: "🌱",
  goalLabel: "芸能界の頂点",
  goalIcon: "👑",
  labels: {
    jobSquareName: "ジャンル",
    jobGachaTitle: "ジャンル選択ガチャ！",
    salaryName: "ギャラ日",
    investVerb: "自己投資",
    homeSquareName: "住まい",
    homeVerb: "選択",
    lotteryItemName: "オーディション整理番号",
    lotteryFinaleName: "運命の生放送抽選会",
    lotteryFinaleVerb: "抽選",
    childEventVerb: "目標達成",
    childGiftLabel: "お祝いの花輪代",
    goalName: "頂点",
    winningLabel: "運命の数字",
  },
  jobs: [
    { id: "idol", name: "アイドル", icon: "🎤", desc: "バランス型。堅実にファンを増やす", mult: { income: 1.0, bonus: 1.0, accident: 1.0, salary: 1.0 } },
    { id: "actress", name: "女優", icon: "🎭", desc: "高いギャラだが気の抜けない毎日", mult: { income: 1.6, bonus: 1.0, accident: 1.2, salary: 1.7 } },
    { id: "comedian", name: "お笑い芸人", icon: "🤣", desc: "ギャラは控えめだが炎上リスクが低く手堅い", mult: { income: 0.85, bonus: 0.8, accident: 0.7, salary: 0.9 } },
    { id: "model", name: "モデル", icon: "💃", desc: "当たれば大きいが波が激しい", mult: { income: 0.9, bonus: 1.6, accident: 1.3, salary: 0.8 } },
    { id: "singer", name: "歌手", icon: "🎵", desc: "ハイリスク・ハイリターンな一発", mult: { income: 1.2, bonus: 1.8, accident: 1.8, salary: 1.3 } },
    { id: "youtuber", name: "YouTuber", icon: "📹", desc: "バズれば大きいが浮き沈みが激しい", mult: { income: 0.8, bonus: 2.0, accident: 1.6, salary: 1.1 } },
  ],
  homeOptions: [
    { id: "tower", label: "高級タワーマンション", icon: "🏙️", cost: -700, baseValue: 700, desc: "スター街道まっしぐらの豪華物件。資産価値も抜群" },
    { id: "condo", label: "芸能人御用達マンション", icon: "🏢", cost: -380, baseValue: 380, desc: "同業者も多い人気エリア。堅実な資産に" },
    { id: "dorm", label: "事務所の寮", icon: "🏠", cost: -250, baseValue: 250, desc: "仲間と共同生活。程よい距離感" },
    { id: "home", label: "実家暮らし", icon: "🏡", cost: -30, baseValue: 0, desc: "地に足のついた実家暮らし。資産にはならない" },
  ],
  news: [
    { text: "話題の新人が現れ、業界の注目度が急上昇している", pct: 12 },
    { text: "大物のスキャンダルで業界全体がイメージダウン", pct: -10 },
    { text: "ヒット番組の影響で仕事の需要が急増している", pct: 7 },
    { text: "不況の影響でCM出演料の相場が下落している", pct: -8 },
    { text: "SNSで新しいブームが起き注目度が急騰", pct: 15 },
    { text: "大手事務所の不祥事で業界の信用が急落", pct: -14 },
    { text: "海外市場で日本のコンテンツが人気上昇", pct: 6 },
    { text: "新しい配信プラットフォームの登場で業界が活気づく", pct: 9 },
    { text: "業界全体に自粛ムードが広がっている", pct: -5 },
    { text: "広告費が絞られ気味で仕事の相場が伸び悩む", pct: -6 },
    { text: "話題のドラマがヒットし関連の仕事が増加", pct: 5 },
    { text: "音楽フェスの盛況でライブ需要が急伸", pct: 8 },
  ],
  desc: {
    income: ["CM契約が決まりギャラが入った", "雑誌の専属モデルに抜擢された", "ラジオのレギュラー出演が決まった", "ファンミーティングのチケットが完売した", "ドラマの脇役オファーが来た", "企業とのタイアップ曲が採用された", "地方営業でしっかり稼いだ", "配信のスーパーチャットで盛り上がった", "雑誌の表紙を飾り増刷がかかった"],
    expense: ["衣装用にオーダーメイドのドレスを新調した", "ボイストレーニングの月謝を払った", "マネージャーへの謝礼を包んだ", "SNS炎上対応で謝罪広告費がかかった", "ダンスレッスンの追加コマを取った", "ファンクラブ会報の制作費を負担した", "私服がスクープされ買い替えた", "事務所へのマネジメント料を払った", "収録先への交通費がかさんだ"],
    bonus: ["配信の投げ銭で予想外の収入があった", "路上ライブがバズって注目を浴びた", "握手会でファンから差し入れの商品券をもらった", "古い写真集が再評価され重版した", "先輩芸能人から仕事を紹介してもらえた", "CMのギャラが交渉で上乗せされた", "懸賞で豪華賞品が当たった", "昔の楽曲が海外でバズって印税が入った", "ファンからの応援グッズが話題になった"],
    accident: ["SNSの発言が炎上し対応に追われた", "熱愛報道の火消しに費用がかかった", "本番で大失敗しお詫びの品を配った", "マネージャーとのトラブルで仲裁費用がかかった", "私物を盗まれ買い直した", "体調を崩して公演を欠席し違約金を払った", "誤情報を流され訂正広告を出した", "ライバルにポジションを奪われ立て直し費用がかかった", "収録先でのトラブル対応に追われた"],
    rest: ["喉を痛めて声が出ず一回休み", "体調不良でスケジュールを調整し一回休み", "長時間の収録が続き一回休み", "地方巡業の移動で一回休み", "メンタルケアのため一回休み"],
    treasure: ["デビュー当時の直筆サイン色紙", "伝説のライブの半券", "初代衣装の一着", "幻の未発表デモ音源", "大御所とのツーショット写真", "受賞トロフィーのレプリカ", "ファン一号からの手紙", "テレビ初出演時の台本", "伝説のポスター初版"],
  },
  icon: {
    income: "💰", expense: "💸", bonus: "🎁", accident: "⚡", rest: "🛌",
    treasure: "💎", job: "🎤", salary: "💴", lifeevent: "✨",
    childevent: "🤝", homepurchase: "🏙️", lottery: "🎬", choice: "🎯",
  },
  squareDesc: {
    job: "ジャンルを選ぼう",
    home: "住まいを選ぼう",
    fork: "進む道を選ぼう",
    lottery: "オーディション整理番号を発見",
    salary: "ギャラ日がやってきた",
  },
  lifeEvents: [
    { idx: 14, icon: "🎤", label: "オーディション", desc: "憧れのオーディションに挑戦した！審査結果は…", base: 120 },
    { idx: 26, icon: "✨", label: "メジャーデビュー", desc: "念願のメジャーデビューを果たした！滑り出しの評判は…", base: 220 },
    { idx: 78, icon: "📺", label: "大型音楽番組出演", desc: "大型音楽番組に出演した！反響のほどは…", base: 550 },
    { idx: 92, icon: "🎊", label: "紅白初出場", desc: "伝説の紅白歌合戦に初出場した！本番の出来は…", base: 850 },
  ],
  childEvents: [
    { idx: 40, label: "念願のソロデビュー", cost: -150 },
    { idx: 84, label: "主演ドラマへの挑戦", cost: -130 },
  ],
  choices: [
    { idx: 6, squareDesc: "臨時収入の使い道", options: [
      { id: "a", label: "貯金する", desc: "将来のために備える", amount: [20, 30] },
      { id: "b", label: "パーッと使う", desc: "気分次第で得することも損することも", amount: [-15, 80] },
    ] },
    { idx: 18, squareDesc: "副業案件の誘い", options: [
      { id: "a", label: "断る", desc: "今の活動に専念する", amount: [10, 20] },
      { id: "b", label: "受ける", desc: "バズれば大きいが空振りもある", amount: [-25, 150] },
    ] },
    { idx: 30, squareDesc: "資金の使い道", options: [
      { id: "a", label: "貯蓄する", desc: "コツコツ堅実に増やす", amount: [30, 50] },
      { id: "b", label: "怪しい投資話に乗る", desc: "一攫千金か、大損か", amount: [-70, 250] },
    ] },
    { idx: 42, squareDesc: "移籍のオファー", options: [
      { id: "a", label: "今の事務所に残る", desc: "安定を選ぶ", amount: [40, 70] },
      { id: "b", label: "移籍する", desc: "環境が変わり運命が動く", amount: [-100, 300] },
    ] },
    { idx: 72, squareDesc: "独立プロデュースの誘い", options: [
      { id: "a", label: "見送る", desc: "今のままで手堅く", amount: [60, 100] },
      { id: "b", label: "独立する", desc: "大きなリターンとリスクが両方待つ", amount: [-180, 600] },
    ] },
    { idx: 80, squareDesc: "大きな買い物", options: [
      { id: "a", label: "我慢する", desc: "節約して貯蓄にまわす", amount: [80, 120] },
      { id: "b", label: "思い切って買う", desc: "散財するか、話題になり資産価値が上がるか", amount: [-140, 400] },
    ] },
    { idx: 87, squareDesc: "レコード契約の選択", options: [
      { id: "a", label: "契約金で受け取る", desc: "手堅く確実に", amount: [100, 150] },
      { id: "b", label: "印税契約にする", desc: "化けるかもしれないが手間もかかる", amount: [-90, 500] },
    ] },
    { idx: 95, squareDesc: "芸能生活最後の大勝負", options: [
      { id: "a", label: "手堅く終える", desc: "安定志向で締めくくる", amount: [150, 200] },
      { id: "b", label: "一発逆転を狙う", desc: "すべてを賭けた大勝負", amount: [-250, 900] },
    ] },
  ],
  forkOptions: [
    { id: "risk", label: "一攫千金コース", icon: "💥", desc: "過激な路線。大バズりも大炎上もある波乱の数マス" },
    { id: "safe", label: "堅実コース", icon: "🎗️", desc: "地道な路線。少しずつ確実に評価が貯まっていく" },
  ],
  riskTemplate: [
    { type: "bonus", desc: "過激な企画に挑戦して大バズりした", amount: [100, 300] },
    { type: "accident", desc: "炎上覚悟の発言が裏目に出た", amount: [-100, -30] },
    { type: "bonus", desc: "際どい写真集が話題騒然になった", amount: [80, 250] },
    { type: "accident", desc: "一か八かのスキャンダル暴露が逆効果に", amount: [-90, -25] },
    { type: "bonus", desc: "際どいネタが当たって注目を独占した", amount: [90, 280] },
    { type: "accident", desc: "過激な発言が大炎上し謝罪に追われた", amount: [-110, -35] },
    { type: "bonus", desc: "炎上覚悟の企画がまさかの神回になった", amount: [110, 320] },
    { type: "accident", desc: "調子に乗りすぎて評判を落とした", amount: [-120, -40] },
  ],
  safeTemplate: [
    { type: "income", desc: "地道なファンサービスで信頼を積み重ねた", amount: [50, 90] },
    { type: "income", desc: "堅実に営業をこなし着実に稼いだ", amount: [40, 80] },
    { type: "income", desc: "真面目な活動が評価され安定収入を得た", amount: [50, 90] },
    { type: "income", desc: "安全第一で慎重にスケジュールをこなした", amount: [40, 80] },
    { type: "income", desc: "誠実な対応でファンの支持を固めた", amount: [50, 90] },
    { type: "income", desc: "コツコツ営業して確実に貯蓄を増やした", amount: [40, 80] },
    { type: "income", desc: "手堅い仕事をきっちりこなして評価された", amount: [50, 90] },
    { type: "income", desc: "無理せず着実に活動を続けた", amount: [40, 80] },
  ],
  rules: [
    { icon: "🎤", label: "ジャンル選択マス", text: "サイコロで活動ジャンルがランダムに決定" },
    { icon: "💴", label: "ギャラ日マス", text: "全員が同時に自己投資額を決める（他のプレイヤーの決定を待ちます）" },
    { icon: "✨", label: "芸能界の一大イベントマス", text: "オーディションや紅白出場など、出目で収入が変わる" },
    { icon: "🤝", label: "目標達成マス", text: "五分五分の運。成功すると他の全員からお祝いの花輪代がもらえる" },
    { icon: "🔀", label: "分かれ道マス", text: "一攫千金コースか堅実コースを選べる" },
    { icon: "🏙️", label: "住まい選択マス", text: "ゴール後に売却して精算" },
    { icon: "🎬💎", label: "オーディション整理番号マス／レジェンドアイテムマス", text: "ゴール後の生放送抽選会・換金でお楽しみ" },
  ],
};

const SCHOOL_THEME_CFG = {
  id: "school",
  name: "学園生活双六",
  tagline: "100マスの学園生活を駆け抜け、部活動を選び、青春を謳歌して卒業を目指そう。",
  eyebrowIcon: "🌸",
  css: "school",
  tokens: ["🎒", "📖", "⚽", "🎸"],
  currencyUnit: "万円",
  startLabel: "新入生スタート",
  startIcon: "🌱",
  goalLabel: "卒業",
  goalIcon: "🎓",
  labels: {
    jobSquareName: "部活動",
    jobGachaTitle: "部活動選択ガチャ！",
    salaryName: "お小遣い日",
    investVerb: "自分磨き",
    homeSquareName: "住まい",
    homeVerb: "選択",
    lotteryItemName: "福引番号",
    lotteryFinaleName: "運命の福引大会",
    lotteryFinaleVerb: "抽選",
    childEventVerb: "告白",
    childGiftLabel: "お祝い（冷やかし）のお小遣い",
    goalName: "卒業",
    winningLabel: "運命の福引番号",
  },
  jobs: [
    { id: "homeclub", name: "帰宅部", icon: "🎒", desc: "バランス型。自分のペースでコツコツ過ごす", mult: { income: 1.0, bonus: 1.0, accident: 1.0, salary: 1.0 } },
    { id: "sports", name: "運動部", icon: "⚽", desc: "頑張った分は評価されるが怪我のリスクも", mult: { income: 1.6, bonus: 1.0, accident: 1.2, salary: 1.7 } },
    { id: "culture", name: "文化部", icon: "🎨", desc: "地味だけどトラブルが少なく手堅い", mult: { income: 0.85, bonus: 0.8, accident: 0.7, salary: 0.9 } },
    { id: "council", name: "生徒会", icon: "📋", desc: "当たれば大きいが忙しく波が激しい", mult: { income: 0.9, bonus: 1.6, accident: 1.3, salary: 0.8 } },
    { id: "band", name: "軽音部", icon: "🎸", desc: "ハイリスク・ハイリターンなステージ", mult: { income: 1.2, bonus: 1.8, accident: 1.8, salary: 1.3 } },
    { id: "esports", name: "eスポーツ部", icon: "🎮", desc: "勝てば大きいが浮き沈みが激しい", mult: { income: 0.8, bonus: 2.0, accident: 1.6, salary: 1.1 } },
  ],
  homeOptions: [
    { id: "boarding", label: "名門寮制学校の個室", icon: "🏰", cost: -700, baseValue: 700, desc: "名門校の贅沢な個室寮。将来の人脈にもなる環境" },
    { id: "oneroom", label: "マンション一人暮らし", icon: "🏢", cost: -380, baseValue: 380, desc: "自由な一人暮らし。堅実な資産に" },
    { id: "dorm", label: "学生寮の相部屋", icon: "🏠", cost: -250, baseValue: 250, desc: "仲間と過ごす学生寮生活" },
    { id: "home", label: "実家から通学", icon: "🏡", cost: -30, baseValue: 0, desc: "地に足のついた実家暮らし。資産にはならない" },
  ],
  news: [
    { text: "学年トップの成績で一躍注目の的になった生徒が現れた", pct: 12 },
    { text: "学内で大きなトラブルが発覚しイメージダウン", pct: -10 },
    { text: "部活の大会での活躍が話題になり応援ムードが高まる", pct: 7 },
    { text: "校則が厳しくなり自由な活動がしづらくなっている", pct: -8 },
    { text: "SNSで学校の話題が急拡散しちょっとした有名校に", pct: 15 },
    { text: "不正が発覚し生徒会の信用が急落", pct: -14 },
    { text: "交流校とのイベントで人脈が広がっている", pct: 6 },
    { text: "新しい部活が発足し校内が活気づく", pct: 9 },
    { text: "テスト期間で校内全体が自粛ムード", pct: -5 },
    { text: "景気の影響でお小遣いの相場が伸び悩む", pct: -6 },
    { text: "文化祭が話題になり関連の手伝いが増加", pct: 5 },
    { text: "体育祭の盛況で応援グッズの需要が急伸", pct: 8 },
  ],
  desc: {
    income: ["バイト先で頑張りが認められ時給が上がった", "テストの成績が良くお小遣いがアップした", "親戚から臨時のお小遣いをもらった", "家庭教師のアルバイト代が入った", "文化祭の模擬店が大盛況で利益が出た", "新聞配達のバイト代をもらった", "塾の模試で好成績を出し特待生に選ばれた", "コンビニのバイトでしっかり稼いだ", "お手伝いのご褒美をもらった"],
    expense: ["部活の遠征費を払った", "友達の誕生日プレゼントを買った", "塾の教材費がかかった", "制服のサイズが合わず買い直した", "文化祭の衣装代を負担した", "参考書をまとめ買いした", "スマホの修理代がかかった", "友達とのカラオケ代がかさんだ", "部費の会費を払った"],
    bonus: ["フリマアプリで不用品が高く売れた", "懸賞でお菓子の詰め合わせが当たった", "先輩からお小遣いをもらった", "落とした財布が届けられ中身が無事だった", "くじ引きで特賞が当たった", "家の手伝いをして臨時ボーナスをもらった", "ポイ活で貯めたポイントを換金した", "古いゲームソフトが高値で売れた", "掃除中に思わぬ小銭を発見した"],
    accident: ["財布を落として現金ごと失くした", "友達との約束をすっぽかし埋め合わせをした", "スマホの画面を割って修理に出した", "部活の道具を壊して弁償した", "課金しすぎて後悔した", "友達に奢りすぎて出費がかさんだ", "先生に見つかり反省文用の文房具代がかかった", "自転車がパンクして修理代がかかった", "教材を忘れて買い直した"],
    rest: ["テスト勉強で夜更かしして一回休み", "風邪をひいて学校を休み一回休み", "部活の疲れで一回休み", "文化祭の準備で疲れて一回休み", "夏バテで一回休み"],
    treasure: ["初めてもらったラブレター", "文化祭で着た手作り衣装", "部活の県大会優勝メダル", "幻の生徒会長選挙ポスター", "先生からもらった直筆の手紙", "入学式の記念写真", "合唱コンクールの指揮棒", "卒業アルバムの試作品", "伝説の先輩からもらったお守り"],
  },
  icon: {
    income: "💰", expense: "💸", bonus: "🎁", accident: "⚡", rest: "🛌",
    treasure: "💎", job: "🎒", salary: "💴", lifeevent: "🌸",
    childevent: "💌", homepurchase: "🏠", lottery: "🎫", choice: "✏️",
  },
  squareDesc: {
    job: "部活動を選ぼう",
    home: "住まいを選ぼう",
    fork: "進む道を選ぼう",
    lottery: "福引番号を発見",
    salary: "お小遣い日がやってきた",
  },
  lifeEvents: [
    { idx: 14, icon: "🏃", label: "体育祭", desc: "体育祭で大活躍を狙う！結果は…", base: 120 },
    { idx: 26, icon: "🎪", label: "文化祭", desc: "文化祭の出し物、成功するかどうかは…", base: 220 },
    { idx: 78, icon: "✈️", label: "修学旅行", desc: "修学旅行での思い出作り、運命は…", base: 550 },
    { idx: 92, icon: "📝", label: "受験本番", desc: "人生を左右する受験本番！結果は…", base: 850 },
  ],
  childEvents: [
    { idx: 40, label: "初恋の告白", cost: -150 },
    { idx: 84, label: "運命の人への告白", cost: -130 },
  ],
  choices: [
    { idx: 6, squareDesc: "お小遣いの使い道", options: [
      { id: "a", label: "貯金する", desc: "将来のために備える", amount: [20, 30] },
      { id: "b", label: "パーッと使う", desc: "気分次第で得することも損することも", amount: [-15, 80] },
    ] },
    { idx: 18, squareDesc: "バイトの誘い", options: [
      { id: "a", label: "断る", desc: "今の生活を大事にする", amount: [10, 20] },
      { id: "b", label: "受ける", desc: "うまくいけば稼げるが空振りもある", amount: [-25, 150] },
    ] },
    { idx: 30, squareDesc: "お年玉の使い道", options: [
      { id: "a", label: "貯金する", desc: "コツコツ堅実に増やす", amount: [30, 50] },
      { id: "b", label: "友達との投資ごっこに乗る", desc: "一攫千金か、大損か", amount: [-70, 250] },
    ] },
    { idx: 42, squareDesc: "部活の掛け持ちの誘い", options: [
      { id: "a", label: "今の部活に専念する", desc: "安定を選ぶ", amount: [40, 70] },
      { id: "b", label: "掛け持ちする", desc: "環境が変わり運命が動く", amount: [-100, 300] },
    ] },
    { idx: 72, squareDesc: "文化祭の出店企画", options: [
      { id: "a", label: "見送る", desc: "今のままで手堅く", amount: [60, 100] },
      { id: "b", label: "出店する", desc: "大成功か大赤字か", amount: [-180, 600] },
    ] },
    { idx: 80, squareDesc: "大きな買い物", options: [
      { id: "a", label: "我慢する", desc: "節約して貯金にまわす", amount: [80, 120] },
      { id: "b", label: "思い切って買う", desc: "散財するか、みんなに羨ましがられるか", amount: [-140, 400] },
    ] },
    { idx: 87, squareDesc: "おじいちゃんからのお小遣い", options: [
      { id: "a", label: "現金で受け取る", desc: "手堅く確実に", amount: [100, 150] },
      { id: "b", label: "株を買ってもらう", desc: "化けるかもしれないが手間もかかる", amount: [-90, 500] },
    ] },
    { idx: 95, squareDesc: "卒業前最後の賭け", options: [
      { id: "a", label: "手堅く終える", desc: "安定志向で締めくくる", amount: [150, 200] },
      { id: "b", label: "一発逆転を狙う", desc: "すべてを賭けた大勝負", amount: [-250, 900] },
    ] },
  ],
  forkOptions: [
    { id: "risk", label: "一攫千金コース", icon: "💥", desc: "型破りな青春。大成功も大失敗もある波乱の数マス" },
    { id: "safe", label: "堅実コース", icon: "🎗️", desc: "真面目な青春。少しずつ確実に評価が貯まっていく" },
  ],
  riskTemplate: [
    { type: "bonus", desc: "型破りな企画に挑戦して校内で大バズりした", amount: [100, 300] },
    { type: "accident", desc: "目立ちすぎて先生に呼び出しをくらった", amount: [-100, -30] },
    { type: "bonus", desc: "際どい賭け事で友達に勝って大儲けした", amount: [80, 250] },
    { type: "accident", desc: "一か八かの行動が裏目に出た", amount: [-90, -25] },
    { type: "bonus", desc: "大胆な行動が評判になり注目を独占した", amount: [90, 280] },
    { type: "accident", desc: "調子に乗りすぎてトラブルになった", amount: [-110, -35] },
    { type: "bonus", desc: "一発逆転を狙った行動が見事に当たった", amount: [110, 320] },
    { type: "accident", desc: "調子に乗りすぎて信用を落とした", amount: [-120, -40] },
  ],
  safeTemplate: [
    { type: "income", desc: "真面目にコツコツ勉強して評価された", amount: [50, 90] },
    { type: "income", desc: "堅実に係の仕事をこなし信頼を得た", amount: [40, 80] },
    { type: "income", desc: "地道な努力が実を結び安定した評価を得た", amount: [50, 90] },
    { type: "income", desc: "安全第一で慎重にスケジュールをこなした", amount: [40, 80] },
    { type: "income", desc: "誠実な対応で友達の信頼を固めた", amount: [50, 90] },
    { type: "income", desc: "コツコツお小遣いを貯めて堅実に増やした", amount: [40, 80] },
    { type: "income", desc: "真面目な取り組みがきちんと評価された", amount: [50, 90] },
    { type: "income", desc: "無理せず着実に日々を過ごした", amount: [40, 80] },
  ],
  rules: [
    { icon: "🎒", label: "部活動選択マス", text: "サイコロで部活動がランダムに決定" },
    { icon: "💴", label: "お小遣い日マス", text: "全員が同時に自分磨きの投資額を決める（他のプレイヤーの決定を待ちます）" },
    { icon: "🌸", label: "学園生活の一大イベントマス", text: "体育祭や受験本番など、出目で収入が変わる" },
    { icon: "💌", label: "告白イベントマス", text: "五分五分の運。成功すると他の全員からお祝い（冷やかし）のお小遣いがもらえる" },
    { icon: "🔀", label: "分かれ道マス", text: "一攫千金コースか堅実コースを選べる" },
    { icon: "🏠", label: "住まい選択マス", text: "卒業後に精算" },
    { icon: "🎫💎", label: "福引番号マス／思い出の品マス", text: "卒業後の福引大会・換金でお楽しみ" },
  ],
};

const SPACE_THEME_CFG = {
  id: "space",
  name: "宇宙双六",
  tagline: "100マスの銀河を旅して、任務をこなし、コロニーを築きながら、伝説の宇宙飛行士を目指そう。",
  eyebrowIcon: "🚀",
  css: "space",
  tokens: ["🚀", "🛰️", "👽", "🪐"],
  currencyUnit: "Cr",
  startLabel: "訓練基地",
  startIcon: "🌍",
  goalLabel: "銀河の英雄",
  goalIcon: "🌌",
  labels: {
    jobSquareName: "任務",
    jobGachaTitle: "任務適性ガチャ！",
    salaryName: "任務報酬日",
    investVerb: "改造",
    homeSquareName: "居住区",
    homeVerb: "選択",
    lotteryItemName: "座標データ",
    lotteryFinaleName: "運命の座標解析",
    lotteryFinaleVerb: "解析",
    childEventVerb: "クルー勧誘",
    childGiftLabel: "歓迎パーティ費用",
    goalName: "英雄",
    winningLabel: "解析コード",
  },
  jobs: [
    { id: "pilot", name: "パイロット", icon: "🚀", desc: "バランス型。安定した任務をこなす", mult: { income: 1.0, bonus: 1.0, accident: 1.0, salary: 1.0 } },
    { id: "engineer", name: "エンジニア", icon: "🔧", desc: "高い成果報酬だが気の抜けない毎日", mult: { income: 1.6, bonus: 1.0, accident: 1.2, salary: 1.7 } },
    { id: "medic", name: "医療官", icon: "💉", desc: "報酬は控えめだが危険を避けて手堅い", mult: { income: 0.85, bonus: 0.8, accident: 0.7, salary: 0.9 } },
    { id: "scout", name: "偵察兵", icon: "🛰️", desc: "当たれば大きいが波が激しい", mult: { income: 0.9, bonus: 1.6, accident: 1.3, salary: 0.8 } },
    { id: "scientist", name: "科学者", icon: "🧪", desc: "ハイリスク・ハイリターンな大発見", mult: { income: 1.2, bonus: 1.8, accident: 1.8, salary: 1.3 } },
    { id: "commander", name: "司令官", icon: "🎖️", desc: "カリスマ次第で成果が乱高下", mult: { income: 0.8, bonus: 2.0, accident: 1.6, salary: 1.1 } },
  ],
  homeOptions: [
    { id: "cruiser", label: "旗艦クルーザー", icon: "🛸", cost: -700, baseValue: 700, desc: "最新技術を詰め込んだ旗艦。資産価値も抜群" },
    { id: "pod_ship", label: "個人用ポッド船", icon: "🚀", cost: -380, baseValue: 380, desc: "静かな一人用の小型船。堅実な資産に" },
    { id: "colony_dorm", label: "コロニーの寮", icon: "🏠", cost: -250, baseValue: 250, desc: "仲間と過ごすコロニー暮らし" },
    { id: "capsule", label: "簡易カプセル", icon: "🛌", cost: -30, baseValue: 0, desc: "身軽なカプセル暮らし。資産にはならない" },
  ],
  news: [
    { text: "新型ワープエンジンの開発成功で銀河経済が拡大", pct: 12 },
    { text: "小惑星帯の資源枯渇懸念で市場に激震が走る", pct: -10 },
    { text: "コロニー間交易の好調で相場が堅調に推移", pct: 7 },
    { text: "宇宙税の増税懸念からクレジットが下落", pct: -8 },
    { text: "新素材「星屑合金」への期待から相場が急騰", pct: 15 },
    { text: "大手宙域企業の不正発覚で市場が急落", pct: -14 },
    { text: "航路整備の影響で輸送関連が上昇", pct: 6 },
    { text: "銀河評議会の利下げ観測で市場が活気づく", pct: 9 },
    { text: "未確認信号の増加で様子見ムードが広がる", pct: -5 },
    { text: "景気後退懸念がじわじわと広がる", pct: -6 },
    { text: "コロニー人口が増え小売関連が買われる", pct: 5 },
    { text: "反物質燃料高でエネルギー関連が急伸", pct: 8 },
  ],
  desc: {
    income: ["未踏惑星の資源採掘で成果報酬を得た", "救難信号への対応で謝礼を受け取った", "護送任務が成功し謝礼をもらった", "遺跡の遺物を見つけ換金した", "隊内評価が上がり特別報酬が出た", "司令部から感謝の勲章と金一封を受け取った", "薬草…ではなく発光菌の採取依頼で報酬を得た", "古い星図を売却できた", "討伐部隊への協力金が出た"],
    expense: ["船体のハッチ修理費を支払った", "簡易カプセルで少し良い個室に泊まった", "解毒剤を大量に購入した", "着陸脚が壊れ修理費がかかった", "宙賊にわずかな燃料代を奪われた", "医療班全員の予防接種代を支払った", "装備の整備代を支払った", "渡航許可の高額な通行料を払った", "検疫ゲートの通過税を取られた"],
    bonus: ["漂流物の中から金属コンテナを回収した", "商人と交渉して掘り出し物を安く買えた", "古代コインの収集品が高く売れた", "賭け事で思わぬ大勝ちをした", "旅する商船から餞別をもらった", "隠し貨物庫で資源の山を発見した", "謎の泉が願いを叶えクレジットをくれた", "廃棄コロニーの宝物庫を発見した", "行商船から掘り出し物を譲られた"],
    accident: ["デブリの直撃を受け荷物を失った", "毒性ガスにあたり治療費がかさんだ", "詐欺師に高額な謎の薬を売りつけられた", "隔壁の故障で装備が壊れた", "罠センサーにかかり出費がかさんだ", "酒場の喧嘩に巻き込まれ弁償させられた", "宙賊に因縁をつけられクレジットを渡した", "磁気嵐で野営道具が流された", "デブリ雲に巻かれ遠回りして燃料を使った"],
    rest: ["長距離航行の疲れで一回休み", "未知の病原体で一回休み", "磁気嵐に閉じ込められ一回休み", "船体が損傷し一回休み", "仲間の看病で一回休み"],
    treasure: ["伝説の古代エンジン部品", "異星文明の遺物", "賢者の結晶", "呪われた重力石", "失われた旗艦の残骸", "不死鳥座の羽根石", "古の航海日誌", "妖精座の涙の宝石", "巨人型ロボの財宝"],
  },
  icon: {
    income: "💰", expense: "💸", bonus: "🎁", accident: "⚡", rest: "🛌",
    treasure: "💎", job: "🚀", salary: "💳", lifeevent: "🌌",
    childevent: "🤝", homepurchase: "🛸", lottery: "🛰️", choice: "🎯",
  },
  squareDesc: {
    job: "任務を選ぼう",
    home: "居住区を選ぼう",
    fork: "進む航路を選ぼう",
    lottery: "座標データを発見",
    salary: "任務報酬日がやってきた",
  },
  lifeEvents: [
    { idx: 14, icon: "☄️", label: "隕石群との遭遇", desc: "隕石群に遭遇した！回避の結果は…", base: 120 },
    { idx: 26, icon: "🛰️", label: "謎の衛星の発見", desc: "謎の衛星を発見した！探索の成果はいかに…", base: 220 },
    { idx: 78, icon: "🕳️", label: "ワームホールへの突入", desc: "未知のワームホールに突入した！運命の分かれ道…", base: 550 },
    { idx: 92, icon: "👽", label: "異星文明との接触", desc: "異星文明とのコンタクトが発生した！結果は…", base: 850 },
  ],
  childEvents: [
    { idx: 40, label: "第一のクルー", cost: -150 },
    { idx: 84, label: "第二のクルー", cost: -130 },
  ],
  choices: [
    { idx: 6, squareDesc: "臨時報酬の使い道", options: [
      { id: "a", label: "貯める", desc: "いざという時のために蓄える", amount: [20, 30] },
      { id: "b", label: "豪遊する", desc: "気分次第で得することも損することも", amount: [-15, 80] },
    ] },
    { idx: 18, squareDesc: "傭兵任務の誘い", options: [
      { id: "a", label: "断る", desc: "今のクルーで頑張る", amount: [10, 20] },
      { id: "b", label: "受ける", desc: "うまくいけば大金、しくじれば大損", amount: [-25, 150] },
    ] },
    { idx: 30, squareDesc: "資金の使い道", options: [
      { id: "a", label: "銀行衛星に預ける", desc: "手堅く利子を得る", amount: [30, 50] },
      { id: "b", label: "怪しい商人の話に乗る", desc: "一攫千金か、丸損か", amount: [-70, 250] },
    ] },
    { idx: 42, squareDesc: "別の艦隊からの勧誘", options: [
      { id: "a", label: "今の艦隊に残る", desc: "安定を選ぶ", amount: [40, 70] },
      { id: "b", label: "移籍する", desc: "環境が変わり運命が動く", amount: [-100, 300] },
    ] },
    { idx: 72, squareDesc: "独立開業のチャンス", options: [
      { id: "a", label: "見送る", desc: "今のままで手堅く", amount: [60, 100] },
      { id: "b", label: "自分の船団を持つ", desc: "大きなリターンとリスクが両方待つ", amount: [-180, 600] },
    ] },
    { idx: 80, squareDesc: "伝説の装備の噂", options: [
      { id: "a", label: "我慢する", desc: "節約して蓄える", amount: [80, 120] },
      { id: "b", label: "思い切って買う", desc: "駄作か、伝説級の掘り出し物か", amount: [-140, 400] },
    ] },
    { idx: 87, squareDesc: "先代からの遺産", options: [
      { id: "a", label: "クレジットで受け取る", desc: "手堅く確実に", amount: [100, 150] },
      { id: "b", label: "秘宝で受け取る", desc: "化けるかもしれないが手間もかかる", amount: [-90, 500] },
    ] },
    { idx: 95, squareDesc: "最後の大冒険", options: [
      { id: "a", label: "手堅く終える", desc: "安全策で締めくくる", amount: [150, 200] },
      { id: "b", label: "一発逆転を狙う", desc: "すべてを賭けた大博打", amount: [-250, 900] },
    ] },
  ],
  forkOptions: [
    { id: "risk", label: "深宇宙探査コース", icon: "🕳️", desc: "危険な深宇宙。大成功も大事故もある波乱の数マス" },
    { id: "safe", label: "安全航路コース", icon: "🛡️", desc: "安定した航路。少しずつ確実にクレジットが増える" },
  ],
  riskTemplate: [
    { type: "bonus", desc: "危険な航路で財宝の隠し貨物を見つけた", amount: [100, 300] },
    { type: "accident", desc: "小惑星帯に迷い込み大破した", amount: [-100, -30] },
    { type: "bonus", desc: "宙域の裏市場で怪しい大取引がまとまった", amount: [80, 250] },
    { type: "accident", desc: "一か八かの近道で罠にかかった", amount: [-90, -25] },
    { type: "bonus", desc: "廃棄コロニーで埋もれた財宝を掘り当てた", amount: [90, 280] },
    { type: "accident", desc: "宙賊の待ち伏せに遭い身包み剥がされた", amount: [-110, -35] },
    { type: "bonus", desc: "古い星図を頼りに秘密の宝物庫を突き止めた", amount: [110, 320] },
    { type: "accident", desc: "調子に乗って危険な深部まで踏み込んだ", amount: [-120, -40] },
  ],
  safeTemplate: [
    { type: "income", desc: "安全な航路で着実に任務をこなした", amount: [50, 90] },
    { type: "income", desc: "堅実に輸送任務をこなした", amount: [40, 80] },
    { type: "income", desc: "地道な依頼で確実な報酬を得た", amount: [50, 90] },
    { type: "income", desc: "安全第一で慎重に航行を進めた", amount: [40, 80] },
    { type: "income", desc: "信頼できる商船と手堅い取引をした", amount: [50, 90] },
    { type: "income", desc: "コツコツ働いて確実に貯蓄を増やした", amount: [40, 80] },
    { type: "income", desc: "評判のいい任務をきっちりこなした", amount: [50, 90] },
    { type: "income", desc: "無理せず着実に航行を進めた", amount: [40, 80] },
  ],
  rules: [
    { icon: "🚀", label: "任務選択マス", text: "サイコロで任務適性がランダムに決定" },
    { icon: "💳", label: "任務報酬マス", text: "全員が同時に改造費を決める（他のプレイヤーの決定を待ちます）" },
    { icon: "🌌", label: "宇宙の一大イベントマス", text: "隕石群や異星文明との接触など、出目で財産が変わる" },
    { icon: "🤝", label: "クルー加入マス", text: "五分五分の運。成功すると他の全員から歓迎パーティ費用がもらえる" },
    { icon: "🔀", label: "分かれ道マス", text: "深宇宙探査コースか安全航路コースを選べる" },
    { icon: "🛸", label: "居住区選択マス", text: "ゴール後に売却して精算" },
    { icon: "🛰️💎", label: "座標データマス／お宝マス", text: "ゴール後の座標解析・換金でお楽しみ" },
  ],
};

const UNDERWORLD_THEME_CFG = {
  id: "underworld",
  name: "裏社会双六",
  tagline: "5000万円を元手に、シノギを重ねて成り上がり、100マスの抗争を勝ち抜いて裏社会の帝王を目指せ。",
  eyebrowIcon: "🕶️",
  css: "underworld",
  tokens: ["🦈", "🐺", "🐍", "🦂"],
  currencyUnit: "万円",
  startMoney: 5000,
  startLabel: "下っ端スタート",
  startIcon: "🌆",
  goalLabel: "裏社会の帝王",
  goalIcon: "👑",
  labels: {
    jobSquareName: "役職",
    jobGachaTitle: "役職決定ガチャ！",
    salaryName: "上納日",
    investVerb: "裏取引",
    homeSquareName: "隠れ家",
    homeVerb: "購入",
    lotteryItemName: "情報屋のネタ",
    lotteryFinaleName: "運命の情報開示",
    lotteryFinaleVerb: "開示",
    childEventVerb: "勧誘",
    childGiftLabel: "祝儀(みかじめ料)",
    goalName: "帝王",
    winningLabel: "暗号ナンバー",
  },
  jobs: [
    { id: "muscle", name: "下っ端", icon: "🥊", desc: "バランス型。手堅く稼ぐ", mult: { income: 1.0, bonus: 1.0, accident: 1.0, salary: 1.0 } },
    { id: "fixer", name: "始末屋", icon: "🔧", desc: "高い成果報酬だが危険と隣り合わせ", mult: { income: 1.6, bonus: 1.0, accident: 1.2, salary: 1.7 } },
    { id: "accountant", name: "帳簿屋", icon: "📒", desc: "報酬は控えめだが危険を避けて手堅い", mult: { income: 0.85, bonus: 0.8, accident: 0.7, salary: 0.9 } },
    { id: "smuggler", name: "密輸屋", icon: "🚤", desc: "当たれば大きいが波が激しい", mult: { income: 0.9, bonus: 1.6, accident: 1.3, salary: 0.8 } },
    { id: "hacker", name: "裏社会のハッカー", icon: "💻", desc: "ハイリスク・ハイリターンな一撃", mult: { income: 1.2, bonus: 1.8, accident: 1.8, salary: 1.3 } },
    { id: "boss", name: "若頭", icon: "🎩", desc: "カリスマ次第で成果が乱高下", mult: { income: 0.8, bonus: 2.0, accident: 1.6, salary: 1.1 } },
  ],
  homeOptions: [
    { id: "fortress", label: "要塞のような豪邸", icon: "🏯", cost: -3000, baseValue: 3000, desc: "厳重警備の隠れ家。資産価値も抜群" },
    { id: "penthouse", label: "高級ペントハウス", icon: "🏙️", cost: -1500, baseValue: 1500, desc: "街を見下ろす拠点。堅実な資産に" },
    { id: "office", label: "組事務所の一室", icon: "🏢", cost: -800, baseValue: 800, desc: "仲間と過ごす拠点暮らし" },
    { id: "hideout", label: "怪しい倉庫", icon: "🏚️", cost: -100, baseValue: 0, desc: "身軽な仮の隠れ家。資産にはならない" },
  ],
  news: [
    { text: "新しいシノギが軌道に乗り、裏経済が拡大している", pct: 12 },
    { text: "警察の一斉摘発で市場に激震が走る", pct: -10 },
    { text: "縄張り拡大が成功し取引が堅調に推移", pct: 7 },
    { text: "上納金の増額懸念から相場が下落", pct: -8 },
    { text: "新しい裏取引ルートへの期待から相場が急騰", pct: 15 },
    { text: "大物幹部の裏切りが発覚し組織の信用が急落", pct: -14 },
    { text: "隣の縄張りとの手打ちで取引が上昇", pct: 6 },
    { text: "上層部の後押しで市場が活気づく", pct: 9 },
    { text: "潜入捜査の噂で様子見ムードが広がる", pct: -5 },
    { text: "景気後退の噂がじわじわ広がっている", pct: -6 },
    { text: "新規の客が増えて取引がよく売れている", pct: 5 },
    { text: "情報屋のネタが当たり関連取引が急伸", pct: 8 },
  ],
  desc: {
    income: ["みかじめ料をきっちり回収した", "怪しい荷物の運び屋で謝礼をもらった", "賭場の上がりを受け取った", "闇市で品物を売って稼いだ", "組の評価が上がり特別報酬が出た", "兄貴から祝儀をもらった", "情報屋への口利きで謝礼を得た", "古い借金を取り立てた", "見張り役の報酬が出た"],
    expense: ["高級車の修理代を支払った", "接待でいいホテルに泊まった", "弁護士への相談料を支払った", "隠れ家の設備が壊れ修理費がかかった", "下っ端にわずかな金を奪われた", "組全員へのご祝儀を包んだ", "装備の手入れ代を支払った", "縄張りの通行料を払った", "検問での揉め事で金を渡した"],
    bonus: ["路上で落とし物の札束を拾った", "商人と交渉して掘り出し物を安く買えた", "骨董品の収集品が高く売れた", "賭け事で思わぬ大勝ちをした", "旧友から餞別をもらった", "隠し金庫で現金の山を発見した", "怪しい情報屋から儲け話をもらった", "廃ビルの隠し財産を発見した", "闇商人から掘り出し物を譲られた"],
    accident: ["賭場でスってしまった", "偽の商談に引っかかり大損した", "詐欺師に高額な怪しい品を売りつけられた", "抗争に巻き込まれ装備が壊れた", "罠にかかり出費がかさんだ", "酒場の喧嘩に巻き込まれ弁償させられた", "他の組に因縁をつけられ金を渡した", "手入れで隠し金を没収された", "遠回りを強いられ路銀を使った"],
    rest: ["長距離の護送で一回休み", "怪我の療養で一回休み", "潜伏生活で一回休み", "抗争の後始末で一回休み", "仲間の看病で一回休み"],
    treasure: ["伝説の金の延べ棒", "幻のダイヤの指輪", "裏社会の秘宝", "呪われた金貨", "失われた組長の遺産", "闇市の骨董品", "古の裏帳簿", "宝石をあしらった短剣の柄", "巨大商船の財宝"],
    raid: ["闇にまぎれて忍び寄った", "縄張りを荒らして金を狙った", "不意打ちで金庫を狙った", "脅しをかけて金を巻き上げようとした", "隙をついて有り金を狙った"],
    raidFail: ["反撃を受けて逃げ帰った", "見つかって仲間に取り返された", "用心棒に阻まれて失敗した", "返り討ちにあった", "計画がバレて仕返しされた"],
  },
  icon: {
    income: "💰", expense: "💸", bonus: "🎁", accident: "⚡", rest: "🛌",
    treasure: "💎", job: "🎩", salary: "💴", lifeevent: "🚨",
    childevent: "🤝", homepurchase: "🏢", lottery: "🎟️", choice: "🃏", raid: "🥊",
  },
  squareDesc: {
    job: "役職を決めよう",
    home: "隠れ家を選ぼう",
    fork: "進むルートを選ぼう",
    lottery: "情報屋のネタを発見",
    salary: "上納日がやってきた",
  },
  lifeEvents: [
    { idx: 14, icon: "🕵️", label: "潜入捜査官との遭遇", desc: "潜入捜査官に目をつけられた！切り抜けられるか…", base: 1200 },
    { idx: 26, icon: "🔥", label: "縄張り抗争", desc: "隣の組との縄張り抗争が勃発した！結果は…", base: 2200 },
    { idx: 78, icon: "🚔", label: "警察のガサ入れ", desc: "隠れ家に警察のガサ入れが入った！被害の程度は…", base: 5500 },
    { idx: 92, icon: "👑", label: "裏社会の頂点決戦", desc: "裏社会の頂点をかけた決戦に挑む！勝敗のゆくえは…", base: 8500 },
  ],
  childEvents: [
    { idx: 40, label: "舎弟その1", cost: -1500 },
    { idx: 84, label: "舎弟その2", cost: -1300 },
  ],
  choices: [
    { idx: 6, squareDesc: "臨時収入の使い道", options: [
      { id: "a", label: "貯める", desc: "いざという時のために蓄える", amount: [200, 300] },
      { id: "b", label: "豪遊する", desc: "気分次第で得することも損することも", amount: [-150, 800] },
    ] },
    { idx: 18, squareDesc: "危ない仕事の誘い", options: [
      { id: "a", label: "断る", desc: "今の組で頑張る", amount: [100, 200] },
      { id: "b", label: "受ける", desc: "うまくいけば大金、しくじれば大損", amount: [-250, 1500] },
    ] },
    { idx: 30, squareDesc: "裏金の使い道", options: [
      { id: "a", label: "地下銀行に預ける", desc: "手堅く利子を得る", amount: [300, 500] },
      { id: "b", label: "怪しい商人の話に乗る", desc: "一攫千金か、丸損か", amount: [-700, 2500] },
    ] },
    { idx: 42, squareDesc: "他の組からの勧誘", options: [
      { id: "a", label: "今の組に残る", desc: "安定を選ぶ", amount: [400, 700] },
      { id: "b", label: "移籍する", desc: "環境が変わり運命が動く", amount: [-1000, 3000] },
    ] },
    { idx: 72, squareDesc: "独立開業のチャンス", options: [
      { id: "a", label: "見送る", desc: "今のままで手堅く", amount: [600, 1000] },
      { id: "b", label: "自分の組を持つ", desc: "大きなリターンとリスクが両方待つ", amount: [-1800, 6000] },
    ] },
    { idx: 80, squareDesc: "怪しい儲け話", options: [
      { id: "a", label: "我慢する", desc: "節約して蓄える", amount: [800, 1200] },
      { id: "b", label: "思い切って乗る", desc: "駄作か、伝説級の大金か", amount: [-1400, 4000] },
    ] },
    { idx: 87, squareDesc: "先代からの遺産", options: [
      { id: "a", label: "現金で受け取る", desc: "手堅く確実に", amount: [1000, 1500] },
      { id: "b", label: "秘宝で受け取る", desc: "化けるかもしれないが手間もかかる", amount: [-900, 5000] },
    ] },
    { idx: 95, squareDesc: "最後の大勝負", options: [
      { id: "a", label: "手堅く終える", desc: "安全策で締めくくる", amount: [1500, 2000] },
      { id: "b", label: "一発逆転を狙う", desc: "すべてを賭けた大博打", amount: [-2500, 9000] },
    ] },
  ],
  forkOptions: [
    { id: "risk", label: "抗争ルート", icon: "🔥", desc: "危険な抗争。大金星も大惨事もある波乱の数マス" },
    { id: "safe", label: "地道なシノギルート", icon: "🛡️", desc: "手堅い稼ぎ。少しずつ確実に儲けが増える" },
  ],
  riskTemplate: [
    { type: "bonus", desc: "危険な抗争で敵の隠し金庫を見つけた", amount: [1000, 3000] },
    { type: "accident", desc: "抗争に巻き込まれ大怪我をした", amount: [-1000, -300] },
    { type: "bonus", desc: "裏市場で怪しい大取引がまとまった", amount: [800, 2500] },
    { type: "accident", desc: "一か八かの取引で罠にかかった", amount: [-900, -250] },
    { type: "bonus", desc: "廃ビルで埋もれた財宝を掘り当てた", amount: [900, 2800] },
    { type: "accident", desc: "敵の待ち伏せに遭い身包み剥がされた", amount: [-1100, -350] },
    { type: "bonus", desc: "古い情報を頼りに秘密の金庫を突き止めた", amount: [1100, 3200] },
    { type: "accident", desc: "調子に乗って危険な深部まで踏み込んだ", amount: [-1200, -400] },
  ],
  safeTemplate: [
    { type: "income", desc: "安全な仕事で着実にシノギをこなした", amount: [500, 900] },
    { type: "income", desc: "堅実に運び屋の仕事をこなした", amount: [400, 800] },
    { type: "income", desc: "地道な取引で確実な儲けを得た", amount: [500, 900] },
    { type: "income", desc: "安全第一で慎重に事を進めた", amount: [400, 800] },
    { type: "income", desc: "信頼できる相手と手堅い取引をした", amount: [500, 900] },
    { type: "income", desc: "コツコツ働いて確実に儲けを増やした", amount: [400, 800] },
    { type: "income", desc: "評判のいい仕事をきっちりこなした", amount: [500, 900] },
    { type: "income", desc: "無理せず着実に事を進めた", amount: [400, 800] },
  ],
  // 「襲撃マス」: 今いる相手の中で最も裕福な相手を狙い、金を奪う(失敗すると反撃を受ける)。
  // 他のマップにはない、このテーマ専用のマス位置。
  raidIdx: [11, 22, 37, 51, 71, 83, 93, 98],
  rules: [
    { icon: "🎩", label: "役職決定マス", text: "サイコロで組内の役職がランダムに決定" },
    { icon: "💴", label: "上納日マス", text: "全員が同時に裏取引の金額を決める（他のプレイヤーの決定を待ちます）" },
    { icon: "🚨", label: "抗争イベントマス", text: "潜入捜査官や警察のガサ入れなど、出目で財産が変わる" },
    { icon: "🤝", label: "舎弟勧誘マス", text: "五分五分の運。成功すると他の全員から祝儀(みかじめ料)がもらえる" },
    { icon: "🔀", label: "分かれ道マス", text: "抗争ルートか地道なシノギルートを選べる" },
    { icon: "🥊", label: "襲撃マス", text: "今いる中で最も裕福な相手を狙って金を奪う。失敗すると反撃を受ける" },
    { icon: "🏢", label: "隠れ家選択マス", text: "ゴール後に売却して精算" },
    { icon: "🎟️💎", label: "情報屋のネタマス／お宝マス", text: "ゴール後の情報開示・換金でお楽しみ" },
  ],
};

const MAGICSCHOOL_THEME_CFG = {
  id: "magicschool",
  name: "魔法学校双六",
  tagline: "100マスの魔法学院生活を送りながら、魔法を学び、冒険もこなして、大魔法使いを目指そう。",
  eyebrowIcon: "🪄",
  css: "magicschool",
  tokens: ["🪄", "🧹", "🦉", "🐉"],
  currencyUnit: "魔石",
  startLabel: "新入生スタート",
  startIcon: "🏰",
  goalLabel: "大魔法使い",
  goalIcon: "🎓",
  labels: {
    jobSquareName: "適性魔法",
    jobGachaTitle: "適性魔法決定の儀！",
    salaryName: "奨学金支給日",
    investVerb: "修行",
    homeSquareName: "寮",
    homeVerb: "選択",
    lotteryItemName: "占いの札",
    lotteryFinaleName: "運命の占い大会",
    lotteryFinaleVerb: "占う",
    childEventVerb: "使い魔契約",
    childGiftLabel: "お祝いの魔法石",
    goalName: "大魔法使い",
    winningLabel: "運命の数字",
  },
  jobs: [
    { id: "fire", name: "火魔法使い", icon: "🔥", desc: "バランス型。堅実に力を発揮する", mult: { income: 1.0, bonus: 1.0, accident: 1.0, salary: 1.0 } },
    { id: "dark", name: "闇魔法使い", icon: "🌑", desc: "高い成果を出すが危険と隣り合わせ", mult: { income: 1.6, bonus: 1.0, accident: 1.2, salary: 1.7 } },
    { id: "light", name: "光魔法使い", icon: "✨", desc: "成果は控えめだが危険を避けて手堅い", mult: { income: 0.85, bonus: 0.8, accident: 0.7, salary: 0.9 } },
    { id: "illusion", name: "幻術使い", icon: "🎭", desc: "当たれば大きいが波が激しい", mult: { income: 0.9, bonus: 1.6, accident: 1.3, salary: 0.8 } },
    { id: "summoner", name: "召喚魔法使い", icon: "🐉", desc: "ハイリスク・ハイリターンな一撃", mult: { income: 1.2, bonus: 1.8, accident: 1.8, salary: 1.3 } },
    { id: "sage", name: "賢者の秘術使い", icon: "📜", desc: "幸運次第で成果が乱高下", mult: { income: 0.8, bonus: 2.0, accident: 1.6, salary: 1.1 } },
  ],
  homeOptions: [
    { id: "tower", label: "塔の個室", icon: "🗼", cost: -700, baseValue: 700, desc: "見晴らしのいい塔の個室。資産価値も抜群" },
    { id: "suite", label: "寮の特別室", icon: "🏰", cost: -380, baseValue: 380, desc: "広々とした特別室。堅実な資産に" },
    { id: "shared", label: "寮の相部屋", icon: "🛏️", cost: -250, baseValue: 250, desc: "仲間と過ごす寮生活" },
    { id: "attic", label: "屋根裏の小部屋", icon: "🏚️", cost: -30, baseValue: 0, desc: "身軽な屋根裏暮らし。資産にはならない" },
  ],
  news: [
    { text: "新しい魔法薬の開発成功で魔法経済が拡大", pct: 12 },
    { text: "魔石の枯渇懸念で市場に激震が走る", pct: -10 },
    { text: "学院対抗魔法大会の好評で取引が堅調に推移", pct: 7 },
    { text: "魔法省の増税懸念から魔石が下落", pct: -8 },
    { text: "新素材「星屑結晶」への期待から相場が急騰", pct: 15 },
    { text: "大魔法使いの不祥事発覚で市場が急落", pct: -14 },
    { text: "隣国の魔法学院との交流で相場が上昇", pct: 6 },
    { text: "学院長の後押しで市場が活気づく", pct: 9 },
    { text: "禁じられた森からの不穏な気配で様子見ムード", pct: -5 },
    { text: "景気後退の噂がじわじわ広がっている", pct: -6 },
    { text: "魔法薬の需要が高まり関連品がよく売れている", pct: 5 },
    { text: "精霊石の高騰でエンチャント関連が急伸", pct: 8 },
  ],
  desc: {
    income: ["魔法薬の調合を頼まれ報酬を受け取った", "図書館の整理を手伝い謝礼をもらった", "後輩への魔法指導で謝礼を受け取った", "学院祭の出店が大盛況で利益が出た", "試験で好成績を出し特待生に選ばれた", "先輩から臨時のお駄賃をもらった", "使い魔の散歩代行で稼いだ", "魔法道具店のアルバイト代をもらった", "お手伝いのご褒美をもらった"],
    expense: ["杖の修理代を支払った", "魔法薬の材料をまとめ買いした", "教科書代がかかった", "制服のローブを買い直した", "学院祭の衣装代を負担した", "参考書をまとめ買いした", "水晶玉の修理代がかかった", "友達との茶会でお菓子代がかさんだ", "部費(魔法クラブ)の会費を払った"],
    bonus: ["蚤の市で珍しい魔法具が高く売れた", "懸賞で魔法菓子の詰め合わせが当たった", "先輩から臨時のお祝いをもらった", "落とした杖が届けられ中身が無事だった", "くじ引きで特賞が当たった", "使い魔のお手柄で臨時ボーナスをもらった", "魔石ポイントを換金した", "古い魔導書が高値で売れた", "掃除中に思わぬ魔石を発見した"],
    accident: ["杖を折ってしまい修理代がかかった", "友達との約束をすっぽかし埋め合わせをした", "水晶玉を割って修理に出した", "魔法クラブの道具を壊して弁償した", "禁じられた魔法薬に手を出し後悔した", "友達に奢りすぎて出費がかさんだ", "先生に見つかり反省文用の羊皮紙代がかかった", "箒がパンクして修理代がかかった", "教材を忘れて買い直した"],
    rest: ["夜遅くまで魔法の練習をして一回休み", "魔力切れで学院を休み一回休み", "魔法クラブの疲れで一回休み", "学院祭の準備で疲れて一回休み", "魔力の使いすぎで一回休み"],
    treasure: ["初めてもらった魔法のペンダント", "学院祭で着た手作りローブ", "魔法クラブの大会優勝メダル", "幻の学院長選挙ポスター", "先生からもらった直筆の羊皮紙", "入学式の記念写真", "合唱の儀の指揮棒", "卒業アルバムの試作品", "伝説の先輩からもらったお守り"],
  },
  icon: {
    income: "💰", expense: "💸", bonus: "🎁", accident: "⚡", rest: "🛌",
    treasure: "💎", job: "🪄", salary: "📜", lifeevent: "🔮",
    childevent: "🦉", homepurchase: "🏰", lottery: "🃏", choice: "📖",
  },
  squareDesc: {
    job: "適性魔法を決めよう",
    home: "寮を選ぼう",
    fork: "進む道を選ぼう",
    lottery: "占いの札を発見",
    salary: "奨学金支給日がやってきた",
  },
  lifeEvents: [
    { idx: 14, icon: "🕯️", label: "闇の儀式に遭遇", desc: "謎の儀式に遭遇した！対処の結果は…", base: 120 },
    { idx: 26, icon: "🏆", label: "魔法大会への出場", desc: "学院対抗魔法大会に出場した！結果は…", base: 220 },
    { idx: 78, icon: "🐲", label: "禁じられた森での遭遇", desc: "禁じられた森で強大な魔物に遭遇した！運命の分かれ道…", base: 550 },
    { idx: 92, icon: "👹", label: "闇の魔法使いとの決戦", desc: "闇の魔法使いとの決戦に挑む！勝敗のゆくえは…", base: 850 },
  ],
  childEvents: [
    { idx: 40, label: "使い魔その1", cost: -150 },
    { idx: 84, label: "使い魔その2", cost: -130 },
  ],
  choices: [
    { idx: 6, squareDesc: "臨時収入の使い道", options: [
      { id: "a", label: "貯める", desc: "いざという時のために蓄える", amount: [20, 30] },
      { id: "b", label: "パーッと使う", desc: "気分次第で得することも損することも", amount: [-15, 80] },
    ] },
    { idx: 18, squareDesc: "怪しい依頼の誘い", options: [
      { id: "a", label: "断る", desc: "今の生活を大事にする", amount: [10, 20] },
      { id: "b", label: "受ける", desc: "うまくいけば大きいが空振りもある", amount: [-25, 150] },
    ] },
    { idx: 30, squareDesc: "魔石の使い道", options: [
      { id: "a", label: "貯蓄する", desc: "コツコツ堅実に増やす", amount: [30, 50] },
      { id: "b", label: "怪しい儲け話に乗る", desc: "一攫千金か、大損か", amount: [-70, 250] },
    ] },
    { idx: 42, squareDesc: "他の魔法クラブからの勧誘", options: [
      { id: "a", label: "今のクラブに残る", desc: "安定を選ぶ", amount: [40, 70] },
      { id: "b", label: "移る", desc: "環境が変わり運命が動く", amount: [-100, 300] },
    ] },
    { idx: 72, squareDesc: "独自研究のチャンス", options: [
      { id: "a", label: "見送る", desc: "今のままで手堅く", amount: [60, 100] },
      { id: "b", label: "研究に打ち込む", desc: "大きなリターンとリスクが両方待つ", amount: [-180, 600] },
    ] },
    { idx: 80, squareDesc: "伝説の魔法具の噂", options: [
      { id: "a", label: "我慢する", desc: "節約して貯蓄にまわす", amount: [80, 120] },
      { id: "b", label: "思い切って買う", desc: "駄作か、伝説級の掘り出し物か", amount: [-140, 400] },
    ] },
    { idx: 87, squareDesc: "先代からの遺産", options: [
      { id: "a", label: "魔石で受け取る", desc: "手堅く確実に", amount: [100, 150] },
      { id: "b", label: "秘宝で受け取る", desc: "化けるかもしれないが手間もかかる", amount: [-90, 500] },
    ] },
    { idx: 95, squareDesc: "学院生活最後の大勝負", options: [
      { id: "a", label: "手堅く終える", desc: "安定志向で締めくくる", amount: [150, 200] },
      { id: "b", label: "一発逆転を狙う", desc: "すべてを賭けた大勝負", amount: [-250, 900] },
    ] },
  ],
  forkOptions: [
    { id: "risk", label: "禁じられた道", icon: "🌑", desc: "危険な禁断の道。大成功も大失敗もある波乱の数マス" },
    { id: "safe", label: "修行の道", icon: "🛡️", desc: "地道な修行の道。少しずつ確実に魔石が増える" },
  ],
  riskTemplate: [
    { type: "bonus", desc: "禁じられた道で古の宝物庫を見つけた", amount: [100, 300] },
    { type: "accident", desc: "強力な魔物に遭遇し大怪我をした", amount: [-100, -30] },
    { type: "bonus", desc: "闇市場で怪しい大取引がまとまった", amount: [80, 250] },
    { type: "accident", desc: "一か八かの近道で罠にかかった", amount: [-90, -25] },
    { type: "bonus", desc: "廃墟の遺跡で埋もれた財宝を掘り当てた", amount: [90, 280] },
    { type: "accident", desc: "闇の魔法使いの待ち伏せに遭い身包み剥がされた", amount: [-110, -35] },
    { type: "bonus", desc: "古い魔導書を頼りに秘密の宝物庫を突き止めた", amount: [110, 320] },
    { type: "accident", desc: "調子に乗って危険な深部まで踏み込んだ", amount: [-120, -40] },
  ],
  safeTemplate: [
    { type: "income", desc: "安全な道で着実に修行をこなした", amount: [50, 90] },
    { type: "income", desc: "堅実に魔法薬の調合をこなした", amount: [40, 80] },
    { type: "income", desc: "地道な依頼で確実な報酬を得た", amount: [50, 90] },
    { type: "income", desc: "安全第一で慎重に修行を進めた", amount: [40, 80] },
    { type: "income", desc: "信頼できる先生と手堅い契約をした", amount: [50, 90] },
    { type: "income", desc: "コツコツ修行して確実に力を増やした", amount: [40, 80] },
    { type: "income", desc: "評判のいい依頼をきっちりこなした", amount: [50, 90] },
    { type: "income", desc: "無理せず着実に修行を進めた", amount: [40, 80] },
  ],
  rules: [
    { icon: "🪄", label: "適性魔法決定マス", text: "サイコロで適性魔法がランダムに決定" },
    { icon: "📜", label: "奨学金支給マス", text: "全員が同時に修行費を決める（他のプレイヤーの決定を待ちます）" },
    { icon: "🔮", label: "学院生活の一大イベントマス", text: "魔法大会や闇の魔法使いとの決戦など、出目で財産が変わる" },
    { icon: "🦉", label: "使い魔契約マス", text: "五分五分の運。成功すると他の全員からお祝いの魔法石がもらえる" },
    { icon: "🔀", label: "分かれ道マス", text: "禁じられた道か修行の道を選べる" },
    { icon: "🏰", label: "寮選択マス", text: "ゴール後に売却して精算" },
    { icon: "🃏💎", label: "占いの札マス／お宝マス", text: "ゴール後の占い大会・換金でお楽しみ" },
  ],
};

function buildTheme(cfg) {
  const LIFEEVENT_MAP = {};
  cfg.lifeEvents.forEach((ev) => (LIFEEVENT_MAP[ev.idx] = ev));
  const CHILDEVENT_MAP = {};
  cfg.childEvents.forEach((ev) => (CHILDEVENT_MAP[ev.idx] = ev));
  const CHOICE_MAP = {};
  (cfg.choices || []).forEach((c) => (CHOICE_MAP[c.idx] = c));

  const BRANCH_MAP = {};
  FORKS.forEach((forkIdx) => {
    for (let k = 0; k < FORK_LEN; k++) {
      const idx = forkIdx + 1 + k;
      const riskT = cfg.riskTemplate[k % cfg.riskTemplate.length];
      const safeT = cfg.safeTemplate[k % cfg.safeTemplate.length];
      BRANCH_MAP[idx] = {
        forkIdx,
        risk: { type: "bonus_or_accident", realType: riskT.type, icon: cfg.icon[riskT.type], desc: riskT.desc, amount: riskT.amount },
        safe: { type: "income", icon: cfg.icon.income, desc: safeT.desc, amount: safeT.amount },
      };
    }
  });
  function isBranchIdx(idx) {
    return !!BRANCH_MAP[idx];
  }

  const SQUARES = [];

  SQUARES[0] = { type: "start", label: cfg.startLabel, icon: cfg.startIcon };
  SQUARES[4] = { type: "job", icon: cfg.icon.job, desc: cfg.squareDesc.job, forcedStop: true };
  let patternIdx = 0;
  for (let i = 1; i < LAST; i++) {
    if (i === 4) continue;
    if (isForkIdx(i)) {
      SQUARES[i] = { type: "fork", icon: "🔀", desc: cfg.squareDesc.fork, forcedStop: true };
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
      SQUARES[i] = { type: "childevent", icon: cfg.icon.childevent, label: ev.label, childCost: ev.cost, forcedStop: true };
      continue;
    }
    if (CHOICE_MAP[i]) {
      const c = CHOICE_MAP[i];
      SQUARES[i] = { type: "choice", icon: cfg.icon.choice, desc: c.squareDesc, options: c.options, forcedStop: true };
      continue;
    }
    if ((cfg.raidIdx || []).includes(i)) {
      SQUARES[i] = { type: "raid", icon: cfg.icon.raid, forcedStop: true };
      continue;
    }
    if (i === HOME_IDX) {
      SQUARES[i] = { type: "homepurchase", icon: cfg.icon.homepurchase, desc: cfg.squareDesc.home, forcedStop: true };
      continue;
    }
    if (LOTTERY_SET.has(i)) {
      SQUARES[i] = { type: "lottery", icon: cfg.icon.lottery, desc: cfg.squareDesc.lottery };
      continue;
    }
    if (SALARY_SET.has(i)) {
      SQUARES[i] = { type: "salary", icon: cfg.icon.salary, desc: cfg.squareDesc.salary };
      continue;
    }
    const type = PATTERN[patternIdx % PATTERN.length];
    patternIdx++;
    // 文言(desc)はここでは固定せず、着地した瞬間にランダムに選ぶ(randomDesc)。
    // 何度遊んでも同じマスで同じ文言ばかりにならないようにするため。
    const sq = { type, icon: cfg.icon[type] };
    if (type === "income" || type === "expense" || type === "bonus" || type === "accident" || type === "treasure") {
      sq.amount = scaleRange(type, i);
    }
    SQUARES[i] = sq;
  }
  SQUARES[LAST] = { type: "goal", label: cfg.goalLabel, icon: cfg.goalIcon };

  function getSquare(player, idx) {
    const sq = SQUARES[idx];
    if (sq.type === "branch") {
      const bd = BRANCH_MAP[idx];
      const choice = (player.routeChoice && player.routeChoice[bd.forkIdx]) || "safe";
      const picked = choice === "risk" ? bd.risk : bd.safe;
      // 文言は、位置ごとに固定ではなく、同じ種別(ボーナス/アクシデント/収入)の
      // テンプレートからランダムに選ぶ(何度遊んでも同じ組み合わせにならないように)。
      const pool = choice === "risk"
        ? cfg.riskTemplate.filter((t) => t.type === picked.realType)
        : cfg.safeTemplate;
      const desc = pool[Math.floor(Math.random() * pool.length)].desc;
      return { type: picked.realType || picked.type, icon: picked.icon, desc, amount: picked.amount };
    }
    return sq;
  }
  function isForcedStop(player, idx) {
    return !!(getSquare(player, idx).forcedStop || SQUARES[idx].forcedStop);
  }

  return { ...cfg, SQUARES, BRANCH_MAP, LIFEEVENT_MAP, CHILDEVENT_MAP, getSquare, isForcedStop };
}

export const THEMES = {
  money: buildTheme(MONEY_THEME_CFG),
  adventure: buildTheme(ADVENTURE_THEME_CFG),
  idol: buildTheme(IDOL_THEME_CFG),
  school: buildTheme(SCHOOL_THEME_CFG),
  space: buildTheme(SPACE_THEME_CFG),
  underworld: buildTheme(UNDERWORLD_THEME_CFG),
  magicschool: buildTheme(MAGICSCHOOL_THEME_CFG),
};
export const DEFAULT_THEME_ID = "money";
export const THEME_LIST = Object.values(THEMES);

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME_ID];
}

// ---- 盤面レイアウト（曲がり道のグリッド + ジッター）。全テーマ共通の構造。 ----
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

export function createPlayer(id, idx, name, themeId) {
  const theme = getTheme(themeId);
  return {
    id,
    token: theme.tokens[idx],
    name: name || `プレイヤー${idx + 1}`,
    pos: 0,
    rest: 0,
    money: theme.startMoney || START_MONEY,
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
