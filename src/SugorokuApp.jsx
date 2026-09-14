import { useEffect, useMemo, useState } from "react";
import "./sugoroku.css";
import { authReady } from "./firebase.js";
import { createRoom, joinRoom } from "./roomEngine.js";
import { THEME_LIST, DEFAULT_THEME_ID, getTheme } from "./boardData.js";
import GameRoom from "./GameRoom.jsx";
import SoundToggle from "./ui/SoundToggle.jsx";
import { primeAudio } from "./audio.js";

const NAME_KEY = "sgr_name";
const ROOM_KEY = "sgr_room";
const THEME_KEY = "sgr_theme";

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

function MapPicker({ themeId, onSelect }) {
  return (
    <div className="sgr-field">
      <label>マップを選ぶ</label>
      <div className="sgr-choice-list">
        {THEME_LIST.map((t) => (
          <button
            key={t.id}
            className={"sgr-choice-btn" + (themeId === t.id ? " sgr-choice-active" : "")}
            onClick={() => onSelect(t.id)}
            type="button"
          >
            <span className="sgr-c-icon">{t.eyebrowIcon}</span>
            <span className="sgr-c-txt">
              <span className="sgr-c-name">{t.name}</span>
              <span className="sgr-c-desc">{t.tagline}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SugorokuApp() {
  const [uid, setUid] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [tab, setTab] = useState("create");
  const [themeId, setThemeId] = useState(() => localStorage.getItem(THEME_KEY) || DEFAULT_THEME_ID);
  const [joinCode, setJoinCode] = useState(() => readQuery().get("room") || "");
  const [roomCode, setRoomCode] = useState(() => readQuery().get("room") || localStorage.getItem(ROOM_KEY) || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authReady.then((user) => setUid(user.uid)).catch((e) => setAuthError(e));
  }, []);

  useEffect(() => {
    document.title = "すごろく オンライン";
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
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, themeId);
  }, [themeId]);

  const trimmedName = name.trim() || "プレイヤー";
  const theme = getTheme(themeId);

  const canSubmit = useMemo(() => !!uid && !busy, [uid, busy]);

  async function handleCreate() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const code = await createRoom(uid, trimmedName, themeId);
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
      <div className="sgr-root" data-theme={theme.css}>
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
      <div className="sgr-root" data-theme={theme.css}>
        <GameRoom code={roomCode} uid={uid} myName={trimmedName} onLeaveRoom={handleLeaveRoom} onThemeId={setThemeId} />
      </div>
    );
  }

  return (
    <div className="sgr-root" data-theme={theme.css}>
      <div className="sgr-app">
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 18px 0" }}>
          <SoundToggle />
        </div>
        <div className="sgr-screen">
          <div className="sgr-title-block">
            <span className="sgr-eyebrow">{theme.eyebrowIcon}</span>
            <h1>{theme.name} オンライン</h1>
            <p>友達とルームを作って、リアルタイムで100マスのすごろくを遊ぼう。</p>
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
                <MapPicker themeId={themeId} onSelect={setThemeId} />
                <button className="sgr-btn" disabled={!canSubmit} onClick={handleCreate}>
                  {busy ? "作成中…" : "新しいルームを作る"}
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
                <p style={{ fontSize: 12, color: "var(--sgr-muted)", margin: "0 0 4px" }}>
                  マップはルームを作った人が選んだものに合わせて参加します。
                </p>
                <button className="sgr-btn" disabled={!canSubmit} onClick={handleJoin}>
                  {busy ? "参加中…" : "このルームに参加"}
                </button>
              </>
            )}
            <div className="sgr-error">{error}</div>
          </div>

          <div className="sgr-rules-list">
            {theme.rules.map((r) => (
              <div key={r.label}>{r.icon} <b>{r.label}</b>：{r.text}</div>
            ))}
            <div>2〜4人でプレイ可能。はじめの所持{theme.currencyUnit === "G" ? "ゴールド" : "金"}は全員 <b>500{theme.currencyUnit}</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}
