export type SfxName =
  | "click" | "menu" | "pickup" | "craft" | "mine" | "hit" | "hurt"
  | "death" | "victory" | "phase_day" | "phase_night" | "boss_alert"
  | "heal" | "error" | "thunder" | "wave" | "wood_chop" | "water_splash" | "bird"
  | "rain_start" | "wind_gust" | "fire" | "cave_drip";

export type BgmName =
  | "title" | "intro_calm" | "intro_storm" | "intro_shore"
  | "day" | "night" | "day_rain" | "night_rain" | "day_wind" | "night_wind"
  | "cave" | "combat" | "victory" | "gameover";

type Instrument = "felt" | "kalimba" | "flute" | "strings" | "bell" | "pluck" | "bass" | "pulse";
type Percussion = "kick" | "frame" | "wood" | "shaker" | "impact";
type WorldPhase = "day" | "night";
type WeatherLayer = "rain" | "wind" | null;

interface VoiceNote {
  f: number;
  t: number;
  dur: number;
  instrument: Instrument;
  gain: number;
  pan?: number;
}

interface PercHit {
  t: number;
  kind: Percussion;
  gain: number;
  pan?: number;
}

interface Phrase {
  seconds: number;
  notes: VoiceNote[];
  perc: PercHit[];
}

interface InstrumentShape {
  waves: Array<{ type: OscillatorType; ratio: number; level: number; detune?: number }>;
  attack: number;
  release: number;
  filter: BiquadFilterType;
  cutoff: number;
  q: number;
}

interface RecordedMusicPlayback {
  element: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  name: BgmName;
  file: string;
}

const MUSIC_PLAYLISTS: Record<BgmName, readonly string[]> = {
  title: ["island-overture.ogg"],
  intro_calm: ["last-lights-of-home.ogg"],
  intro_storm: ["through-the-tempest.ogg"],
  intro_shore: ["first-light-on-the-island.ogg"],
  day: ["tidebound-horizon.ogg", "green-isle-wind.ogg"],
  night: ["embers-under-stars.ogg"],
  day_rain: ["rain-on-new-leaves.ogg"],
  night_rain: ["lanterns-in-the-rain.ogg"],
  day_wind: ["windward-path.ogg"],
  night_wind: ["stars-in-the-gale.ogg"],
  cave: ["beneath-the-basalt.ogg"],
  combat: ["storm-at-black-reef.ogg", "teeth-in-the-dark.ogg"],
  victory: ["beacon-across-the-sea.ogg"],
  gameover: ["the-shore-remembers.ogg"],
};

const MUSIC_LEVELS: Record<BgmName, number> = {
  title: 0.78,
  intro_calm: 0.72,
  intro_storm: 0.84,
  intro_shore: 0.74,
  day: 0.72,
  night: 0.68,
  day_rain: 0.68,
  night_rain: 0.64,
  day_wind: 0.72,
  night_wind: 0.66,
  cave: 0.64,
  combat: 0.82,
  victory: 0.76,
  gameover: 0.67,
};

const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
const choose = <T>(values: readonly T[]): T => values[Math.floor(Math.random() * values.length)];
const between = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private musicInterval: number | null = null;
  private musicTrackGain: GainNode | null = null;
  private recordedPlayback: RecordedMusicPlayback | null = null;
  private lastTrackByBgm = new Map<BgmName, string>();
  private currentBgm: BgmName | null = null;
  private phraseIndex = 0;
  private playbackBlocked = false;

  private worldZone = "none";
  private worldPhase: WorldPhase = "day";
  private worldMusicPhase: WorldPhase = "day";
  private nearFire = false;
  private weatherLayer: WeatherLayer = null;
  private ambientSources: AudioScheduledSourceNode[] = [];
  private ambientLayerGains: GainNode[] = [];
  private ambientTimers: number[] = [];
  private loopNoiseBuffers = new Map<number, AudioBuffer>();
  muted = false;

  constructor() {
    try { this.muted = typeof localStorage !== "undefined" && localStorage.getItem("loha-audio-muted") === "1"; } catch { /* storage unavailable */ }
  }

  init(): void {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.28;
    compressor.connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.92;
    this.masterGain.connect(compressor);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.54;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.28;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.42;

    const dry = this.ctx.createGain();
    dry.gain.value = 0.9;
    this.musicGain.connect(dry);
    dry.connect(this.masterGain);

    const convolver = this.ctx.createConvolver();
    convolver.buffer = this.makeImpulse(2.6, 2.8);
    const wet = this.ctx.createGain();
    wet.gain.value = 0.1;
    this.musicGain.connect(convolver);
    convolver.connect(wet);
    wet.connect(this.masterGain);

    this.ambientGain.connect(this.masterGain);
  }

  resume(): void {
    this.init();
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    if (this.recordedPlayback?.element.paused) {
      void this.recordedPlayback.element.play()
        .then(() => { this.playbackBlocked = false; })
        .catch(() => { this.playbackBlocked = true; });
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 0.92;
    try { localStorage.setItem("loha-audio-muted", muted ? "1" : "0"); } catch { /* storage unavailable */ }
  }

  toggleMuted(): boolean {
    if (this.playbackBlocked || this.ctx?.state === "suspended") {
      this.setMuted(false);
      this.resume();
      return false;
    }
    this.setMuted(!this.muted);
    return this.muted;
  }

  get needsActivation(): boolean {
    return !this.ctx || this.ctx.state === "suspended" || this.playbackBlocked;
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.sfxGain) return;
    switch (name) {
      case "click": this.tone(920, 0.045, 0.055, "sine"); break;
      case "menu":
        this.tone(620, 0.11, 0.11, "triangle");
        this.tone(930, 0.16, 0.09, "sine", 0.055);
        break;
      case "pickup":
        [740, 988, 1319].forEach((f, i) => this.tone(f, 0.16 + i * 0.025, 0.12 - i * 0.015, i === 2 ? "sine" : "triangle", i * 0.055));
        break;
      case "craft":
        this.noiseBurst(0.07, 1800, 0.16, 0, "bandpass", 2.4);
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 0.12, "triangle", 0.06 + i * 0.08));
        break;
      case "mine":
        this.noiseBurst(0.12, 1450, 0.34, 0, "bandpass", 3.5);
        this.glide(185, 95, 0.2, "triangle", 0.18, 0.015);
        this.noiseBurst(0.08, 700, 0.18, 0.11, "lowpass");
        break;
      case "wood_chop":
        this.noiseBurst(0.075, 2100, 0.3, 0, "bandpass", 1.8);
        this.glide(240, 130, 0.13, "triangle", 0.16, 0.018);
        this.noiseBurst(0.05, 3400, 0.13, 0.085, "highpass");
        break;
      case "water_splash":
        this.noiseBurst(0.42, 2600, 0.2, 0, "bandpass", 0.8);
        this.glide(380, 720, 0.23, "sine", 0.06, 0.035);
        break;
      case "bird": this.birdCall(1); break;
      case "hit":
        this.noiseBurst(0.13, 1350, 0.36, 0, "bandpass", 1.8);
        this.glide(520, 150, 0.19, "sawtooth", 0.17, 0.012);
        break;
      case "hurt":
        this.glide(270, 92, 0.38, "sawtooth", 0.22);
        this.noiseBurst(0.12, 480, 0.18, 0.035, "lowpass");
        break;
      case "death":
        this.glide(310, 48, 1.65, "triangle", 0.25);
        this.glide(205, 42, 2.1, "sine", 0.18, 0.16);
        this.noiseBurst(0.8, 280, 0.1, 0.2, "lowpass");
        break;
      case "victory":
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, i > 2 ? 0.55 : 0.25, 0.17, "triangle", i * 0.14));
        break;
      case "phase_day":
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.4, 0.13, i === 3 ? "sine" : "triangle", i * 0.11));
        this.birdCall(0.55, 0.45);
        break;
      case "phase_night":
        [392, 330, 262, 220].forEach((f, i) => this.tone(f, 0.5, 0.11, "sine", i * 0.16));
        break;
      case "boss_alert":
        this.glide(72, 310, 0.65, "sawtooth", 0.25);
        this.glide(310, 64, 0.7, "sawtooth", 0.23, 0.64);
        this.noiseBurst(0.38, 390, 0.16, 0.08, "lowpass");
        break;
      case "heal": [659, 880, 1175].forEach((f, i) => this.tone(f, 0.28, 0.13, "sine", i * 0.11)); break;
      case "error":
        this.tone(220, 0.14, 0.17, "square");
        this.tone(165, 0.18, 0.15, "square", 0.13);
        break;
      case "thunder": this.thunder(); break;
      case "wave": this.wave(1); break;
      case "rain_start":
        this.noiseBurst(1.5, 3600, 0.12, 0, "highpass", 0.6);
        this.glide(180, 105, 1.1, "sine", 0.05, 0.15);
        break;
      case "wind_gust":
        this.noiseBurst(2.8, 900, 0.16, 0, "bandpass", 0.7);
        this.glide(330, 190, 2.2, "sine", 0.035, 0.2);
        break;
      case "fire":
        for (let i = 0; i < 4; i++) this.noiseBurst(0.045, between(1300, 2600), 0.08, i * 0.08, "bandpass", 3);
        break;
      case "cave_drip":
        this.tone(between(1450, 2150), 0.18, 0.08, "sine");
        this.tone(between(900, 1250), 0.3, 0.035, "sine", 0.08);
        break;
    }
  }

  playAnimal(kind: "rabbit" | "wolf" | "boar" | "bear", distance: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const level = clamp(1 - distance / 12, 0.12, 0.8);
    const pan = between(-0.75, 0.75);
    if (kind === "rabbit") {
      this.noiseBurst(0.075, 3300, 0.09 * level, 0, "highpass", 1.2, this.sfxGain, pan);
      if (Math.random() < 0.25) this.glide(1280, 1650, 0.08, "sine", 0.045 * level, 0.02, this.sfxGain, pan);
    } else if (kind === "wolf") {
      this.glide(520, 300, 0.85, "sine", 0.12 * level, 0, this.sfxGain, pan);
      this.glide(430, 270, 0.72, "triangle", 0.055 * level, 0.08, this.sfxGain, pan);
    } else if (kind === "boar") {
      this.noiseBurst(0.28, 430, 0.18 * level, 0, "lowpass", 1, this.sfxGain, pan);
      this.glide(145, 92, 0.32, "sawtooth", 0.09 * level, 0.02, this.sfxGain, pan);
    } else {
      this.noiseBurst(0.5, 260, 0.2 * level, 0, "lowpass", 0.7, this.sfxGain, pan);
      this.glide(105, 58, 0.58, "sawtooth", 0.11 * level, 0.04, this.sfxGain, pan);
    }
  }

  playBgm(name: BgmName): void {
    this.init();
    if (!this.ctx || !this.musicGain || this.currentBgm === name) return;
    this.fadeOutCurrentTrack();
    this.currentBgm = name;
    this.startRecordedBgm(name);
  }

  private startRecordedBgm(name: BgmName): void {
    if (!this.ctx || !this.musicGain || this.currentBgm !== name || typeof document === "undefined") return;
    const probe = document.createElement("audio");
    if (!probe.canPlayType('audio/ogg; codecs="vorbis"')) {
      this.startProceduralBgm(name);
      return;
    }

    const playlist = MUSIC_PLAYLISTS[name];
    const previous = this.lastTrackByBgm.get(name);
    const candidates = playlist.length > 1 ? playlist.filter((file) => file !== previous) : playlist;
    const file = choose(candidates.length ? candidates : playlist);
    this.lastTrackByBgm.set(name, file);

    const element = document.createElement("audio");
    element.src = new URL(`audio/music/${file}`, document.baseURI).href;
    element.preload = "auto";
    element.loop = false;

    let source: MediaElementAudioSourceNode;
    try {
      source = this.ctx.createMediaElementSource(element);
    } catch {
      this.startProceduralBgm(name);
      return;
    }

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const level = MUSIC_LEVELS[name];
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 1.6);
    source.connect(gain);
    gain.connect(this.musicGain);

    const playback: RecordedMusicPlayback = { element, source, gain, name, file };
    this.recordedPlayback = playback;
    element.onplaying = () => {
      if (this.recordedPlayback === playback) this.playbackBlocked = false;
    };
    element.onended = () => {
      if (this.recordedPlayback !== playback || this.currentBgm !== name) return;
      this.recordedPlayback = null;
      this.disposeRecordedPlayback(playback);
      this.startRecordedBgm(name);
    };
    element.onerror = () => this.handleRecordedMusicFailure(playback);
    void element.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        this.playbackBlocked = true;
        return;
      }
      if (error instanceof DOMException && error.name === "AbortError") return;
      this.handleRecordedMusicFailure(playback);
    });
  }

  playWorldBgm(phase: WorldPhase): void {
    this.worldMusicPhase = phase;
    this.playBgm(this.worldBgmFor(phase, this.weatherLayer));
  }

  private handleRecordedMusicFailure(playback: RecordedMusicPlayback): void {
    if (this.recordedPlayback !== playback || this.currentBgm !== playback.name) return;
    this.recordedPlayback = null;
    this.disposeRecordedPlayback(playback);
    this.startProceduralBgm(playback.name);
  }

  private startProceduralBgm(name: BgmName): void {
    if (!this.ctx || !this.musicGain || this.currentBgm !== name) return;
    this.phraseIndex = 0;

    const track = this.ctx.createGain();
    const now = this.ctx.currentTime;
    track.gain.setValueAtTime(0.0001, now);
    track.gain.exponentialRampToValueAtTime(1, now + 1.15);
    track.connect(this.musicGain);
    this.musicTrackGain = track;

    let nextPhraseAt = now + 0.08;
    const schedule = () => {
      if (!this.ctx || this.currentBgm !== name || this.musicTrackGain !== track) return;
      while (nextPhraseAt < this.ctx.currentTime + 3.2) {
        const phrase = this.buildPhrase(name, this.phraseIndex++);
        for (const note of phrase.notes) this.scheduleVoice(note, nextPhraseAt, track);
        for (const hit of phrase.perc) this.schedulePercussion(hit, nextPhraseAt, track);
        nextPhraseAt += phrase.seconds;
      }
    };
    schedule();
    this.musicInterval = window.setInterval(schedule, 350);
  }

  stopBgm(): void {
    this.fadeOutCurrentTrack(0.3);
    this.currentBgm = null;
  }

  setWorldContext(terrain: string, phase: WorldPhase, nearFire = false): void {
    this.init();
    const zone = terrain === "deep_water" || terrain === "shallow_water" || terrain === "sand" ? "coast"
      : terrain === "river" ? "river"
      : terrain === "forest" ? "forest"
      : terrain === "rock" || terrain === "cliff_rock" ? "highland"
      : terrain === "cave" ? "cave"
      : "grassland";
    if (zone === this.worldZone && phase === this.worldPhase && nearFire === this.nearFire) return;
    this.worldZone = zone;
    this.worldPhase = phase;
    this.nearFire = nearFire;
    this.refreshWorldAmbience();
  }

  setWeather(weather: WeatherLayer): void {
    this.init();
    if (this.weatherLayer === weather) return;
    this.weatherLayer = weather;
    this.refreshWorldAmbience();
    if (this.currentBgm && this.isWorldBgm(this.currentBgm)) {
      this.playBgm(this.worldBgmFor(this.worldMusicPhase, weather));
    }
  }

  clearWorldAmbience(): void {
    this.worldZone = "none";
    this.nearFire = false;
    this.weatherLayer = null;
    this.clearAmbientNodes();
  }

  private fadeOutCurrentTrack(duration = 0.75): void {
    if (this.musicInterval != null) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    const recorded = this.recordedPlayback;
    this.recordedPlayback = null;
    if (recorded) this.disposeRecordedPlayback(recorded, duration);
    const track = this.musicTrackGain;
    this.musicTrackGain = null;
    if (!this.ctx || !track) return;
    const now = this.ctx.currentTime;
    track.gain.cancelScheduledValues(now);
    track.gain.setValueAtTime(Math.max(0.0001, track.gain.value), now);
    track.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    window.setTimeout(() => { try { track.disconnect(); } catch { /* already disconnected */ } }, (duration + 4) * 1000);
  }

  private disposeRecordedPlayback(playback: RecordedMusicPlayback, fadeSeconds = 0): void {
    playback.element.onended = null;
    playback.element.onerror = null;
    playback.element.onplaying = null;
    if (!this.ctx || fadeSeconds <= 0) {
      playback.element.pause();
      try { playback.source.disconnect(); playback.gain.disconnect(); } catch { /* already disconnected */ }
      return;
    }
    const now = this.ctx.currentTime;
    playback.gain.gain.cancelScheduledValues(now);
    playback.gain.gain.setValueAtTime(Math.max(0.0001, playback.gain.gain.value), now);
    playback.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeSeconds);
    window.setTimeout(() => {
      playback.element.pause();
      try { playback.source.disconnect(); playback.gain.disconnect(); } catch { /* already disconnected */ }
    }, (fadeSeconds + 0.1) * 1000);
  }

  private worldBgmFor(phase: WorldPhase, weather: WeatherLayer): BgmName {
    if (weather === "rain") return phase === "day" ? "day_rain" : "night_rain";
    if (weather === "wind") return phase === "day" ? "day_wind" : "night_wind";
    return phase;
  }

  private isWorldBgm(name: BgmName): boolean {
    return name === "day" || name === "night"
      || name === "day_rain" || name === "night_rain"
      || name === "day_wind" || name === "night_wind";
  }

  private buildPhrase(name: BgmName, index: number): Phrase {
    if (name === "title") return this.harmonicPhrase(
      choose([
        [[57,60,64],[53,57,60],[48,52,55],[55,59,62],[57,60,64],[52,55,59]],
        [[57,60,64],[55,59,62],[53,57,60],[52,55,59],[48,52,55],[55,59,62]],
      ]), 4, index, "felt", "strings", false, true,
    );
    if (name === "intro_calm") return this.harmonicPhrase(
      [[45,52,57],[48,52,55],[53,57,60],[50,53,57],[45,52,57]], 3.6, index, "bell", "strings", false, true,
    );
    if (name === "intro_shore") return this.harmonicPhrase(
      [[48,52,55],[55,59,62],[57,60,64],[53,57,60],[48,52,55]], 3.8, index, "flute", "strings", false, true,
    );
    if (name === "day" || name === "day_rain" || name === "day_wind") {
      const progressions = [
        [[48,52,55],[55,59,62],[57,60,64],[53,57,60],[48,52,55],[52,55,59],[53,57,60]],
        [[57,60,64],[53,57,60],[48,52,55],[55,59,62],[52,55,59],[53,57,60],[55,59,62]],
        [[48,52,55],[52,55,59],[57,60,64],[55,59,62],[53,57,60],[50,53,57],[55,59,62]],
        [[53,57,60],[48,52,55],[57,60,64],[52,55,59],[53,57,60],[55,59,62],[48,52,55]],
      ] as const;
      return this.harmonicPhrase(choose(progressions).map((c) => [...c]), 4, index, choose(["kalimba","pluck","felt"] as const), "strings", index % 3 !== 2, true);
    }
    if (name === "night" || name === "night_rain" || name === "night_wind") return this.harmonicPhrase(
      choose([
        [[50,53,57],[46,50,53],[43,46,50],[48,52,55],[50,53,57],[45,48,52]],
        [[45,48,52],[50,53,57],[48,52,55],[43,46,50],[46,50,53],[45,48,52]],
      ]), 5, index, index % 2 ? "bell" : "flute", "strings", false, false,
    );
    if (name === "cave") return this.cavePhrase(index);
    if (name === "intro_storm") return this.stormPhrase(index, false);
    if (name === "combat") return this.stormPhrase(index, true);
    if (name === "victory") return this.harmonicPhrase(
      [[48,52,55],[53,57,60],[55,59,62],[48,52,55],[57,60,64]], 3.2, index, "bell", "strings", true, true,
    );
    return this.harmonicPhrase(
      [[45,48,52],[43,47,50],[41,45,48],[40,43,47],[38,41,45]], 4.8, index, "felt", "strings", false, false,
    );
  }

  private harmonicPhrase(
    chords: number[][],
    beat: number,
    index: number,
    lead: Instrument,
    pad: Instrument,
    rhythm: boolean,
    bright: boolean,
  ): Phrase {
    const notes: VoiceNote[] = [];
    const perc: PercHit[] = [];
    const seconds = chords.length * beat;
    const arpOrders = [[0,1,2,1],[0,2,1,2],[1,2,0,2],[0,1,2,0]];
    let melodicDegree = 1;

    chords.forEach((chord, bar) => {
      const t = bar * beat;
      notes.push({ f: midi(chord[0] - 12), t, dur: beat * 0.94, instrument: "bass", gain: bright ? 0.105 : 0.085, pan: -0.08 });
      chord.forEach((n, i) => notes.push({ f: midi(n), t, dur: beat * 0.96, instrument: pad, gain: 0.042, pan: (i - 1) * 0.42 }));

      const order = choose(arpOrders);
      const subdivisions = lead === "flute" ? 2 : 4;
      for (let step = 0; step < subdivisions; step++) {
        if (Math.random() < (lead === "flute" ? 0.35 : 0.13)) continue;
        const chordIndex = order[(step + index + bar) % order.length];
        const octave = lead === "flute" ? 12 : step === subdivisions - 1 && Math.random() < 0.35 ? 24 : 12;
        notes.push({
          f: midi(chord[chordIndex] + octave),
          t: t + step * (beat / subdivisions) + between(-0.025, 0.025),
          dur: lead === "flute" ? beat * 0.72 : beat / subdivisions * 0.72,
          instrument: lead,
          gain: lead === "flute" ? 0.075 : 0.09,
          pan: between(-0.48, 0.48),
        });
      }

      if ((bar + index) % 2 === 0 && Math.random() < 0.78) {
        melodicDegree = clamp(melodicDegree + choose([-1, 0, 1]), 0, 2);
        notes.push({
          f: midi(chord[melodicDegree] + 24),
          t: t + beat * choose([0.25, 0.5, 0.7]),
          dur: between(0.65, 1.35),
          instrument: lead === "flute" ? "bell" : "flute",
          gain: 0.048,
          pan: between(-0.3, 0.3),
        });
      }
      if (rhythm) {
        perc.push({ t, kind: "frame", gain: 0.11, pan: -0.2 });
        if ((bar + index) % 2 === 0) perc.push({ t: t + beat * 0.5, kind: "wood", gain: 0.075, pan: 0.25 });
        if (Math.random() < 0.58) {
          for (let s = 1; s < 8; s += 2) perc.push({ t: t + s * beat / 8, kind: "shaker", gain: 0.028, pan: between(-0.55, 0.55) });
        }
      }
    });
    return { seconds, notes, perc };
  }

  private stormPhrase(index: number, combat: boolean): Phrase {
    const seconds = combat ? 12 : 14;
    const notes: VoiceNote[] = [];
    const perc: PercHit[] = [];
    const roots = combat ? choose([[40,40,43,38],[40,43,45,38],[38,40,43,35]]) : choose([[33,33,36,31],[33,36,38,31]]);
    const pulse = combat ? 0.375 : 0.5;
    for (let step = 0; step < Math.floor(seconds / pulse); step++) {
      const bar = Math.floor(step * pulse / (seconds / roots.length));
      const root = roots[Math.min(roots.length - 1, bar)];
      const degree = choose([0,0,0,3,7,10]);
      notes.push({ f: midi(root + degree), t: step * pulse, dur: pulse * 0.62, instrument: "pulse", gain: combat ? 0.075 : 0.06, pan: step % 2 ? 0.22 : -0.22 });
      if (step % 4 === 0) {
        notes.push({ f: midi(root - 12), t: step * pulse, dur: pulse * 2.7, instrument: "bass", gain: 0.13 });
        perc.push({ t: step * pulse, kind: "kick", gain: combat ? 0.2 : 0.15 });
      }
      if (step % 4 === 2) perc.push({ t: step * pulse, kind: "impact", gain: combat ? 0.12 : 0.09, pan: 0.1 });
      if ((step + index) % 2 === 1 && combat) perc.push({ t: step * pulse, kind: "shaker", gain: 0.035, pan: between(-0.6,0.6) });
    }
    notes.push({ f: midi(45), t: 0, dur: seconds * 0.96, instrument: "strings", gain: 0.045, pan: -0.35 });
    notes.push({ f: midi(52), t: 0, dur: seconds * 0.96, instrument: "strings", gain: 0.04, pan: 0.35 });
    return { seconds, notes, perc };
  }

  private cavePhrase(index: number): Phrase {
    const seconds = 24;
    const notes: VoiceNote[] = [
      { f: midi(33), t: 0, dur: 11.5, instrument: "strings", gain: 0.05, pan: -0.35 },
      { f: midi(31), t: 12, dur: 11.5, instrument: "strings", gain: 0.05, pan: 0.35 },
      { f: midi(21), t: 0, dur: 11, instrument: "bass", gain: 0.11 },
      { f: midi(19), t: 12, dur: 11, instrument: "bass", gain: 0.11 },
    ];
    for (let i = 0; i < 5; i++) {
      const t = between(1, seconds - 1);
      notes.push({ f: midi(choose([72,74,77,79]) + (index % 2 ? 0 : -5)), t, dur: between(0.15,0.4), instrument: "bell", gain: 0.045, pan: between(-0.8,0.8) });
    }
    return { seconds, notes, perc: [] };
  }

  private scheduleVoice(note: VoiceNote, base: number, destination: AudioNode): void {
    if (!this.ctx) return;
    const start = base + note.t;
    const shape = this.instrumentShape(note.instrument, note.f);
    const filter = this.ctx.createBiquadFilter();
    filter.type = shape.filter;
    filter.frequency.setValueAtTime(shape.cutoff, start);
    filter.Q.value = shape.q;
    const amp = this.ctx.createGain();
    const attackEnd = start + Math.min(shape.attack, note.dur * 0.45);
    const releaseStart = Math.max(attackEnd, start + note.dur - shape.release);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.linearRampToValueAtTime(note.gain, attackEnd);
    amp.gain.setValueAtTime(note.gain * 0.82, releaseStart);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = note.pan ?? 0;
    filter.connect(amp); amp.connect(pan); pan.connect(destination);

    for (const wave of shape.waves) {
      const oscillator = this.ctx.createOscillator();
      const level = this.ctx.createGain();
      oscillator.type = wave.type;
      oscillator.frequency.value = note.f * wave.ratio;
      oscillator.detune.value = wave.detune ?? 0;
      level.gain.value = wave.level;
      oscillator.connect(level); level.connect(filter);
      oscillator.start(start); oscillator.stop(start + note.dur + 0.08);
    }
  }

  private instrumentShape(instrument: Instrument, frequency: number): InstrumentShape {
    switch (instrument) {
      case "felt": return { waves: [{type:"sine",ratio:1,level:0.85},{type:"triangle",ratio:2,level:0.13}], attack:0.012, release:0.75, filter:"lowpass", cutoff:Math.min(4200,frequency*5), q:0.6 };
      case "kalimba": return { waves: [{type:"sine",ratio:1,level:0.8},{type:"sine",ratio:3,level:0.16},{type:"triangle",ratio:5,level:0.05}], attack:0.004, release:0.42, filter:"lowpass", cutoff:5600, q:1.2 };
      case "flute": return { waves: [{type:"sine",ratio:1,level:0.86},{type:"triangle",ratio:2,level:0.08}], attack:0.16, release:0.45, filter:"lowpass", cutoff:3600, q:0.7 };
      case "strings": return { waves: [{type:"triangle",ratio:1,level:0.46,detune:-7},{type:"triangle",ratio:1,level:0.46,detune:7},{type:"sine",ratio:0.5,level:0.18}], attack:0.72, release:1.2, filter:"lowpass", cutoff:1450, q:0.8 };
      case "bell": return { waves: [{type:"sine",ratio:1,level:0.72},{type:"sine",ratio:2.01,level:0.2},{type:"sine",ratio:3.97,level:0.08}], attack:0.004, release:1.1, filter:"highpass", cutoff:180, q:0.5 };
      case "pluck": return { waves: [{type:"triangle",ratio:1,level:0.76},{type:"sine",ratio:2,level:0.19}], attack:0.005, release:0.3, filter:"lowpass", cutoff:3100, q:1.6 };
      case "bass": return { waves: [{type:"sine",ratio:1,level:0.78},{type:"triangle",ratio:1,level:0.22}], attack:0.035, release:0.6, filter:"lowpass", cutoff:420, q:0.9 };
      case "pulse": return { waves: [{type:"triangle",ratio:1,level:0.72},{type:"square",ratio:0.5,level:0.08}], attack:0.008, release:0.16, filter:"lowpass", cutoff:1250, q:1.3 };
    }
  }

  private schedulePercussion(hit: PercHit, base: number, destination: AudioNode): void {
    if (!this.ctx) return;
    const start = base + hit.t;
    if (hit.kind === "kick") {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, start);
      osc.frequency.exponentialRampToValueAtTime(42, start + 0.22);
      gain.gain.setValueAtTime(hit.gain, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.connect(gain); gain.connect(destination); osc.start(start); osc.stop(start + 0.3);
      return;
    }
    const settings = hit.kind === "shaker" ? [7200,0.055,"highpass",0.65]
      : hit.kind === "wood" ? [1100,0.09,"bandpass",2.8]
      : hit.kind === "frame" ? [260,0.18,"bandpass",1.3]
      : [420,0.28,"lowpass",0.9];
    this.scheduledNoise(start, settings[1] as number, settings[0] as number, hit.gain, settings[2] as BiquadFilterType, settings[3] as number, destination, hit.pan ?? 0);
  }

  private refreshWorldAmbience(): void {
    this.clearAmbientNodes();
    if (!this.ctx || !this.ambientGain || this.worldZone === "none") return;

    const phaseGain = this.worldPhase === "night" ? 0.78 : 1;
    if (this.worldZone !== "cave" && this.weatherLayer === "rain") {
      this.loopNoise(7, "highpass", 1900, 0.115, 0.075);
      this.loopNoise(9, "lowpass", 520, 0.055, 0.045);
      this.scheduleAmbient(() => { if (Math.random() < 0.5) this.thunder(this.ambientGain!, 0.32); }, 8000, 18000);
    } else if (this.worldZone !== "cave" && this.weatherLayer === "wind") {
      this.loopNoise(8, "bandpass", 760, 0.12, 0.11);
      this.scheduleAmbient(() => this.windWhisper(), 3500, 7200);
    } else if (this.worldZone !== "cave") {
      this.loopNoise(8, "lowpass", this.worldZone === "highland" ? 760 : 430, 0.022 * phaseGain, 0.014);
    }

    if (this.worldZone === "coast") {
      this.loopNoise(10, "lowpass", 620, 0.05 * phaseGain, 0.045);
      this.scheduleAmbient(() => this.wave(0.42, this.ambientGain!), 4500, 9500);
    } else if (this.worldZone === "river") {
      this.loopNoise(7, "bandpass", 1450, 0.064 * phaseGain, 0.025);
      this.scheduleAmbient(() => this.waterBubble(), 2500, 6500);
    } else if (this.worldZone === "forest") {
      this.loopNoise(9, "lowpass", 1650, 0.026 * phaseGain, 0.018);
      if (this.worldPhase === "day") this.scheduleAmbient(() => this.birdCall(0.28, 0, this.ambientGain!), 5200, 14000);
    } else if (this.worldZone === "highland") {
      this.loopNoise(8, "bandpass", 920, 0.065 * phaseGain, 0.055);
      this.scheduleAmbient(() => this.windWhisper(), 4200, 9000);
    } else if (this.worldZone === "cave") {
      this.loopNoise(8, "lowpass", 220, 0.065, 0.025);
      this.scheduleAmbient(() => this.caveDrip(), 2800, 8600);
    }

    if (this.worldPhase === "night" && this.worldZone !== "cave") {
      this.scheduleAmbient(() => this.crickets(), 1800, 4300);
      this.scheduleAmbient(() => { if (Math.random() < 0.35) this.owlCall(); }, 11000, 23000);
    }
    if (this.nearFire && this.worldZone !== "cave") {
      this.loopNoise(6, "bandpass", 1150, 0.018, 0.012);
      this.scheduleAmbient(() => this.fireCrackle(), 1200, 3600);
    }
  }

  private loopNoise(seconds: number, type: BiquadFilterType, frequency: number, gainValue: number, modulation: number): void {
    if (!this.ctx || !this.ambientGain) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.getLoopNoiseBuffer(seconds);
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = between(0.035, 0.11);
    lfoGain.gain.value = modulation;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    source.connect(filter); filter.connect(gain); gain.connect(this.ambientGain);
    source.start(); lfo.start();
    this.ambientSources.push(source, lfo);
    this.ambientLayerGains.push(gain);
  }

  private getLoopNoiseBuffer(seconds: number): AudioBuffer {
    if (!this.ctx) throw new Error("Audio context unavailable");
    const cached = this.loopNoiseBuffers.get(seconds);
    if (cached) return cached;
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let brown = 0;
      for (let i = 0; i < length; i++) {
        brown = brown * 0.985 + (Math.random() * 2 - 1) * 0.12;
        const edge = Math.min(1, i / 1500, (length - i) / 1500);
        data[i] = brown * edge * 0.7;
      }
    }
    this.loopNoiseBuffers.set(seconds, buffer);
    return buffer;
  }

  private scheduleAmbient(callback: () => void, minDelay: number, maxDelay: number): void {
    const scheduleNext = () => {
      const timer = window.setTimeout(() => {
        this.ambientTimers = this.ambientTimers.filter((id) => id !== timer);
        if (!this.ctx || this.worldZone === "none") return;
        callback();
        scheduleNext();
      }, between(minDelay, maxDelay));
      this.ambientTimers.push(timer);
    };
    scheduleNext();
  }

  private clearAmbientNodes(): void {
    for (const timer of this.ambientTimers) window.clearTimeout(timer);
    this.ambientTimers = [];
    const stopAt = this.ctx ? this.ctx.currentTime + 0.28 : 0;
    for (const gain of this.ambientLayerGains) {
      if (!this.ctx) continue;
      gain.gain.cancelScheduledValues(this.ctx.currentTime);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    }
    for (const source of this.ambientSources) {
      try { source.stop(stopAt); } catch { /* already stopped */ }
    }
    const oldSources = this.ambientSources;
    window.setTimeout(() => oldSources.forEach((source) => { try { source.disconnect(); } catch { /* already disconnected */ } }), 420);
    this.ambientSources = [];
    this.ambientLayerGains = [];
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    if (!this.ctx) throw new Error("Audio context unavailable");
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return impulse;
  }

  private tone(freq: number, dur: number, gainValue: number, type: OscillatorType, delay = 0, dest: AudioNode | null = this.sfxGain, panValue = 0): void {
    if (!this.ctx || !dest) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner();
    osc.type = type; osc.frequency.value = freq; pan.pan.value = panValue;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainValue, start + Math.min(0.012, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain); gain.connect(pan); pan.connect(dest);
    osc.start(start); osc.stop(start + dur + 0.04);
  }

  private glide(from: number, to: number, dur: number, type: OscillatorType, gainValue: number, delay = 0, dest: AudioNode | null = this.sfxGain, panValue = 0): void {
    if (!this.ctx || !dest) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner();
    osc.type = type; pan.pan.value = panValue;
    osc.frequency.setValueAtTime(Math.max(20, from), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainValue, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain); gain.connect(pan); pan.connect(dest);
    osc.start(start); osc.stop(start + dur + 0.05);
  }

  private noiseBurst(dur: number, frequency: number, gainValue: number, delay = 0, type: BiquadFilterType = "lowpass", q = 0.8, dest: AudioNode | null = this.sfxGain, panValue = 0): void {
    if (!this.ctx || !dest) return;
    this.scheduledNoise(this.ctx.currentTime + delay, dur, frequency, gainValue, type, q, dest, panValue);
  }

  private scheduledNoise(start: number, dur: number, frequency: number, gainValue: number, type: BiquadFilterType, q: number, dest: AudioNode, panValue: number): void {
    if (!this.ctx) return;
    const size = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, 1.4);
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner();
    source.buffer = buffer; filter.type = type; filter.frequency.value = frequency; filter.Q.value = q; pan.pan.value = panValue;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(gainValue, start + Math.min(0.02, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    source.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(dest);
    source.start(start); source.stop(start + dur + 0.04);
  }

  private birdCall(level = 1, delay = 0, dest: AudioNode | null = this.sfxGain): void {
    const pan = between(-0.75, 0.75);
    const base = between(1550, 2050);
    this.glide(base, base * 1.32, 0.11, "sine", 0.075 * level, delay, dest, pan);
    this.glide(base * 1.25, base * 0.92, 0.12, "sine", 0.06 * level, delay + 0.14, dest, pan);
    if (Math.random() < 0.65) this.glide(base * 1.05, base * 1.45, 0.09, "sine", 0.05 * level, delay + 0.31, dest, pan);
  }

  private thunder(dest: AudioNode | null = this.sfxGain, level = 1): void {
    if (!dest) return;
    this.noiseBurst(1.8, 260, 0.48 * level, 0, "lowpass", 0.6, dest, between(-0.4,0.4));
    this.noiseBurst(0.32, 950, 0.2 * level, 0.02, "bandpass", 1.1, dest);
    this.noiseBurst(1.1, 130, 0.26 * level, 0.35, "lowpass", 0.5, dest);
    this.glide(72, 38, 1.5, "sine", 0.16 * level, 0.08, dest);
  }

  private wave(level = 1, dest: AudioNode | null = this.sfxGain): void {
    if (!dest) return;
    this.noiseBurst(2.6, 760, 0.11 * level, 0, "lowpass", 0.6, dest, between(-0.6,0.6));
    this.noiseBurst(1.4, 1850, 0.055 * level, 0.55, "bandpass", 0.8, dest);
  }

  private windWhisper(): void {
    if (!this.ambientGain) return;
    this.noiseBurst(between(2,3.8), between(650,1100), 0.045, 0, "bandpass", 1.2, this.ambientGain, between(-0.8,0.8));
  }

  private waterBubble(): void {
    if (!this.ambientGain) return;
    const pan = between(-0.7,0.7);
    for (let i=0;i<3;i++) this.glide(between(420,620), between(760,1050), 0.1, "sine", 0.018, i*0.08, this.ambientGain, pan);
  }

  private caveDrip(): void {
    if (!this.ambientGain) return;
    const pan = between(-0.8,0.8);
    this.tone(between(1350,2200), 0.18, 0.038, "sine", 0, this.ambientGain, pan);
    this.tone(between(680,980), 0.45, 0.016, "sine", 0.09, this.ambientGain, pan);
  }

  private crickets(): void {
    if (!this.ambientGain) return;
    const pan = between(-0.85,0.85);
    const f = between(3900,4800);
    for (let i=0;i<choose([2,3,4]);i++) this.tone(f, 0.035, 0.018, "sine", i*0.072, this.ambientGain, pan);
  }

  private owlCall(): void {
    if (!this.ambientGain) return;
    const pan = between(-0.75,0.75);
    this.glide(430,340,0.48,"sine",0.035,0,this.ambientGain,pan);
    this.glide(410,315,0.52,"sine",0.035,0.68,this.ambientGain,pan);
  }

  private fireCrackle(): void {
    if (!this.ambientGain) return;
    const pan = between(-0.25, 0.25);
    for (let i = 0; i < choose([2,3,4]); i++) {
      this.noiseBurst(0.035, between(1200, 2800), 0.032, i * between(0.045, 0.09), "bandpass", 2.8, this.ambientGain, pan);
    }
  }
}

export const audio = new AudioManager();
