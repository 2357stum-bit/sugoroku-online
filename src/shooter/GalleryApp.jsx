import { useEffect, useMemo, useState } from "react";
import "../sugoroku.css";
import "./gallery.css";
import { authReady } from "../firebase.js";
import { createRoom, joinRoom, subscribeRoom, startGame, resetToLobby, deleteRoom } from "./galleryRoom.js";
import { STAGES, RANKS, getRank } from "./galleryEngine.js";
import { primeAudio } from "./galleryAudio.js";
import GalleryCanvas from "./GalleryCanvas.jsx";
import GallerySoundToggle from "./GallerySoundToggle.jsx";

const NAME_KEY = "gly_name";
const ROOM_KEY = "gly_room";

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
  const hostReady = !!room.hostUid;
  const guestReady = !!room.guestUid;

  return (
    <div className="sgr-card">
      <div className="sgr-field">
        <label>ルームコード</label>
        <div className="gly-room-code">{room.code}</div>
        <p className="gly-hint-text">このコードを相方に伝えて「コードで参加」してもらおう(ひとりでもプレイできます)</p>
      </div>
      <div className="gly-lobby-slots">
        <div className={"gly-slot" + (hostReady ? " gly-slot-filled" : "")}>
          <span className="gly-slot-icon">🎪</span>
          <span className="gly-slot-name">{room.hostName || "..."}</span>
          <span className="gly-slot-tag">ホスト</span>
        </div>
        <div className={"gly-slot" + (guestReady ? " gly-slot-filled" : "")}>
          <span className="gly-slot-icon">{guestReady ? "🎪" : "⏳"}</span>
          <span className="gly-slot-name">{room.guestName || "参加待ち…"}</span>
          <span className="gly-slot-tag">ゲスト</span>
        </div>
      </div>
      {isHost ? (
        <button className="sgr-btn" disabled={busy} onClick={onStart}>
          {busy ? "開始中…" : guestReady ? "ゲーム開始(同時スタート)" : "ひとりで始める"}
        </button>
      ) : (
        <p className="gly-hint-text">ホストが開始するのを待っています…</p>
      )}
      <button className="sgr-btn sgr-secondary" onClick={onLeave}>
        退出する
      </button>
    </div>
  );
}

function ResultScreen({ myScore, room, uid, onRematch, onLeave, busy }) {
  const isHost = room.hostUid === uid;
  const otherUid = room.hostUid === uid ? room.guestUid : room.hostUid;
  const otherName = room.hostUid === uid ? room.guestName : room.hostName;
  const otherScore = otherUid ? room.scores?.[otherUid] ?? 0 : null;
  const otherFinished = otherUid ? !!room.finished?.[otherUid] : true;
  const isWin = otherScore != null && myScore > otherScore;
  const isTie = otherScore != null && myScore === otherScore;
  const rank = getRank(myScore);
  const rankIdx = RANKS.indexOf(rank);
  const nextRank = RANKS[rankIdx + 1];

  return (
    <div className="sgr-card gly-result-card">
      <div className="gly-result-icon">{otherScore == null ? "🎯" : isWin ? "🏆" : isTie ? "🤝" : "🥈"}</div>
      <h2 className="gly-result-title">
        {otherScore == null ? "プレイ終了！" : isWin ? "あなたの勝ち！" : isTie ? "引き分け！" : "あと一歩！"}
      </h2>
      <p className="gly-result-score">あなたのスコア {myScore.toLocaleString()}</p>
      {otherUid && (
        <p className="gly-result-score gly-result-score-sub">
          {otherName || "相手"}のスコア {otherFinished ? otherScore.toLocaleString() : "計測中…"}
        </p>
      )}
      <div className="gly-rank-badge">
        <span className="gly-rank-emoji">{rank.emoji}</span>
        <span className="gly-rank-title">{rank.title}</span>
      </div>
      <p className="gly-hint-text">
        {nextRank
          ? `次のランク「${nextRank.emoji} ${nextRank.title}」まであと ${(nextRank.min - myScore).toLocaleString()}点`
          : "全ランク制覇！お見事！"}
      </p>
      {isHost ? (
        <button className="sgr-btn" disabled={busy} onClick={onRematch}>
          {busy ? "準備中…" : "もう一度あそぶ"}
        </button>
      ) : (
        <p className="gly-hint-text">ホストが「もう一度あそぶ」を選ぶとロビーに戻ります</p>
      )}
      <button className="sgr-btn sgr-secondary" onClick={onLeave}>
        退出する
      </button>
    </div>
  );
}

export default function GalleryApp() {
  const [uid, setUid] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [tab, setTab] = useState("create");
  const [joinCode, setJoinCode] = useState(() => readQuery().get("room") || "");
  const [roomCode, setRoomCode] = useState(() => readQuery().get("room") || localStorage.getItem(ROOM_KEY) || "");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [localScore, setLocalScore] = useState(null);

  useEffect(() => {
    authReady.then((user) => setUid(user.uid)).catch((e) => setAuthError(e));
  }, []);

  // ブラウザの自動再生制限のため、最初のユーザー操作でオーディオを起動する
  useEffect(() => {
    const handler = () => {
      primeAudio();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  useEffect(() => {
    document.title = "おもちゃ箱シューティングギャラリー";
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
    if (room?.status === "lobby") setLocalScore(null);
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
    setLocalScore(null);
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

  async function handleRematch() {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      await resetToLobby(room.code, uid);
      setLocalScore(null);
    } catch (e) {
      setError(e.message || "リセットに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function handleFinished(score) {
    setLocalScore(score);
  }

  if (authError) {
    return (
      <div className="sgr-root" data-theme="gallery">
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
    const showResult = localScore != null;
    return (
      <div className="sgr-root" data-theme="gallery">
        <div className="sgr-app">
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 18px 0" }}>
            <GallerySoundToggle />
          </div>
          <div className="sgr-screen">
            <div className="sgr-title-block gly-title-block-compact">
              <span className="sgr-eyebrow">🎪</span>
              <h1>おもちゃ箱シューティングギャラリー</h1>
            </div>
            {room.status === "lobby" && <Lobby room={room} uid={uid} onStart={handleStart} onLeave={handleLeaveRoom} busy={busy} />}
            {room.status === "playing" && !showResult && (
              <GalleryCanvas room={room} code={room.code} uid={uid} onFinished={handleFinished} />
            )}
            {showResult && (
              <ResultScreen
                myScore={localScore}
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
    <div className="sgr-root" data-theme="gallery">
      <div className="sgr-app">
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 18px 0" }}>
          <GallerySoundToggle />
        </div>
        <div className="sgr-screen">
          <div className="sgr-title-block">
            <span className="sgr-eyebrow">🎪</span>
            <h1>おもちゃ箱シューティングギャラリー</h1>
            <p>全{STAGES.length}ステージのおもちゃの的当てを撃ちまくって、ハイスコアを目指そう。2人で同時プレイしてスコアを競うこともできる。</p>
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
                  ひとりで遊ぶ
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
            <div>🎯 <b>操作</b>：狙った場所をタップ/クリックで発射(または矢印キー+スペース)。</div>
            <div>🎪 <b>人数</b>：1人でハイスコア狙いもよし、2人同時プレイでスコアを競うのもよし。</div>
            <div>🏆 <b>目標</b>：全{STAGES.length}ステージ、制限時間内にできるだけ多くの的を撃ち抜いて高得点を狙おう。</div>
            <div>🔥 <b>コンボ</b>：連続ヒットで得点倍率アップ。外すとコンボはリセット。</div>
            <div>👑 <b>ランク</b>：通算スコアで🎈〜👑の7段階ランクが決まる。最高ランクは「でんせつ」！</div>
          </div>

          <a className="gly-back-link" href="/">
            ← すごろくオンラインへ戻る
          </a>
          <a className="gly-back-link" href="/puzzle">
            🧩 きょうどうパズルもあそべます →
          </a>
        </div>
      </div>
    </div>
  );
}
