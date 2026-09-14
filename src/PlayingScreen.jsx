import { useEffect, useMemo, useRef, useState } from "react";
import { BOARD_SIZE, GRID_COLS, ROW_HEIGHT, LANE_OFFSET, basePoint, getTheme } from "./boardData.js";
import { rollDice, chooseFork, chooseHome, choosePick, submitInvest, ackLanding } from "./roomEngine.js";
import { describeToast, signed, amtClass } from "./ui/helpers.js";
import GameTopBar from "./ui/TopBar.jsx";
import {
  sfxDiceTick,
  sfxDiceLand,
  sfxStep,
  sfxCoinGain,
  sfxCoinLoss,
  sfxChoiceClick,
  sfxFanfare,
  sfxSparkle,
  sfxSadTone,
  sfxJackpot,
  startBgm,
  setBgmMode,
} from "./audio.js";

const DIE_FACE = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };

function ScoreBoard({ players, currentIdx, unit }) {
  return (
    <div className="sgr-scoreboard">
      {players.map((p, i) => (
        <div key={p.id} className={"sgr-score-item" + (i === currentIdx && !p.finished ? " sgr-active" : "") + (p.finished ? " sgr-finished" : "")}>
          <div className="sgr-tok">{p.finished ? "🏁" : p.token}</div>
          <div className={"sgr-amt " + (p.money >= 0 ? "sgr-pos" : "sgr-neg")}>{p.money}{unit}</div>
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

// player の現在マスの座標(%,px)。分かれ道マスなら本人の選択に応じたレーン側に立つ。
function tokenCoord(theme, player, pos) {
  const sq = theme.SQUARES[pos];
  const pt = basePoint(pos);
  if (sq.type === "branch") {
    const bd = theme.BRANCH_MAP[pos];
    const choice = (player.routeChoice && player.routeChoice[bd.forkIdx]) || "safe";
    return { x: choice === "risk" ? pt.xPct - LANE_OFFSET : pt.xPct + LANE_OFFSET, y: pt.y, laneKey: `${pos}:${choice}` };
  }
  return { x: pt.xPct, y: pt.y, laneKey: `${pos}:none` };
}

// コマを盤面の上に独立したレイヤーとして重ね、left/topをCSSトランジションで
// 滑らかに動かす。同じマスに複数コマがいる場合は少し横にファンアウトする。
function TokenLayer({ theme, players, walking }) {
  const displayPlayers = useMemo(() => {
    if (!walking) return players;
    return players.map((p) => (p.id === walking.playerId ? { ...p, pos: walking.pos } : p));
  }, [players, walking]);

  const items = useMemo(() => {
    const groups = {};
    displayPlayers.forEach((p) => {
      const c = tokenCoord(theme, p, p.pos);
      if (!groups[c.laneKey]) groups[c.laneKey] = [];
      groups[c.laneKey].push({ p, c });
    });
    const list = [];
    Object.values(groups).forEach((group) => {
      const n = group.length;
      group.forEach(({ p, c }, i) => {
        const fan = (i - (n - 1) / 2) * 7;
        list.push({ id: p.id, token: p.token, x: c.x, y: c.y, fan });
      });
    });
    return list;
  }, [displayPlayers, theme]);

  return items.map((it) => (
    <span key={it.id} className="sgr-token-float" style={{ left: `calc(${it.x}% + ${it.fan}px)`, top: it.y + 15 }}>
      {it.token}
    </span>
  ));
}

function Board({ theme, players, walking }) {
  const cells = useMemo(() => {
    const list = [];
    for (let idx = 0; idx < BOARD_SIZE; idx++) {
      const sq = theme.SQUARES[idx];
      const pt = basePoint(idx);
      if (sq.type === "branch") {
        const bd = theme.BRANCH_MAP[idx];
        list.push({ key: `${idx}:risk`, idx, lane: "risk", sq: bd.risk, x: pt.xPct - LANE_OFFSET, y: pt.y });
        list.push({ key: `${idx}:safe`, idx, lane: "safe", sq: bd.safe, x: pt.xPct + LANE_OFFSET, y: pt.y });
      } else {
        list.push({ key: `${idx}:none`, idx, lane: null, sq, x: pt.xPct, y: pt.y });
      }
    }
    return list;
  }, [theme]);

  const roadPoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      const pt = basePoint(i);
      pts.push(`${pt.xPct},${pt.y}`);
    }
    return pts.join(" ");
  }, []);

  const totalRows = Math.ceil(BOARD_SIZE / GRID_COLS);
  const totalHeight = totalRows * ROW_HEIGHT + 34;

  const activeCellRef = useRef(null);
  const activeKey = useMemo(() => {
    if (walking) return tokenCoord(theme, players.find((pl) => pl.id === walking.playerId) || players[0], walking.pos).laneKey;
    const p = players.find((pl) => !pl.finished);
    return p ? tokenCoord(theme, p, p.pos).laneKey : null;
  }, [players, walking, theme]);

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
        {cells.map((c) => (
          <div
            key={c.key}
            ref={c.key === activeKey ? activeCellRef : null}
            className={"sgr-sq sgr-" + c.sq.type + (c.lane ? " sgr-lane-" + c.lane : "")}
            style={{ left: c.x + "%", top: c.y }}
          >
            <div className="sgr-num">{c.idx}</div>
            <div className="sgr-icon">{c.sq.icon || "・"}</div>
          </div>
        ))}
        <TokenLayer theme={theme} players={players} walking={walking} />
      </div>
    </div>
  );
}

function Toast({ event, players, theme }) {
  const d = describeToast(event, players, theme);
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
            <span className={"sgr-amt " + amtClass(d.amount)}>{signed(d.amount, d.unit)}</span>
          </>
        )}
        {d.sub && <span className="sgr-sub2">{d.sub}</span>}
      </div>
    </div>
  );
}

function ShowcaseOverlay({ event, theme }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 90);
    const stop = setTimeout(() => clearInterval(id), 1100);
    // スピン演出が止まり結果が確定するタイミングで結果音を鳴らす
    const soundTimer = setTimeout(() => {
      if (event.kind === "job") sfxFanfare();
      else if (event.kind === "lifeevent") (event.amt >= 0 ? sfxCoinGain() : sfxCoinLoss());
      else if (event.kind === "childevent") (event.success ? sfxJackpot() : sfxSadTone());
    }, 1000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
      clearTimeout(soundTimer);
    };
  }, [event.at]);

  const settled = tick > 11;
  const unit = theme.currencyUnit;

  if (event.kind === "job") {
    const spinJob = theme.jobs[tick % theme.jobs.length];
    const shown = settled ? event.job : spinJob;
    return (
      <div className="sgr-ovl sgr-show">
        <div className="sgr-ovl-card">
          <h2>{theme.labels.jobGachaTitle}</h2>
          <p className="sgr-ovl-lead">サイコロを振って、この先を左右する{theme.labels.jobSquareName}を決めよう</p>
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
          <div className="sgr-dice-face">{DIE_FACE[shown]}</div>
          {settled && (
            <div className="sgr-child-result">
              {event.amt >= 0 ? "🎉 いい流れが来た！" : "😅 出費がかさんでしまった…"}
              <br />
              <span className={"sgr-amt " + amtClass(event.amt)}>{signed(event.amt, unit)}</span>
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
        <h2>{theme.icon.childevent} {event.label}に挑戦！</h2>
        <p className="sgr-ovl-lead">サイコロで五分五分。4以上で成功！</p>
        <div className="sgr-dice-face">{DIE_FACE[shown]}</div>
        {settled && (
          <div className="sgr-child-result">
            {event.success ? `🎉 ${event.label}がパーティに加わった！` : "😢 残念、今回は失敗した…また挑戦しよう"}
            <br />
            <span className="sgr-amt sgr-neg">{signed(event.amt, unit)}</span>
            {event.giftTotal > 0 && (
              <>
                <br />
                🎁 他のプレイヤーから{theme.labels.childGiftLabel} <span className="sgr-amt sgr-pos">{signed(event.giftTotal, unit)}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ForkChoiceOverlay({ code, uid, theme }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sgr-ovl sgr-show">
      <div className="sgr-ovl-card">
        <h2>🔀 道を選ぼう</h2>
        <p className="sgr-ovl-lead">この先しばらく、選んだコースの出来事が待っている</p>
        <div className="sgr-choice-list">
          {theme.forkOptions.map((opt) => (
            <button
              key={opt.id}
              className="sgr-choice-btn"
              disabled={busy}
              onClick={async () => {
                sfxChoiceClick();
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

function HomeChoiceOverlay({ code, uid, theme }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sgr-ovl sgr-show">
      <div className="sgr-ovl-card">
        <div className="sgr-ovl-illust" style={{ background: "var(--sgr-sq-home)" }}>
          <span style={{ fontSize: 28 }}>{theme.icon.homepurchase}</span>
        </div>
        <h2>{theme.labels.homeSquareName}を{theme.labels.homeVerb}しよう！</h2>
        <p className="sgr-ovl-lead">予算に合わせて選ぼう（ゴール後に売却できるよ）</p>
        <div className="sgr-choice-list">
          {theme.homeOptions.map((opt) => (
            <button
              key={opt.id}
              className="sgr-choice-btn"
              disabled={busy}
              onClick={async () => {
                sfxChoiceClick();
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
                <span className="sgr-c-cost">初期費用 {opt.cost}{theme.currencyUnit}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InvestOverlay({ code, uid, invest, players, myMoney, theme }) {
  const decided = invest.decisions[uid] !== undefined;
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const maxAmt = Math.max(0, Math.floor(myMoney / 10) * 10);
  const unit = theme.currencyUnit;

  if (decided) {
    return (
      <div className="sgr-ovl sgr-show">
        <div className="sgr-ovl-card">
          <h2>{theme.icon.salary} {theme.labels.salaryName}</h2>
          <p className="sgr-ovl-lead">他のプレイヤーの{theme.labels.investVerb}判断を待っています…</p>
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
        <h2>{theme.icon.salary} {theme.labels.salaryName}</h2>
        <div className="sgr-salary-pay">
          {payerName}が{invest.jobLabel} <span className="sgr-amt sgr-pos">{signed(invest.salaryAmt, unit)}</span>
        </div>
        <div className="sgr-news-box">
          <div className="sgr-news-headline">{arrow} {invest.news.text}</div>
          <div className="sgr-news-index">指数 {invest.before} → <b>{invest.after}</b></div>
        </div>
        <div className="sgr-invest-title">{theme.labels.investVerb}する金額（10{unit}単位・あなたの手持ち: {myMoney}{unit}）</div>
        <div className="sgr-invest-row">
          <button className="sgr-step-btn" onClick={() => { sfxChoiceClick(); setAmount((a) => Math.max(0, a - 10)); }}>−10</button>
          <div className="sgr-invest-amt">{amount}{unit}</div>
          <button className="sgr-step-btn" onClick={() => { sfxChoiceClick(); setAmount((a) => Math.min(maxAmt, a + 10)); }}>+10</button>
        </div>
        <div className="sgr-invest-quick">
          <button className="sgr-invest-quick-btn" onClick={() => { sfxChoiceClick(); setAmount(0); }}>{theme.labels.investVerb}しない</button>
          <button className="sgr-invest-quick-btn" onClick={() => { sfxChoiceClick(); setAmount(Math.floor(maxAmt / 2 / 10) * 10); }}>半分</button>
          <button className="sgr-invest-quick-btn" onClick={() => { sfxChoiceClick(); setAmount(maxAmt); }}>全部</button>
        </div>
        <div className="sgr-invest-note">{theme.labels.investVerb}後の手持ち: {myMoney - amount}{unit}</div>
        <button
          className="sgr-btn"
          disabled={busy}
          onClick={async () => {
            sfxChoiceClick();
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

function ChoiceSquareOverlay({ code, uid, choice, theme }) {
  const [busy, setBusy] = useState(false);
  const optIcon = { a: "🛡️", b: "🎲" };
  return (
    <div className="sgr-ovl sgr-show">
      <div className="sgr-ovl-card">
        <h2>{theme.icon.choice} {choice.desc}</h2>
        <p className="sgr-ovl-lead">どちらを選ぶ？</p>
        <div className="sgr-choice-list">
          {choice.options.map((opt) => (
            <button
              key={opt.id}
              className="sgr-choice-btn"
              disabled={busy}
              onClick={async () => {
                sfxChoiceClick();
                setBusy(true);
                try {
                  await choosePick(code, uid, opt.id);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <span className="sgr-c-icon">{optIcon[opt.id] || "・"}</span>
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

function LogOverlay({ log, players, onClose }) {
  const entries = [...log].reverse();
  return (
    <div className="sgr-ovl sgr-show">
      <div className="sgr-ovl-card">
        <h2>📜 これまでのログ</h2>
        <div className="sgr-log-feed" style={{ maxHeight: "50vh" }}>
          {entries.length === 0 && <div className="sgr-log-line">まだ記録がありません</div>}
          {entries.map((entry, i) => {
            const p = entry.playerId ? players.find((pl) => pl.id === entry.playerId) : null;
            return (
              <div key={i} className="sgr-log-line">
                {p ? p.token + " " : ""}{entry.text}
              </div>
            );
          })}
        </div>
        <button className="sgr-btn sgr-secondary sgr-small" onClick={onClose} style={{ marginTop: 12 }}>
          閉じる
        </button>
      </div>
    </div>
  );
}

export default function PlayingScreen({ room, code, uid, onLeaveRoom }) {
  const theme = getTheme(room.themeId);
  const { players, currentIdx, turn, lastEvent } = room;
  const me = players.find((p) => p.id === uid);
  const actor = players[currentIdx];
  const isMyTurn = actor && actor.id === uid && turn.status === "idle";

  const [rolling, setRolling] = useState(false);
  const [diceFace, setDiceFace] = useState("🎲");
  const [showcase, setShowcase] = useState(null);
  const [walking, setWalking] = useState(null);
  // コマが着地するまでは、トースト/選択画面などマスの内容を隠しておく
  // (「移動しきってから内容を表示する」ため)
  const [revealReady, setRevealReady] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const seenTurnKey = useRef(null);
  // 「ダイス演出→移動演出」の最中は true。この間は着地演出(トースト/ショーケース)を
  // 出したり、ゲームを先に進めたりしない(演出用の別エフェクトと競合させないため)。
  const busyRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  // プレイ中は少しテンポの速いBGMに切り替える。画面を離れたら元(落ち着いた曲調)に戻す。
  useEffect(() => {
    startBgm();
    setBgmMode("play");
    return () => setBgmMode("ambient");
  }, []);

  // turn.roll/fromPos/toPos/path はターンが確定した瞬間から次のプレイヤーの番になるまで
  // 変わらないので、これをキーにして「新しいロールが起きた」ことを検出する。
  // (lastEvent はターン内で何度も上書きされるので、ロール自体の検出には使えない)
  useEffect(() => {
    if (turn.roll == null || !turn.path) return;
    const key = `${turn.actorId}:${turn.roll}:${turn.fromPos}:${turn.toPos}`;
    if (key === seenTurnKey.current) return;
    seenTurnKey.current = key;
    busyRef.current = true;

    const fromPos = turn.fromPos;
    const path = turn.path;
    const actorId = turn.actorId;
    const finalRoll = turn.roll;

    setRevealReady(false);
    setRolling(true);
    let n = 0;
    const totalTicks = 10; // サイコロを振っている感覚が出る程度に転がす
    const diceTimer = setInterval(() => {
      setDiceFace(DIE_FACE[1 + Math.floor(Math.random() * 6)]);
      sfxDiceTick();
      n++;
      if (n > totalTicks) {
        clearInterval(diceTimer);
        setDiceFace(DIE_FACE[finalRoll]);
        setRolling(false);
        sfxDiceLand();

        // コマをスタート地点から1マスずつ歩かせる
        setWalking({ playerId: actorId, pos: fromPos });
        let i = 0;
        const stepTimer = setInterval(() => {
          if (i >= path.length) {
            clearInterval(stepTimer);
            setWalking(null);
            busyRef.current = false;
            setRevealReady(true);
            return;
          }
          setWalking({ playerId: actorId, pos: path[i] });
          sfxStep();
          i++;
        }, 550);
      }
    }, 90);
    return () => clearInterval(diceTimer);
  }, [turn.actorId, turn.roll, turn.fromPos, turn.toPos]);

  // マスの結果が確定(turn.status === "landed")したら、移動演出が終わっているのを確認してから
  // トースト/ショーケースを見せ、少し経ってからゲームを先に進める(ackLanding)。
  // 分かれ道・マイホーム・二択マスの選択直後もここで拾う(その場合は移動演出を挟まない)。
  useEffect(() => {
    if (turn.status !== "landed" || busyRef.current) return;
    const isShowcase = lastEvent && ["job", "lifeevent", "childevent"].includes(lastEvent.kind);
    if (isShowcase) {
      setShowcase(lastEvent);
    } else if (lastEvent) {
      if (["income", "expense", "bonus", "accident", "pick_result", "raid"].includes(lastEvent.kind)) {
        (lastEvent.amt >= 0 ? sfxCoinGain : sfxCoinLoss)();
      } else if (lastEvent.kind === "treasure" || lastEvent.kind === "lottery") {
        sfxSparkle();
      } else if (lastEvent.kind === "goal") {
        sfxFanfare();
      }
    }
    const delay = isShowcase ? 1800 : 1100;
    const timer = setTimeout(() => {
      setShowcase(null);
      ackLanding(code).catch(() => {});
    }, delay);
    return () => clearTimeout(timer);
  }, [turn.status, lastEvent, revealReady, code]);

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
    if (turn.choice?.type === "fork") turnSub = "分かれ道を選んでいます…";
    else if (turn.choice?.type === "home") turnSub = `${theme.labels.homeSquareName}を選んでいます…`;
    else if (turn.choice?.type === "pick") turnSub = `${turn.choice.desc}を検討中…`;
    else turnSub = "選んでいます…";
  } else if (turn.status === "awaiting_invest") {
    turnSub = "全員の投資判断を待っています…";
  } else if (!revealReady) {
    turnSub = "移動中…";
  } else if (turn.status === "landed") {
    turnSub = "結果を確認中…";
  } else {
    turnSub = "進行中…";
  }

  return (
    <div className="sgr-app">
      <GameTopBar title={theme.name} code={code} uid={uid} hostUid={room.hostUid} onLeaveRoom={onLeaveRoom} />

      <div className="sgr-topbar-btns" style={{ justifyContent: "flex-end", padding: "0 18px 4px" }}>
        <button className="sgr-link-btn" onClick={() => setShowLog(true)}>📜 ログ</button>
      </div>

      <ScoreBoard players={players} currentIdx={currentIdx} unit={theme.currencyUnit} />

      <div className="sgr-turn-banner">
        <div className="sgr-tok">{actor.token}</div>
        <div>
          <div className="sgr-txt">{actor.name}のばん{actor.id === uid ? "（あなた）" : ""}</div>
          <div className="sgr-sub">{turnSub}</div>
        </div>
      </div>

      <Board theme={theme} players={players} walking={walking} />

      {revealReady && <Toast event={lastEvent} players={players} theme={theme} />}

      <div className="sgr-controls">
        <button className={"sgr-dice" + (rolling ? " sgr-rolling" : "")} disabled={!isMyTurn || submitting} onClick={handleRoll}>
          {rolling ? diceFace : isMyTurn ? "🎲" : diceFace}
        </button>
        <div className="sgr-dice-label">{isMyTurn ? "タップしてサイコロを振る" : ""}</div>
      </div>

      {revealReady && turn.status === "awaiting_choice" && turn.choice?.type === "fork" && turn.actorId === uid && (
        <ForkChoiceOverlay code={code} uid={uid} theme={theme} />
      )}
      {revealReady && turn.status === "awaiting_choice" && turn.choice?.type === "home" && turn.actorId === uid && (
        <HomeChoiceOverlay code={code} uid={uid} theme={theme} />
      )}
      {revealReady && turn.status === "awaiting_choice" && turn.choice?.type === "pick" && turn.actorId === uid && (
        <ChoiceSquareOverlay code={code} uid={uid} choice={turn.choice} theme={theme} />
      )}
      {revealReady && turn.status === "awaiting_invest" && turn.invest && turn.invest.pending.includes(uid) && me && (
        <InvestOverlay code={code} uid={uid} invest={turn.invest} players={players} myMoney={me.money} theme={theme} />
      )}
      {showcase && <ShowcaseOverlay event={showcase} theme={theme} />}
      {showLog && <LogOverlay log={room.log || []} players={players} onClose={() => setShowLog(false)} />}
    </div>
  );
}
