// きょうどうパズル - Firestoreを介したルーム作成/参加/進行のラッパー。
// 1手ごとの移動は頻度が低い(人間の操作速度)ので、すごろく側の roomEngine.js と
// 同じくFirestoreトランザクションで「最新状態を読んで検証してから書く」方式にする。
// これにより2人がほぼ同時に手を打っても、片方が壊れた状態を書き込むことがない。

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase.js";
import { LEVELS, createInitialState, parseLevel, movePlayer } from "./puzzleEngine.js";

const COLLECTION = "puzzleRooms";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 見間違えやすい文字は除外

function randomCode(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

function roomRef(code) {
  return doc(db, COLLECTION, code.toUpperCase());
}

export async function createRoom(uid, name) {
  let code = randomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const snap = await getDoc(roomRef(code));
    if (!snap.exists()) break;
    code = randomCode();
  }
  const room = {
    code,
    hostUid: uid,
    hostName: name,
    guestUid: null,
    guestName: null,
    status: "lobby", // lobby -> playing -> cleared(そのステージクリア)
    levelId: LEVELS[0].id,
    game: null,
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
    if (data.hostUid === uid || data.guestUid === uid) return; // 再参加はそのまま許可
    if (data.status !== "lobby") throw new Error("すでにゲームが始まっています");
    if (data.guestUid) throw new Error("満員です（最大2人）");
    tx.update(ref, { guestUid: uid, guestName: name, seq: (data.seq || 0) + 1, updatedAt: serverTimestamp() });
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
    tx.update(ref, {
      status: "playing",
      game: createInitialState(data.levelId || LEVELS[0].id),
      seq: (data.seq || 0) + 1,
      updatedAt: serverTimestamp(),
    });
  });
}

// 自分がホスト/ゲストどちらか(0 or 1)を判定してから1マス動かす。
// ひとりプレイ(ゲスト不在)の場合だけ、soloIdxで「今どちらのキャラを動かすか」を
// クライアント側から指定できる(2人プレイ中は他人のキャラを勝手に動かせないよう無視する)。
// 盤面の検証はすべて movePlayer(純粋関数)に委ねる。
export async function move(code, uid, dir, soloIdx) {
  const ref = roomRef(code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.status !== "playing" || !data.game) return;
    let playerIdx = -1;
    if (data.hostUid === uid && !data.guestUid) playerIdx = soloIdx === 1 ? 1 : 0;
    else if (data.hostUid === uid) playerIdx = 0;
    else if (data.guestUid === uid) playerIdx = 1;
    if (playerIdx < 0) return;
    const level = parseLevel(data.game.levelId);
    const game = JSON.parse(JSON.stringify(data.game));
    const moved = movePlayer(game, level, playerIdx, dir);
    if (!moved) return;
    const update = { game, seq: (data.seq || 0) + 1, updatedAt: serverTimestamp() };
    if (game.solved) update.status = "cleared";
    tx.update(ref, update);
  });
}

export async function resetLevel(code, uid) {
  const ref = roomRef(code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.hostUid !== uid) throw new Error("ホストのみ操作できます");
    tx.update(ref, {
      status: "playing",
      game: createInitialState(data.levelId || LEVELS[0].id),
      seq: (data.seq || 0) + 1,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function nextLevel(code, uid) {
  const ref = roomRef(code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.hostUid !== uid) throw new Error("ホストのみ操作できます");
    if (data.status !== "cleared") throw new Error("このステージがまだ終わっていません");
    const idx = LEVELS.findIndex((l) => l.id === data.levelId);
    const next = LEVELS[idx + 1];
    if (!next) throw new Error("最後のステージです");
    tx.update(ref, {
      status: "playing",
      levelId: next.id,
      game: createInitialState(next.id),
      seq: (data.seq || 0) + 1,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function backToLobby(code, uid) {
  const ref = roomRef(code);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.hostUid !== uid) throw new Error("ホストのみ操作できます");
    tx.update(ref, {
      status: "lobby",
      game: null,
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
