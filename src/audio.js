// 効果音・BGMを外部ファイルなしで鳴らすための小さなオーディオモジュール。
// Web Audio APIでその場で音を合成する(元の参考デザインの方式を踏襲)ので、
// 音声ファイルのホスティングや著作権を気にする必要がない。
// モジュール単位のシングルトン状態として持つ(Reactの外側で管理する)。

let ctx = null;
let enabled = true;
let bgmGain = null;
let bgmActive = false;
let bgmTimer = null;
let bgmOscs = [];
let bgmIndex = 0;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(enabled));
}

export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isSoundEnabled() {
  return enabled;
}

function ensureAudio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) ctx = new Ctx();
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
  return ctx;
}

// ブラウザの自動再生制限のため、最初のユーザー操作をきっかけに一度だけ呼ぶ。
export function primeAudio() {
  ensureAudio();
  if (enabled) startBgm();
}

export function setSoundEnabled(v) {
  enabled = v;
  if (!v) {
    stopBgm();
  } else {
    ensureAudio();
    startBgm();
  }
  notify();
}

export function toggleSound() {
  setSoundEnabled(!enabled);
  return enabled;
}

function playTone(freq, duration, type = "sine", vol = 0.15, delay = 0, dest = null) {
  if (!enabled) return;
  const c = ensureAudio();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(dest || c.destination);
  const t0 = c.currentTime + delay;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function sfxDiceTick() {
  playTone(500 + Math.random() * 250, 0.045, "square", 0.07);
}
export function sfxDiceLand() {
  playTone(300, 0.16, "triangle", 0.2);
}
export function sfxStep() {
  playTone(420, 0.03, "square", 0.05);
}
export function sfxCoinGain() {
  playTone(880, 0.08, "sine", 0.16);
  playTone(1320, 0.12, "sine", 0.16, 0.08);
}
export function sfxCoinLoss() {
  playTone(220, 0.28, "sawtooth", 0.13);
}
export function sfxChoiceClick() {
  playTone(700, 0.05, "square", 0.08);
}
export function sfxFanfare() {
  [523, 659, 784, 1047].forEach((f, i) => playTone(f, 0.25, "triangle", 0.18, i * 0.12));
}
export function sfxSparkle() {
  [660, 880, 1100, 1320].forEach((f, i) => playTone(f, 0.12, "sine", 0.12, i * 0.06));
}
export function sfxSadTone() {
  [400, 340].forEach((f, i) => playTone(f, 0.22, "sine", 0.12, i * 0.18));
}
export function sfxJackpot() {
  [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => playTone(f, 0.2, "triangle", 0.2, i * 0.09));
}

// ---- BGM: シンプルなアンビエントパッド(4つのコードを8秒ごとに切り替え) ----
const BGM_CHORDS = [
  [130.81, 164.81, 196.0], // C3 E3 G3
  [146.83, 174.61, 220.0], // D3 F3 A3
  [110.0, 146.83, 174.61], // A2 D3 F3
  [130.81, 155.56, 196.0], // C3 Eb3 G3
];

function stopBgmOscs() {
  bgmOscs.forEach((o) => {
    try {
      o.stop();
    } catch {
      // すでに停止している場合は無視
    }
  });
  bgmOscs = [];
}

function playBgmChord() {
  if (!bgmActive || !enabled) return;
  const c = ensureAudio();
  if (!c) return;
  if (!bgmGain) {
    bgmGain = c.createGain();
    bgmGain.gain.value = 0.05;
    bgmGain.connect(c.destination);
  }
  stopBgmOscs();
  const chord = BGM_CHORDS[bgmIndex % BGM_CHORDS.length];
  bgmIndex++;
  chord.forEach((freq) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(1, c.currentTime + 1.5);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 7.5);
    osc.connect(g);
    g.connect(bgmGain);
    osc.start();
    osc.stop(c.currentTime + 8);
    bgmOscs.push(osc);
  });
  bgmTimer = setTimeout(playBgmChord, 8000);
}

export function startBgm() {
  if (bgmActive || !enabled) return;
  bgmActive = true;
  playBgmChord();
}

export function stopBgm() {
  bgmActive = false;
  if (bgmTimer) clearTimeout(bgmTimer);
  stopBgmOscs();
}
