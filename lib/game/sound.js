// Efeitos sonoros gerados no navegador com a Web Audio API: nada é baixado,
// e não há arquivos de áudio nem licenças envolvidas.

const STORAGE_KEY = "nublue-sound";
let context = null;

export function isSoundEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Sem armazenamento, a preferência vale só nesta visita.
  }
}

function audioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return null;
  context ??= new AudioContextClass();
  if (context.state === "suspended") context.resume().catch(() => undefined);
  return context;
}

// Cada som é uma sequência de notas: [frequência (Hz), início (s), duração (s)].
const SOUNDS = {
  tap: { wave: "triangle", volume: 0.08, notes: [[660, 0, 0.05]] },
  correct: {
    wave: "sine",
    volume: 0.18,
    notes: [
      [660, 0, 0.12],
      [880, 0.1, 0.18],
    ],
  },
  wrong: {
    wave: "square",
    volume: 0.07,
    notes: [
      [220, 0, 0.14],
      [165, 0.12, 0.22],
    ],
  },
  complete: {
    wave: "triangle",
    volume: 0.2,
    notes: [
      [523, 0, 0.12],
      [659, 0.12, 0.12],
      [784, 0.24, 0.12],
      [1047, 0.36, 0.3],
    ],
  },
  fail: {
    wave: "sawtooth",
    volume: 0.06,
    notes: [
      [392, 0, 0.18],
      [330, 0.18, 0.18],
      [262, 0.36, 0.35],
    ],
  },
  lives: {
    wave: "sine",
    volume: 0.16,
    notes: [
      [587, 0, 0.1],
      [740, 0.1, 0.1],
      [880, 0.2, 0.22],
    ],
  },
  achievement: {
    wave: "triangle",
    volume: 0.2,
    notes: [
      [784, 0, 0.1],
      [988, 0.1, 0.1],
      [1175, 0.2, 0.1],
      [1568, 0.3, 0.32],
    ],
  },
};

/** Toca um efeito ("tap", "correct", "wrong", "complete", "fail", "lives", "achievement"). */
export function playSound(name) {
  const sound = SOUNDS[name];
  if (!sound || !isSoundEnabled()) return;
  const ctx = audioContext();
  if (!ctx) return;
  const start = ctx.currentTime;
  for (const [frequency, offset, duration] of sound.notes) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = sound.wave;
    oscillator.frequency.setValueAtTime(frequency, start + offset);
    // Envelope curto para não estalar no começo nem no fim.
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(sound.volume, start + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + duration + 0.02);
  }
}
