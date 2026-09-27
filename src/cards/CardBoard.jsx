import { useEffect, useRef } from "react";

const TYPE_CLASS = {
  attack: "crd-card-attack",
  heal: "crd-card-heal",
  shield: "crd-card-shield",
  draw: "crd-card-draw",
};

function HpBar({ hp, maxHp }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const tone = pct > 50 ? "crd-hp-high" : pct > 25 ? "crd-hp-mid" : "crd-hp-low";
  return (
    <div className="crd-hp-track">
      <div className={"crd-hp-fill " + tone} style={{ width: `${pct}%` }} />
      <span className="crd-hp-label">
        {hp} / {maxHp}
      </span>
    </div>
  );
}

export default function CardBoard({ room, myIdx, opponentName, isSolo, onPlayCard }) {
  const game = room.game;
  const oppIdx = 1 - myIdx;
  const isMyTurn = game.turn === myIdx && game.status === "playing";
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [game.log.length]);

  return (
    <div className="crd-wrap">
      <div className="crd-player-row">
        <div className="crd-player-info">
          <span className="crd-player-name">{opponentName}</span>
          {game.shield[oppIdx] > 0 && <span className="crd-shield-badge">🛡️{game.shield[oppIdx]}</span>}
        </div>
        <HpBar hp={game.hp[oppIdx]} maxHp={game.maxHp} />
        <div className="crd-hand-back">
          {game.hand[oppIdx].map((_, i) => (
            <span key={i} className="crd-card-back">
              🂠
            </span>
          ))}
        </div>
      </div>

      <div className={"crd-turn-banner" + (isMyTurn ? " crd-turn-banner-mine" : "")}>
        {isMyTurn ? "あなたの番です！カードを選ぼう" : isSolo ? "🤖 AIが考え中…" : "相手の番です…"}
      </div>

      <div className="crd-log" ref={logRef}>
        {game.log.slice(-6).map((line, i) => (
          <div key={i} className="crd-log-line">
            {line}
          </div>
        ))}
      </div>

      <div className="crd-player-row">
        <div className="crd-player-info">
          <span className="crd-player-name">あなた</span>
          {game.shield[myIdx] > 0 && <span className="crd-shield-badge">🛡️{game.shield[myIdx]}</span>}
        </div>
        <HpBar hp={game.hp[myIdx]} maxHp={game.maxHp} />
      </div>

      <div className="crd-hand">
        {game.hand[myIdx].map((card) => (
          <button
            key={card.id}
            className={"crd-card " + TYPE_CLASS[card.type]}
            disabled={!isMyTurn}
            onClick={() => onPlayCard(card.id)}
          >
            <span className="crd-card-emoji">{card.emoji}</span>
            <span className="crd-card-label">{card.label}</span>
          </button>
        ))}
      </div>
      <p className="crd-hint-text">🎴ドローは連続でカードを出せる、他のカードは出すと相手の番になる</p>
    </div>
  );
}
