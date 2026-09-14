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

// ---- BGM ----
// "ambient": ロビーや結果画面向けの、ゆったりした4つのコードパッド(8秒ごとに切替)。
// "play": プレイ中向けの、少しテンポの速いコード進行 + 軽いパルス(リズム感)を重ねる。
const BGM_CHORDS = [
  [130.81, 164.81, 196.0], // C3 E3 G3
  [146.83, 174.61, 220.0], // D3 F3 A3
  [110.0, 146.83, 174.61], // A2 D3 F3
  [130.81, 155.56, 196.0], // C3 Eb3 G3
];
const PLAY_CHORDS = [
  [164.81, 196.0, 246.94], // E3 G3 B3
  [196.0, 246.94, 293.66], // G3 B3 D4
  [146.83, 174.61, 220.0], // D3 F3 A3
  [174.61, 220.0, 261.63], // F3 A3 C4
];

let bgmMode = "ambient";
let pulseTimer = null;

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

function playPulse() {
  if (!bgmActive || !enabled || bgmMode !== "play") return;
  const c = ensureAudio();
  if (c && bgmGain) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, c.currentTime + 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0.1, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16);
    osc.connect(g);
    g.connect(bgmGain);
    osc.start();
    osc.stop(c.currentTime + 0.18);
  }
  pulseTimer = setTimeout(playPulse, 480);
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
  const isPlay = bgmMode === "play";
  const chords = isPlay ? PLAY_CHORDS : BGM_CHORDS;
  const duration = isPlay ? 4.5 : 8;
  const chord = chords[bgmIndex % chords.length];
  bgmIndex++;
  chord.forEach((freq) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(1, c.currentTime + (isPlay ? 0.6 : 1.5));
    g.gain.linearRampToValueAtTime(0, c.currentTime + duration - 0.5);
    osc.connect(g);
    g.connect(bgmGain);
    osc.start();
    osc.stop(c.currentTime + duration);
    bgmOscs.push(osc);
  });
  bgmTimer = setTimeout(playBgmChord, duration * 1000);
}

export function startBgm() {
  if (bgmActive || !enabled) return;
  bgmActive = true;
  playBgmChord();
  if (bgmMode === "play") playPulse();
}

export function stopBgm() {
  bgmActive = false;
  if (bgmTimer) clearTimeout(bgmTimer);
  if (pulseTimer) clearTimeout(pulseTimer);
  stopBgmOscs();
}

// プレイ中は少しテンポの速い曲調 + パルスに切り替える。それ以外は落ち着いた曲調に戻す。
export function setBgmMode(mode) {
  if (bgmMode === mode) return;
  bgmMode = mode;
  if (mode === "play" && bgmActive && enabled) {
    if (pulseTimer) clearTimeout(pulseTimer);
    playPulse();
  } else if (pulseTimer) {
    clearTimeout(pulseTimer);
    pulseTimer = null;
  }
}
