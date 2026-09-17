import { useEffect, useMemo, useState } from "react";
import "../sugoroku.css";
import "./shooter.css";
import { authReady } from "../firebase.js";
import { createRoom, joinRoom, subscribeRoom, startGame, resetToLobby, deleteRoom } from "./shooterRoom.js";
import { createInitialState } from "./shooterEngine.js";
import GameCanvas from "./GameCanvas.jsx";

const NAME_KEY = "sgt_name";
const ROOM_KEY = "sgt_room";

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

function Lobby({ room, uid, myName, onStart, onLeave, busy }) {
  const isHost = room.hostUid === uid;
  const hostReady = !!room.hostUid;
  const guestReady = !!room.guestUid;
  const canStart = isHost && hostReady && guestReady && !busy;

  return (
    <div className="sgr-card">
      <div className="sgr-field">
        <label>ルームコード</label>
        <div className="sgt-room-code">{room.code}</div>
        <p className="sgt-hint-text">このコードを相方に伝えて「コードで参加」してもらおう</p>
      </div>
      <div className="sgt-lobby-slots">
        <div className={"sgt-slot" + (hostReady ? " sgt-slot-filled" : "")}>
          <span className="sgt-slot-icon">🧑‍🚀</span>
          <span className="sgt-slot-name">{room.hostName || "..."}</span>
          <span className="sgt-slot-tag">ホスト</span>
        </div>
        <div className={"sgt-slot" + (guestReady ? " sgt-slot-filled" : "")}>
          <span className="sgt-slot-icon">{guestReady ? "🧑‍🚀" : "⏳"}</span>
          <span className="sgt-slot-name">{room.guestName || "参加待ち…"}</span>
          <span className="sgt-slot-tag">ゲスト</span>
        </div>
      </div>
      {isHost ? (
        <button className="sgr-btn" disabled={!canStart} onClick={onStart}>
          {!guestReady ? "相方の参加を待っています…" : busy ? "開始中…" : "ゲーム開始"}
        </button>
      ) : (
        <p className="sgt-hint-text">ホストが開始するのを待っています…</p>
      )}
      <button className="sgr-btn sgr-secondary" onClick={onLeave}>
        退出する
      </button>
    </div>
  );
}

function ResultScreen({ result, score, room, uid, onRematch, onLeave, busy }) {
  const isHost = room.hostUid === uid;
  return (
    <div className="sgr-card sgt-result-card">
      <div className="sgt-result-icon">{result === "victory" ? "🏆" : "💥"}</div>
      <h2 className="sgt-result-title">{result === "victory" ? "ボス撃破！" : "全滅…"}</h2>
      <p className="sgt-result-score">スコア {score}</p>
      {isHost ? (
        <button className="sgr-btn" disabled={busy} onClick={onRematch}>
          {busy ? "準備中…" : "もう一度あそぶ"}
        </button>
      ) : (
        <p className="sgt-hint-text">ホストが「もう一度あそぶ」を選ぶとロビーに戻ります</p>
      )}
      <button className="sgr-btn sgr-secondary" onClick={onLeave}>
        退出する
      </button>
    </div>
  );
}

export default function ShooterApp() {
  const [uid, setUid] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [tab, setTab] = useState("create");
  const [joinCode, setJoinCode] = useState(() => readQuery().get("room") || "");
  const [roomCode, setRoomCode] = useState(() => readQuery().get("room") || localStorage.getItem(ROOM_KEY) || "");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [localResult, setLocalResult] = useState(null);

  useEffect(() => {
    authReady.then((user) => setUid(user.uid)).catch((e) => setAuthError(e));
  }, []);

  useEffect(() => {
    document.title = "きょうどうシューティング オンライン";
  }, []);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  useEffect(() => {
    if (!roomCode) {
      setRoom(null);
      return;
    }
    const unsub = subscribeRoom(
      roomCode,
      (data) => {
        if (!data) {
          setError("ルームが見つかりませんでした");
          setRoomCode("");
          localStorage.removeItem(ROOM_KEY);
          setUrlRoom(null);
          return;
        }
        setRoom(data);
      },
      () => setError("通信エラーが発生しました")
    );
    return unsub;
  }, [roomCode]);

  useEffect(() => {
    if (room?.status === "lobby") setLocalResult(null);
  }, [room?.status]);

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
    if (room && room.hostUid === uid) deleteRoom(room.code, uid).catch(() => {});
    localStorage.removeItem(ROOM_KEY);
    setUrlRoom(null);
    setRoomCode("");
    setRoom(null);
    setLocalResult(null);
  }

  async function handleStart() {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      const uids = [room.hostUid, room.guestUid].filter(Boolean);
      await startGame(room.code, uid, createInitialState(uids));
    } catch (e) {
      setError(e.message || "開始に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleRematch() {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      await resetToLobby(room.code, uid);
      setLocalResult(null);
    } catch (e) {
      setError(e.message || "リセットに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function handleGameResult(result, score) {
    setLocalResult({ result, score });
  }

  if (authError) {
    return (
      <div className="sgr-root" data-theme="shooter">
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

  if (roomCode && room) {
    const isHost = room.hostUid === uid;
    const showResult = localResult || room.status === "ended";
    return (
      <div className="sgr-root" data-theme="shooter">
        <div className="sgr-app">
          <div className="sgr-screen">
            <div className="sgr-title-block sgt-title-block-compact">
              <span className="sgr-eyebrow">🚀</span>
              <h1>きょうどうシューティング</h1>
            </div>
            {room.status === "lobby" && (
              <Lobby room={room} uid={uid} myName={trimmedName} onStart={handleStart} onLeave={handleLeaveRoom} busy={busy} />
            )}
            {room.status === "playing" && !localResult && (
              <GameCanvas room={room} code={room.code} uid={uid} isHost={isHost} onResult={handleGameResult} />
            )}
            {showResult && (
              <ResultScreen
                result={localResult?.result || (room.hostState?.result ?? "gameover")}
                score={localResult?.score ?? room.hostState?.score ?? 0}
                room={room}
                uid={uid}
                onRematch={handleRematch}
                onLeave={handleLeaveRoom}
                busy={busy}
              />
            )}
            <div className="sgr-error">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sgr-root" data-theme="shooter">
      <div className="sgr-app">
        <div className="sgr-screen">
          <div className="sgr-title-block">
            <span className="sgr-eyebrow">🚀</span>
            <h1>きょうどうシューティング オンライン</h1>
            <p>相方と2人で参加して、迫りくる敵をかわしながらボスを倒そう。</p>
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
            <div>🚀 <b>操作</b>：矢印キー/WASD、またはドラッグで自機を移動。弾は自動発射。</div>
            <div>🤝 <b>人数</b>：2人協力プレイ。ホストが部屋を作り、ゲストがコードで参加する。</div>
            <div>👹 <b>目標</b>：迫りくる敵をかわし、最後に現れるボスを倒せばクリア。</div>
            <div>❤️ <b>ライフ</b>：3ライフ制。全員のライフが尽きるとゲームオーバー。</div>
          </div>

          <a className="sgt-back-link" href="/">
            ← すごろくオンラインへ戻る
          </a>
        </div>
      </div>
    </div>
  );
}
