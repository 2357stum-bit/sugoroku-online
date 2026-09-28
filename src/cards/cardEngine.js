// カードバトルアリーナ - 純粋関数のゲームロジック。
// Firestoreトランザクション内で「最新状態を読んで検証してから書く」方式(他ゲームと同じ)
// なので、シャッフル等にMath.random()を使っても問題ない(サーバー権威の単一書き込みのため)。

export const MAX_HP = 30;
export const START_HAND_SIZE = 5;
export const HAND_CAP = 8;

function attackCards(dmgList) {
  return dmgList.map((dmg) => ({ type: "attack", dmg, emoji: "⚔️", label: `こうげき ${dmg}` }));
}
function healCards(amount, count) {
  return Array.from({ length: count }, () => ({ type: "heal", amount, emoji: "💖", label: `かいふく +${amount}` }));
}
function shieldCards(amount, count) {
  return Array.from({ length: count }, () => ({ type: "shield", amount, emoji: "🛡️", label: `シールド ${amount}` }));
}
function drawTypeCards(amount, count) {
  return Array.from({ length: count }, () => ({ type: "draw", amount, emoji: "🎴", label: `ドロー +${amount}` }));
}

// デッキタイプ: それぞれ20枚。対戦前にプレイヤーごとに選べる(相性/戦略の違いを出す)。
export const DECK_ARCHETYPES = [
  {
    id: "balance",
    name: "バランス型",
    icon: "🎯",
    desc: "攻撃・回復・シールドがまんべんなく入った基本デッキ。",
  },
  {
    id: "aggro",
    name: "こうげき型",
    icon: "🔥",
    desc: "高火力の攻撃カード多め。守りは薄いが一気に押し切れる。",
  },
  {
    id: "defense",
    name: "ぼうぎょ型",
    icon: "🛡️",
    desc: "回復とシールドが豊富。長期戦でじわじわ削る。",
  },
  {
    id: "cycle",
    name: "じゅんかん型",
    icon: "🌀",
    desc: "ドローが多く、1ターンに連続でカードを出しやすい。",
  },
];

const ARCHETYPE_DEFS = {
  balance: [
    ...attackCards([3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8]),
    ...healCards(5, 3),
    ...shieldCards(6, 3),
    ...drawTypeCards(2, 2),
  ],
  aggro: [
    ...attackCards([3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7]),
    ...healCards(5, 3),
    ...shieldCards(6, 3),
    ...drawTypeCards(2, 2),
  ],
  defense: [
    ...attackCards([4, 4, 5, 5, 6, 6, 7, 7, 8, 8]),
    ...healCards(4, 4),
    ...shieldCards(5, 4),
    ...drawTypeCards(2, 2),
  ],
  cycle: [
    ...attackCards([3, 3, 4, 4, 5, 5, 5, 6, 6, 7, 7]),
    ...healCards(5, 3),
    ...shieldCards(6, 3),
    ...drawTypeCards(2, 3),
  ],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(playerIdx, deckId) {
  const defs = ARCHETYPE_DEFS[deckId] || ARCHETYPE_DEFS.balance;
  return shuffle(defs.map((c, i) => ({ ...c, id: `p${playerIdx}-c${i}` })));
}

export function createInitialState(deckId0 = "balance", deckId1 = "balance") {
  const decks = [buildDeck(0, deckId0), buildDeck(1, deckId1)];
  const hand = [decks[0].splice(0, START_HAND_SIZE), decks[1].splice(0, START_HAND_SIZE)];
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
    lastAction: null,
  };
}

function drawCards(state, idx, n) {
  for (let i = 0; i < n; i++) {
    if (state.hand[idx].length >= HAND_CAP) return;
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

// 演出(モーション)用に、直前のアクションを構造化データとして残す。
// クライアント側はこれを見て「誰が・何を・どこへ」出したかをアニメーションできる。
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
    state.lastAction = { id: card.id, by: idx, target: opp, type: "attack", emoji: card.emoji, amount: effective, blocked };
    return { endsTurn: true };
  }
  if (card.type === "heal") {
    state.hp[idx] = Math.min(state.maxHp, state.hp[idx] + card.amount);
    pushLog(state, `P${idx + 1}が${card.label}！ HPを回復`);
    state.lastAction = { id: card.id, by: idx, target: idx, type: "heal", emoji: card.emoji, amount: card.amount };
    return { endsTurn: true };
  }
  if (card.type === "shield") {
    state.shield[idx] += card.amount;
    pushLog(state, `P${idx + 1}が${card.label}！ 次のこうげきに備える`);
    state.lastAction = { id: card.id, by: idx, target: idx, type: "shield", emoji: card.emoji, amount: card.amount };
    return { endsTurn: true };
  }
  if (card.type === "draw") {
    drawCards(state, idx, card.amount);
    pushLog(state, `P${idx + 1}が${card.label}！ 手札を引いた`);
    state.lastAction = { id: card.id, by: idx, target: idx, type: "draw", emoji: card.emoji, amount: card.amount };
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
    state.turn = opp;
    state.turnCount += 1;
    drawCards(state, opp, 1); // 新しく手番になった側が1枚引く(いわゆるドローフェイズ)
  }
  return state;
}

// 完全に「常に最大ダメージ」を選ぶAIだと、デッキ間のわずかな平均火力差が
// 何十ターンも積み重なってほぼ確定的な勝敗になってしまう(デッキ相性の意味が薄れる)。
// ダメージの2乗を重みにした加重ランダムで選び、強いカードを優先しつつも揺らぎを持たせる。
function weightedPick(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[0];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ひとりで遊ぶ場合のAI: 単純な優先順位ヒューリスティックでカードを選ぶ。
export function aiChooseCardId(state, aiIdx) {
  const opp = 1 - aiIdx;
  const hand = state.hand[aiIdx];

  const lethal = hand
    .filter((c) => c.type === "attack" && c.dmg - Math.min(state.shield[opp], c.dmg) >= state.hp[opp])
    .sort((a, b) => a.dmg - b.dmg)[0];
  if (lethal) return lethal.id;

  if (state.hp[aiIdx] <= state.maxHp * 0.6) {
    const heal = hand.find((c) => c.type === "heal");
    if (heal) return heal.id;
  }

  // ドローは手番を消費しない「実質無料」の一手なので、手札に余裕があれば積極的に使う。
  const draw = hand.find((c) => c.type === "draw");
  if (draw && hand.length < HAND_CAP && Math.random() < 0.7) return draw.id;

  if (Math.random() < 0.55) {
    const shield = hand.find((c) => c.type === "shield");
    if (shield && state.shield[aiIdx] < 6) return shield.id;
  }

  const attacks = hand.filter((c) => c.type === "attack");
  if (attacks.length) return weightedPick(attacks, (c) => c.dmg).id;

  return hand[0]?.id ?? null;
}
