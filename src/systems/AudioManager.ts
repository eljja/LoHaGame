export type SfxName =
  | "click" | "menu" | "pickup" | "craft" | "mine" | "hit" | "hurt"
  | "death" | "victory" | "phase_day" | "phase_night" | "boss_alert"
  | "heal" | "error" | "thunder" | "wave" | "wood_chop" | "water_splash" | "bird";

export type BgmName =
  | "title" | "day" | "night" | "cave" | "combat" | "victory" | "gameover"
  | "tense" | "combat_intense";

interface Note {
  f: number;             // fundamental frequency
  t: number;             // start time within loop
  dur: number;           // duration
  type?: OscillatorType;
  gain?: number;
  /** 화성 배수: [1, 0.3, 0.15] = fundamental + 2nd harmonic at 0.3 amp + 3rd at 0.15 */
  harm?: number[];
  /** Detune cents — 미세 어긋남으로 chorus/warmth 효과 (양수: 위로 detune, 음수: 아래) */
  detune?: number;
  /** Lowpass filter cutoff Hz — 음색을 부드럽게 */
  filter?: number;
  /** Attack 시간 (s, 기본 0.015) */
  attack?: number;
}

interface PercHit { t: number; freq: number; dur: number; gain: number }

interface BgmPattern {
  loopSeconds: number;
  notes: Note[];
  bass?: Note[];
  perc?: PercHit[];
  /** 지속 패드: detune 으로 chorus 효과 */
  pad?: { f: number; gain: number; type: OscillatorType; detune?: number };
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmDry: GainNode | null = null;
  private bgmWet: GainNode | null = null;
  private bgmInterval: number | null = null;
  /** 현재 BGM의 패드 osc/gain 목록 (detune된 multi-pad 가능). */
  private bgmPadNodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];
  private currentBgm: BgmName | null = null;
  /** Cross-fade 진행 중 새 BGM이 들어왔을 때 무시할 timeout id */
  private bgmFadeTimer: number | null = null;
  /** BGM 정상 게인 (cross-fade target) */
  private readonly BGM_NORMAL_GAIN = 0.22;
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

    // BGM 체인: bgmGain → [dry] → masterGain
    //                   → [delay feedback reverb wet] → masterGain
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.BGM_NORMAL_GAIN;

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
  /** BGM 변경 — cross-fade 효과로 부드럽게 전환. 같은 BGM이면 무시. */
  playBgm(name: BgmName): void {
    this.init();
    if (!this.ctx || !this.bgmGain) return;
    if (this.currentBgm === name) return;

    const ctx = this.ctx;
    const gainNode = this.bgmGain;
    const fadeMs = 400;

    const startNew = () => {
      if (!this.ctx || !this.bgmGain) return;
      this.stopBgmInternal();
      this.currentBgm = name;
      const pattern = this.bgmPattern(name);
      if (!pattern) return;

      // Pad: 여러 detune된 osc 동시 재생으로 chorus 효과
      if (pattern.pad) {
        const pad = pattern.pad;
        const detuneOpts = pad.detune ?? 0;
        const padCount = detuneOpts > 0 ? 2 : 1;
        for (let i = 0; i < padCount; i++) {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = pad.type;
          osc.frequency.value = pad.f;
          if (detuneOpts > 0) osc.detune.value = (i === 0 ? -1 : 1) * detuneOpts;
          g.gain.value = pad.gain;
          osc.connect(g);
          g.connect(this.bgmGain);
          osc.start();
          this.bgmPadNodes.push({ osc, gain: g });
        }
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

      // Fade in 새 BGM
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.BGM_NORMAL_GAIN, ctx.currentTime + fadeMs / 1000);
    };

    // 기존 BGM이 없으면 페이드 없이 즉시 시작
    if (this.currentBgm === null) {
      startNew();
      return;
    }

    // Cross-fade: 기존 BGM 페이드 아웃 → 새 BGM 페이드 인
    gainNode.gain.cancelScheduledValues(ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeMs / 1000);

    // 이전에 진행 중이던 fade 타이머가 있으면 무효화
    if (this.bgmFadeTimer != null) {
      window.clearTimeout(this.bgmFadeTimer);
      this.bgmFadeTimer = null;
    }
    this.bgmFadeTimer = window.setTimeout(() => {
      this.bgmFadeTimer = null;
      startNew();
    }, fadeMs + 30);
  }

  stopBgm(): void {
    if (this.bgmFadeTimer != null) { window.clearTimeout(this.bgmFadeTimer); this.bgmFadeTimer = null; }
    this.stopBgmInternal();
    this.currentBgm = null;
  }

  private stopBgmInternal(): void {
    if (this.bgmInterval != null) { window.clearInterval(this.bgmInterval); this.bgmInterval = null; }
    for (const { osc, gain } of this.bgmPadNodes) {
      try { osc.stop(); } catch { /* */ }
      osc.disconnect();
      gain.disconnect();
    }
    this.bgmPadNodes = [];
  }

  /** 풍부한 voice — fundamental + harmonics + optional detune + optional lowpass filter. */
  private scheduleNote(n: Note, base: number, dest: AudioNode, gainMul = 1): void {
    if (!this.ctx) return;
    const peak = (n.gain ?? 0.2) * gainMul;
    const attack = n.attack ?? 0.015;
    const release = Math.min(n.dur * 0.4, 0.15);
    const startT = base + n.t;
    const endT = startT + n.dur;

    // ADSR envelope
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, startT);
    env.gain.linearRampToValueAtTime(peak, startT + attack);
    env.gain.setValueAtTime(peak, Math.max(startT + attack, endT - release));
    env.gain.exponentialRampToValueAtTime(0.0001, endT);

    // Optional lowpass filter for warmth
    let envOut: AudioNode = env;
    if (n.filter) {
      const filt = this.ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = n.filter;
      filt.Q.value = 0.7;
      env.connect(filt);
      envOut = filt;
    }
    envOut.connect(dest);

    // Harmonics: [1] = single fundamental, [1, 0.3, 0.15] = + 2nd + 3rd partials
    const harm = n.harm ?? [1];
    const detune = n.detune ?? 0;
    const oscType: OscillatorType = n.type ?? "triangle";

    for (let h = 0; h < harm.length; h++) {
      const ampl = harm[h];
      if (ampl <= 0) continue;
      const partialGain = this.ctx.createGain();
      partialGain.gain.value = ampl;
      partialGain.connect(env);

      // Detune된 멀티 osc (chorus 효과)
      const oscCount = detune > 0 ? 2 : 1;
      for (let d = 0; d < oscCount; d++) {
        const osc = this.ctx.createOscillator();
        osc.type = oscType;
        osc.frequency.value = n.f * (h + 1);
        if (detune > 0) osc.detune.value = (d === 0 ? -1 : 1) * detune;
        osc.connect(partialGain);
        osc.start(startT);
        osc.stop(endT + 0.1);
      }
    }
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
  // 모든 패턴에 harmonics + filter 적용해 부드럽고 풍부한 음색.
  private bgmPattern(name: BgmName): BgmPattern | null {
    switch (name) {

      // 타이틀: 고요한 해변 저녁, Am 아르페지오 + 풍부한 화성
      case "title": {
        const b = (i: number) => i * 0.55;
        return {
          loopSeconds: 11,
          notes: [
            { f: 220, t: b(0), dur: 0.8, type: "triangle", gain: 0.16, harm: [1, 0.25, 0.1], filter: 1800 },
            { f: 277, t: b(1), dur: 0.8, type: "triangle", gain: 0.15, harm: [1, 0.25, 0.1], filter: 1800 },
            { f: 330, t: b(2), dur: 0.8, type: "triangle", gain: 0.15, harm: [1, 0.25, 0.1], filter: 1800 },
            { f: 440, t: b(3), dur: 1.2, type: "triangle", gain: 0.18, harm: [1, 0.3, 0.12], filter: 2000 },
            { f: 330, t: b(5), dur: 0.8, type: "triangle", gain: 0.15, harm: [1, 0.25, 0.1], filter: 1800 },
            { f: 262, t: b(6), dur: 0.8, type: "triangle", gain: 0.14, harm: [1, 0.25, 0.1], filter: 1700 },
            { f: 247, t: b(7), dur: 0.8, type: "triangle", gain: 0.14, harm: [1, 0.25, 0.1], filter: 1700 },
            { f: 220, t: b(8), dur: 1.4, type: "triangle", gain: 0.16, harm: [1, 0.3, 0.12], filter: 1800 },
            // 상단 멜로디 — sine 기반 부드럽게
            { f: 659, t: b(3), dur: 1.0, type: "sine", gain: 0.10, harm: [1, 0.15], filter: 2400, detune: 6 },
            { f: 587, t: b(5), dur: 0.7, type: "sine", gain: 0.09, harm: [1, 0.15], filter: 2400, detune: 6 },
            { f: 523, t: b(7), dur: 1.2, type: "sine", gain: 0.10, harm: [1, 0.18], filter: 2400, detune: 6 },
          ],
          bass: [
            { f: 110, t: 0,   dur: 5.0, type: "sine", gain: 0.20, harm: [1, 0.3] },
            { f: 98,  t: 5.5, dur: 5.0, type: "sine", gain: 0.20, harm: [1, 0.3] },
          ],
          pad: { f: 55, gain: 0.06, type: "sine", detune: 8 },
        };
      }

      // 낮: 열대 섬 오후, 펜타토닉 C + 나무통 퍼커션 + 부드러운 현악기 느낌
      case "day": {
        const mel: Note[] = [
          { f: 784,  t: 0.0,  dur: 0.28, type: "triangle", gain: 0.13, harm: [1, 0.25, 0.1], filter: 2400 },
          { f: 880,  t: 0.33, dur: 0.28, type: "triangle", gain: 0.12, harm: [1, 0.25, 0.1], filter: 2400 },
          { f: 1047, t: 0.66, dur: 0.4,  type: "triangle", gain: 0.14, harm: [1, 0.25, 0.1], filter: 2600 },
          { f: 880,  t: 1.2,  dur: 0.28, type: "triangle", gain: 0.12, harm: [1, 0.25, 0.1], filter: 2400 },
          { f: 784,  t: 1.53, dur: 0.28, type: "triangle", gain: 0.12, harm: [1, 0.25, 0.1], filter: 2400 },
          { f: 659,  t: 1.86, dur: 0.4,  type: "triangle", gain: 0.13, harm: [1, 0.25, 0.1], filter: 2200 },
          { f: 523,  t: 2.4,  dur: 0.28, type: "triangle", gain: 0.12, harm: [1, 0.25, 0.1], filter: 2000 },
          { f: 587,  t: 2.73, dur: 0.28, type: "triangle", gain: 0.11, harm: [1, 0.25, 0.1], filter: 2200 },
          { f: 659,  t: 3.06, dur: 0.4,  type: "triangle", gain: 0.13, harm: [1, 0.25, 0.1], filter: 2400 },
          { f: 784,  t: 3.6,  dur: 0.28, type: "triangle", gain: 0.12, harm: [1, 0.25, 0.1], filter: 2400 },
          { f: 880,  t: 3.93, dur: 0.28, type: "triangle", gain: 0.12, harm: [1, 0.25, 0.1], filter: 2400 },
          { f: 784,  t: 4.26, dur: 0.28, type: "triangle", gain: 0.11, harm: [1, 0.25, 0.1], filter: 2400 },
          { f: 659,  t: 4.59, dur: 0.4,  type: "triangle", gain: 0.13, harm: [1, 0.25, 0.1], filter: 2200 },
          // 카운터 멜로디 — 부드러운 sine + chorus
          { f: 523,  t: 0.16, dur: 0.4, type: "sine", gain: 0.07, harm: [1, 0.18], filter: 2200, detune: 5 },
          { f: 587,  t: 0.83, dur: 0.4, type: "sine", gain: 0.07, harm: [1, 0.18], filter: 2200, detune: 5 },
          { f: 523,  t: 1.66, dur: 0.4, type: "sine", gain: 0.07, harm: [1, 0.18], filter: 2200, detune: 5 },
          { f: 440,  t: 2.5,  dur: 0.5, type: "sine", gain: 0.08, harm: [1, 0.18], filter: 2000, detune: 5 },
          { f: 392,  t: 3.3,  dur: 0.4, type: "sine", gain: 0.07, harm: [1, 0.18], filter: 2000, detune: 5 },
          { f: 440,  t: 4.1,  dur: 0.4, type: "sine", gain: 0.07, harm: [1, 0.18], filter: 2000, detune: 5 },
        ];
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
            { f: 131, t: 0,   dur: 2.4, type: "sine", gain: 0.20, harm: [1, 0.3, 0.1] },
            { f: 110, t: 2.6, dur: 2.4, type: "sine", gain: 0.20, harm: [1, 0.3, 0.1] },
          ],
          perc,
          pad: { f: 65, gain: 0.04, type: "sine", detune: 7 },
        };
      }

      // 밤: 드론 + 귀뚜라미 블립 + 올빼미풍 하강 음 + 조심스런 분위기
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
            { f: 392, t: 0.5, dur: 0.9, type: "sine", gain: 0.12, harm: [1, 0.2], filter: 1600, detune: 4 },
            { f: 330, t: 1.5, dur: 0.9, type: "sine", gain: 0.11, harm: [1, 0.2], filter: 1600, detune: 4 },
            { f: 262, t: 2.6, dur: 1.4, type: "sine", gain: 0.12, harm: [1, 0.2], filter: 1500, detune: 4 },
            { f: 349, t: 5.0, dur: 0.8, type: "sine", gain: 0.10, harm: [1, 0.2], filter: 1600, detune: 4 },
            { f: 293, t: 6.0, dur: 0.8, type: "sine", gain: 0.10, harm: [1, 0.2], filter: 1500, detune: 4 },
            { f: 247, t: 7.2, dur: 1.2, type: "sine", gain: 0.11, harm: [1, 0.2], filter: 1500, detune: 4 },
            ...cricket(),
          ],
          bass: [
            { f: 73, t: 0, dur: 4.5, type: "sine", gain: 0.18, harm: [1, 0.3] },
            { f: 65, t: 5, dur: 4.5, type: "sine", gain: 0.18, harm: [1, 0.3] },
          ],
          pad: { f: 36, gain: 0.08, type: "sine", detune: 6 },
        };
      }

      // 동굴: 깊은 서브 드론 + 물방울 + 금속 핑 — 어둡고 음습
      case "cave": {
        const drips: Note[] = [
          { f: 1760, t: 1.2,  dur: 0.1,  type: "sine", gain: 0.10, harm: [1, 0.2] },
          { f: 2093, t: 3.8,  dur: 0.1,  type: "sine", gain: 0.09, harm: [1, 0.2] },
          { f: 1480, t: 6.1,  dur: 0.12, type: "sine", gain: 0.10, harm: [1, 0.2] },
          { f: 1760, t: 8.4,  dur: 0.1,  type: "sine", gain: 0.08, harm: [1, 0.2] },
        ];
        return {
          loopSeconds: 12,
          notes: [
            { f: 110, t: 0,  dur: 5.5, type: "triangle", gain: 0.10, harm: [1, 0.2], filter: 1200 },
            { f: 98,  t: 6,  dur: 5.5, type: "triangle", gain: 0.10, harm: [1, 0.2], filter: 1200 },
            { f: 440, t: 2.5, dur: 0.18, type: "sine", gain: 0.10, harm: [1, 0.3, 0.1], detune: 4 },
            { f: 587, t: 7.0, dur: 0.18, type: "sine", gain: 0.10, harm: [1, 0.3, 0.1], detune: 4 },
            ...drips,
          ],
          pad: { f: 55, gain: 0.09, type: "sawtooth", detune: 10 },
        };
      }

      // 전투: 강렬한 퍼커션 + 긴박 Em 리프
      case "combat": {
        const seq = [165, 196, 247, 165, 196, 330, 247, 196];
        const mel: Note[] = [];
        for (let bar = 0; bar < 2; bar++) {
          for (let i = 0; i < seq.length; i++) {
            mel.push({
              f: seq[i], t: bar * 2 + i * 0.25, dur: 0.16,
              type: "square", gain: 0.13, harm: [1, 0.2], filter: 2200,
            });
          }
        }
        // 상단 카운터 멜로디
        const top: Note[] = [
          { f: 659, t: 0.5, dur: 0.5, type: "triangle", gain: 0.10, harm: [1, 0.2], filter: 2400, detune: 4 },
          { f: 784, t: 1.5, dur: 0.5, type: "triangle", gain: 0.10, harm: [1, 0.2], filter: 2400, detune: 4 },
          { f: 988, t: 2.5, dur: 0.5, type: "triangle", gain: 0.11, harm: [1, 0.2], filter: 2600, detune: 4 },
          { f: 880, t: 3.5, dur: 0.5, type: "triangle", gain: 0.10, harm: [1, 0.2], filter: 2400, detune: 4 },
        ];
        const perc: PercHit[] = [];
        for (let i = 0; i < 4; i++) perc.push({ t: i * 1.0, freq: 80, dur: 0.22, gain: 0.7 });
        for (let i = 0; i < 4; i++) perc.push({ t: 0.5 + i * 1.0, freq: 400, dur: 0.15, gain: 0.5 });
        for (let i = 0; i < 8; i++) perc.push({ t: i * 0.5, freq: 8000, dur: 0.06, gain: 0.3 });
        return {
          loopSeconds: 4,
          notes: [...mel, ...top],
          bass: [
            { f: 82,  t: 0,   dur: 0.4, type: "sawtooth", gain: 0.22, harm: [1, 0.25], filter: 600 },
            { f: 82,  t: 1.0, dur: 0.4, type: "sawtooth", gain: 0.22, harm: [1, 0.25], filter: 600 },
            { f: 110, t: 2.0, dur: 0.4, type: "sawtooth", gain: 0.22, harm: [1, 0.25], filter: 700 },
            { f: 98,  t: 3.0, dur: 0.4, type: "sawtooth", gain: 0.22, harm: [1, 0.25], filter: 600 },
          ],
          perc,
        };
      }

      // 위기 (탐험 중 HP 낮음): 불안한 minor 화음 + 심장박동 perc
      case "tense": {
        // Cm 화음 (C Eb G) — 단조의 어두움 + 변박
        return {
          loopSeconds: 6,
          notes: [
            // Cm 코드 길게 깔리는 sustain
            { f: 261, t: 0,   dur: 1.5, type: "triangle", gain: 0.13, harm: [1, 0.3, 0.1], filter: 1400 },
            { f: 311, t: 0,   dur: 1.5, type: "triangle", gain: 0.11, harm: [1, 0.3, 0.1], filter: 1400 },
            { f: 392, t: 0,   dur: 1.5, type: "triangle", gain: 0.12, harm: [1, 0.3, 0.1], filter: 1400 },
            // 멜로디 — 불안한 반복 (Bb-Ab-Bb-G)
            { f: 466, t: 1.5, dur: 0.4, type: "sine", gain: 0.12, harm: [1, 0.2], filter: 1800, detune: 5 },
            { f: 415, t: 2.0, dur: 0.4, type: "sine", gain: 0.11, harm: [1, 0.2], filter: 1800, detune: 5 },
            { f: 466, t: 2.5, dur: 0.4, type: "sine", gain: 0.12, harm: [1, 0.2], filter: 1800, detune: 5 },
            { f: 392, t: 3.0, dur: 0.6, type: "sine", gain: 0.13, harm: [1, 0.2], filter: 1800, detune: 5 },
            // 두 번째 사이클 — 같은 코드 반복
            { f: 261, t: 3.0, dur: 1.5, type: "triangle", gain: 0.11, harm: [1, 0.3, 0.1], filter: 1400 },
            { f: 311, t: 3.0, dur: 1.5, type: "triangle", gain: 0.10, harm: [1, 0.3, 0.1], filter: 1400 },
            { f: 392, t: 3.0, dur: 1.5, type: "triangle", gain: 0.11, harm: [1, 0.3, 0.1], filter: 1400 },
            { f: 466, t: 4.5, dur: 0.4, type: "sine", gain: 0.11, harm: [1, 0.2], filter: 1800, detune: 5 },
            { f: 392, t: 5.0, dur: 0.4, type: "sine", gain: 0.11, harm: [1, 0.2], filter: 1800, detune: 5 },
            { f: 311, t: 5.5, dur: 0.4, type: "sine", gain: 0.10, harm: [1, 0.2], filter: 1700, detune: 5 },
          ],
          bass: [
            { f: 65, t: 0,   dur: 2.8, type: "sine", gain: 0.22, harm: [1, 0.3] },
            { f: 73, t: 3.0, dur: 2.8, type: "sine", gain: 0.22, harm: [1, 0.3] },
          ],
          perc: [
            // 심장박동 (kick + sub kick)
            { t: 0,   freq: 80, dur: 0.18, gain: 0.45 },
            { t: 0.5, freq: 70, dur: 0.18, gain: 0.40 },
            { t: 1.5, freq: 80, dur: 0.18, gain: 0.45 },
            { t: 2.0, freq: 70, dur: 0.18, gain: 0.40 },
            { t: 3.0, freq: 80, dur: 0.18, gain: 0.45 },
            { t: 3.5, freq: 70, dur: 0.18, gain: 0.40 },
            { t: 4.5, freq: 80, dur: 0.18, gain: 0.45 },
            { t: 5.0, freq: 70, dur: 0.18, gain: 0.40 },
          ],
          pad: { f: 33, gain: 0.07, type: "sawtooth", detune: 12 },
        };
      }

      // 위기 전투 (HP 낮은 상태에서 전투): combat + 더 긴박 + 더 빠른 박자
      case "combat_intense": {
        // Em 리프 + 위로 올라가는 octave
        const seq = [165, 196, 247, 330, 247, 196, 165, 247];
        const mel: Note[] = [];
        for (let bar = 0; bar < 2; bar++) {
          for (let i = 0; i < seq.length; i++) {
            mel.push({
              f: seq[i] * 1.5, t: bar * 1.6 + i * 0.2, dur: 0.14,
              type: "square", gain: 0.14, harm: [1, 0.25], filter: 2400,
            });
          }
        }
        // 위협적인 sub-bass 슬라이드
        const sub: Note[] = [
          { f: 55, t: 0,   dur: 1.4, type: "sawtooth", gain: 0.20, harm: [1, 0.2], filter: 400 },
          { f: 65, t: 1.6, dur: 1.4, type: "sawtooth", gain: 0.20, harm: [1, 0.2], filter: 400 },
        ];
        const perc: PercHit[] = [];
        // 빠른 더블킥
        for (let i = 0; i < 8; i++) perc.push({ t: i * 0.4, freq: 80, dur: 0.18, gain: 0.7 });
        // 빠른 스네어
        for (let i = 0; i < 8; i++) perc.push({ t: 0.2 + i * 0.4, freq: 380, dur: 0.12, gain: 0.55 });
        // 반박 하이햇
        for (let i = 0; i < 16; i++) perc.push({ t: i * 0.2, freq: 9000, dur: 0.04, gain: 0.32 });
        return {
          loopSeconds: 3.2,
          notes: mel,
          bass: sub,
          perc,
        };
      }

      // 승리: 밝은 팡파르 C장조 + 풍부한 화성
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
            { f: 523,  t: 0.0, dur: 0.25, type: "triangle", gain: 0.18, harm: [1, 0.3, 0.15], filter: 2400 },
            { f: 659,  t: 0.3, dur: 0.25, type: "triangle", gain: 0.18, harm: [1, 0.3, 0.15], filter: 2400 },
            { f: 784,  t: 0.6, dur: 0.25, type: "triangle", gain: 0.18, harm: [1, 0.3, 0.15], filter: 2400 },
            { f: 1047, t: 0.9, dur: 0.8,  type: "triangle", gain: 0.20, harm: [1, 0.3, 0.15], filter: 2600 },
            { f: 880,  t: 2.1, dur: 0.3,  type: "triangle", gain: 0.18, harm: [1, 0.3, 0.15], filter: 2400 },
            { f: 1047, t: 2.5, dur: 0.3,  type: "triangle", gain: 0.18, harm: [1, 0.3, 0.15], filter: 2400 },
            { f: 1319, t: 2.9, dur: 1.0,  type: "triangle", gain: 0.20, harm: [1, 0.3, 0.15], filter: 2800 },
            { f: 784,  t: 4.2, dur: 0.3,  type: "triangle", gain: 0.16, harm: [1, 0.3, 0.15], filter: 2400 },
            { f: 880,  t: 4.6, dur: 0.3,  type: "triangle", gain: 0.16, harm: [1, 0.3, 0.15], filter: 2400 },
            { f: 1047, t: 5.0, dur: 1.8,  type: "triangle", gain: 0.18, harm: [1, 0.3, 0.15], filter: 2600 },
            { f: 659,  t: 0.9, dur: 0.8,  type: "sine", gain: 0.10, harm: [1, 0.2], detune: 6 },
            { f: 784,  t: 2.9, dur: 1.0,  type: "sine", gain: 0.10, harm: [1, 0.2], detune: 6 },
          ],
          bass: [
            { f: 131, t: 0,   dur: 2.0, type: "sine", gain: 0.22, harm: [1, 0.3, 0.1] },
            { f: 165, t: 2.1, dur: 2.0, type: "sine", gain: 0.22, harm: [1, 0.3, 0.1] },
            { f: 196, t: 4.2, dur: 2.5, type: "sine", gain: 0.22, harm: [1, 0.3, 0.1] },
          ],
          perc,
        };
      }

      // 게임오버: 비통한 하강 선율 + 깊은 드론
      case "gameover": {
        return {
          loopSeconds: 10,
          notes: [
            { f: 392, t: 0.0, dur: 1.8, type: "sine", gain: 0.13, harm: [1, 0.2], filter: 1500, detune: 5 },
            { f: 349, t: 2.2, dur: 1.8, type: "sine", gain: 0.13, harm: [1, 0.2], filter: 1500, detune: 5 },
            { f: 311, t: 4.4, dur: 1.8, type: "sine", gain: 0.12, harm: [1, 0.2], filter: 1400, detune: 5 },
            { f: 262, t: 6.6, dur: 2.8, type: "sine", gain: 0.13, harm: [1, 0.2], filter: 1300, detune: 5 },
            { f: 523, t: 0.0, dur: 1.5, type: "triangle", gain: 0.07, harm: [1, 0.15], filter: 2000 },
            { f: 494, t: 2.2, dur: 1.5, type: "triangle", gain: 0.07, harm: [1, 0.15], filter: 2000 },
            { f: 440, t: 4.4, dur: 1.5, type: "triangle", gain: 0.06, harm: [1, 0.15], filter: 1900 },
          ],
          bass: [
            { f: 98, t: 0,   dur: 4.5, type: "sine", gain: 0.18, harm: [1, 0.3] },
            { f: 87, t: 5,   dur: 4.5, type: "sine", gain: 0.16, harm: [1, 0.3] },
          ],
          pad: { f: 49, gain: 0.08, type: "sine", detune: 10 },
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
