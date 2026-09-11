// マネー双六 - ゲーム進行の純粋関数群（Firestore等の入出力には依存しない）
// state はプレーンオブジェクトで、常に JSON 化可能（Firestoreにそのまま保存できる）。
// state.themeId によってマップ(職業・拠点・イベント文言・アイコン等)を切り替える。

import {
  LIFEEVENT_ROLL_MULT,
  CHILD_GIFT_TOTAL,
  FINISH_BONUS,
  LOTTERY_REWARD,
  BASE_SALARY,
  PART_TIME_RATE,
  LAST,
  scaleFlat,
  pickAmount,
  randomTicket,
  getTheme,
  DEFAULT_THEME_ID,
} from "./boardData.js";

function findPlayer(state, id) {
  const p = state.players.find((pl) => pl.id === id);
  if (!p) throw new Error("プレイヤーが見つかりません");
  return p;
}

function allFinished(players) {
  return players.every((p) => p.finished);
}

function pushLog(state, text, kind, playerId) {
  if (!state.log) state.log = [];
  state.log.push({ text, kind, playerId, t: Date.now() });
  if (state.log.length > 15) state.log.shift();
}

// state.lastEvent は「直近に起きたこと」を表示するための情報で、turn(誰の番か)
// が次のプレイヤーに移っても上書きされない。ターン内で複数回起きても、都度更新される。
function setLastEvent(state, data) {
  state.lastEvent = { ...data, at: Date.now() };
}

function freshTurn(actorId) {
  return {
    actorId,
    status: "idle",
    roll: null,
    fromPos: null,
    toPos: null,
    path: [],
    queue: [],
    queueIndex: 0,
    choice: null,
    invest: null,
  };
}

export function initGameState(players, themeId) {
  return {
    themeId: themeId || DEFAULT_THEME_ID,
    players,
    currentIdx: 0,
    finishOrder: 0,
    marketIndex: 100,
    status: "playing",
    turn: freshTurn(players[0].id),
    lastEvent: null,
    log: [],
    settlement: null,
    lottery: null,
  };
}

function buildQueue(theme, player, fromPos, target) {
  const salaryHits = [];
  for (let i = fromPos + 1; i < target; i++) {
    if (theme.getSquare(player, i).type === "salary") salaryHits.push(i);
  }
  const queue = salaryHits.map((idx) => ({ kind: "salary_mid", idx }));
  queue.push({ kind: "landing", idx: target });
  return queue;
}

function openInvestPhase(state, theme, payerId, idx) {
  const payer = findPlayer(state, payerId);
  const rate = payer.job ? payer.job.mult.salary : PART_TIME_RATE;
  const salaryAmt = Math.round((scaleFlat(BASE_SALARY, idx) * rate) / 10) * 10;
  payer.money += salaryAmt;

  const news = theme.news[Math.floor(Math.random() * theme.news.length)];
  const before = state.marketIndex;
  const after = Math.max(20, Math.round(before * (1 + news.pct / 100)));
  state.marketIndex = after;

  const jobLabel = payer.job ? `${payer.job.icon} ${payer.job.name}として` : "見習いとして";
  const pending = state.players.filter((p) => !p.finished).map((p) => p.id);

  state.turn.invest = { idx, payerId, salaryAmt, jobLabel, news, before, after, pending, decisions: {} };
  state.turn.status = "awaiting_invest";
  setLastEvent(state, { kind: "salary", playerId: payerId, salaryAmt, jobLabel, news, before, after });
  pushLog(state, `${payer.name}：${theme.labels.salaryName} +${salaryAmt}${theme.currencyUnit}`, "salary", payerId);
}

function resolveLandingAuto(state, theme, actor, sq, idx) {
  switch (sq.type) {
    case "fork": {
      state.turn.choice = { type: "fork", forkIdx: idx };
      state.turn.status = "awaiting_choice";
      setLastEvent(state, { kind: "fork_wait", playerId: actor.id });
      pushLog(state, `${actor.name}：🔀道を選んでいます…`, "fork", actor.id);
      return true;
    }
    case "homepurchase": {
      state.turn.choice = { type: "home" };
      state.turn.status = "awaiting_choice";
      setLastEvent(state, { kind: "home_wait", playerId: actor.id });
      pushLog(state, `${actor.name}：${theme.labels.homeSquareName}を選んでいます…`, "homepurchase", actor.id);
      return true;
    }
    case "salary": {
      openInvestPhase(state, theme, actor.id, idx);
      return true;
    }
    case "goal": {
      actor.finished = true;
      const rank = state.finishOrder + 1;
      const bonus = FINISH_BONUS[Math.min(state.finishOrder, FINISH_BONUS.length - 1)];
      state.finishOrder++;
      actor.finishBonus = bonus;
      actor.money += bonus;
      setLastEvent(state, { kind: "goal", playerId: actor.id, rank, bonus });
      pushLog(state, `${actor.name}：🏁${rank}着で${theme.labels.goalName}！ +${bonus}${theme.currencyUnit}`, "goal", actor.id);
      return false;
    }
    case "job": {
      if (!actor.job) {
        const job = theme.jobs[Math.floor(Math.random() * theme.jobs.length)];
        actor.job = job;
        setLastEvent(state, { kind: "job", playerId: actor.id, job });
        pushLog(state, `${actor.name}：${job.icon}${job.name}になった！`, "job", actor.id);
      } else {
        setLastEvent(state, { kind: "job_done", playerId: actor.id, job: actor.job });
      }
      return false;
    }
    case "lifeevent": {
      const roll = 1 + Math.floor(Math.random() * 6);
      const mult = LIFEEVENT_ROLL_MULT[roll];
      const amt = Math.round((sq.baseMagnitude * mult) / 10) * 10;
      actor.money += amt;
      setLastEvent(state, { kind: "lifeevent", playerId: actor.id, label: sq.label, icon: sq.icon, desc: sq.desc, roll, amt });
      pushLog(state, `${actor.name}：${sq.icon}${sq.label} ${amt >= 0 ? "+" : ""}${amt}${theme.currencyUnit}`, "lifeevent", actor.id);
      return false;
    }
    case "childevent": {
      const roll = 1 + Math.floor(Math.random() * 6);
      const success = roll >= 4;
      let amt = -20;
      let giftTotal = 0;
      if (success) {
        amt += sq.childCost;
        const others = state.players.filter((p) => p.id !== actor.id);
        if (others.length) {
          const share = Math.round(CHILD_GIFT_TOTAL / others.length / 10) * 10;
          others.forEach((o) => {
            o.money -= share;
            giftTotal += share;
          });
        }
      }
      actor.money += amt + giftTotal;
      setLastEvent(state, { kind: "childevent", playerId: actor.id, label: sq.label, roll, success, amt, giftTotal });
      pushLog(state, `${actor.name}：${sq.label} ${success ? "成功！" : "また挑戦"} ${amt}${theme.currencyUnit}`, "childevent", actor.id);
      return false;
    }
    case "lottery": {
      const ticket = randomTicket();
      actor.lotteryTickets.push(ticket);
      setLastEvent(state, { kind: "lottery", playerId: actor.id, ticket });
      pushLog(state, `${actor.name}：${theme.labels.lotteryItemName}『${ticket}』をゲット`, "lottery", actor.id);
      return false;
    }
    case "treasure": {
      const val = pickAmount(sq.amount);
      actor.cards.push({ name: sq.desc, value: val });
      setLastEvent(state, { kind: "treasure", playerId: actor.id, name: sq.desc, value: val });
      pushLog(state, `${actor.name}：💎『${sq.desc}』(${val}${theme.currencyUnit}相当)`, "treasure", actor.id);
      return false;
    }
    case "rest": {
      actor.rest = 1;
      setLastEvent(state, { kind: "rest", playerId: actor.id, desc: sq.desc });
      pushLog(state, `${actor.name}：${sq.desc}`, "rest", actor.id);
      return false;
    }
    case "income":
    case "expense":
    case "bonus":
    case "accident": {
      let amt = pickAmount(sq.amount);
      if (actor.job && sq.type !== "expense") {
        amt = Math.round((amt * actor.job.mult[sq.type]) / 10) * 10;
      }
      actor.money += amt;
      setLastEvent(state, { kind: sq.type, playerId: actor.id, desc: sq.desc, amt });
      pushLog(state, `${actor.name}：${sq.desc} ${amt >= 0 ? "+" : ""}${amt}${theme.currencyUnit}`, sq.type, actor.id);
      return false;
    }
    default: {
      return false;
    }
  }
}

function processQueue(state, theme) {
  while (state.turn.queueIndex < state.turn.queue.length) {
    const step = state.turn.queue[state.turn.queueIndex];
    const actor = findPlayer(state, state.turn.actorId);
    if (step.kind === "salary_mid") {
      openInvestPhase(state, theme, actor.id, step.idx);
      state.turn.queueIndex++;
      return;
    }
    if (step.kind === "landing") {
      const sq = theme.getSquare(actor, step.idx);
      const paused = resolveLandingAuto(state, theme, actor, sq, step.idx);
      state.turn.queueIndex++;
      if (paused) return;
      continue;
    }
    state.turn.queueIndex++;
  }
  state.turn.status = "done";
  finalizeTurn(state);
}

function awardWaitingTickets(state) {
  state.players.forEach((pl) => {
    if (pl.finished) pl.lotteryTickets.push(randomTicket());
  });
}

function advanceToNextPlayer(state) {
  state.currentIdx = (state.currentIdx + 1) % state.players.length;
  const p = state.players[state.currentIdx];
  if (p.finished) {
    advanceToNextPlayer(state);
    return;
  }
  awardWaitingTickets(state);
  if (p.rest > 0) {
    p.rest = 0;
    pushLog(state, `${p.name}：一回休み`, "rest_skip", p.id);
    advanceToNextPlayer(state);
    return;
  }
  state.turn = freshTurn(p.id);
}

function finalizeTurn(state) {
  if (allFinished(state.players)) {
    startSettlement(state);
    return;
  }
  advanceToNextPlayer(state);
}

export function rollForPlayer(state, playerId) {
  if (state.status !== "playing") throw new Error("ゲーム中ではありません");
  const theme = getTheme(state.themeId);
  const actor = state.players[state.currentIdx];
  if (!actor || actor.id !== playerId) throw new Error("あなたの番ではありません");
  if (state.turn.status !== "idle") throw new Error("すでに処理中です");

  const roll = 1 + Math.floor(Math.random() * 6);
  const fromPos = actor.pos;
  let target = Math.min(fromPos + roll, LAST);
  for (let i = fromPos + 1; i <= target; i++) {
    if (theme.isForcedStop(actor, i)) {
      target = i;
      break;
    }
  }
  actor.pos = target;
  const path = [];
  for (let i = fromPos + 1; i <= target; i++) path.push(i);
  const queue = buildQueue(theme, actor, fromPos, target);

  state.turn = {
    actorId: playerId,
    status: "animating",
    roll,
    fromPos,
    toPos: target,
    path,
    queue,
    queueIndex: 0,
    choice: null,
    invest: null,
  };
  setLastEvent(state, { kind: "roll", playerId, roll });
  pushLog(state, `${actor.name}：🎲${roll}`, "roll", playerId);
  processQueue(state, theme);
  return state;
}

export function chooseFork(state, playerId, choiceId) {
  if (state.turn.status !== "awaiting_choice" || !state.turn.choice || state.turn.choice.type !== "fork") {
    throw new Error("分岐選択のタイミングではありません");
  }
  if (state.turn.actorId !== playerId) throw new Error("あなたの選択ではありません");
  if (choiceId !== "risk" && choiceId !== "safe") throw new Error("不正な選択です");
  const theme = getTheme(state.themeId);
  const actor = findPlayer(state, playerId);
  actor.routeChoice[state.turn.choice.forkIdx] = choiceId;
  const opt = theme.forkOptions.find((o) => o.id === choiceId);
  state.turn.choice = null;
  state.turn.status = "animating";
  setLastEvent(state, { kind: "fork_result", playerId: actor.id, option: opt });
  pushLog(state, `${actor.name}：${opt.icon}${opt.label}を選択`, "fork", actor.id);
  processQueue(state, theme);
  return state;
}

export function chooseHome(state, playerId, optionId) {
  if (state.turn.status !== "awaiting_choice" || !state.turn.choice || state.turn.choice.type !== "home") {
    throw new Error("マイホーム選択のタイミングではありません");
  }
  if (state.turn.actorId !== playerId) throw new Error("あなたの選択ではありません");
  const theme = getTheme(state.themeId);
  const opt = theme.homeOptions.find((o) => o.id === optionId);
  if (!opt) throw new Error("不正な選択です");
  const actor = findPlayer(state, playerId);
  actor.home = opt;
  actor.money += opt.cost;
  state.turn.choice = null;
  state.turn.status = "animating";
  setLastEvent(state, { kind: "home_result", playerId: actor.id, option: opt });
  pushLog(state, `${actor.name}：${opt.icon}${opt.label}を${theme.labels.homeVerb}`, "homepurchase", actor.id);
  processQueue(state, theme);
  return state;
}

export function submitInvestDecision(state, playerId, amount) {
  const inv = state.turn.invest;
  if (state.turn.status !== "awaiting_invest" || !inv) throw new Error("投資判断のタイミングではありません");
  if (!inv.pending.includes(playerId)) throw new Error("このラウンドの対象ではありません");
  if (inv.decisions[playerId] !== undefined) return state; // already decided

  const player = findPlayer(state, playerId);
  const maxAmt = Math.max(0, Math.floor(player.money / 10) * 10);
  const amt = Math.max(0, Math.min(maxAmt, Math.round((Number(amount) || 0) / 10) * 10));
  inv.decisions[playerId] = amt;

  const allDone = inv.pending.every((id) => inv.decisions[id] !== undefined);
  if (allDone) {
    inv.pending.forEach((id) => {
      const pl = findPlayer(state, id);
      const decided = inv.decisions[id];
      pl.money -= decided;
      pl.invested += decided;
    });
    state.turn.invest = null;
    state.turn.status = "animating";
    processQueue(state, getTheme(state.themeId));
  }
  return state;
}

export function startSettlement(state) {
  state.status = "settlement";
  state.players.forEach((p) => {
    const payout = Math.round(((p.invested * state.marketIndex) / 100 / 10)) * 10;
    p.investPayout = payout;
    p.investGain = payout - p.invested;
    p.money += payout;

    if (p.home && p.home.baseValue > 0) {
      const appr = 1.05 + Math.random() * 0.4;
      p.homeSaleValue = Math.round((p.home.baseValue * appr) / 10) * 10;
      p.money += p.homeSaleValue;
    } else {
      p.homeSaleValue = 0;
    }

    p.treasureSum = p.cards.reduce((s, c) => s + c.value, 0);
    p.money += p.treasureSum;
  });
  state.settlement = { computedAt: Date.now() };
  setLastEvent(state, { kind: "settlement" });
  pushLog(state, "全員ゴール！最終精算を行います", "settlement", null);
  return state;
}

export function startLottery(state) {
  if (state.status !== "settlement") throw new Error("精算前です");
  state.status = "lottery";
  const winningNumber = randomTicket();
  const rewards = {};
  state.players.forEach((p) => {
    let reward = 0;
    p.lotteryTickets.forEach((t) => {
      let match = 0;
      for (let i = 0; i < 4; i++) if (t[i] === winningNumber[i]) match++;
      reward += LOTTERY_REWARD[match];
    });
    p.lotteryReward = reward;
    p.money += reward;
    rewards[p.id] = reward;
  });
  state.lottery = { winningNumber, rewards };
  setLastEvent(state, { kind: "lottery_result", winningNumber });
  pushLog(state, `当選番号 ${winningNumber}`, "lottery_result", null);
  return state;
}

export function finishGame(state) {
  if (state.status !== "lottery") throw new Error("抽選前です");
  state.status = "finished";
  return state;
}

export function getRanking(players) {
  return [...players].sort((a, b) => b.money - a.money);
}
