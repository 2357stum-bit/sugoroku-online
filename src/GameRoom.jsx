import { useEffect, useState } from "react";
import {
  subscribeRoom,
  startGame,
  advanceToLottery,
  advanceToFinal,
  resetToLobby,
} from "./roomEngine.js";
import { getTheme } from "./boardData.js";
import PlayingScreen from "./PlayingScreen.jsx";
import { getRanking } from "./gameLogic.js";
import GameTopBar from "./ui/TopBar.jsx";

function LobbyScreen({ room, code, uid, theme, onLeaveRoom }) {
  const isHost = room.hostUid === uid;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    setBusy(true);
    setError("");
    try {
      await startGame(code, uid);
    } catch (e) {
      setError(e.message || "開始に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sgr-app">
      <div className="sgr-screen">
        <div className="sgr-title-block">
          <span className="sgr-eyebrow">{theme.eyebrowIcon}</span>
          <h1>ルームで待機中</h1>
          <p>{theme.name}</p>
        </div>
        <div className="sgr-room-code">
          このコードを友達に共有してね
          <br />
          <b>{code}</b>
        </div>
        <div className="sgr-card">
          <h2>参加プレイヤー（{room.players.length}/4）</h2>
          <div className="sgr-lobby-players">
            {room.players.map((p) => (
              <div key={p.id} className="sgr-lobby-player">
                <span className="sgr-tok">{p.token}</span>
                <span className="sgr-nm">{p.name}{p.id === uid ? "（あなた）" : ""}</span>
                {p.id === room.hostUid && <span className="sgr-host-badge">ホスト</span>}
              </div>
            ))}
          </div>
        </div>
        {isHost ? (
          <>
            <button className="sgr-btn" disabled={busy} onClick={handleStart}>
              {busy ? "開始中…" : "ゲームを開始する"}
            </button>
            {room.players.length < 2 && (
              <div className="sgr-error" style={{ color: "var(--sgr-muted)" }}>
                1人でも試しに遊べます。友達を待つ場合はコードを共有してね。
              </div>
            )}
          </>
        ) : (
          <div className="sgr-error" style={{ color: "var(--sgr-muted)" }}>
            ホストが開始するのを待っています…
          </div>
        )}
        <div className="sgr-error">{error}</div>
        <button className="sgr-btn sgr-secondary sgr-small" onClick={onLeaveRoom}>
          ルームを退出する
        </button>
      </div>
    </div>
  );
}

function SettlementScreen({ room, code, uid, theme, onLeaveRoom }) {
  const [busy, setBusy] = useState(false);
  const unit = theme.currencyUnit;
  return (
    <div className="sgr-app">
      <GameTopBar title={theme.name} code={code} uid={uid} hostUid={room.hostUid} onLeaveRoom={onLeaveRoom} />
      <div className="sgr-screen">
        <div className="sgr-title-block">
          <span className="sgr-eyebrow">📋</span>
          <h1>最終精算</h1>
          <p>{theme.labels.investVerb}・{theme.labels.homeSquareName}・お宝カードを精算したよ</p>
        </div>
        <div>
          {room.players.map((p) => {
            const investLine = p.invested > 0
              ? `${theme.labels.investVerb} ${p.invested}${unit} → ${p.investPayout}${unit}（${p.investGain >= 0 ? "+" : ""}${p.investGain}${unit}）`
              : `${theme.labels.investVerb}はしなかった`;
            const homeLine = p.home
              ? p.home.baseValue > 0
                ? `${p.home.label}を売却 → +${p.homeSaleValue}${unit}`
                : `${p.home.label}（売却益なし）`
              : `${theme.labels.homeSquareName}は選ばなかった`;
            const treasureLine = p.cards.length ? `お宝${p.cards.length}個換金 → +${p.treasureSum}${unit}` : "お宝カードはなし";
            return (
              <div key={p.id} className="sgr-settle-row">
                <div className="sgr-settle-head"><span>{p.token}</span><span>{p.name}</span></div>
                <div className="sgr-settle-line">💹 {investLine}</div>
                <div className="sgr-settle-line">{theme.icon.homepurchase} {homeLine}</div>
                <div className="sgr-settle-line">💎 {treasureLine}</div>
                {p.cards.length > 0 && (
                  <div className="sgr-settle-detail">{p.cards.map((c) => `${c.name} ${c.value}${unit}`).join("　/　")}</div>
                )}
                <div className="sgr-settle-money">現在の所持{unit === "G" ? "ゴールド" : "金"} {p.money}{unit}</div>
              </div>
            );
          })}
        </div>
        <button
          className="sgr-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await advanceToLottery(code);
            } finally {
              setBusy(false);
            }
          }}
        >
          {theme.labels.lotteryFinaleName}へ
        </button>
      </div>
    </div>
  );
}

function LotteryScreen({ room, code, uid, theme, onLeaveRoom }) {
  const [busy, setBusy] = useState(false);
  const unit = theme.currencyUnit;
  const winningNumber = room.lottery?.winningNumber || "----";
  return (
    <div className="sgr-app">
      <GameTopBar title={theme.name} code={code} uid={uid} hostUid={room.hostUid} onLeaveRoom={onLeaveRoom} />
      <div className="sgr-screen">
        <div className="sgr-title-block">
          <span className="sgr-eyebrow">🎰</span>
          <h1>{theme.labels.lotteryFinaleName}</h1>
        </div>
        <div className="sgr-winning-number">{theme.labels.winningLabel}：{winningNumber}</div>
        <div className="sgr-lottery-summary">
          {room.players.map((p) => (
            <div key={p.id} className="sgr-lot-line">
              <span>{p.token} {p.name}</span>
              <span>{p.lotteryTickets.length}枚 → +{p.lotteryReward}{unit}</span>
            </div>
          ))}
        </div>
        <button
          className="sgr-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await advanceToFinal(code);
            } finally {
              setBusy(false);
            }
          }}
        >
          最終結果を見る
        </button>
      </div>
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉", "🎗️"];

function FinalScreen({ room, code, uid, theme, onLeaveRoom }) {
  const sorted = getRanking(room.players);
  const isHost = room.hostUid === uid;
  const [busy, setBusy] = useState(false);
  const unit = theme.currencyUnit;
  return (
    <div className="sgr-app">
      <div className="sgr-screen">
        <div style={{ textAlign: "center", fontSize: 38 }}>🏆</div>
        <h2 style={{ textAlign: "center" }}>{sorted[0].name} の大勝利！</h2>
        <div className="sgr-rank-list">
          {sorted.map((p, i) => (
            <div key={p.id} className="sgr-rank-row">
              <div className="sgr-head">
                <div className="sgr-medal">{MEDALS[i] || "・"}</div>
                <div className="sgr-tok">{p.token}</div>
                <div className="sgr-nm">{p.name}{p.job ? `（${p.job.name}）` : ""}</div>
                <div className={"sgr-total " + (p.money >= 0 ? "sgr-pos" : "sgr-neg")}>{p.money}{unit}</div>
              </div>
              <div className="sgr-breakdown">
                🏁ゴールボーナス +{p.finishBonus}{unit}　／　💹{theme.labels.investVerb} {p.investGain >= 0 ? "+" : ""}{p.investGain}{unit}　／　{theme.icon.homepurchase}{theme.labels.homeSquareName} +{p.homeSaleValue}{unit}
                <br />
                💎お宝 +{p.treasureSum}{unit}　／　{theme.icon.lottery}{theme.labels.lotteryItemName} +{p.lotteryReward}{unit}
              </div>
            </div>
          ))}
        </div>
        {isHost && (
          <button
            className="sgr-btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await resetToLobby(code, uid);
              } finally {
                setBusy(false);
              }
            }}
          >
            もう一度あそぶ
          </button>
        )}
        <button className="sgr-btn sgr-secondary sgr-small" onClick={onLeaveRoom}>
          ルームを退出する
        </button>
      </div>
    </div>
  );
}

export default function GameRoom({ code, uid, onLeaveRoom, onThemeId }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = subscribeRoom(
      code,
      (data) => setRoom(data),
      (e) => setError(e.message || "接続エラーが発生しました")
    );
    return unsub;
  }, [code]);

  useEffect(() => {
    if (room?.themeId && onThemeId) onThemeId(room.themeId);
  }, [room?.themeId, onThemeId]);

  if (error) {
    return (
      <div className="sgr-app">
        <div className="sgr-screen">
          <div className="sgr-title-block">
            <h1>エラー</h1>
            <p>{error}</p>
          </div>
          <button className="sgr-btn" onClick={onLeaveRoom}>ホームに戻る</button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="sgr-app">
        <div className="sgr-screen">
          <div className="sgr-title-block">
            <h1>読み込み中…</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!room.players.some((p) => p.id === uid) && room.status === "lobby") {
    return (
      <div className="sgr-app">
        <div className="sgr-screen">
          <div className="sgr-title-block">
            <h1>ルームが見つかりません</h1>
            <p>コード「{code}」のルームには参加していません。</p>
          </div>
          <button className="sgr-btn" onClick={onLeaveRoom}>ホームに戻る</button>
        </div>
      </div>
    );
  }

  const theme = getTheme(room.themeId);

  switch (room.status) {
    case "lobby":
      return <LobbyScreen room={room} code={code} uid={uid} theme={theme} onLeaveRoom={onLeaveRoom} />;
    case "playing":
      return <PlayingScreen room={room} code={code} uid={uid} onLeaveRoom={onLeaveRoom} />;
    case "settlement":
      return <SettlementScreen room={room} code={code} uid={uid} theme={theme} onLeaveRoom={onLeaveRoom} />;
    case "lottery":
      return <LotteryScreen room={room} code={code} uid={uid} theme={theme} onLeaveRoom={onLeaveRoom} />;
    case "finished":
      return <FinalScreen room={room} code={code} uid={uid} theme={theme} onLeaveRoom={onLeaveRoom} />;
    default:
      return null;
  }
}
