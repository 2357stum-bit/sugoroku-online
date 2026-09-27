// カードバトルアリーナ - Firestoreを介したルーム作成/参加/進行のラッパー。
// 1手ごとの操作は人間の操作速度なので、パズル/すごろくと同じくFirestoreトランザクションで
// 「最新状態を読んで検証してから書く」方式にする(2人がほぼ同時に操作しても壊れない)。

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
import { withRetry } from "../firestoreRetry.js";
import { createInitialState, playCard as glPlayCard, aiChooseCardId } from "./cardEngine.js";

const COLLECTION = "cardRooms";
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
      game: null,
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
      if (data.hostUid === uid || data.guestUid === uid) return; // 再参加はそのまま許可
      if (data.status !== "lobby") throw new Error("すでにゲームが始まっています");
      if (data.guestUid) throw new Error("満員です（最大2人）");
      tx.update(ref, { guestUid: uid, guestName: name, seq: (data.seq || 0) + 1, updatedAt: serverTimestamp() });
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
      tx.update(ref, {
        status: "playing",
        game: createInitialState(),
        seq: (data.seq || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
  });
}

// 自分がホスト/ゲストどちらか(0 or 1)を判定してからカードを1枚出す。
// 検証・状態遷移はすべて playCard(純粋関数)に委ねる。
export async function playCard(code, uid, cardId) {
  return withRetry(async () => {
    const ref = roomRef(code);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("ルームが見つかりません");
      const data = snap.data();
      if (data.status !== "playing" || !data.game) return;
      let playerIdx = -1;
      if (data.hostUid === uid) playerIdx = 0;
      else if (data.guestUid === uid) playerIdx = 1;
      if (playerIdx < 0) return;
      const game = JSON.parse(JSON.stringify(data.game));
      const result = glPlayCard(game, playerIdx, cardId);
      if (!result) return; // 手番違い/手札に無いカード等は黙って無視(冪等)
      const update = { game, seq: (data.seq || 0) + 1, updatedAt: serverTimestamp() };
      if (game.status === "finished") update.status = "finished";
      tx.update(ref, update);
    });
  });
}

// ひとりで遊ぶ(ゲスト不在)場合のAIの手番。ゲストが参加した後に呼ばれても
// 何もしない(そのモードの本来の対戦者に任せる)。
export async function aiPlayTurn(code) {
  return withRetry(async () => {
    const ref = roomRef(code);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status !== "playing" || !data.game) return;
      if (data.guestUid) return; // 対人戦になっていたらAIは何もしない
      if (data.game.turn !== 1) return;
      const game = JSON.parse(JSON.stringify(data.game));
      const cardId = aiChooseCardId(game, 1);
      if (!cardId) return;
      const result = glPlayCard(game, 1, cardId);
      if (!result) return;
      const update = { game, seq: (data.seq || 0) + 1, updatedAt: serverTimestamp() };
      if (game.status === "finished") update.status = "finished";
      tx.update(ref, update);
    });
  });
}

export async function rematch(code, uid) {
  return withRetry(async () => {
    const ref = roomRef(code);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("ルームが見つかりません");
      const data = snap.data();
      if (data.hostUid !== uid) throw new Error("ホストのみ操作できます");
      tx.update(ref, {
        status: "playing",
        game: createInitialState(),
        seq: (data.seq || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    });
  });
}

export async function backToLobby(code, uid) {
  return withRetry(async () => {
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
