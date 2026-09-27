// カードバトルアリーナ - 純粋関数のゲームロジック。
// Firestoreトランザクション内で「最新状態を読んで検証してから書く」方式(他ゲームと同じ)
// なので、シャッフル等にMath.random()を使っても問題ない(サーバー権威の単一書き込みのため)。

export const MAX_HP = 30;
export const HAND_SIZE = 4;

const CARD_DEFS = [
  ...[3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8].map((dmg) => ({
    type: "attack",
    dmg,
    emoji: "⚔️",
    label: `こうげき ${dmg}`,
  })),
  ...Array.from({ length: 3 }, () => ({ type: "heal", amount: 5, emoji: "💖", label: "かいふく +5" })),
  ...Array.from({ length: 3 }, () => ({ type: "shield", amount: 6, emoji: "🛡️", label: "シールド 6" })),
  ...Array.from({ length: 2 }, () => ({ type: "draw", amount: 2, emoji: "🎴", label: "ドロー +2" })),
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(playerIdx) {
  return shuffle(CARD_DEFS.map((c, i) => ({ ...c, id: `p${playerIdx}-c${i}` })));
}

export function createInitialState() {
  const decks = [buildDeck(0), buildDeck(1)];
  const hand = [decks[0].splice(0, HAND_SIZE), decks[1].splice(0, HAND_SIZE)];
  return {
    hp: [MAX_HP, MAX_HP],
    maxHp: MAX_HP,
    shield: [0, 0],
    hand,
    deck: decks,
    discard: [[], []],
    turn: Math.random() < 0.5 ? 0 : 1, // 先手固定だと有利すぎるため毎回ランダムに決める
    turnCount: 0,
    log: [],
    status: "playing",
    winner: null,
  };
}

function drawCards(state, idx, n) {
  for (let i = 0; i < n; i++) {
    if (state.deck[idx].length === 0) {
      if (state.discard[idx].length === 0) return; // これ以上引けない(通常は起きない)
      state.deck[idx] = shuffle(state.discard[idx]);
      state.discard[idx] = [];
    }
    state.hand[idx].push(state.deck[idx].shift());
  }
}

function pushLog(state, text) {
  state.log = [...state.log, text].slice(-30);
}

function applyCard(state, idx, card) {
  const opp = 1 - idx;
  if (card.type === "attack") {
    const blocked = Math.min(state.shield[opp], card.dmg);
    state.shield[opp] -= blocked;
    const effective = card.dmg - blocked;
    state.hp[opp] = Math.max(0, state.hp[opp] - effective);
    pushLog(
      state,
      blocked > 0
        ? `P${idx + 1}が${card.label}！ シールドで${blocked}軽減、${effective}ダメージ`
        : `P${idx + 1}が${card.label}！ ${effective}ダメージ`
    );
    return { endsTurn: true };
  }
  if (card.type === "heal") {
    state.hp[idx] = Math.min(state.maxHp, state.hp[idx] + card.amount);
    pushLog(state, `P${idx + 1}が${card.label}！ HPを回復`);
    return { endsTurn: true };
  }
  if (card.type === "shield") {
    state.shield[idx] += card.amount;
    pushLog(state, `P${idx + 1}が${card.label}！ 次のこうげきに備える`);
    return { endsTurn: true };
  }
  if (card.type === "draw") {
    drawCards(state, idx, card.amount);
    pushLog(state, `P${idx + 1}が${card.label}！ 手札を引いた`);
    return { endsTurn: false };
  }
  return { endsTurn: true };
}

// cardId を出したときの状態遷移。不正な操作(手番違い/手札に無い等)は null を返す。
export function playCard(state, playerIdx, cardId) {
  if (state.status !== "playing" || state.turn !== playerIdx) return null;
  const hand = state.hand[playerIdx];
  const cardIdx = hand.findIndex((c) => c.id === cardId);
  if (cardIdx < 0) return null;
  const [card] = hand.splice(cardIdx, 1);
  state.discard[playerIdx].push(card);

  const { endsTurn } = applyCard(state, playerIdx, card);

  const opp = 1 - playerIdx;
  if (state.hp[opp] <= 0) {
    state.status = "finished";
    state.winner = playerIdx;
    return state;
  }

  if (endsTurn) {
    const need = HAND_SIZE - state.hand[playerIdx].length;
    if (need > 0) drawCards(state, playerIdx, need);
    state.turn = opp;
    state.turnCount += 1;
  }
  return state;
}

// ひとりで遊ぶ場合のAI: 単純な優先順位ヒューリスティックでカードを選ぶ。
export function aiChooseCardId(state, aiIdx) {
  const opp = 1 - aiIdx;
  const hand = state.hand[aiIdx];

  const lethal = hand
    .filter((c) => c.type === "attack" && c.dmg - Math.min(state.shield[opp], c.dmg) >= state.hp[opp])
    .sort((a, b) => a.dmg - b.dmg)[0];
  if (lethal) return lethal.id;

  if (state.hp[aiIdx] <= 12) {
    const heal = hand.find((c) => c.type === "heal");
    if (heal) return heal.id;
  }

  const draw = hand.find((c) => c.type === "draw");
  if (draw && hand.length <= 3) return draw.id;

  if (Math.random() < 0.35) {
    const shield = hand.find((c) => c.type === "shield");
    if (shield && state.shield[aiIdx] < 4) return shield.id;
  }

  const bestAttack = hand.filter((c) => c.type === "attack").sort((a, b) => b.dmg - a.dmg)[0];
  if (bestAttack) return bestAttack.id;

  return hand[0]?.id ?? null;
}
