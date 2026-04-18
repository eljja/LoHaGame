/**
 * 외부 에셋 없이 Web Audio API로 효과음과 BGM을 절차적으로 생성한다.
 * - 효과음: 버튼/채집/제작/채굴/공격/피격/승리/사망/낮밤 전환 등
 * - BGM: 타이틀·낮·밤·동굴·전투·승리를 각기 다른 짧은 루프로 재생
 * - 브라우저 정책상 첫 유저 제스처 전까지는 AudioContext가 suspend 상태다. Button 클릭 시 resume 호출.
 */

export type SfxName =
  | "click"
  | "menu"
  | "pickup"
  | "craft"
  | "mine"
  | "hit"
  | "hurt"
  | "death"
  | "victory"
  | "phase_day"
  | "phase_night"
  | "boss_alert"
  | "heal"
  | "error"
  | "thunder"
  | "wave";

export type BgmName = "title" | "day" | "night" | "cave" | "combat" | "victory" | "gameover";

interface Note {
  f: number;
  t: number; // seconds from pattern start
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

interface BgmPattern {
  bpm: number;
  loopSeconds: number;
  notes: Note[];
  bass?: Note[];
  pad?: { f: number; gain: number; type: OscillatorType };
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmInterval: number | null = null;
  private bgmPadOsc: OscillatorNode | null = null;
  private bgmPadGain: GainNode | null = null;
  private currentBgm: BgmName | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = typeof localStorage !== "undefined" && localStorage.getItem("loha-audio-muted") === "1";
    } catch {
      /* ignore */
    }
  }

  init(): void {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1;
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.masterGain);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.18;
    this.bgmGain.connect(this.masterGain);
  }

  resume(): void {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : 1;
    try {
      localStorage.setItem("loha-audio-muted", m ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ── SFX ──
  play(name: SfxName): void {
    if (!this.ctx || !this.sfxGain) return;
    switch (name) {
      case "click":
        this.blip(900, 0.04, 0.2, "square");
        break;
      case "menu":
        this.blip(660, 0.06, 0.18, "triangle");
        this.blip(990, 0.05, 0.14, "triangle", 0.05);
        break;
      case "pickup":
        this.blip(740, 0.05, 0.2, "triangle");
        this.blip(1100, 0.06, 0.2, "triangle", 0.05);
        break;
      case "craft":
        this.blip(523, 0.07, 0.2, "square");
        this.blip(659, 0.07, 0.2, "square", 0.08);
        this.blip(784, 0.1, 0.22, "square", 0.16);
        break;
      case "mine":
        this.noise(0.08, 900, 0.35);
        this.blip(180, 0.08, 0.25, "square", 0.04);
        break;
      case "hit":
        this.noise(0.12, 1400, 0.35);
        this.slide(700, 300, 0.12, "sawtooth", 0.25);
        break;
      case "hurt":
        this.slide(260, 110, 0.35, "sawtooth", 0.3);
        break;
      case "death":
        this.slide(320, 70, 1.4, "sawtooth", 0.35);
        this.slide(220, 50, 1.6, "triangle", 0.25);
        break;
      case "victory":
        this.blip(523, 0.15, 0.3, "triangle", 0);
        this.blip(659, 0.15, 0.3, "triangle", 0.15);
        this.blip(784, 0.15, 0.3, "triangle", 0.3);
        this.blip(1046, 0.4, 0.35, "triangle", 0.45);
        break;
      case "phase_day":
        this.blip(523, 0.15, 0.22, "triangle");
        this.blip(784, 0.25, 0.22, "triangle", 0.12);
        break;
      case "phase_night":
        this.blip(392, 0.2, 0.22, "triangle");
        this.blip(262, 0.4, 0.22, "triangle", 0.18);
        break;
      case "boss_alert":
        this.slide(120, 340, 0.4, "sawtooth", 0.32);
        this.slide(340, 120, 0.4, "sawtooth", 0.32);
        break;
      case "heal":
        this.blip(659, 0.1, 0.22, "sine");
        this.blip(880, 0.1, 0.22, "sine", 0.08);
        this.blip(1175, 0.2, 0.22, "sine", 0.18);
        break;
      case "error":
        this.blip(220, 0.08, 0.22, "square");
        this.blip(170, 0.1, 0.22, "square", 0.1);
        break;
      case "thunder":
        this.noise(0.8, 400, 0.5);
        break;
      case "wave":
        this.noise(1.5, 600, 0.15);
        break;
    }
  }

  // ── BGM ──
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
      if (pattern.bass) for (const n of pattern.bass) this.scheduleNote(n, base, this.bgmGain, 0.6);
    };
    schedule();
    this.bgmInterval = window.setInterval(schedule, pattern.loopSeconds * 1000);
  }

  stopBgm(): void {
    if (this.bgmInterval != null) {
      window.clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    if (this.bgmPadOsc) {
      try {
        this.bgmPadOsc.stop();
      } catch {
        /* ignore */
      }
      this.bgmPadOsc.disconnect();
      this.bgmPadOsc = null;
    }
    if (this.bgmPadGain) {
      this.bgmPadGain.disconnect();
      this.bgmPadGain = null;
    }
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
    g.gain.linearRampToValueAtTime(peak, base + n.t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, base + n.t + n.dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(base + n.t);
    osc.stop(base + n.t + n.dur + 0.05);
  }

  private bgmPattern(name: BgmName): BgmPattern | null {
    switch (name) {
      case "title": {
        // 잔잔한 A단조 아르페지오
        const t = (i: number) => i * 0.5;
        return {
          bpm: 60,
          loopSeconds: 8,
          notes: [
            { f: 220, t: t(0), dur: 0.45, type: "triangle", gain: 0.18 },
            { f: 277, t: t(1), dur: 0.45, type: "triangle", gain: 0.18 },
            { f: 330, t: t(2), dur: 0.45, type: "triangle", gain: 0.18 },
            { f: 440, t: t(3), dur: 0.8, type: "triangle", gain: 0.2 },
            { f: 330, t: t(5), dur: 0.45, type: "triangle", gain: 0.18 },
            { f: 277, t: t(6), dur: 0.45, type: "triangle", gain: 0.18 },
            { f: 220, t: t(7), dur: 0.8, type: "triangle", gain: 0.2 },
          ],
          bass: [
            { f: 110, t: 0, dur: 3.5, type: "sine", gain: 0.22 },
            { f: 98, t: 4, dur: 3.5, type: "sine", gain: 0.22 },
          ],
        };
      }
      case "day": {
        // 밝은 C장조 4박 펄스
        return {
          bpm: 88,
          loopSeconds: 8,
          notes: [
            { f: 523, t: 0.0, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 659, t: 0.5, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 784, t: 1.0, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 659, t: 1.5, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 587, t: 2.0, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 698, t: 2.5, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 880, t: 3.0, dur: 0.6, type: "triangle", gain: 0.16 },
            { f: 523, t: 4.0, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 659, t: 4.5, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 784, t: 5.0, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 987, t: 5.5, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 880, t: 6.0, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 784, t: 6.5, dur: 0.3, type: "triangle", gain: 0.14 },
            { f: 659, t: 7.0, dur: 0.6, type: "triangle", gain: 0.16 },
          ],
          bass: [
            { f: 131, t: 0, dur: 1.8, type: "sine", gain: 0.22 },
            { f: 147, t: 2, dur: 1.8, type: "sine", gain: 0.22 },
            { f: 165, t: 4, dur: 1.8, type: "sine", gain: 0.22 },
            { f: 131, t: 6, dur: 1.8, type: "sine", gain: 0.22 },
          ],
        };
      }
      case "night": {
        // 낮고 느린 D단조 드론
        return {
          bpm: 54,
          loopSeconds: 9,
          notes: [
            { f: 293, t: 0, dur: 1.2, type: "sine", gain: 0.14 },
            { f: 349, t: 1.5, dur: 1.2, type: "sine", gain: 0.14 },
            { f: 440, t: 3, dur: 1.5, type: "sine", gain: 0.14 },
            { f: 392, t: 5, dur: 1.2, type: "sine", gain: 0.14 },
            { f: 293, t: 7, dur: 2, type: "sine", gain: 0.14 },
          ],
          pad: { f: 73, gain: 0.12, type: "sine" },
        };
      }
      case "cave": {
        // 낮은 드론 + 가끔 물방울
        return {
          bpm: 50,
          loopSeconds: 10,
          notes: [
            { f: 110, t: 0, dur: 4, type: "triangle", gain: 0.12 },
            { f: 98, t: 4, dur: 4, type: "triangle", gain: 0.12 },
            { f: 880, t: 2.5, dur: 0.12, type: "sine", gain: 0.14 },
            { f: 1175, t: 6, dur: 0.12, type: "sine", gain: 0.14 },
            { f: 988, t: 8.5, dur: 0.12, type: "sine", gain: 0.14 },
          ],
          pad: { f: 55, gain: 0.1, type: "sawtooth" },
        };
      }
      case "combat": {
        // 긴박한 E단조 16분 반복
        const notes: Note[] = [];
        const seq = [165, 247, 196, 247, 165, 247, 196, 330];
        for (let bar = 0; bar < 2; bar++) {
          for (let i = 0; i < seq.length; i++) {
            notes.push({ f: seq[i], t: bar * 2 + i * 0.25, dur: 0.18, type: "square", gain: 0.14 });
          }
        }
        return {
          bpm: 140,
          loopSeconds: 4,
          notes,
          bass: [
            { f: 82, t: 0, dur: 0.5, type: "sawtooth", gain: 0.2 },
            { f: 82, t: 1, dur: 0.5, type: "sawtooth", gain: 0.2 },
            { f: 110, t: 2, dur: 0.5, type: "sawtooth", gain: 0.2 },
            { f: 82, t: 3, dur: 0.5, type: "sawtooth", gain: 0.2 },
          ],
        };
      }
      case "victory": {
        return {
          bpm: 100,
          loopSeconds: 6,
          notes: [
            { f: 523, t: 0, dur: 0.25, type: "triangle", gain: 0.2 },
            { f: 659, t: 0.3, dur: 0.25, type: "triangle", gain: 0.2 },
            { f: 784, t: 0.6, dur: 0.25, type: "triangle", gain: 0.2 },
            { f: 1046, t: 0.9, dur: 0.7, type: "triangle", gain: 0.22 },
            { f: 880, t: 2, dur: 0.3, type: "triangle", gain: 0.2 },
            { f: 1046, t: 2.4, dur: 0.3, type: "triangle", gain: 0.2 },
            { f: 1318, t: 2.8, dur: 0.9, type: "triangle", gain: 0.22 },
            { f: 784, t: 4, dur: 1.8, type: "triangle", gain: 0.18 },
          ],
          bass: [
            { f: 131, t: 0, dur: 1.8, type: "sine", gain: 0.22 },
            { f: 165, t: 2, dur: 1.8, type: "sine", gain: 0.22 },
            { f: 196, t: 4, dur: 1.8, type: "sine", gain: 0.22 },
          ],
        };
      }
      case "gameover": {
        return {
          bpm: 50,
          loopSeconds: 8,
          notes: [
            { f: 220, t: 0, dur: 1.5, type: "sine", gain: 0.16 },
            { f: 196, t: 2, dur: 1.5, type: "sine", gain: 0.16 },
            { f: 174, t: 4, dur: 1.5, type: "sine", gain: 0.16 },
            { f: 130, t: 6, dur: 2, type: "sine", gain: 0.16 },
          ],
          pad: { f: 65, gain: 0.1, type: "sine" },
        };
      }
    }
    return null;
  }

  // ── 기본 음원 생성 헬퍼 ──
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
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(base);
    osc.stop(base + dur + 0.05);
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
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(base);
    osc.stop(base + dur + 0.05);
  }

  private noise(dur: number, filterFreq: number, gain: number, delay = 0): void {
    if (!this.ctx || !this.sfxGain) return;
    const base = this.ctx.currentTime + delay;
    const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, base);
    g.gain.linearRampToValueAtTime(gain, base + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, base + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(base);
    src.stop(base + dur + 0.05);
  }
}

export const audio = new AudioManager();
