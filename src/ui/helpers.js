// トースト表示用の簡易ヘルパー。イベント種別ごとに絵文字・背景色・文言を組み立てる。
// テーマ(マップ)ごとに通貨単位・アイコン・呼び方が変わるため、theme を受け取って組み立てる。

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
  choice: "var(--sgr-sq-bonus)",
};

export function findPlayerName(players, id) {
  const p = players.find((pl) => pl.id === id);
  return p ? p.name : "";
}

export function signed(amt, unit = "万円") {
  return `${amt >= 0 ? "+" : ""}${amt}${unit}`;
}

export function amtClass(amt) {
  return amt >= 0 ? "sgr-pos" : "sgr-neg";
}

// lastEvent -> トーストに出す {icon,bg,title,sub,amount} を組み立てる。
// job/lifeevent/childevent は別に全画面のショーケースを出すのでここでは省略。
export function describeToast(event, players, theme) {
  if (!event) return null;
  const name = event.playerId ? findPlayerName(players, event.playerId) : "";
  const unit = theme.currencyUnit;
  switch (event.kind) {
    case "income":
    case "expense":
    case "bonus":
    case "accident":
      return { icon: { income: "💰", expense: "💸", bonus: "🎁", accident: "⚡" }[event.kind], bg: EVENT_BG[event.kind], title: `${name}：${event.desc}`, amount: event.amt, unit };
    case "rest":
      return { icon: theme.icon.rest, bg: EVENT_BG.rest, title: `${name}：${event.desc}` };
    case "treasure":
      return { icon: "💎", bg: EVENT_BG.treasure, title: `${name}：『${event.name}』をゲット！`, sub: "ゴール後に換金できるよ" };
    case "lottery":
      return { icon: theme.icon.lottery, bg: EVENT_BG.lottery, title: `${name}：${theme.labels.lotteryItemName}『${event.ticket}』をゲット！`, sub: "結果はゴール後のお楽しみ" };
    case "goal":
      return { icon: theme.goalIcon, bg: EVENT_BG.goal, title: `${name}：${event.rank}着で${theme.labels.goalName}！`, amount: event.bonus, unit };
    case "job_done":
      return { icon: theme.icon.job, bg: EVENT_BG.job, title: `${name}：もう${theme.labels.jobSquareName}は決まっているね` };
    case "fork_wait":
      return { icon: "🔀", bg: EVENT_BG.fork, title: `${name}さんが道を選んでいます…` };
    case "fork_result":
      return { icon: event.option.icon, bg: EVENT_BG.fork, title: `${name}：${event.option.label}を選んだ`, sub: "🔀 コースの分かれ道" };
    case "home_wait":
      return { icon: theme.icon.homepurchase, bg: EVENT_BG.homepurchase, title: `${name}さんが${theme.labels.homeSquareName}を選んでいます…` };
    case "home_result":
      return { icon: event.option.icon, bg: EVENT_BG.homepurchase, title: `${name}：${event.option.label}を${theme.labels.homeVerb}した！`, sub: "ゴール後に売却できるよ" };
    case "salary":
      return { icon: theme.icon.salary, bg: EVENT_BG.salary, title: `${name}：${theme.labels.salaryName} ${signed(event.salaryAmt, unit)}`, sub: "全員の投資判断を待っています…" };
    case "pick_wait":
      return { icon: theme.icon.choice, bg: EVENT_BG.choice, title: `${name}さんが「${event.desc}」を検討中…` };
    case "pick_result":
      return { icon: theme.icon.choice, bg: EVENT_BG.choice, title: `${name}：${event.desc}『${event.option.label}』を選んだ`, amount: event.amt, unit };
    default:
      return null;
  }
}
