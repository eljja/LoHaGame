export type SfxName =
  | "click" | "menu" | "pickup" | "craft" | "mine" | "hit" | "hurt"
  | "death" | "victory" | "phase_day" | "phase_night" | "boss_alert"
  | "heal" | "error" | "thunder" | "wave" | "wood_chop" | "water_splash" | "bird";

export type BgmName = "title" | "day" | "night" | "cave" | "combat" | "victory" | "gameover";

interface Note { f: number; t: number; dur: number; type?: OscillatorType; gain?: number }
interface PercHit { t: number; freq: number; dur: number; gain: number }
interface BgmPattern {
  loopSeconds: number;
  notes: Note[];
  bass?: Note[];
  perc?: PercHit[];
  pad?: { f: number; gain: number; type: OscillatorType };
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmDry: GainNode | null = null;
  private bgmWet: GainNode | null = null;
  private bgmInterval: number | null = null;
  private bgmPadOsc: OscillatorNode | null = null;
  private bgmPadGain: GainNode | null = null;
  private currentBgm: BgmName | null = null;
  muted = false;

  constructor() {
    try { this.muted = typeof localStorage !== "undefined" && localStorage.getItem("loha-audio-muted") === "1"; } catch { /* */ }
  }

  init(): void {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.masterGain);

    // BGM 체인: bgmGain → [dry path] → masterGain
    //                   → [delay feedback reverb] → masterGain
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.22;

    this.bgmDry = this.ctx.createGain();
    this.bgmDry.gain.value = 0.7;

    this.bgmWet = this.ctx.createGain();
    this.bgmWet.gain.value = 0.3;

    const delay = this.ctx.createDelay(1.0);
    delay.delayTime.value = 0.38;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.28;

    this.bgmGain.connect(this.bgmDry);
    this.bgmDry.connect(this.masterGain);

    this.bgmGain.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(this.bgmWet);
    this.bgmWet.connect(this.masterGain);
  }

  resume(): void {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : 1;
    try { localStorage.setItem("loha-audio-muted", m ? "1" : "0"); } catch { /* */ }
  }

  toggleMuted(): boolean { this.setMuted(!this.muted); return this.muted; }

  // ── SFX ──────────────────────────────────────────────────────
  play(name: SfxName): void {
    if (!this.ctx || !this.sfxGain) return;
    switch (name) {
      case "click":
        this.blip(880, 0.04, 0.06, "square");
        break;
      case "menu":
        this.blip(660, 0.06, 0.14, "triangle");
        this.blip(990, 0.05, 0.12, "triangle", 0.06);
        break;
      case "pickup":
        this.blip(740, 0.05, 0.18, "triangle");
        this.blip(1100, 0.06, 0.2, "triangle", 0.06);
        this.blip(1320, 0.04, 0.14, "triangle", 0.12);
        break;
      case "craft":
        this.blip(523, 0.07, 0.18, "square");
        this.blip(659, 0.07, 0.18, "square", 0.09);
        this.blip(784, 0.1, 0.22, "square", 0.18);
        this.blip(1047, 0.12, 0.25, "triangle", 0.30);
        break;
      case "mine":
        this.noise(0.1, 1200, 0.35);
        this.blip(160, 0.12, 0.22, "square", 0.03);
        this.noise(0.08, 600, 0.2, 0.12);
        break;
      case "wood_chop":
        this.noise(0.08, 2200, 0.4);
        this.blip(200, 0.1, 0.18, "sawtooth", 0.02);
        this.noise(0.06, 1800, 0.3, 0.1);
        break;
      case "water_splash":
        this.noise(0.25, 3000, 0.28);
        this.noise(0.18, 4000, 0.18, 0.05);
        this.blip(440, 0.15, 0.08, "sine", 0.03);
        this.blip(660, 0.12, 0.06, "sine", 0.08);
        break;
      case "bird":
        this.slide(1800, 2200, 0.12, "sine", 0.18);
        this.slide(2200, 1600, 0.1, "sine", 0.14, 0.14);
        this.slide(1900, 2400, 0.1, "sine", 0.16, 0.30);
        break;
      case "hit":
        this.noise(0.12, 1800, 0.38);
        this.slide(700, 280, 0.18, "sawtooth", 0.2);
        break;
      case "hurt":
        this.slide(260, 100, 0.35, "sawtooth", 0.3);
        this.noise(0.1, 400, 0.2, 0.05);
        break;
      case "death":
        this.slide(320, 65, 1.4, "sawtooth", 0.35);
        this.slide(220, 50, 1.8, "triangle", 0.28);
        this.noise(0.6, 300, 0.15, 0.2);
        break;
      case "victory":
        this.blip(523, 0.18, 0.3, "triangle", 0);
        this.blip(659, 0.18, 0.3, "triangle", 0.16);
        this.blip(784, 0.18, 0.3, "triangle", 0.32);
        this.blip(1047, 0.5, 0.4, "triangle", 0.5);
        this.blip(1318, 0.4, 0.35, "triangle", 0.75);
        break;
      case "phase_day":
        this.blip(523, 0.2, 0.25, "triangle");
        this.blip(659, 0.2, 0.22, "triangle", 0.15);
        this.blip(784, 0.2, 0.2, "triangle", 0.3);
        break;
      case "phase_night":
        this.blip(392, 0.25, 0.25, "triangle");
        this.blip(330, 0.3, 0.22, "triangle", 0.18);
        this.blip(262, 0.4, 0.28, "triangle", 0.38);
        break;
      case "boss_alert":
        this.slide(100, 380, 0.45, "sawtooth", 0.35);
        this.slide(380, 100, 0.45, "sawtooth", 0.35, 0.45);
        this.noise(0.3, 500, 0.15, 0.1);
        break;
      case "heal":
        this.blip(659, 0.12, 0.22, "sine");
        this.blip(880, 0.12, 0.22, "sine", 0.1);
        this.blip(1175, 0.22, 0.25, "sine", 0.22);
        break;
      case "error":
        this.blip(220, 0.1, 0.22, "square");
        this.blip(165, 0.12, 0.22, "square", 0.12);
        break;
      case "thunder":
        this.noise(0.9, 300, 0.7);
        this.noise(0.5, 600, 0.4, 0.1);
        break;
      case "wave":
        this.noise(2.0, 500, 0.12);
        this.noise(1.5, 800, 0.08, 0.4);
        break;
    }
  }

  // ── BGM ──────────────────────────────────────────────────────
  playBgm(name: BgmName): void {
    this.init();
    if (!this.ctx || !this.bgmGain) return;
    if (this.currentBgm === name) return;
    this.stopBgm();
    this.currentBgm = name;

    const pattern = this.bgmPattern(name);
    if (!pattern) return;

    if (pattern.pad) {
      const pad = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      pad.type = pattern.pad.type;
      pad.frequency.value = pattern.pad.f;
      g.gain.value = pattern.pad.gain;
      pad.connect(g);
      g.connect(this.bgmGain);
      pad.start();
      this.bgmPadOsc = pad;
      this.bgmPadGain = g;
    }

    const schedule = () => {
      if (!this.ctx || !this.bgmGain) return;
      const base = this.ctx.currentTime;
      for (const n of pattern.notes) this.scheduleNote(n, base, this.bgmGain);
      if (pattern.bass) for (const n of pattern.bass) this.scheduleNote(n, base, this.bgmGain, 0.65);
      if (pattern.perc) for (const p of pattern.perc) this.schedulePerc(p, base);
    };
    schedule();
    this.bgmInterval = window.setInterval(schedule, pattern.loopSeconds * 1000);
  }

  stopBgm(): void {
    if (this.bgmInterval != null) { window.clearInterval(this.bgmInterval); this.bgmInterval = null; }
    if (this.bgmPadOsc) { try { this.bgmPadOsc.stop(); } catch { /**/ } this.bgmPadOsc.disconnect(); this.bgmPadOsc = null; }
    if (this.bgmPadGain) { this.bgmPadGain.disconnect(); this.bgmPadGain = null; }
    this.currentBgm = null;
  }

  private scheduleNote(n: Note, base: number, dest: AudioNode, gainMul = 1): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = n.type ?? "triangle";
    osc.frequency.value = n.f;
    const peak = (n.gain ?? 0.2) * gainMul;
    g.gain.setValueAtTime(0, base + n.t);
    g.gain.linearRampToValueAtTime(peak, base + n.t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, base + n.t + n.dur);
    osc.connect(g); g.connect(dest);
    osc.start(base + n.t);
    osc.stop(base + n.t + n.dur + 0.05);
  }

  private schedulePerc(p: PercHit, base: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const bufSize = Math.max(1, Math.floor(this.ctx.sampleRate * p.dur));
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.15));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = p.freq;
    filt.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(p.gain, base + p.t);
    g.gain.exponentialRampToValueAtTime(0.0001, base + p.t + p.dur);
    src.connect(filt); filt.connect(g); g.connect(this.bgmGain);
    src.start(base + p.t);
    src.stop(base + p.t + p.dur + 0.05);
  }

  // ── BGM 패턴 ────────────────────────────────────────────────
  private bgmPattern(name: BgmName): BgmPattern | null {
    switch (name) {

      // 타이틀: 고요한 해변 저녁, Am 아르페지오 + 파도 리버브
      case "title": {
        const b = (i: number) => i * 0.55;
        return {
          loopSeconds: 11,
          notes: [
            { f: 220, t: b(0), dur: 0.8, type: "triangle", gain: 0.16 },
            { f: 277, t: b(1), dur: 0.8, type: "triangle", gain: 0.15 },
            { f: 330, t: b(2), dur: 0.8, type: "triangle", gain: 0.15 },
            { f: 440, t: b(3), dur: 1.2, type: "triangle", gain: 0.18 },
            { f: 330, t: b(5), dur: 0.8, type: "triangle", gain: 0.15 },
            { f: 262, t: b(6), dur: 0.8, type: "triangle", gain: 0.14 },
            { f: 247, t: b(7), dur: 0.8, type: "triangle", gain: 0.14 },
            { f: 220, t: b(8), dur: 1.4, type: "triangle", gain: 0.16 },
            // 상단 멜로디
            { f: 659, t: b(3), dur: 1.0, type: "sine", gain: 0.09 },
            { f: 587, t: b(5), dur: 0.7, type: "sine", gain: 0.08 },
            { f: 523, t: b(7), dur: 1.2, type: "sine", gain: 0.09 },
          ],
          bass: [
            { f: 110, t: 0,   dur: 5.0, type: "sine", gain: 0.2 },
            { f: 98,  t: 5.5, dur: 5.0, type: "sine", gain: 0.2 },
          ],
          pad: { f: 55, gain: 0.06, type: "sine" },
        };
      }

      // 낮: 열대 섬 오후, 펜타토닉 C + 나무통 퍼커션
      case "day": {
        // C 펜타토닉: C D E G A — 523 587 659 784 880 1047
        const mel: Note[] = [
          { f: 784,  t: 0.0,  dur: 0.28, type: "triangle", gain: 0.14 },
          { f: 880,  t: 0.33, dur: 0.28, type: "triangle", gain: 0.13 },
          { f: 1047, t: 0.66, dur: 0.4,  type: "triangle", gain: 0.15 },
          { f: 880,  t: 1.2,  dur: 0.28, type: "triangle", gain: 0.13 },
          { f: 784,  t: 1.53, dur: 0.28, type: "triangle", gain: 0.13 },
          { f: 659,  t: 1.86, dur: 0.4,  type: "triangle", gain: 0.14 },
          { f: 523,  t: 2.4,  dur: 0.28, type: "triangle", gain: 0.13 },
          { f: 587,  t: 2.73, dur: 0.28, type: "triangle", gain: 0.12 },
          { f: 659,  t: 3.06, dur: 0.4,  type: "triangle", gain: 0.14 },
          { f: 784,  t: 3.6,  dur: 0.28, type: "triangle", gain: 0.13 },
          { f: 880,  t: 3.93, dur: 0.28, type: "triangle", gain: 0.13 },
          { f: 784,  t: 4.26, dur: 0.28, type: "triangle", gain: 0.12 },
          { f: 659,  t: 4.59, dur: 0.4,  type: "triangle", gain: 0.14 },
          // 카운터 멜로디
          { f: 523,  t: 0.16, dur: 0.22, type: "sine", gain: 0.07 },
          { f: 587,  t: 0.83, dur: 0.22, type: "sine", gain: 0.07 },
          { f: 523,  t: 1.66, dur: 0.22, type: "sine", gain: 0.07 },
          { f: 440,  t: 2.5,  dur: 0.3,  type: "sine", gain: 0.08 },
          { f: 392,  t: 3.3,  dur: 0.22, type: "sine", gain: 0.07 },
          { f: 440,  t: 4.1,  dur: 0.22, type: "sine", gain: 0.07 },
        ];
        // 나무통 퍼커션: 나무 타격음 (고주파 bandpass noise)
        const perc: PercHit[] = [
          { t: 0.0,  freq: 800,  dur: 0.12, gain: 0.5 },
          { t: 0.66, freq: 500,  dur: 0.1,  gain: 0.3 },
          { t: 1.33, freq: 800,  dur: 0.12, gain: 0.5 },
          { t: 1.66, freq: 1200, dur: 0.08, gain: 0.25 },
          { t: 2.0,  freq: 800,  dur: 0.12, gain: 0.5 },
          { t: 2.66, freq: 500,  dur: 0.1,  gain: 0.3 },
          { t: 3.33, freq: 800,  dur: 0.12, gain: 0.5 },
          { t: 3.83, freq: 1200, dur: 0.08, gain: 0.25 },
          { t: 4.0,  freq: 800,  dur: 0.12, gain: 0.5 },
          { t: 4.66, freq: 500,  dur: 0.1,  gain: 0.3 },
        ];
        return {
          loopSeconds: 5.2,
          notes: mel,
          bass: [
            { f: 131, t: 0,   dur: 2.4, type: "sine", gain: 0.2 },
            { f: 110, t: 2.6, dur: 2.4, type: "sine", gain: 0.2 },
          ],
          perc,
        };
      }

      // 밤: 드론 + 귀뚜라미 블립 + 올빼미풍 하강 음
      case "night": {
        const cricket = (): Note[] => {
          const out: Note[] = [];
          const times = [0.4, 1.1, 2.3, 3.5, 4.0, 5.2, 6.4, 7.8];
          for (const t of times) {
            out.push({ f: 4200, t, dur: 0.04, type: "sine", gain: 0.06 });
            out.push({ f: 4200, t: t + 0.07, dur: 0.04, type: "sine", gain: 0.05 });
          }
          return out;
        };
        return {
          loopSeconds: 10,
          notes: [
            // 올빼미풍 하강
            { f: 392, t: 0.5, dur: 0.9, type: "sine", gain: 0.12 },
            { f: 330, t: 1.5, dur: 0.9, type: "sine", gain: 0.11 },
            { f: 262, t: 2.6, dur: 1.4, type: "sine", gain: 0.12 },
            // 중간 화음
            { f: 349, t: 5.0, dur: 0.8, type: "sine", gain: 0.10 },
            { f: 293, t: 6.0, dur: 0.8, type: "sine", gain: 0.10 },
            { f: 247, t: 7.2, dur: 1.2, type: "sine", gain: 0.11 },
            ...cricket(),
          ],
          bass: [
            { f: 73, t: 0, dur: 4.5, type: "sine", gain: 0.18 },
            { f: 65, t: 5, dur: 4.5, type: "sine", gain: 0.18 },
          ],
          pad: { f: 36, gain: 0.08, type: "sine" },
        };
      }

      // 동굴: 깊은 서브 드론 + 물방울 + 금속 핑
      case "cave": {
        const drips: Note[] = [
          { f: 1760, t: 1.2,  dur: 0.1,  type: "sine", gain: 0.1  },
          { f: 2093, t: 3.8,  dur: 0.1,  type: "sine", gain: 0.09 },
          { f: 1480, t: 6.1,  dur: 0.12, type: "sine", gain: 0.1  },
          { f: 1760, t: 8.4,  dur: 0.1,  type: "sine", gain: 0.08 },
        ];
        return {
          loopSeconds: 12,
          notes: [
            { f: 110, t: 0,  dur: 5.5, type: "triangle", gain: 0.1 },
            { f: 98,  t: 6,  dur: 5.5, type: "triangle", gain: 0.1 },
            // 금속 반향
            { f: 440, t: 2.5, dur: 0.18, type: "sine", gain: 0.1 },
            { f: 587, t: 7.0, dur: 0.18, type: "sine", gain: 0.1 },
            ...drips,
          ],
          pad: { f: 55, gain: 0.09, type: "sawtooth" },
        };
      }

      // 전투: 강렬한 퍼커션 + 긴박 Em 리프
      case "combat": {
        const seq = [165, 196, 247, 165, 196, 330, 247, 196];
        const mel: Note[] = [];
        for (let bar = 0; bar < 2; bar++) {
          for (let i = 0; i < seq.length; i++) {
            mel.push({ f: seq[i], t: bar * 2 + i * 0.25, dur: 0.16, type: "square", gain: 0.13 });
          }
        }
        const perc: PercHit[] = [];
        // 킥 (저음 타격)
        for (let i = 0; i < 4; i++) perc.push({ t: i * 1.0, freq: 80, dur: 0.22, gain: 0.7 });
        // 스네어
        for (let i = 0; i < 4; i++) perc.push({ t: 0.5 + i * 1.0, freq: 400, dur: 0.15, gain: 0.5 });
        // 하이햇
        for (let i = 0; i < 8; i++) perc.push({ t: i * 0.5, freq: 8000, dur: 0.06, gain: 0.3 });
        return {
          loopSeconds: 4,
          notes: mel,
          bass: [
            { f: 82,  t: 0,   dur: 0.4, type: "sawtooth", gain: 0.22 },
            { f: 82,  t: 1.0, dur: 0.4, type: "sawtooth", gain: 0.22 },
            { f: 110, t: 2.0, dur: 0.4, type: "sawtooth", gain: 0.22 },
            { f: 98,  t: 3.0, dur: 0.4, type: "sawtooth", gain: 0.22 },
          ],
          perc,
        };
      }

      // 승리: 밝은 팡파르 C장조 + 퍼커션
      case "victory": {
        const perc: PercHit[] = [
          { t: 0.0, freq: 700, dur: 0.15, gain: 0.6 },
          { t: 0.3, freq: 700, dur: 0.15, gain: 0.5 },
          { t: 0.9, freq: 700, dur: 0.15, gain: 0.6 },
          { t: 1.5, freq: 500, dur: 0.18, gain: 0.5 },
          { t: 2.4, freq: 700, dur: 0.15, gain: 0.6 },
          { t: 3.0, freq: 700, dur: 0.15, gain: 0.5 },
        ];
        return {
          loopSeconds: 7,
          notes: [
            { f: 523,  t: 0.0, dur: 0.25, type: "triangle", gain: 0.2 },
            { f: 659,  t: 0.3, dur: 0.25, type: "triangle", gain: 0.2 },
            { f: 784,  t: 0.6, dur: 0.25, type: "triangle", gain: 0.2 },
            { f: 1047, t: 0.9, dur: 0.8,  type: "triangle", gain: 0.22 },
            { f: 880,  t: 2.1, dur: 0.3,  type: "triangle", gain: 0.2 },
            { f: 1047, t: 2.5, dur: 0.3,  type: "triangle", gain: 0.2 },
            { f: 1319, t: 2.9, dur: 1.0,  type: "triangle", gain: 0.22 },
            { f: 784,  t: 4.2, dur: 0.3,  type: "triangle", gain: 0.18 },
            { f: 880,  t: 4.6, dur: 0.3,  type: "triangle", gain: 0.18 },
            { f: 1047, t: 5.0, dur: 1.8,  type: "triangle", gain: 0.2 },
            // 화음층
            { f: 659,  t: 0.9, dur: 0.8,  type: "sine", gain: 0.1 },
            { f: 784,  t: 2.9, dur: 1.0,  type: "sine", gain: 0.1 },
          ],
          bass: [
            { f: 131, t: 0,   dur: 2.0, type: "sine", gain: 0.22 },
            { f: 165, t: 2.1, dur: 2.0, type: "sine", gain: 0.22 },
            { f: 196, t: 4.2, dur: 2.5, type: "sine", gain: 0.22 },
          ],
          perc,
        };
      }

      // 게임오버: 비통한 하강 선율
      case "gameover": {
        return {
          loopSeconds: 10,
          notes: [
            { f: 392, t: 0.0, dur: 1.8, type: "sine", gain: 0.14 },
            { f: 349, t: 2.2, dur: 1.8, type: "sine", gain: 0.14 },
            { f: 311, t: 4.4, dur: 1.8, type: "sine", gain: 0.13 },
            { f: 262, t: 6.6, dur: 2.8, type: "sine", gain: 0.14 },
            // 상성(上聲)
            { f: 523, t: 0.0, dur: 1.5, type: "triangle", gain: 0.08 },
            { f: 494, t: 2.2, dur: 1.5, type: "triangle", gain: 0.08 },
            { f: 440, t: 4.4, dur: 1.5, type: "triangle", gain: 0.07 },
          ],
          bass: [
            { f: 98, t: 0,   dur: 4.5, type: "sine", gain: 0.18 },
            { f: 87, t: 5,   dur: 4.5, type: "sine", gain: 0.16 },
          ],
          pad: { f: 49, gain: 0.08, type: "sine" },
        };
      }
    }
    return null;
  }

  // ── 기본 음원 헬퍼 ──────────────────────────────────────────
  private blip(freq: number, dur: number, gain: number, type: OscillatorType, delay = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const base = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, base);
    g.gain.linearRampToValueAtTime(gain, base + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, base + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(base); osc.stop(base + dur + 0.05);
  }

  private slide(fromF: number, toF: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const base = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromF, base);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, toF), base + dur);
    g.gain.setValueAtTime(0, base);
    g.gain.linearRampToValueAtTime(gain, base + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, base + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(base); osc.stop(base + dur + 0.05);
  }

  private noise(dur: number, filterFreq: number, gain: number, delay = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const base = this.ctx.currentTime + delay;
    const bufSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, base);
    g.gain.linearRampToValueAtTime(gain, base + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, base + dur);
    src.connect(filt); filt.connect(g); g.connect(this.sfxGain);
    src.start(base); src.stop(base + dur + 0.05);
  }
}

export const audio = new AudioManager();
