// おもちゃ箱シューティングギャラリー - 歴代ハイスコアランキング(全ルーム共通)。
// 1プレイ終了ごとに新しい記録として1件追加していく(上書きしない)ので、
// 同じ人が何度挑戦しても過去の記録はそのまま残る。

import { collection, doc, setDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";
import { withRetry } from "../firestoreRetry.js";

const COLLECTION = "galleryLeaderboard";

export async function submitScore(name, score) {
  return withRetry(async () => {
    const ref = doc(collection(db, COLLECTION));
    await setDoc(ref, { name, score, date: serverTimestamp() });
  });
}

export function subscribeTopScores(onChange, onError, count = 10) {
  const q = query(collection(db, COLLECTION), orderBy("score", "desc"), limit(count));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError
  );
}
