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
  const descCounter = {};
  function nextDesc(type) {
    descCounter[type] = (descCounter[type] || 0) + 1;
    const pool = cfg.desc[type];
    return pool[(descCounter[type] - 1) % pool.length];
  }

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
    const sq = { type, icon: cfg.icon[type], desc: nextDesc(type) };
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
      return { type: picked.realType || picked.type, icon: picked.icon, desc: picked.desc, amount: picked.amount };
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
