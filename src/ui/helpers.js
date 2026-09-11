// トースト表示用の簡易ヘルパー。イベント種別ごとに絵文字・背景色・文言を組み立てる。

export const EVENT_BG = {
  income: "var(--sgr-sq-income)",
  expense: "var(--sgr-sq-expense)",
  bonus: "var(--sgr-sq-bonus)",
  accident: "var(--sgr-sq-accident)",
  rest: "var(--sgr-sq-rest)",
  salary: "var(--sgr-sq-salary)",
  treasure: "var(--sgr-sq-treasure)",
  lottery: "var(--sgr-sq-lottery)",
  job: "var(--sgr-sq-job)",
  homepurchase: "var(--sgr-sq-home)",
  fork: "var(--sgr-sq-lifeevent)",
  lifeevent: "var(--sgr-sq-lifeevent)",
  childevent: "var(--sgr-sq-childevent)",
  goal: "var(--sgr-sq-goal)",
};

export function findPlayerName(players, id) {
  const p = players.find((pl) => pl.id === id);
  return p ? p.name : "";
}

export function signed(amt) {
  return `${amt >= 0 ? "+" : ""}${amt}万円`;
}

export function amtClass(amt) {
  return amt >= 0 ? "sgr-pos" : "sgr-neg";
}

// lastEvent -> トーストに出す {icon,bg,title,sub,amount} を組み立てる。
// job/lifeevent/childevent は別に全画面のショーケースを出すのでここでは省略。
export function describeToast(event, players) {
  if (!event) return null;
  const name = event.playerId ? findPlayerName(players, event.playerId) : "";
  switch (event.kind) {
    case "income":
    case "expense":
    case "bonus":
    case "accident":
      return { icon: { income: "💰", expense: "💸", bonus: "🎁", accident: "⚡" }[event.kind], bg: EVENT_BG[event.kind], title: `${name}：${event.desc}`, amount: event.amt };
    case "rest":
      return { icon: "💤", bg: EVENT_BG.rest, title: `${name}：${event.desc}` };
    case "treasure":
      return { icon: "💎", bg: EVENT_BG.treasure, title: `${name}：お宝『${event.name}』をゲット！`, sub: "ゴール後に換金できるよ" };
    case "lottery":
      return { icon: "🎫", bg: EVENT_BG.lottery, title: `${name}：宝くじ『${event.ticket}』をゲット！`, sub: "結果はゴール後のお楽しみ" };
    case "goal":
      return { icon: "🏁", bg: EVENT_BG.goal, title: `${name}：${event.rank}着でゴール！`, amount: event.bonus };
    case "job_done":
      return { icon: "🏢", bg: EVENT_BG.job, title: `${name}：もう就職先は決まっているね` };
    case "fork_wait":
      return { icon: "🔀", bg: EVENT_BG.fork, title: `${name}さんが道を選んでいます…` };
    case "fork_result":
      return { icon: event.option.icon, bg: EVENT_BG.fork, title: `${name}：${event.option.label}を選んだ`, sub: "🔀 コースの分かれ道" };
    case "home_wait":
      return { icon: "🏘️", bg: EVENT_BG.homepurchase, title: `${name}さんがマイホームを選んでいます…` };
    case "home_result":
      return { icon: event.option.icon, bg: EVENT_BG.homepurchase, title: `${name}：${event.option.label}を購入した！`, sub: "ゴール後に売却できるよ" };
    case "salary":
      return { icon: "💴", bg: EVENT_BG.salary, title: `${name}：給料日 ${signed(event.salaryAmt)}`, sub: "全員の投資判断を待っています…" };
    default:
      return null;
  }
}
