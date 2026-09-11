import { useEffect, useMemo, useState } from "react";
import "./sugoroku.css";
import { authReady } from "./firebase.js";
import { createRoom, joinRoom } from "./roomEngine.js";
import GameRoom from "./GameRoom.jsx";

const NAME_KEY = "sgr_name";
const ROOM_KEY = "sgr_room";

function readQuery() {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

function setUrlRoom(code) {
  try {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("room", code);
    else url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
  } catch {
    // URL操作に失敗しても致命的ではないので無視する
  }
}

export default function SugorokuApp() {
  const [uid, setUid] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [tab, setTab] = useState("create");
  const [joinCode, setJoinCode] = useState(() => readQuery().get("room") || "");
  const [roomCode, setRoomCode] = useState(() => readQuery().get("room") || localStorage.getItem(ROOM_KEY) || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authReady.then((user) => setUid(user.uid)).catch((e) => setAuthError(e));
  }, []);

  useEffect(() => {
    document.title = "マネー双六 オンライン";
  }, []);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  const trimmedName = name.trim() || "プレイヤー";

  const canSubmit = useMemo(() => !!uid && !busy, [uid, busy]);

  async function handleCreate() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const code = await createRoom(uid, trimmedName);
      localStorage.setItem(ROOM_KEY, code);
      setUrlRoom(code);
      setRoomCode(code);
    } catch (e) {
      setError(e.message || "ルームの作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!canSubmit) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("ルームコードを入力してください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await joinRoom(code, uid, trimmedName);
      localStorage.setItem(ROOM_KEY, code);
      setUrlRoom(code);
      setRoomCode(code);
    } catch (e) {
      setError(e.message || "参加に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function handleLeaveRoom() {
    localStorage.removeItem(ROOM_KEY);
    setUrlRoom(null);
    setRoomCode("");
  }

  if (authError) {
    return (
      <div className="sgr-root">
        <div className="sgr-app">
          <div className="sgr-screen">
            <div className="sgr-title-block">
              <h1>接続エラー</h1>
              <p>Firebaseの設定が正しくないため、オンライン対戦を開始できません。.env.local を確認してください。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (roomCode) {
    return (
      <div className="sgr-root">
        <GameRoom code={roomCode} uid={uid} myName={trimmedName} onLeaveRoom={handleLeaveRoom} />
      </div>
    );
  }

  return (
    <div className="sgr-root">
      <div className="sgr-app">
        <div className="sgr-screen">
          <div className="sgr-title-block">
            <span className="sgr-eyebrow">💰</span>
            <h1>マネー双六 オンライン</h1>
            <p>友達とルームを作って、リアルタイムで100マスの人生ゲームを遊ぼう。</p>
          </div>

          <div className="sgr-card">
            <div className="sgr-field">
              <label>あなたの名前</label>
              <input
                className="sgr-input"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 12))}
                placeholder="プレイヤー名"
                maxLength={12}
              />
            </div>

            <div className="sgr-tabs">
              <button className={"sgr-tab" + (tab === "create" ? " sgr-active" : "")} onClick={() => setTab("create")}>
                ルームを作る
              </button>
              <button className={"sgr-tab" + (tab === "join" ? " sgr-active" : "")} onClick={() => setTab("join")}>
                コードで参加
              </button>
            </div>

            {tab === "create" ? (
              <button className="sgr-btn" disabled={!canSubmit} onClick={handleCreate}>
                {busy ? "作成中…" : "新しいルームを作る"}
              </button>
            ) : (
              <>
                <div className="sgr-field">
                  <label>ルームコード</label>
                  <input
                    className="sgr-input sgr-code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="ABCD"
                  />
                </div>
                <button className="sgr-btn" disabled={!canSubmit} onClick={handleJoin}>
                  {busy ? "参加中…" : "このルームに参加"}
                </button>
              </>
            )}
            <div className="sgr-error">{error}</div>
          </div>

          <div className="sgr-rules-list">
            <div>🏢 <b>就職マス</b>：サイコロで職業がランダムに決定</div>
            <div>💴 <b>給料日マス</b>：全員が同時に投資額を決める（他のプレイヤーの決定を待ちます）</div>
            <div>💍 <b>人生の一大イベントマス</b>：結婚・転職・独立など、出目で家計が変わる</div>
            <div>👶 <b>子作りマス</b>：五分五分の運。成功すると他の全員からお祝い金がもらえる</div>
            <div>🔀 <b>分かれ道マス</b>：一攫千金コースか堅実コースを選べる</div>
            <div>🏘️ <b>マイホームマス</b>：ゴール後に売却して精算</div>
            <div>🎫 <b>宝くじマス</b>／💎 <b>お宝マス</b>：ゴール後の抽選・換金でお楽しみ</div>
            <div>2〜4人でプレイ可能。はじめの所持金は全員 <b>500万円</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}
