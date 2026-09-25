// おもちゃ箱シューティングギャラリー専用のオーディオモジュール。
// すごろく側の audio.js と同じ方針(Web Audio APIでその場で音を合成、
// 音声ファイル不要)を踏襲しつつ、こちらは独立したモジュール状態を持つ
// (すごろく側のBGM設定と混ざらないように)。
// ステージごとに曲調(コード進行/テンポ/音色)を変え、"ready/cleared"画面は
// ゆったりしたアンビエント、プレイ中は少しテンポの速い曲調+パルスにする。

let ctx = null;
let enabled = true;
let bgmGain = null;
let bgmActive = false;
let bgmTimer = null;
let bgmOscs = [];
let bgmIndex = 0;
let pulseTimer = null;
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

// ---- 効果音 ----
export function sfxHit() {
  playTone(880, 0.07, "sine", 0.14);
}
export function sfxMiss() {
  playTone(180, 0.09, "square", 0.05);
}
export function sfxSecretFound() {
  [660, 880, 1320].forEach((f, i) => playTone(f, 0.14, "triangle", 0.15, i * 0.05));
}
export function sfxStageClear() {
  [523, 659, 784, 1047].forEach((f, i) => playTone(f, 0.22, "triangle", 0.16, i * 0.1));
}

// ---- BGM ----
// ステージごとに曲調(コード進行・音色・テンポ)を変える。ready/cleared画面は
// ステージ1相当のゆったりしたアンビエントにしておく。
const STAGE_MUSIC = {
  1: {
    // きょうりゅうのふうせん: 明るいC durのI-IV-V-I。開放的でおだやかな導入
    chords: [
      [261.63, 329.63, 392.0], // C4 E4 G4 (C)
      [349.23, 440.0, 523.25], // F4 A4 C5 (F)
      [392.0, 493.88, 587.33], // G4 B4 D5 (G)
      [261.63, 329.63, 392.0], // C4 E4 G4 (C)
    ],
    type: "triangle", playDur: 4.6, ambientDur: 6.5, pulse: false,
  },
  2: {
    // メリーゴーランド: G durの音楽箱のようなワルツ調
    chords: [
      [392.0, 493.88, 587.33], // G4 B4 D5 (G)
      [523.25, 659.25, 783.99], // C5 E5 G5 (C)
      [587.33, 739.99, 880.0], // D5 F#5 A5 (D)
      [392.0, 493.88, 587.33], // G4 B4 D5 (G)
    ],
    type: "triangle", playDur: 3.0, ambientDur: 5.6, pulse: false,
  },
  3: {
    // ロボットたいせん: D durの元気なI-V-IV-V。電子的な音色でテンポよく
    chords: [
      [293.66, 369.99, 440.0], // D4 F#4 A4 (D)
      [440.0, 554.37, 659.25], // A4 C#5 E5 (A)
      [392.0, 493.88, 587.33], // G4 B4 D5 (G)
      [440.0, 554.37, 659.25], // A4 C#5 E5 (A)
    ],
    type: "square", playDur: 2.4, ambientDur: 5.0, pulse: true,
  },
  4: {
    // アヒルのぎょうれつ: G durの明るく弾むテンポ
    chords: [
      [392.0, 493.88, 587.33], // G4 B4 D5 (G)
      [440.0, 554.37, 659.25], // A4 C#5 E5 (A)
      [523.25, 659.25, 783.99], // C5 E5 G5 (C)
      [587.33, 739.99, 880.0], // D5 F#5 A5 (D)
    ],
    type: "triangle", playDur: 1.9, ambientDur: 4.6, pulse: true,
  },
  5: {
    // もくばのまと: C durのI-IV-V-Iで締めくくる、フィナーレらしい力強い進行
    chords: [
      [261.63, 329.63, 392.0], // C4 E4 G4 (C)
      [349.23, 440.0, 523.25], // F4 A4 C5 (F)
      [392.0, 493.88, 587.33], // G4 B4 D5 (G)
      [261.63, 329.63, 392.0], // C4 E4 G4 (C)
    ],
    type: "sawtooth", playDur: 1.7, ambientDur: 4.2, pulse: true,
  },
};

let bgmMode = "ambient"; // "ambient" | "play"
let bgmStage = 1;

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

function currentMusic() {
  return STAGE_MUSIC[bgmStage] || STAGE_MUSIC[1];
}

function playPulse() {
  const music = currentMusic();
  if (!bgmActive || !enabled || bgmMode !== "play" || !music.pulse) return;
  const c = ensureAudio();
  if (c && bgmGain) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(100, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(42, c.currentTime + 0.1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.09, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
    osc.connect(g);
    g.connect(bgmGain);
    osc.start();
    osc.stop(c.currentTime + 0.16);
  }
  pulseTimer = setTimeout(playPulse, 420);
}

function playBgmChord() {
  if (!bgmActive || !enabled) return;
  const c = ensureAudio();
  if (!c) return;
  if (!bgmGain) {
    bgmGain = c.createGain();
    bgmGain.gain.value = 0.065;
    bgmGain.connect(c.destination);
  }
  stopBgmOscs();
  const music = currentMusic();
  const isPlay = bgmMode === "play";
  const duration = isPlay ? music.playDur : music.ambientDur;
  const chord = music.chords[bgmIndex % music.chords.length];
  bgmIndex++;
  chord.forEach((freq) => {
    const osc = c.createOscillator();
    osc.type = music.type;
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(1, c.currentTime + (isPlay ? 0.4 : 1.4));
    g.gain.linearRampToValueAtTime(0, c.currentTime + duration - 0.4);
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

// ステージ(1〜5)ごとにBGMの曲調を切り替える。次のコード切り替わりの
// タイミングから反映される(鳴っている音を途中で切らないため)。
export function setBgmStage(stageId) {
  if (!STAGE_MUSIC[stageId] || bgmStage === stageId) return;
  bgmStage = stageId;
}

// プレイ中は少しテンポの速い曲調(+対応ステージはパルス)に切り替える。
// それ以外(ホーム/ロビー/ステージ開始待ち/クリア画面)は落ち着いた曲調に戻す。
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
