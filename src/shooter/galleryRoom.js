// おもちゃ箱シューティングギャラリー - Firestoreを介したルーム作成/参加/進行のラッパー。
// このゲームは的の出現スケジュールが完全に決定的なので、旧シューティングのような
// 「ホストだけが正の状態を計算する」方式は不要。2人ともローカルで同じエンジンを
// 実行して同じ的を狙い、自分のスコアだけを scores.<uid> に書き込み合う(競合しない)。

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
import { withRetry } from "../firestoreRetry.js";

const COLLECTION = "galleryRooms";
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
  return withRetry(async () => {
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
      status: "lobby", // lobby -> playing -> finished
      startedAt: null,
      scores: {},
      finished: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(roomRef(code), room);
    return code;
  });
}

export async function joinRoom(code, uid, name) {
  return withRetry(async () => {
    const ref = roomRef(code);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.hostUid === uid || data.guestUid === uid) return code; // 再参加はそのまま許可
    if (data.status !== "lobby") throw new Error("すでにゲームが始まっています");
    if (data.guestUid) throw new Error("満員です（最大2人）");
    await updateDoc(ref, { guestUid: uid, guestName: name, updatedAt: serverTimestamp() });
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
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.hostUid !== uid) throw new Error("ホストのみ開始できます");
    if (data.status !== "lobby") throw new Error("すでに開始しています");
    await updateDoc(ref, {
      status: "playing",
      startedAt: serverTimestamp(),
      scores: {},
      finished: {},
      updatedAt: serverTimestamp(),
    });
  });
}

// プレイ中、数百msおきに間引いて自分のスコアを書き込む(他人のフィールドには触れないので競合しない)。
export function publishScore(code, uid, score) {
  return updateDoc(roomRef(code), { [`scores.${uid}`]: score });
}

export function markFinished(code, uid, score) {
  return updateDoc(roomRef(code), { [`scores.${uid}`]: score, [`finished.${uid}`]: true });
}

export async function resetToLobby(code, uid) {
  return withRetry(async () => {
    const ref = roomRef(code);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("ルームが見つかりません");
    const data = snap.data();
    if (data.hostUid !== uid) throw new Error("ホストのみ操作できます");
    await updateDoc(ref, {
      status: "lobby",
      startedAt: null,
      scores: {},
      finished: {},
      updatedAt: serverTimestamp(),
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
