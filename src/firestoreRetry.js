// Firestoreは、接続がまだ確立していない瞬間(ページを開いた直後など)や、
// ほんの一瞬回線が途切れただけでも「Failed to get document because the
// client is offline.」のような分かりにくい英語のエラーを投げてくることがある。
// 多くの場合すぐに繋がり直るので、この関数は1回だけ短い間隔をおいて
// 自動リトライし、それでもダメなら分かりやすい日本語のエラーに変換する。
// すごろく/シューティング/パズル、いずれのルーム操作(作成・参加・進行)からも
// このラッパー経由でFirestoreを呼ぶことで、挙動を統一している。

function isTransientOffline(e) {
  const code = e && e.code;
  const msg = String((e && e.message) || "");
  return code === "unavailable" || /client is offline/i.test(msg) || /network error/i.test(msg);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry(fn) {
  try {
    return await fn();
  } catch (e) {
    if (!isTransientOffline(e)) throw e;
    await sleep(800);
    try {
      return await fn();
    } catch (e2) {
      if (isTransientOffline(e2)) {
        const friendly = new Error("通信エラー: ネットワークの接続状況を確認してから、もう一度お試しください。");
        friendly.cause = e2;
        throw friendly;
      }
      throw e2;
    }
  }
}
