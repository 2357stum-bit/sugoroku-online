import { useEffect, useMemo, useState } from "react";
import "../sugoroku.css";
import "./cards.css";
import { authReady } from "../firebase.js";
import {
  createRoom,
  joinRoom,
  subscribeRoom,
  startGame,
  playCard,
  aiPlayTurn,
  rematch,
  deleteRoom,
  setDeck,
} from "./cardRoom.js";
import { DECK_ARCHETYPES } from "./cardEngine.js";
import CardBoard from "./CardBoard.jsx";

const NAME_KEY = "crd_name";
const ROOM_KEY = "crd_room";
const DECK_KEY = "crd_deck";

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

function opponentLabel(room) {
  if (room.guestUid) return room.guestName || "...";
  return "🤖 AI";
}

function deckMeta(id) {
  return DECK_ARCHETYPES.find((d) => d.id === id) || DECK_ARCHETYPES[0];
}

function DeckPicker({ selectedId, onSelect }) {
  return (
    <div className="sgr-map-grid">
      {DECK_ARCHETYPES.map((d) => (
        <button
          key={d.id}
          type="button"
          className={"sgr-map-card" + (selectedId === d.id ? " sgr-map-card-active" : "")}
          onClick={() => onSelect(d.id)}
        >
          {selectedId === d.id && <span className="sgr-map-card-check">✓</span>}
          <span className="sgr-map-card-icon">{d.icon}</span>
          <span className="sgr-map-card-name">{d.name}</span>
          <span className="sgr-map-card-desc">{d.desc}</span>
        </button>
      ))}
    </div>
  );
}

function Lobby({ room, uid, onStart, onLeave, busy, onPickDeck }) {
  const isHost = room.hostUid === uid;
  const guestReady = !!room.guestUid;
  const myDeckId = isHost ? room.hostDeckId || "balance" : room.guestDeckId || "balance";
  const hostDeck = deckMeta(room.hostDeckId);
  const guestDeck = deckMeta(room.guestDeckId);

  return (
    <div className="sgr-card">
      <div className="sgr-field">
        <label>ルームコード</label>
        <div className="crd-room-code">{room.code}</div>
        <p className="crd-hint-text">このコードを相手に伝えて「コードで参加」してもらおう(参加者がいなければAIと対戦)</p>
      </div>
      <div className="crd-lobby-slots">
        <div className="crd-slot crd-slot-filled">
          <span className="crd-slot-icon">🧑</span>
          <span className="crd-slot-name">{room.hostName || "..."}</span>
          <span className="crd-slot-tag">{hostDeck.icon} {hostDeck.name}</span>
        </div>
        <div className={"crd-slot" + (guestReady ? " crd-slot-filled" : "")}>
          <span className="crd-slot-icon">{guestReady ? "🧑‍🦰" : "⏳"}</span>
          <span className="crd-slot-name">{guestReady ? room.guestName || "..." : "参加待ち…"}</span>
          <span className="crd-slot-tag">{guestReady ? `${guestDeck.icon} ${guestDeck.name}` : "🤖 AI"}</span>
        </div>
      </div>
      <div className="crd-deck-picker-label">あなたのデッキ</div>
      <DeckPicker selectedId={myDeckId} onSelect={onPickDeck} />
      {isHost ? (
        <button className="sgr-btn" disabled={busy} onClick={onStart}>
          {busy ? "開始中…" : guestReady ? "たいせん開始" : "AIと対戦する"}
        </button>
      ) : (
        <p className="crd-hint-text">ホストが開始するのを待っています…</p>
      )}
      <button className="sgr-btn sgr-secondary" onClick={onLeave}>
        退出する
      </button>
    </div>
  );
}

function ResultScreen({ room, uid, onRematch, onLeave, busy }) {
  const isHost = room.hostUid === uid;
  const myIdx = isHost ? 0 : 1;
  const won = room.game.winner === myIdx;

  return (
    <div className="sgr-card crd-result-card">
      <div className="crd-result-icon">{won ? "🏆" : "😢"}</div>
      <h2 className="crd-result-title">{won ? "あなたの勝ち！" : "あなたの負け…"}</h2>
      <p className="crd-result-score">
        あなたのHP {room.game.hp[myIdx]} / 相手のHP {room.game.hp[1 - myIdx]}
      </p>
      {isHost ? (
        <button className="sgr-btn" disabled={busy} onClick={onRematch}>
          {busy ? "準備中…" : "もう一度あそぶ"}
        </button>
      ) : (
        <p className="crd-hint-text">ホストの操作を待っています…</p>
      )}
      <button className="sgr-btn sgr-secondary" onClick={onLeave}>
        退出する
      </button>
    </div>
  );
}

export default function CardApp() {
  const [uid, setUid] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [deckId, setDeckId] = useState(() => localStorage.getItem(DECK_KEY) || "balance");
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
    document.title = "カードバトルアリーナ オンライン";
  }, []);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem(DECK_KEY, deckId);
  }, [deckId]);

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

  // ひとりで遊ぶ(ゲスト不在)場合、AIの手番になったら少し待ってから自動で1手進める。
  useEffect(() => {
    if (!room || room.status !== "playing" || room.guestUid || !room.game) return;
    if (room.game.turn !== 1) return;
    const code = room.code;
    const timer = setTimeout(() => {
      aiPlayTurn(code).catch(() => {});
    }, 900);
    return () => clearTimeout(timer);
  }, [room?.seq, room?.status, room?.guestUid, room?.code]);

  const trimmedName = name.trim() || "プレイヤー";
  const canSubmit = useMemo(() => !!uid && !busy, [uid, busy]);

  async function handleCreate() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const code = await createRoom(uid, trimmedName, deckId);
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
      const code = await createRoom(uid, trimmedName, deckId);
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
      await joinRoom(code, uid, trimmedName, deckId);
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

  function handlePickDeck(id) {
    setDeckId(id);
    if (room && room.status === "lobby") setDeck(room.code, uid, id).catch(() => {});
  }

  async function handlePlayCard(cardId) {
    if (!room) return;
    try {
      await playCard(room.code, uid, cardId);
    } catch (e) {
      setError(e.message || "そのカードは使えません");
    }
  }

  async function handleRematch() {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      await rematch(room.code, uid);
    } catch (e) {
      setError(e.message || "再戦に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (authError) {
    return (
      <div className="sgr-root" data-theme="cards">
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
      <div className="sgr-root" data-theme="cards">
        <div className="sgr-app">
          <div className="sgr-screen">
            <div className="sgr-title-block crd-title-block-compact">
              <span className="sgr-eyebrow">🎴</span>
              <h1>カードバトルアリーナ</h1>
            </div>
            {room.status === "lobby" && (
              <Lobby room={room} uid={uid} onStart={handleStart} onLeave={handleLeaveRoom} busy={busy} onPickDeck={handlePickDeck} />
            )}
            {room.status === "playing" && room.game && (
              <CardBoard
                room={room}
                myIdx={myIdx}
                opponentName={opponentLabel(room)}
                isSolo={!room.guestUid}
                onPlayCard={handlePlayCard}
              />
            )}
            {room.status === "finished" && room.game && (
              <ResultScreen room={room} uid={uid} onRematch={handleRematch} onLeave={handleLeaveRoom} busy={busy} />
            )}
            <div className="sgr-error">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sgr-root" data-theme="cards">
      <div className="sgr-app">
        <div className="sgr-screen">
          <div className="sgr-title-block">
            <span className="sgr-eyebrow">🎴</span>
            <h1>カードバトルアリーナ</h1>
            <p>攻撃・回復・シールドのカードを出し合って、相手のHPを先にゼロにしよう！</p>
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

            <div className="crd-deck-picker-label">デッキを選ぶ</div>
            <DeckPicker selectedId={deckId} onSelect={setDeckId} />

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
                  ひとりで遊ぶ(AI対戦)
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
            <div>🎴 <b>操作</b>：手札からカードをタップして出す。自分の番が来るたびに山札から1枚自動で引く。</div>
            <div>⚔️ <b>こうげき</b>：相手のHPを減らす。🛡️シールドで軽減できる。</div>
            <div>💖 <b>かいふく</b>／🛡️<b>シールド</b>：自分のHPを守る。</div>
            <div>🎯 <b>デッキ</b>：4種類のデッキから戦い方を選べる(こうげき型・ぼうぎょ型など)。</div>
            <div>🏆 <b>目標</b>：相手のHPを先にゼロにしよう(HP30スタート)。</div>
          </div>

          <a className="crd-back-link" href="/">
            ← すごろくオンラインへ戻る
          </a>
          <a className="crd-back-link" href="/shooter">
            🎪 おもちゃ箱シューティングギャラリーもあそべます →
          </a>
          <a className="crd-back-link" href="/puzzle">
            🧩 きょうどうパズルもあそべます →
          </a>
        </div>
      </div>
    </div>
  );
}
