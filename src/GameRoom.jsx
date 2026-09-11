import { useEffect, useState } from "react";
import {
  subscribeRoom,
  startGame,
  advanceToLottery,
  advanceToFinal,
  resetToLobby,
} from "./roomEngine.js";
import PlayingScreen from "./PlayingScreen.jsx";
import { getRanking } from "./gameLogic.js";

function LobbyScreen({ room, code, uid, onLeaveRoom }) {
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
          <span className="sgr-eyebrow">💰</span>
          <h1>ルームで待機中</h1>
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
          <button className="sgr-btn" disabled={busy || room.players.length < 2} onClick={handleStart}>
            {room.players.length < 2 ? "2人以上で開始できます" : busy ? "開始中…" : "ゲームを開始する"}
          </button>
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

function SettlementScreen({ room, code, uid }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sgr-app">
      <div className="sgr-screen">
        <div className="sgr-title-block">
          <span className="sgr-eyebrow">📋</span>
          <h1>最終精算</h1>
          <p>投資・不動産・お宝カードを精算したよ</p>
        </div>
        <div>
          {room.players.map((p) => {
            const investLine = p.invested > 0
              ? `投資 ${p.invested}万円 → ${p.investPayout}万円（${p.investGain >= 0 ? "+" : ""}${p.investGain}万円）`
              : "投資はしなかった";
            const homeLine = p.home
              ? p.home.baseValue > 0
                ? `${p.home.label}を売却 → +${p.homeSaleValue}万円`
                : `${p.home.label}（売却益なし）`
              : "マイホームは購入しなかった";
            const treasureLine = p.cards.length ? `お宝${p.cards.length}個換金 → +${p.treasureSum}万円` : "お宝カードはなし";
            return (
              <div key={p.id} className="sgr-settle-row">
                <div className="sgr-settle-head"><span>{p.token}</span><span>{p.name}</span></div>
                <div className="sgr-settle-line">💹 {investLine}</div>
                <div className="sgr-settle-line">🏘️ {homeLine}</div>
                <div className="sgr-settle-line">💎 {treasureLine}</div>
                {p.cards.length > 0 && (
                  <div className="sgr-settle-detail">{p.cards.map((c) => `${c.name} ${c.value}万円`).join("　/　")}</div>
                )}
                <div className="sgr-settle-money">現在の所持金 {p.money}万円</div>
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
          宝くじ抽選会へ
        </button>
      </div>
    </div>
  );
}

function LotteryScreen({ room, code }) {
  const [busy, setBusy] = useState(false);
  const winningNumber = room.lottery?.winningNumber || "----";
  return (
    <div className="sgr-app">
      <div className="sgr-screen">
        <div className="sgr-title-block">
          <span className="sgr-eyebrow">🎰</span>
          <h1>宝くじ抽選会</h1>
        </div>
        <div className="sgr-winning-number">当選番号：{winningNumber}</div>
        <div className="sgr-lottery-summary">
          {room.players.map((p) => (
            <div key={p.id} className="sgr-lot-line">
              <span>{p.token} {p.name}</span>
              <span>{p.lotteryTickets.length}枚 → +{p.lotteryReward}万円</span>
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

function FinalScreen({ room, code, uid, onLeaveRoom }) {
  const sorted = getRanking(room.players);
  const isHost = room.hostUid === uid;
  const [busy, setBusy] = useState(false);
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
                <div className={"sgr-total " + (p.money >= 0 ? "sgr-pos" : "sgr-neg")}>{p.money}万円</div>
              </div>
              <div className="sgr-breakdown">
                🏁ゴールボーナス +{p.finishBonus}万円　／　💹投資 {p.investGain >= 0 ? "+" : ""}{p.investGain}万円　／　🏘️不動産 +{p.homeSaleValue}万円
                <br />
                💎お宝 +{p.treasureSum}万円　／　🎫宝くじ +{p.lotteryReward}万円
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

export default function GameRoom({ code, uid, onLeaveRoom }) {
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

  switch (room.status) {
    case "lobby":
      return <LobbyScreen room={room} code={code} uid={uid} onLeaveRoom={onLeaveRoom} />;
    case "playing":
      return <PlayingScreen room={room} code={code} uid={uid} />;
    case "settlement":
      return <SettlementScreen room={room} code={code} uid={uid} />;
    case "lottery":
      return <LotteryScreen room={room} code={code} />;
    case "finished":
      return <FinalScreen room={room} code={code} uid={uid} onLeaveRoom={onLeaveRoom} />;
    default:
      return null;
  }
}
