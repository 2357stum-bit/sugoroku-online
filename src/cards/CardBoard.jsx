import { useEffect, useRef, useState } from "react";

const TYPE_CLASS = {
  attack: "crd-card-attack",
  heal: "crd-card-heal",
  shield: "crd-card-shield",
  draw: "crd-card-draw",
};

const TYPE_EMOJI = { attack: "💥", heal: "💖", shield: "🛡️", draw: "🎴" };

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

function floaterText(action) {
  if (action.type === "attack") return `-${action.amount}`;
  if (action.type === "heal") return `+${action.amount}`;
  if (action.type === "shield") return `+${action.amount}`;
  if (action.type === "draw") return `+${action.amount}`;
  return "";
}

function PlayerRow({ label, hp, maxHp, shield, fx, extra }) {
  const fxClass = fx ? ` crd-fx-${fx.type}` : "";
  return (
    <div className={"crd-player-row" + fxClass}>
      <div className="crd-player-info">
        <span className="crd-player-name">{label}</span>
        {shield > 0 && <span className="crd-shield-badge">🛡️{shield}</span>}
      </div>
      <HpBar hp={hp} maxHp={maxHp} />
      {fx && (
        <>
          <span key={fx.id + "-t"} className={`crd-floater crd-floater-${fx.type}`}>
            {floaterText(fx)}
          </span>
          <span key={fx.id + "-e"} className="crd-impact-emoji">
            {TYPE_EMOJI[fx.type]}
          </span>
        </>
      )}
      {extra}
    </div>
  );
}

export default function CardBoard({ room, myIdx, opponentName, isSolo, onPlayCard }) {
  const game = room.game;
  const oppIdx = 1 - myIdx;
  const isMyTurn = game.turn === myIdx && game.status === "playing";
  const logRef = useRef(null);
  const [launchingId, setLaunchingId] = useState(null);
  const [recentAction, setRecentAction] = useState(null);
  const seenActionIdRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [game.log.length]);

  // Firestoreから来た直前のアクション(lastAction)が新しければ、対象側に一瞬だけ演出を出す。
  useEffect(() => {
    const la = game.lastAction;
    if (!la || la.id === seenActionIdRef.current) return;
    seenActionIdRef.current = la.id;
    setRecentAction(la);
    const t = setTimeout(() => {
      setRecentAction((cur) => (cur && cur.id === la.id ? null : cur));
    }, 850);
    return () => clearTimeout(t);
  }, [game.lastAction]);

  function handlePlay(cardId) {
    if (!isMyTurn || launchingId) return;
    setLaunchingId(cardId);
    onPlayCard(cardId);
    setTimeout(() => setLaunchingId((cur) => (cur === cardId ? null : cur)), 480);
  }

  const oppFx = recentAction && recentAction.target === oppIdx ? recentAction : null;
  const myFx = recentAction && recentAction.target === myIdx ? recentAction : null;

  return (
    <div className="crd-wrap">
      <PlayerRow
        label={opponentName}
        hp={game.hp[oppIdx]}
        maxHp={game.maxHp}
        shield={game.shield[oppIdx]}
        fx={oppFx}
        extra={
          <div className="crd-hand-back">
            {game.hand[oppIdx].map((_, i) => (
              <span key={i} className="crd-card-back">
                🂠
              </span>
            ))}
          </div>
        }
      />

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

      <PlayerRow label="あなた" hp={game.hp[myIdx]} maxHp={game.maxHp} shield={game.shield[myIdx]} fx={myFx} />

      <div className={"crd-hand" + (launchingId ? " crd-hand-sending" : "")}>
        {game.hand[myIdx].map((card) => (
          <button
            key={card.id}
            className={"crd-card " + TYPE_CLASS[card.type] + (launchingId === card.id ? " crd-card-launching" : "")}
            disabled={!isMyTurn || !!launchingId}
            onClick={() => handlePlay(card.id)}
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
