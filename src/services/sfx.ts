import { useGameStore } from "@/store/gameStore";

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = new AudioCtor();
  return ctx;
}

function enabled(): boolean {
  return useGameStore.getState().sfxEnabled;
}

function envelopedTone(opts: {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  freqEnd?: number;
}): void {
  if (!enabled()) return;
  const c = ac();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(opts.freqEnd, now + opts.duration);
  }
  const peak = opts.gain ?? 0.18;
  const atk = opts.attack ?? 0.005;
  const rel = opts.release ?? 0.05;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + atk);
  g.gain.setValueAtTime(peak, now + opts.duration - rel);
  g.gain.linearRampToValueAtTime(0, now + opts.duration);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + opts.duration + 0.02);
}

function noiseBurst(opts: {
  duration: number;
  gain?: number;
  filterFreq?: number;
}): void {
  if (!enabled()) return;
  const c = ac();
  if (!c) return;
  const now = c.currentTime;
  const buffer = c.createBuffer(
    1,
    Math.max(1, Math.floor(c.sampleRate * opts.duration)),
    c.sampleRate
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.15, now);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = opts.filterFreq ?? 1500;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(now);
  src.stop(now + opts.duration);
}

export const Sfx = {
  // ユーザー操作でAudioContextをアンロック
  unlock(): void {
    const c = ac();
    if (!c) return;
    if (c.state === "suspended") {
      c.resume().catch(() => {
        /* noop */
      });
    }
  },
  attackHit(): void {
    noiseBurst({ duration: 0.08, gain: 0.18, filterFreq: 1800 });
  },
  unitAttack(): void {
    envelopedTone({
      freq: 320,
      freqEnd: 220,
      duration: 0.08,
      type: "square",
      gain: 0.08,
    });
  },
  generalDamage(): void {
    envelopedTone({
      freq: 180,
      freqEnd: 100,
      duration: 0.18,
      type: "sawtooth",
      gain: 0.22,
    });
  },
  generalAttackHit(): void {
    envelopedTone({
      freq: 520,
      freqEnd: 360,
      duration: 0.1,
      type: "triangle",
      gain: 0.18,
    });
  },
  dodge(): void {
    envelopedTone({
      freq: 720,
      freqEnd: 1100,
      duration: 0.12,
      type: "triangle",
      gain: 0.12,
    });
  },
  skill(): void {
    envelopedTone({
      freq: 440,
      freqEnd: 880,
      duration: 0.22,
      type: "sine",
      gain: 0.18,
    });
  },
  victory(): void {
    envelopedTone({ freq: 523, duration: 0.18, gain: 0.18, type: "triangle" });
    setTimeout(
      () => envelopedTone({ freq: 659, duration: 0.18, gain: 0.18, type: "triangle" }),
      150
    );
    setTimeout(
      () => envelopedTone({ freq: 784, duration: 0.3, gain: 0.2, type: "triangle" }),
      300
    );
  },
  defeat(): void {
    envelopedTone({ freq: 330, freqEnd: 110, duration: 0.6, gain: 0.22, type: "sawtooth" });
  },
};
