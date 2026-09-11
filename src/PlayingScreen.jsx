import { useEffect, useMemo, useRef, useState } from "react";
import {
  SQUARES,
  BRANCH_MAP,
  BOARD_SIZE,
  GRID_COLS,
  ROW_HEIGHT,
  LANE_OFFSET,
  basePoint,
  HOME_OPTIONS,
  FORK_OPTIONS,
  JOBS,
} from "./boardData.js";
import { rollDice, chooseFork, chooseHome, submitInvest } from "./roomEngine.js";
import { describeToast, signed, amtClass } from "./ui/helpers.js";

function ScoreBoard({ players, currentIdx }) {
  return (
    <div className="sgr-scoreboard">
      {players.map((p, i) => (
        <div key={p.id} className={"sgr-score-item" + (i === currentIdx && !p.finished ? " sgr-active" : "") + (p.finished ? " sgr-finished" : "")}>
          <div className="sgr-tok">{p.finished ? "🏁" : p.token}</div>
          <div className={"sgr-amt " + (p.money >= 0 ? "sgr-pos" : "sgr-neg")}>{p.money}万円</div>
          {p.job && <div className="sgr-jobtag">{p.job.icon}{p.job.name}</div>}
          {(p.cards.length > 0 || p.lotteryTickets.length > 0) && (
            <div className="sgr-cards">
              {p.cards.length > 0 ? `💎${p.cards.length} ` : ""}
              {p.lotteryTickets.length > 0 ? `🎫${p.lotteryTickets.length}` : ""}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Board({ players }) {
  const cells = useMemo(() => {
    const list = [];
    for (let idx = 0; idx < BOARD_SIZE; idx++) {
      const sq = SQUARES[idx];
      const pt = basePoint(idx);
      if (sq.type === "branch") {
        const bd = BRANCH_MAP[idx];
        list.push({ key: `${idx}:risk`, idx, lane: "risk", sq: bd.risk, x: pt.xPct - LANE_OFFSET, y: pt.y });
        list.push({ key: `${idx}:safe`, idx, lane: "safe", sq: bd.safe, x: pt.xPct + LANE_OFFSET, y: pt.y });
      } else {
        list.push({ key: `${idx}:none`, idx, lane: null, sq, x: pt.xPct, y: pt.y });
      }
    }
    return list;
  }, []);

  const roadPoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      const pt = basePoint(i);
      pts.push(`${pt.xPct},${pt.y}`);
    }
    return pts.join(" ");
  }, []);

  const tokensByCell = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      const sq = SQUARES[p.pos];
      let key;
      if (sq.type === "branch") {
        const bd = BRANCH_MAP[p.pos];
        const choice = (p.routeChoice && p.routeChoice[bd.forkIdx]) || "safe";
        key = `${p.pos}:${choice}`;
      } else {
        key = `${p.pos}:none`;
      }
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [players]);

  const totalRows = Math.ceil(BOARD_SIZE / GRID_COLS);
  const totalHeight = totalRows * ROW_HEIGHT + 34;

  const activeCellRef = useRef(null);
  const activeKey = useMemo(() => {
    const p = players.find((pl) => !pl.finished);
    return p ? (SQUARES[p.pos].type === "branch" ? `${p.pos}:${(p.routeChoice && p.routeChoice[BRANCH_MAP[p.pos].forkIdx]) || "safe"}` : `${p.pos}:none`) : null;
  }, [players]);

  useEffect(() => {
    if (activeCellRef.current) {
      activeCellRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeKey]);

  return (
    <div className="sgr-board-wrap">
      <div className="sgr-board" style={{ height: totalHeight }}>
        <svg className="sgr-road-svg" viewBox={`0 0 100 ${totalHeight}`} preserveAspectRatio="none">
          <polyline points={roadPoints} className="sgr-road-line" vectorEffect="non-scaling-stroke" />
        </svg>
        {cells.map((c) => {
          const toks = tokensByCell[c.key] || [];
          return (
            <div
              key={c.key}
              ref={c.key === activeKey ? activeCellRef : null}
              className={"sgr-sq sgr-" + c.sq.type + (c.lane ? " sgr-lane-" + c.lane : "")}
              style={{ left: c.x + "%", top: c.y }}
            >
              <div className="sgr-num">{c.idx}</div>
              <div className="sgr-icon">{c.sq.icon || "・"}</div>
              <div className="sgr-tokens-on-sq">
                {toks.map((p) => (
                  <span key={p.id}>{p.token}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toast({ event, players }) {
  const d = describeToast(event, players);
  if (!d) return null;
  return (
    <div className="sgr-msg-toast">
      <div className="sgr-toast-illust" style={{ background: d.bg }}>
        <span style={{ fontSize: 20 }}>{d.icon}</span>
      </div>
      <div className="sgr-toast-text">
        {d.title}
        {d.amount != null && (
          <>
            <br />
            <span className={"sgr-amt " + amtClass(d.amount)}>{signed(d.amount)}</span>
          </>
        )}
        {d.sub && <span className="sgr-sub2">{d.sub}</span>}
      </div>
    </div>
  );
}

function ShowcaseOverlay({ event }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 90);
    const stop = setTimeout(() => clearInterval(id), 1100);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [event.at]);

  const settled = tick > 11;

  if (event.kind === "job") {
    const spinJob = JOBS[tick % JOBS.length];
    const shown = settled ? event.job : spinJob;
    return (
      <div className="sgr-ovl sgr-show">
        <div className="sgr-ovl-card">
          <h2>{"就職ガチャ！"}</h2>
          <p className="sgr-ovl-lead">サイコロを振って、この先の人生を左右する職業を決めよう</p>
          <div className="sgr-job-roll">
            <span className="sgr-job-icon-big">{shown.icon}</span>
            <div className="sgr-job-name-big">{shown.name}</div>
            {settled && <div className="sgr-job-desc-big">{shown.desc}</div>}
          </div>
        </div>
      </div>
    );
  }

  if (event.kind === "lifeevent") {
    const spinRoll = 1 + (tick % 6);
    const shown = settled ? event.roll : spinRoll;
    return (
      <div className="sgr-ovl sgr-show">
        <div className="sgr-ovl-card">
          <h2>{event.icon} {event.label}</h2>
          <p className="sgr-ovl-lead">{event.desc}</p>
          <div className="sgr-dice-face">{shown}</div>
          {settled && (
            <div className="sgr-child-result">
              {event.amt >= 0 ? "🎉 いい流れが来た！" : "😅 出費がかさんでしまった…"}
              <br />
              <span className={"sgr-amt " + amtClass(event.amt)}>{signed(event.amt)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // childevent
  const spinRoll = 1 + (tick % 6);
  const shown = settled ? event.roll : spinRoll;
  return (
    <div className="sgr-ovl sgr-show">
      <div className="sgr-ovl-card">
        <h2>👶 {event.label}に挑戦！</h2>
        <p className="sgr-ovl-lead">サイコロで五分五分。4以上で成功！</p>
        <div className="sgr-dice-face">{shown}</div>
        {settled && (
          <div className="sgr-child-result">
            {event.success ? "🎉 元気な赤ちゃんが誕生した！おめでとう！" : "😢 残念、今回は授からなかった…また挑戦しよう"}
            <br />
            <span className="sgr-amt sgr-neg">{signed(event.amt)}</span>
            {event.giftTotal > 0 && (
              <>
                <br />
                🎁 他のプレイヤーからお祝い金 <span className="sgr-amt sgr-pos">{signed(event.giftTotal)}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ForkChoiceOverlay({ code, uid }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sgr-ovl sgr-show">
      <div className="sgr-ovl-card">
        <h2>🔀 道を選ぼう</h2>
        <p className="sgr-ovl-lead">この先しばらく、選んだコースの出来事が待っている</p>
        <div className="sgr-choice-list">
          {FORK_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className="sgr-choice-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await chooseFork(code, uid, opt.id);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <span className="sgr-c-icon">{opt.icon}</span>
              <span className="sgr-c-txt">
                <span className="sgr-c-name">{opt.label}</span>
                <span className="sgr-c-desc">{opt.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HomeChoiceOverlay({ code, uid }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sgr-ovl sgr-show">
      <div className="sgr-ovl-card">
        <div className="sgr-ovl-illust" style={{ background: "var(--sgr-sq-home)" }}>
          <span style={{ fontSize: 28 }}>🏘️</span>
        </div>
        <h2>マイホームを購入しよう！</h2>
        <p className="sgr-ovl-lead">予算に合わせて住まいを選ぼう（ゴール後に売却できるよ）</p>
        <div className="sgr-choice-list">
          {HOME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className="sgr-choice-btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await chooseHome(code, uid, opt.id);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <span className="sgr-c-icon">{opt.icon}</span>
              <span className="sgr-c-txt">
                <span className="sgr-c-name">{opt.label}</span>
                <span className="sgr-c-desc">{opt.desc}</span>
                <span className="sgr-c-cost">初期費用 {opt.cost}万円</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InvestOverlay({ code, uid, invest, players, myMoney }) {
  const decided = invest.decisions[uid] !== undefined;
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const maxAmt = Math.max(0, Math.floor(myMoney / 10) * 10);

  if (decided) {
    return (
      <div className="sgr-ovl sgr-show">
        <div className="sgr-ovl-card">
          <h2>💴 給料日</h2>
          <p className="sgr-ovl-lead">他のプレイヤーの投資判断を待っています…</p>
          <div className="sgr-invest-wait-list">
            {invest.pending.map((id) => {
              const p = players.find((pl) => pl.id === id);
              const done = invest.decisions[id] !== undefined;
              return (
                <div key={id} className={"sgr-invest-wait-row" + (done ? " sgr-done" : "")}>
                  <span>{p ? p.token + " " + p.name : id}</span>
                  <span>{done ? "決定済み ✅" : "検討中…"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const payerName = players.find((p) => p.id === invest.payerId)?.name || "";
  const arrow = invest.news.pct >= 0 ? "📈" : "📉";

  return (
    <div className="sgr-ovl sgr-show">
      <div className="sgr-ovl-card">
        <h2>💴 給料日</h2>
        <div className="sgr-salary-pay">
          {payerName}が{invest.jobLabel} <span className="sgr-amt sgr-pos">{signed(invest.salaryAmt)}</span>
        </div>
        <div className="sgr-news-box">
          <div className="sgr-news-headline">{arrow} {invest.news.text}</div>
          <div className="sgr-news-index">株価指数 {invest.before} → <b>{invest.after}</b></div>
        </div>
        <div className="sgr-invest-title">投資する金額（10万円単位・あなたの手持ち: {myMoney}万円）</div>
        <div className="sgr-invest-row">
          <button className="sgr-step-btn" onClick={() => setAmount((a) => Math.max(0, a - 10))}>−10</button>
          <div className="sgr-invest-amt">{amount}万円</div>
          <button className="sgr-step-btn" onClick={() => setAmount((a) => Math.min(maxAmt, a + 10))}>+10</button>
        </div>
        <div className="sgr-invest-quick">
          <button className="sgr-invest-quick-btn" onClick={() => setAmount(0)}>投資しない</button>
          <button className="sgr-invest-quick-btn" onClick={() => setAmount(Math.floor(maxAmt / 2 / 10) * 10)}>半額</button>
          <button className="sgr-invest-quick-btn" onClick={() => setAmount(maxAmt)}>全額</button>
        </div>
        <div className="sgr-invest-note">投資後の手持ち: {myMoney - amount}万円</div>
        <button
          className="sgr-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await submitInvest(code, uid, amount);
            } finally {
              setBusy(false);
            }
          }}
        >
          この金額で決定
        </button>
      </div>
    </div>
  );
}

export default function PlayingScreen({ room, code, uid }) {
  const { players, currentIdx, turn, lastEvent } = room;
  const me = players.find((p) => p.id === uid);
  const actor = players[currentIdx];
  const isMyTurn = actor && actor.id === uid && turn.status === "idle";

  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState("🎲");
  const [showcase, setShowcase] = useState(null);
  const seenAt = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!lastEvent || lastEvent.at === seenAt.current) return;
    seenAt.current = lastEvent.at;
    if (lastEvent.kind === "roll") {
      let n = 0;
      const timer = setInterval(() => {
        setDiceFace(String(1 + Math.floor(Math.random() * 6)));
        n++;
        if (n > 8) {
          clearInterval(timer);
          setDiceFace(String(lastEvent.roll));
          setRolling(false);
        }
      }, 70);
      setRolling(true);
      return () => clearInterval(timer);
    }
    if (lastEvent.kind === "job" || lastEvent.kind === "lifeevent" || lastEvent.kind === "childevent") {
      setShowcase(lastEvent);
      const t = setTimeout(() => setShowcase(null), 2200);
      return () => clearTimeout(t);
    }
  }, [lastEvent]);

  async function handleRoll() {
    if (!isMyTurn || submitting) return;
    setSubmitting(true);
    try {
      await rollDice(code, uid);
    } catch {
      // 失敗時は次のスナップショットで状態が戻る
    } finally {
      setSubmitting(false);
    }
  }

  let turnSub = "";
  if (turn.status === "idle") {
    turnSub = actor.id === uid ? "サイコロを振ってね" : "サイコロを待っています…";
  } else if (turn.status === "awaiting_choice") {
    turnSub = turn.choice?.type === "fork" ? "分かれ道を選んでいます…" : "マイホームを選んでいます…";
  } else if (turn.status === "awaiting_invest") {
    turnSub = "全員の投資判断を待っています…";
  } else {
    turnSub = "進行中…";
  }

  return (
    <div className="sgr-app">
      <div className="sgr-topbar">
        <h1>マネー双六</h1>
      </div>

      <ScoreBoard players={players} currentIdx={currentIdx} />

      <div className="sgr-turn-banner">
        <div className="sgr-tok">{actor.token}</div>
        <div>
          <div className="sgr-txt">{actor.name}のばん{actor.id === uid ? "（あなた）" : ""}</div>
          <div className="sgr-sub">{turnSub}</div>
        </div>
      </div>

      <Board players={players} />

      <Toast event={lastEvent} players={players} />

      <div className="sgr-controls">
        <button className="sgr-dice" disabled={!isMyTurn || submitting} onClick={handleRoll}>
          {rolling ? diceFace : isMyTurn ? "🎲" : diceFace}
        </button>
        <div className="sgr-dice-label">{isMyTurn ? "タップしてサイコロを振る" : ""}</div>
      </div>

      {turn.status === "awaiting_choice" && turn.choice?.type === "fork" && turn.actorId === uid && (
        <ForkChoiceOverlay code={code} uid={uid} />
      )}
      {turn.status === "awaiting_choice" && turn.choice?.type === "home" && turn.actorId === uid && (
        <HomeChoiceOverlay code={code} uid={uid} />
      )}
      {turn.status === "awaiting_invest" && turn.invest && turn.invest.pending.includes(uid) && me && (
        <InvestOverlay code={code} uid={uid} invest={turn.invest} players={players} myMoney={me.money} />
      )}
      {showcase && <ShowcaseOverlay event={showcase} />}
    </div>
  );
}
