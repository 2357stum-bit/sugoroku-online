// マネー双六 - Firestoreを介したルーム作成/参加/進行のラッパー。
// ゲーム進行そのものは gameLogic.js（純粋関数）に委ね、ここでは
// 「誰が・いつ書き込めるか」をトランザクションで保証することに専念する。

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { withRetry } from "./firestoreRetry.js";
import { MAX_PLAYERS, createPlayer, DEFAULT_THEME_ID, THEME_LIST } from "./boardData.js";
import {
  initGameState,
  rollForPlayer,
  chooseFork as glChooseFork,
  chooseHome as glChooseHome,
  choosePick as glChoosePick,
  chooseLand as glChooseLand,
  advanceFromLanding as glAdvanceFromLanding,
  submitInvestDecision as glSubmitInvestDecision,
  startSettlement,
  startLottery,
  finishGame,
  getRanking,
} from "./gameLogic.js";

const COLLECTION = "sugorokuRooms";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 見間違えやすい文字は除外

function randomCode(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function roomRef(code) {
  return doc(db, COLLECTION, code.toUpperCase());
}

function extractGameState(data) {
  return {
    themeId: data.themeId || DEFAULT_THEME_ID,
    players: data.players,
    currentIdx: data.currentIdx,
    finishOrder: data.finishOrder,
    marketIndex: data.marketIndex,
    status: data.status,
    turn: data.turn,
    lastEvent: data.lastEvent || null,
    log: data.log || [],
    settlement: data.settlement,
    lottery: data.lottery,
    landOwners: data.landOwners || {},
  };
}

function applyGameState(update, state) {
  update.players = state.players;
  update.currentIdx = state.currentIdx;
  update.finishOrder = state.finishOrder;
  update.marketIndex = state.marketIndex;
  update.status = state.status;
  update.turn = state.turn;
  update.lastEvent = state.lastEvent;
  update.log = state.log;
  update.settlement = state.settlement;
  update.lottery = state.lottery;
  update.landOwners = state.landOwners || {};
  return update;
}

export async function createRoom(uid, name, themeId, seriesMode) {
  return withRetry(async () => {
    let code = randomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const snap = await getDoc(roomRef(code));
      if (!snap.exists()) break;
      code = randomCode();
    }
    // 「全ステージ通し」モードでは、全マップを固定の順番でプレイして総合得点を競う。
    const seriesOrder = seriesMode ? THEME_LIST.map((t) => t.id) : null;
    const resolvedThemeId = seriesMode ? seriesOrder[0] : (themeId || DEFAULT_THEME_ID);
    const host = createPlayer(uid, 0, name, resolvedThemeId);
    const room = {
      code,
      hostUid: uid,
      themeId: resolvedThemeId,
      seriesMode: !!seriesMode,
      seriesOrder,
      seriesStage: 0,
      seriesScores: {},
      seriesHistory: [],
      status: "lobby",
      players: [host],
      currentIdx: 0,
      finishOrder: 0,
      marketIndex: 100,
      turn: null,
      lastEvent: null,
      log: [],
      settlement: null,
      lottery: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      seq: 0,
    };
    await setDoc(roomRef(code), room);
    return code;
  });
}

export async function joinRoom(code, uid, name) {
  return withRetry(async () => {
    const ref = roomRef(code);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("ルームが見つかりません");
      const data = snap.data();
      if (data.players.some((p) => p.id === uid)) return; // 再参加はそのまま許可
      if (data.status !== "lobby") throw new Error("すでにゲームが始まっています");
      if (data.players.length >= MAX_PLAYERS) throw new Error("満員です（最大4人）");
      const player = createPlayer(uid, data.players.length, name, data.themeId);
      tx.update(ref, {
        players: [...data.players, player],
        seq: (data.seq || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
    return code;
  });
}

export function subscribeRoom(code, onChange, onError) {
  return onSnapshot(
    roomRef(code),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

export async function startGame(code, uid) {
  return withRetry(async () => {
    const ref = roomRef(code);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("ルームが見つかりません");
      const data = snap.data();
      if (data.hostUid !== uid) throw new Error("ホストのみ開始できます");
      if (data.status !== "lobby") throw new Error("すでに開始しています");
      if (data.players.length < 1) throw new Error("プレイヤーがいません");
      const state = initGameState(data.players.map((p) => ({ ...p })), data.themeId);
      const update = applyGameState({ seq: (data.seq || 0) + 1, updatedAt: serverTimestamp() }, state);
      tx.update(ref, update);
    });
  });
}

async function runGameTransaction(code, mutator) {
  return withRetry(async () => {
    const ref = roomRef(code);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("ルームが見つかりません");
      const data = snap.data();
      const state = extractGameState(data);
      mutator(state);
      const update = applyGameState({ seq: (data.seq || 0) + 1, updatedAt: serverTimestamp() }, state);
      tx.update(ref, update);
    });
  });
}

export function rollDice(code, playerId) {
  return runGameTransaction(code, (state) => rollForPlayer(state, playerId));
}

export function chooseFork(code, playerId, choiceId) {
  return runGameTransaction(code, (state) => glChooseFork(state, playerId, choiceId));
}

export function chooseHome(code, playerId, optionId) {
  return runGameTransaction(code, (state) => glChooseHome(state, playerId, optionId));
}

export function choosePick(code, playerId, optionId) {
  return runGameTransaction(code, (state) => glChoosePick(state, playerId, optionId));
}

export function chooseLand(code, playerId, buy) {
  return runGameTransaction(code, (state) => glChooseLand(state, playerId, buy));
}

export function submitInvest(code, playerId, amount) {
  return runGameTransaction(code, (state) => glSubmitInvestDecision(state, playerId, amount));
}

// マスの着地演出(トースト/ショーケース)を見せ終えたら、どのクライアントからでも呼んでゲームを先へ進める。
// 既に別のクライアントが進めていれば何もしない(冪等)ので、複数人が同時に呼んでも安全。
export function ackLanding(code) {
  return runGameTransaction(code, (state) => glAdvanceFromLanding(state));
}

export function advanceToLottery(code) {
  return runGameTransaction(code, (state) => {
    if (state.status === "settlement") startLottery(state);
  });
}

// ロッタリー結果からゲームを終了させる。全ステージ通しモードの場合は、この
// ステージの順位に応じた得点(1位が最多)を通算スコアに加算し、履歴に残す。
export async function advanceToFinal(code) {
  return withRetry(async () => {
    const ref = roomRef(code);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("ルームが見つかりません");
      const data = snap.data();
      const state = extractGameState(data);
      if (state.status !== "lottery") return; // 既に進行済みなら何もしない(冪等)
      finishGame(state);
      const update = applyGameState({ seq: (data.seq || 0) + 1, updatedAt: serverTimestamp() }, state);
      if (data.seriesMode) {
        const ranking = getRanking(state.players);
        const n = ranking.length;
        const scores = { ...(data.seriesScores || {}) };
        ranking.forEach((p, i) => {
          scores[p.id] = (scores[p.id] || 0) + (n - i);
        });
        update.seriesScores = scores;
        update.seriesHistory = [
          ...(data.seriesHistory || []),
          {
            themeId: data.themeId,
            stage: data.seriesStage || 0,
            ranking: ranking.map((p, i) => ({ id: p.id, name: p.name, token: p.token, money: p.money, rank: i + 1, points: n - i })),
          },
        ];
      }
      tx.update(ref, update);
    });
  });
}

// 「次のステージへ」: 全ステージ通しモードで、このステージの結果を保ったまま
// 次のマップのロビーへ進む(通算スコア・履歴はそのまま引き継ぐ)。
export async function advanceSeriesStage(code, uid) {
  return withRetry(async () => {
    const ref = roomRef(code);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("ルームが見つかりません");
      const data = snap.data();
      if (data.hostUid !== uid) throw new Error("ホストのみ操作できます");
      if (!data.seriesMode) throw new Error("全ステージ通しモードではありません");
      if (data.status !== "finished") throw new Error("このステージがまだ終わっていません");
      const nextStage = (data.seriesStage || 0) + 1;
      if (nextStage >= data.seriesOrder.length) throw new Error("最後のステージです");
      const nextThemeId = data.seriesOrder[nextStage];
      const players = data.players.map((p, i) => createPlayer(p.id, i, p.name, nextThemeId));
      tx.update(ref, {
        players,
        themeId: nextThemeId,
        seriesStage: nextStage,
        status: "lobby",
        currentIdx: 0,
        finishOrder: 0,
        marketIndex: 100,
        turn: null,
        lastEvent: null,
        log: [],
        settlement: null,
        lottery: null,
        seq: (data.seq || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
  });
}

export async function resetToLobby(code, uid) {
  return withRetry(async () => {
    const ref = roomRef(code);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("ルームが見つかりません");
      const data = snap.data();
      if (data.hostUid !== uid) throw new Error("ホストのみ操作できます");
      // 全ステージ通しモードの「もう一度あそぶ」は、シリーズ全体を最初からやり直す。
      const themeId = data.seriesMode ? data.seriesOrder[0] : data.themeId;
      const players = data.players.map((p, i) => createPlayer(p.id, i, p.name, themeId));
      const update = {
        players,
        themeId,
        status: "lobby",
        currentIdx: 0,
        finishOrder: 0,
        marketIndex: 100,
        turn: null,
        lastEvent: null,
        log: [],
        settlement: null,
        lottery: null,
        seq: (data.seq || 0) + 1,
        updatedAt: serverTimestamp(),
      };
      if (data.seriesMode) {
        update.seriesStage = 0;
        update.seriesScores = {};
        update.seriesHistory = [];
      }
      tx.update(ref, update);
    });
  });
}

export async function deleteRoom(code, uid) {
  return withRetry(async () => {
    const ref = roomRef(code);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().hostUid === uid) {
      await deleteDoc(ref);
    }
  });
}
