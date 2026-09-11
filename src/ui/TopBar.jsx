import { useState } from "react";
import { resetToLobby } from "../roomEngine.js";

export default function GameTopBar({ title, code, uid, hostUid, onLeaveRoom }) {
  const [busy, setBusy] = useState(false);
  const isHost = hostUid === uid;

  async function handleReset() {
    if (!window.confirm("進行中のゲームをリセットして、ロビーに戻します。よろしいですか？")) return;
    setBusy(true);
    try {
      await resetToLobby(code, uid);
    } catch (e) {
      window.alert(e.message || "リセットに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function handleLeave() {
    if (!window.confirm("このルームから退出しますか？")) return;
    onLeaveRoom();
  }

  return (
    <div className="sgr-topbar">
      <h1>{title}</h1>
      <div className="sgr-topbar-btns">
        {isHost && (
          <button className="sgr-link-btn" disabled={busy} onClick={handleReset}>
            リセット
          </button>
        )}
        <button className="sgr-link-btn" onClick={handleLeave}>
          退出
        </button>
      </div>
    </div>
  );
}
