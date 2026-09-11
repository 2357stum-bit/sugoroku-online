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
import { TOKENS, MAX_PLAYERS, createPlayer } from "./boardData.js";
import {
  initGameState,
  rollForPlayer,
  chooseFork as glChooseFork,
  chooseHome as glChooseHome,
  submitInvestDecision as glSubmitInvestDecision,
  startSettlement,
  startLottery,
  finishGame,
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
  return update;
}

export async function createRoom(uid, name) {
  let code = randomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await getDoc(roomRef(code));
    if (!snap.exists()) break;
    code = randomCode();
  }
  const host = createPlayer(uid, 0, name);
  const room = {
    code,
    hostUid: uid,
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
}

export async function joinRoom(code, uid, name) {
  const ref = roomRef(code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.players.some((p) => p.id === uid)) return; // 再参加はそのまま許可
    if (data.status !== "lobby") throw new Error("すでにゲームが始まっています");
    if (data.players.length >= MAX_PLAYERS) throw new Error("満員です（最大4人）");
    const player = createPlayer(uid, data.players.length, name);
    tx.update(ref, {
      players: [...data.players, player],
      seq: (data.seq || 0) + 1,
      updatedAt: serverTimestamp(),
    });
  });
  return code;
}

export function subscribeRoom(code, onChange, onError) {
  return onSnapshot(
    roomRef(code),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

export async function startGame(code, uid) {
  const ref = roomRef(code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.hostUid !== uid) throw new Error("ホストのみ開始できます");
    if (data.status !== "lobby") throw new Error("すでに開始しています");
    if (data.players.length < 2) throw new Error("2人以上必要です");
    const state = initGameState(data.players.map((p) => ({ ...p })));
    const update = applyGameState({ seq: (data.seq || 0) + 1, updatedAt: serverTimestamp() }, state);
    tx.update(ref, update);
  });
}

async function runGameTransaction(code, mutator) {
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

export function submitInvest(code, playerId, amount) {
  return runGameTransaction(code, (state) => glSubmitInvestDecision(state, playerId, amount));
}

export function advanceToLottery(code) {
  return runGameTransaction(code, (state) => {
    if (state.status === "settlement") startLottery(state);
  });
}

export function advanceToFinal(code) {
  return runGameTransaction(code, (state) => {
    if (state.status === "lottery") finishGame(state);
  });
}

export async function resetToLobby(code, uid) {
  const ref = roomRef(code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.hostUid !== uid) throw new Error("ホストのみ操作できます");
    const players = data.players.map((p, i) => createPlayer(p.id, i, p.name));
    tx.update(ref, {
      players,
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
}

export async function deleteRoom(code, uid) {
  const ref = roomRef(code);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().hostUid === uid) {
    await deleteDoc(ref);
  }
}

export { TOKENS };
