// シューティング(協力ボス戦) - Firestoreを介したルーム作成/参加/進行のラッパー。
// すごろく側の roomEngine.js とは異なり、ここでは毎フレームに近い頻度で書き込みが
// 発生するため、Firestoreトランザクションは使わず(競合の起きようがないため)
// 直接 updateDoc/setDoc で書き込む。ホストだけが「正」の状態(hostState)を書き、
// ゲストは自分の位置(guestInput)だけを書く、という役割分担で競合を避けている。

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase.js";

const COLLECTION = "shooterRooms";
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
    status: "lobby", // lobby -> playing -> ended
    hostState: null,
    guestInput: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(roomRef(code), room);
  return code;
}

export async function joinRoom(code, uid, name) {
  const ref = roomRef(code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("ルームが見つかりません");
  const data = snap.data();
  if (data.hostUid === uid || data.guestUid === uid) return code; // 再参加はそのまま許可
  if (data.status !== "lobby") throw new Error("すでにゲームが始まっています");
  if (data.guestUid) throw new Error("満員です（最大2人）");
  await updateDoc(ref, {
    guestUid: uid,
    guestName: name,
    updatedAt: serverTimestamp(),
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

export async function startGame(code, uid, initialState) {
  const ref = roomRef(code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("ルームが見つかりません");
  const data = snap.data();
  if (data.hostUid !== uid) throw new Error("ホストのみ開始できます");
  if (data.status !== "lobby") throw new Error("すでに開始しています");
  await updateDoc(ref, {
    status: "playing",
    hostState: initialState,
    guestInput: null,
    updatedAt: serverTimestamp(),
  });
}

// ホストが毎フレーム(実際は数十msおきに間引いて)呼ぶ。トランザクション不要
// (この値を書くのは常にホストだけなので競合しない)。
export function publishHostState(code, state) {
  return updateDoc(roomRef(code), { hostState: state, updatedAt: serverTimestamp() });
}

// ゲストが自分の位置を報告する。
export function publishGuestInput(code, x, y) {
  return updateDoc(roomRef(code), { guestInput: { x, y, at: Date.now() } });
}

// ホストがゲームを終えたら呼ぶ(結果画面へ)。
export function endGame(code) {
  return updateDoc(roomRef(code), { status: "ended", updatedAt: serverTimestamp() });
}

// もう一度あそぶ: ロビーに戻す。
export async function resetToLobby(code, uid) {
  const ref = roomRef(code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("ルームが見つかりません");
  const data = snap.data();
  if (data.hostUid !== uid) throw new Error("ホストのみ操作できます");
  await updateDoc(ref, {
    status: "lobby",
    hostState: null,
    guestInput: null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRoom(code, uid) {
  const ref = roomRef(code);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().hostUid === uid) {
    await deleteDoc(ref);
  }
}
