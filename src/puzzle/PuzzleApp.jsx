import { useEffect, useMemo, useState } from "react";
import "../sugoroku.css";
import "./puzzle.css";
import { authReady } from "../firebase.js";
import {
  createRoom,
  joinRoom,
  subscribeRoom,
  startGame,
  resetLevel,
  nextLevel,
  backToLobby,
  deleteRoom,
} from "./puzzleRoom.js";
import { LEVELS, getLevelList } from "./puzzleEngine.js";
import PuzzleBoard from "./PuzzleBoard.jsx";

const NAME_KEY = "pzl_name";
const ROOM_KEY = "pzl_room";

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

function Lobby({ room, uid, onStart, onLeave, busy }) {
  const isHost = room.hostUid === uid;
  const guestReady = !!room.guestUid;
  const levelIdx = LEVELS.findIndex((l) => l.id === room.levelId);

  return (
    <div className="sgr-card">
      <div className="sgr-field">
        <label>ルームコード</label>
        <div className="pzl-room-code">{room.code}</div>
        <p className="pzl-hint-text">このコードを相方に伝えて「コードで参加」してもらおう(ひとりでもプレイできます)</p>
      </div>
      <div className="pzl-lobby-slots">
        <div className="pzl-slot pzl-slot-filled">
          <span className="pzl-slot-icon">🧑</span>
          <span className="pzl-slot-name">{room.hostName || "..."}</span>
          <span className="pzl-slot-tag">ホスト</span>
        </div>
        <div className={"pzl-slot" + (guestReady ? " pzl-slot-filled" : "")}>
          <span className="pzl-slot-icon">{guestReady ? "🧑‍🦰" : "⏳"}</span>
          <span className="pzl-slot-name">{room.guestName || "参加待ち…"}</span>
          <span className="pzl-slot-tag">ゲスト</span>
        </div>
      </div>
      <p className="pzl-hint-text">さいしょのステージ: {LEVELS[Math.max(levelIdx, 0)]?.name || LEVELS[0].name}</p>
      {isHost ? (
        <button className="sgr-btn" disabled={busy} onClick={onStart}>
          {busy ? "開始中…" : guestReady ? "ゲーム開始" : "ひとりで始める(2キャラを操作)"}
        </button>
      ) : (
        <p className="pzl-hint-text">ホストが開始するのを待っています…</p>
      )}
      <button className="sgr-btn sgr-secondary" onClick={onLeave}>
        退出する
      </button>
    </div>
  );
}

function ClearScreen({ room, uid, onNext, onReplay, onLeave, busy }) {
  const isHost = room.hostUid === uid;
  const levelIdx = LEVELS.findIndex((l) => l.id === room.levelId);
  const isLast = levelIdx === LEVELS.length - 1;

  return (
    <div className="sgr-card pzl-result-card">
      <div className="pzl-result-icon">🎉</div>
      <h2 className="pzl-result-title">ステージクリア！</h2>
      <p className="pzl-result-score">てかず {room.game?.moves ?? 0}</p>
      {isHost ? (
        <>
          {!isLast ? (
            <button className="sgr-btn" disabled={busy} onClick={onNext}>
              {busy ? "準備中…" : "次のステージへ"}
            </button>
          ) : (
            <p className="pzl-hint-text">全ステージクリア！おめでとう🎊</p>
          )}
          <button className="sgr-btn sgr-secondary" disabled={busy} onClick={onReplay}>
            もう一度あそぶ
          </button>
        </>
      ) : (
        <p className="pzl-hint-text">ホストの操作を待っています…</p>
      )}
      <button className="sgr-btn sgr-secondary" onClick={onLeave}>
        退出する
      </button>
    </div>
  );
}

export default function PuzzleApp() {
  const [uid, setUid] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [tab, setTab] = useState("create");
  const [joinCode, setJoinCode] = useState(() => readQuery().get("room") || "");
  const [roomCode, setRoomCode] = useState(() => readQuery().get("room") || localStorage.getItem(ROOM_KEY) || "");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authReady.then((user) => setUid(user.uid)).catch((e) => setAuthError(e));
  }, []);

  useEffect(() => {
    document.title = "きょうどうパズル オンライン";
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

  const trimmedName = name.trim() || "プレイヤー";
  const canSubmit = useMemo(() => !!uid && !busy, [uid, busy]);
  const levelMeta = room?.game ? LEVELS.find((l) => l.id === room.game.levelId) : null;

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

  async function handleSoloStart() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const code = await createRoom(uid, trimmedName);
      await startGame(code, uid);
      localStorage.setItem(ROOM_KEY, code);
      setUrlRoom(code);
      setRoomCode(code);
    } catch (e) {
      setError(e.message || "開始に失敗しました");
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
  }

  async function handleStart() {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      await startGame(room.code, uid);
    } catch (e) {
      setError(e.message || "開始に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleNext() {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      await nextLevel(room.code, uid);
    } catch (e) {
      setError(e.message || "次のステージへ進めませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function handleReplay() {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      await resetLevel(room.code, uid);
    } catch (e) {
      setError(e.message || "リセットに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (authError) {
    return (
      <div className="sgr-root" data-theme="puzzle">
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
    const myIdx = isHost ? 0 : 1;
    return (
      <div className="sgr-root" data-theme="puzzle">
        <div className="sgr-app">
          <div className="sgr-screen">
            <div className="sgr-title-block pzl-title-block-compact">
              <span className="sgr-eyebrow">🧩</span>
              <h1>きょうどうパズル{levelMeta ? ` - ${levelMeta.name}` : ""}</h1>
            </div>
            {room.status === "lobby" && <Lobby room={room} uid={uid} onStart={handleStart} onLeave={handleLeaveRoom} busy={busy} />}
            {room.status === "playing" && room.game && (
              <PuzzleBoard
                room={room}
                code={room.code}
                uid={uid}
                myIdx={myIdx}
                isSolo={!room.guestUid}
                hint={levelMeta?.hint}
              />
            )}
            {room.status === "cleared" && (
              <ClearScreen room={room} uid={uid} onNext={handleNext} onReplay={handleReplay} onLeave={handleLeaveRoom} busy={busy} />
            )}
            <div className="sgr-error">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sgr-root" data-theme="puzzle">
      <div className="sgr-app">
        <div className="sgr-screen">
          <div className="sgr-title-block">
            <span className="sgr-eyebrow">🧩</span>
            <h1>きょうどうパズル オンライン</h1>
            <p>相方と2人で同じ盤面を見ながら、箱を目的地まで押していこう。</p>
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
              <>
                <button className="sgr-btn" disabled={!canSubmit} onClick={handleCreate}>
                  {busy ? "作成中…" : "新しいルームを作る"}
                </button>
                <button className="sgr-btn sgr-secondary" disabled={!canSubmit} onClick={handleSoloStart}>
                  ひとりで遊ぶ(2キャラを操作)
                </button>
              </>
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
            <div>🧩 <b>操作</b>：矢印キー/WASD、または画面下の十字ボタンで移動。</div>
            <div>🤝 <b>人数</b>：1人で2キャラを切り替えて操作するもよし、2人協力プレイもよし。</div>
            <div>◆ <b>スイッチ</b>：誰か(箱でも可)が乗っている間だけ、対応する扉が開く。</div>
            <div>📦 <b>目標</b>：すべての箱を目的地(黄色いマス)まで運べばクリア。</div>
          </div>

          <a className="pzl-back-link" href="/">
            ← すごろくオンラインへ戻る
          </a>
          <a className="pzl-back-link" href="/shooter">
            🚀 きょうどうシューティングもあそべます →
          </a>
        </div>
      </div>
    </div>
  );
}
