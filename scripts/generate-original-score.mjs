import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import encodeOgg from "@audio/encode-ogg";

const SAMPLE_RATE = 32_000;
const TABLE_SIZE = 4096;
const TAU = Math.PI * 2;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "public", "audio", "music");

const TRACKS = [
  {
    id: "island-overture", title: "Island Overture", bpm: 72, bars: 24, seed: 1107, style: "title",
    melodyBase: 66,
    chords: [[38, 42, 45, 50], [35, 38, 42, 47], [43, 47, 50, 55], [45, 49, 52, 57], [40, 43, 47, 52], [38, 42, 45, 50]],
    motif: [0, 3, 7, 9, 7, 12, 11, 7, 4, 2, 0, 4, 7, 9, 12, 11],
  },
  {
    id: "last-lights-of-home", title: "Last Lights of Home", bpm: 68, bars: 20, seed: 1301, style: "intro_calm",
    melodyBase: 64,
    chords: [[36, 40, 43, 48], [43, 47, 50, 55], [40, 43, 47, 52], [41, 45, 48, 53], [38, 43, 47, 50], [43, 47, 50, 55]],
    motif: [0, 4, 7, 9, 7, 4, 2, 0, 5, 7, 12, 9, 7, 5, 4, 2],
  },
  {
    id: "through-the-tempest", title: "Through the Tempest", bpm: 96, bars: 20, seed: 1423, style: "intro_storm",
    melodyBase: 62,
    chords: [[38, 41, 45, 50], [34, 38, 41, 46], [36, 40, 43, 48], [33, 38, 41, 45], [43, 47, 50, 55], [38, 42, 45, 50]],
    motif: [0, 0, 3, 5, 7, 5, 9, 7, 3, 5, 7, 10, 9, 7, 5, 2],
  },
  {
    id: "first-light-on-the-island", title: "First Light on the Island", bpm: 74, bars: 16, seed: 1553, style: "intro_shore",
    melodyBase: 67,
    chords: [[36, 40, 43, 48], [41, 45, 48, 53], [43, 47, 50, 55], [40, 43, 47, 52], [45, 49, 52, 57], [43, 47, 50, 55]],
    motif: [0, 2, 5, 7, 9, 12, 9, 7, 5, 4, 2, 0, 7, 9, 12, 14],
  },
  {
    id: "tidebound-horizon", title: "Tidebound Horizon", bpm: 84, bars: 32, seed: 2029, style: "day",
    melodyBase: 66,
    chords: [[38, 42, 45, 50], [35, 38, 42, 47], [43, 47, 50, 54], [40, 43, 47, 52], [38, 42, 45, 50], [45, 49, 52, 57]],
    motif: [0, 2, 5, 7, 9, 7, 5, 2, 0, 5, 7, 11, 9, 7, 5, 4],
  },
  {
    id: "green-isle-wind", title: "Green Isle Wind", bpm: 78, bars: 32, seed: 3413, style: "day",
    melodyBase: 69,
    chords: [[41, 45, 48, 53], [36, 40, 43, 48], [38, 42, 45, 50], [43, 47, 50, 55], [45, 49, 52, 57], [36, 40, 43, 48]],
    motif: [0, 5, 7, 9, 7, 5, 4, 2, 0, 2, 5, 9, 12, 9, 7, 5],
  },
  {
    id: "embers-under-stars", title: "Embers Under Stars", bpm: 60, bars: 28, seed: 4517, style: "night",
    melodyBase: 67,
    chords: [[40, 43, 47, 52], [36, 40, 43, 48], [43, 47, 50, 55], [38, 42, 45, 50], [41, 45, 48, 53], [43, 47, 50, 55]],
    motif: [0, 4, 7, 5, 2, 0, -2, 0, 7, 9, 7, 5, 4, 2, 0, -3],
  },
  {
    id: "rain-on-new-leaves", title: "Rain on New Leaves", bpm: 70, bars: 20, seed: 4721, style: "rain_day",
    melodyBase: 69,
    chords: [[41, 45, 48, 53], [36, 40, 43, 48], [43, 47, 50, 55], [38, 42, 45, 50], [40, 43, 47, 52], [41, 45, 48, 53]],
    motif: [0, 2, 5, 9, 7, 5, 2, 0, 4, 7, 9, 12, 9, 7, 5, 4],
  },
  {
    id: "lanterns-in-the-rain", title: "Lanterns in the Rain", bpm: 62, bars: 20, seed: 4861, style: "rain_night",
    melodyBase: 67,
    chords: [[40, 43, 47, 52], [36, 40, 43, 48], [41, 45, 48, 53], [43, 47, 50, 55], [38, 42, 45, 50], [40, 43, 47, 52]],
    motif: [0, 4, 7, 9, 7, 4, 2, 0, -2, 2, 5, 7, 5, 4, 2, 0],
  },
  {
    id: "windward-path", title: "Windward Path", bpm: 92, bars: 16, seed: 4933, style: "wind_day",
    melodyBase: 66,
    chords: [[38, 42, 45, 50], [43, 47, 50, 55], [40, 43, 47, 52], [45, 49, 52, 57], [38, 42, 45, 50], [35, 38, 42, 47]],
    motif: [0, 2, 4, 7, 9, 11, 9, 7, 5, 4, 2, 5, 7, 9, 12, 11],
  },
  {
    id: "stars-in-the-gale", title: "Stars in the Gale", bpm: 74, bars: 16, seed: 5051, style: "wind_night",
    melodyBase: 67,
    chords: [[43, 47, 50, 55], [40, 43, 47, 52], [36, 40, 43, 48], [38, 42, 45, 50], [41, 45, 48, 53], [43, 47, 50, 55]],
    motif: [0, 2, 7, 9, 7, 5, 4, 2, 0, 4, 7, 11, 9, 7, 4, 2],
  },
  {
    id: "beneath-the-basalt", title: "Beneath the Basalt", bpm: 54, bars: 24, seed: 5813, style: "cave",
    melodyBase: 62,
    chords: [[38, 42, 45, 50], [35, 38, 42, 47], [36, 40, 43, 48], [33, 38, 41, 45], [43, 47, 50, 55], [38, 42, 45, 50]],
    motif: [0, 2, 5, 8, 7, 2, -3, 0, 7, 5, 2, 0],
  },
  {
    id: "storm-at-black-reef", title: "Storm at Black Reef", bpm: 110, bars: 32, seed: 6119, style: "combat",
    melodyBase: 62,
    chords: [[38, 41, 45, 50], [38, 42, 45, 50], [34, 38, 41, 46], [43, 47, 50, 55], [33, 38, 41, 45], [38, 42, 45, 50]],
    motif: [0, 0, 3, 5, 7, 9, 7, 5, 10, 9, 7, 5, 2, 5, 7, 9],
  },
  {
    id: "teeth-in-the-dark", title: "Teeth in the Dark", bpm: 104, bars: 32, seed: 7727, style: "combat",
    melodyBase: 64,
    chords: [[35, 38, 42, 47], [36, 40, 43, 48], [31, 35, 38, 43], [38, 42, 45, 50], [33, 38, 41, 45], [43, 47, 50, 55]],
    motif: [0, 3, 0, 5, 7, 5, 9, 7, 0, 2, 4, 7, 9, 7, 5, 4],
  },
  {
    id: "beacon-across-the-sea", title: "Beacon Across the Sea", bpm: 76, bars: 20, seed: 8641, style: "victory",
    melodyBase: 67,
    chords: [[43, 47, 50, 55], [38, 43, 47, 50], [40, 43, 47, 52], [36, 40, 43, 48], [45, 49, 52, 57], [43, 47, 50, 55]],
    motif: [0, 4, 7, 12, 11, 7, 4, 2, 0, 7, 9, 12, 14, 12, 11, 7],
  },
  {
    id: "the-shore-remembers", title: "The Shore Remembers", bpm: 58, bars: 16, seed: 9901, style: "gameover",
    melodyBase: 69,
    chords: [[45, 48, 52, 57], [41, 45, 48, 53], [36, 40, 43, 48], [43, 47, 50, 55], [38, 42, 45, 50], [43, 47, 50, 55]],
    motif: [0, 3, 7, 5, 3, 0, -4, -2, 0, 5, 4, 2, 0, 2, 4, 7],
  },
];

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function makeWave(harmonics) {
  const table = new Float32Array(TABLE_SIZE);
  let peak = 0;
  for (let i = 0; i < TABLE_SIZE; i++) {
    let value = 0;
    for (let h = 0; h < harmonics.length; h++) value += Math.sin(TAU * i * (h + 1) / TABLE_SIZE) * harmonics[h];
    table[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  for (let i = 0; i < TABLE_SIZE; i++) table[i] /= peak || 1;
  return table;
}

const WAVES = {
  strings: makeWave([1, .36, .22, .13, .075, .043, .024, .013]),
  brass: makeWave([1, .58, .32, .18, .1, .055, .028]),
  woodwind: makeWave([1, .12, .24, .045, .075, .022]),
  flute: makeWave([1, .075, .025, .008]),
  harp: makeWave([1, .52, .31, .19, .115, .065, .035, .018]),
  pulse: makeWave([1, .28, .12, .055, .025]),
  sub: makeWave([1, .14, .035]),
};

function midi(note) { return 440 * 2 ** ((note - 69) / 12); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function smooth(value) { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); }
function waveAt(table, phase) {
  const position = (phase % 1 + 1) % 1 * TABLE_SIZE;
  const index = position | 0;
  const fraction = position - index;
  return table[index] + (table[(index + 1) % TABLE_SIZE] - table[index]) * fraction;
}

class Score {
  constructor(track) {
    this.track = track;
    this.rng = createRng(track.seed);
    this.beatSeconds = 60 / track.bpm;
    this.duration = track.bars * 4 * this.beatSeconds + 6;
    this.left = new Float32Array(Math.ceil(this.duration * SAMPLE_RATE));
    this.right = new Float32Array(this.left.length);
  }

  note(instrument, note, beat, beats, velocity, pan = 0) {
    const frequency = midi(note);
    const start = Math.max(0, Math.floor(beat * this.beatSeconds * SAMPLE_RATE));
    const duration = beats * this.beatSeconds;
    const shape = instrumentShape(instrument, duration);
    const samples = Math.min(this.left.length - start, Math.floor((duration + shape.release) * SAMPLE_RATE));
    if (samples <= 0) return;
    const table = WAVES[shape.wave];
    const basePhase = this.rng();
    const leftGain = Math.cos((clamp(pan, -1, 1) + 1) * Math.PI / 4) * velocity * shape.level;
    const rightGain = Math.sin((clamp(pan, -1, 1) + 1) * Math.PI / 4) * velocity * shape.level;
    const detune = shape.detune;
    let noiseState = (this.track.seed + start + note * 97) >>> 0;

    for (let i = 0; i < samples; i++) {
      const t = i / SAMPLE_RATE;
      const envelope = noteEnvelope(t, duration, shape.attack, shape.release, shape.sustain);
      if (envelope <= 0) continue;
      const vibrato = shape.vibrato ? Math.sin(TAU * shape.vibrato * t + basePhase * TAU) * shape.vibratoDepth : 0;
      const phase = basePhase + frequency * t + vibrato;
      let value = waveAt(table, phase);
      if (detune) {
        value = value * .56
          + waveAt(table, basePhase * .37 + frequency * (1 - detune) * t) * .23
          + waveAt(table, basePhase * 1.73 + frequency * (1 + detune) * t) * .21;
      }
      if (shape.breath) {
        noiseState ^= noiseState << 13; noiseState ^= noiseState >>> 17; noiseState ^= noiseState << 5;
        value += (((noiseState >>> 0) / 2_147_483_648) - 1) * shape.breath;
      }
      const shimmer = shape.shimmer ? 1 + Math.sin(TAU * .19 * t + pan * 2) * shape.shimmer : 1;
      this.left[start + i] += value * envelope * leftGain * shimmer;
      this.right[start + i] += value * envelope * rightGain * (2 - shimmer);
    }
  }

  drum(kind, beat, velocity, pan = 0) {
    const start = Math.floor(beat * this.beatSeconds * SAMPLE_RATE);
    const duration = kind === "cymbal" ? 3.6 : kind === "boom" ? 2.4 : kind === "timpani" ? 1.7 : .9;
    const samples = Math.min(this.left.length - start, Math.floor(duration * SAMPLE_RATE));
    const leftGain = Math.cos((pan + 1) * Math.PI / 4) * velocity;
    const rightGain = Math.sin((pan + 1) * Math.PI / 4) * velocity;
    let state = (this.track.seed * 31 + start) >>> 0;
    let filtered = 0;
    for (let i = 0; i < samples; i++) {
      const t = i / SAMPLE_RATE;
      state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
      const noise = (state >>> 0) / 2_147_483_648 - 1;
      let value;
      if (kind === "boom") {
        const phase = TAU * (49 * t - 7 * t * t);
        filtered += (noise - filtered) * .055;
        value = (Math.sin(phase) * .9 + Math.sin(phase * .5) * .24 + filtered * .13) * Math.exp(-1.85 * t);
      } else if (kind === "timpani") {
        const phase = TAU * (72 * t - 18 * t * t);
        value = (Math.sin(phase) * .82 + noise * .13) * Math.exp(-2.5 * t);
      } else if (kind === "taiko") {
        const phase = TAU * (61 * t - 16 * t * t);
        filtered += (noise - filtered) * .12;
        value = (Math.sin(phase) * .72 + filtered * .34) * Math.exp(-5.4 * t);
      } else {
        filtered += (noise - filtered) * .035;
        const high = noise - filtered;
        value = (high * .75 + Math.sin(TAU * 3917 * t) * .08 + Math.sin(TAU * 5783 * t) * .06) * Math.exp(-1.65 * t);
      }
      this.left[start + i] += value * leftGain;
      this.right[start + i] += value * rightGain;
    }
  }
}

function instrumentShape(instrument, duration) {
  switch (instrument) {
    case "violins": return { wave: "strings", attack: .34, release: .9, sustain: .86, level: .13, detune: .00125, vibrato: 4.9, vibratoDepth: .00075, breath: .004, shimmer: .018 };
    case "violas": return { wave: "strings", attack: .38, release: 1, sustain: .88, level: .135, detune: .0011, vibrato: 4.5, vibratoDepth: .00065, breath: .003, shimmer: .012 };
    case "cellos": return { wave: "strings", attack: .24, release: .85, sustain: .9, level: .16, detune: .0008, vibrato: 4.1, vibratoDepth: .00055, breath: .002, shimmer: .008 };
    case "horns": return { wave: "brass", attack: .18, release: .58, sustain: .84, level: .13, detune: .00055, vibrato: 4.5, vibratoDepth: .00035, breath: .006, shimmer: .008 };
    case "trombones": return { wave: "brass", attack: .09, release: .42, sustain: .88, level: .14, detune: .00035, vibrato: 0, vibratoDepth: 0, breath: .004, shimmer: 0 };
    case "trumpets": return { wave: "brass", attack: .07, release: .35, sustain: .82, level: .105, detune: .00045, vibrato: 4.7, vibratoDepth: .00025, breath: .005, shimmer: .006 };
    case "flute": return { wave: "flute", attack: .07, release: .25, sustain: .92, level: .085, detune: 0, vibrato: 5, vibratoDepth: .00055, breath: .018, shimmer: .008 };
    case "oboe": return { wave: "woodwind", attack: .065, release: .24, sustain: .9, level: .078, detune: 0, vibrato: 4.8, vibratoDepth: .0004, breath: .012, shimmer: .005 };
    case "harp": return { wave: "harp", attack: .004, release: Math.min(2.1, duration), sustain: .08, level: .092, detune: .00025, vibrato: 0, vibratoDepth: 0, breath: 0, shimmer: .008 };
    case "pulse": return { wave: "pulse", attack: .008, release: .16, sustain: .62, level: .115, detune: .0003, vibrato: 0, vibratoDepth: 0, breath: 0, shimmer: 0 };
    case "sub": return { wave: "sub", attack: .015, release: .38, sustain: .9, level: .2, detune: 0, vibrato: 0, vibratoDepth: 0, breath: 0, shimmer: 0 };
    default: return { wave: "strings", attack: .12, release: .7, sustain: .85, level: .1, detune: 0, vibrato: 0, vibratoDepth: 0, breath: 0, shimmer: 0 };
  }
}

function noteEnvelope(t, duration, attack, release, sustain) {
  if (t < attack) return smooth(t / Math.max(.001, attack));
  if (t < duration) return sustain + (1 - sustain) * Math.exp(-(t - attack) * 1.8);
  if (t < duration + release) return sustain * (1 - smooth((t - duration) / release));
  return 0;
}

function intensityFor(style, bar, bars) {
  const progress = bar / Math.max(1, bars - 1);
  if (style === "combat") return .58 + .34 * Math.sin(Math.PI * progress) + (bar % 8 >= 6 ? .08 : 0);
  if (style === "intro_storm") return .46 + .36 * Math.sin(Math.PI * progress) + progress * .12;
  if (style === "cave") return .24 + .18 * Math.sin(Math.PI * progress);
  if (style === "night" || style === "rain_night" || style === "wind_night") return .28 + .24 * Math.sin(Math.PI * progress);
  if (style === "rain_day") return .3 + .25 * Math.sin(Math.PI * progress);
  if (style === "wind_day") return .42 + .3 * Math.sin(Math.PI * progress);
  if (style === "intro_calm") return .3 + progress * .35;
  if (style === "intro_shore") return .36 + progress * .45;
  if (style === "gameover") return .45 * (1 - progress * .58);
  if (style === "victory") return .4 + progress * .52;
  return .34 + .43 * Math.sin(Math.PI * progress) + (progress > .74 ? .12 : 0);
}

const D_MAJOR_PITCH_CLASSES = new Set([1, 2, 4, 6, 7, 9, 11]);

function nearestChordTone(target, chord, registerOffset = 24) {
  const candidates = [];
  for (const note of chord) {
    for (const octave of [registerOffset - 12, registerOffset, registerOffset + 12]) candidates.push(note + octave);
  }
  return candidates.reduce((best, note) => Math.abs(note - target) < Math.abs(best - target) ? note : best, candidates[0]);
}

function nearestScaleTone(target) {
  for (let distance = 0; distance < 7; distance++) {
    const up = Math.round(target) + distance;
    if (D_MAJOR_PITCH_CLASSES.has((up % 12 + 12) % 12)) return up;
    const down = Math.round(target) - distance;
    if (D_MAJOR_PITCH_CLASSES.has((down % 12 + 12) % 12)) return down;
  }
  return Math.round(target);
}

function orchestrate(score) {
  const { track } = score;
  const melodyBase = track.melodyBase;
  const isAction = track.style === "combat" || track.style === "intro_storm";
  const isRain = track.style === "rain_day" || track.style === "rain_night";
  const isWind = track.style === "wind_day" || track.style === "wind_night";
  const isNightLike = track.style === "night" || track.style === "rain_night" || track.style === "wind_night";
  const isHeroic = track.style === "title" || track.style === "intro_shore" || track.style === "victory";
  const isGentle = isRain || isNightLike || track.style === "intro_calm" || track.style === "gameover";

  for (let bar = 0; bar < track.bars; bar++) {
    const beat = bar * 4;
    const chord = track.chords[bar % track.chords.length];
    const intensity = intensityFor(track.style, bar, track.bars);
    const progress = bar / Math.max(1, track.bars - 1);
    const root = chord[0];
    const fifth = chord[2];

    // A stable low foundation and open fifths keep the harmony broad rather than uncanny.
    score.note("sub", root - 12, beat, 4.05, .34 + intensity * .28, 0);
    score.note("cellos", root, beat, 4.05, .5 + intensity * .28, -.22);
    score.note("cellos", fifth, beat, 4.05, .35 + intensity * .2, .16);
    score.note("violas", chord[1] + 12, beat, 4.08, .3 + intensity * .24, -.34);
    score.note("violas", fifth + 12, beat, 4.08, .32 + intensity * .24, .3);
    score.note("violins", chord[3] + 12, beat, 4.05, .25 + intensity * .2, .45);

    const pulseStarts = isAction ? 0 : (track.style === "title" && bar < 4) || isGentle ? 4 : 2;
    const pulseSteps = isAction || isWind ? 8 : 4;
    if (bar >= pulseStarts && track.style !== "cave") {
      for (let step = 0; step < pulseSteps; step++) {
        const pulseNote = step % 4 === 3 ? fifth : root;
        const pulseBeat = beat + step * 4 / pulseSteps;
        score.note("pulse", pulseNote + 12, pulseBeat, isAction ? .28 : .48, (.18 + intensity * .3) * (isGentle ? .45 : 1), step % 2 ? .16 : -.16);
        if (isAction && step % 2 === 0) score.note("cellos", pulseNote, pulseBeat, .26, .24 + intensity * .3, -.08);
      }
    }

    const brassThreshold = isHeroic ? .42 : isAction ? .52 : .68;
    if (intensity >= brassThreshold && !isRain && !isNightLike && track.style !== "gameover") {
      score.note("horns", root + 12, beat, 3.75, .34 + intensity * .4, -.18);
      score.note("horns", fifth + 12, beat, 3.75, .3 + intensity * .34, .2);
      if ((isAction || isHeroic) && progress > .55) score.note("trombones", root, beat, 3.6, .28 + intensity * .32, -.04);
    }

    // Strong beats resolve to the current chord; weak beats may move through the shared major scale.
    const melodySteps = isAction || isWind ? 4 : 2;
    const melodyActive = isAction || isHeroic || bar % 2 === 0 || (track.style === "day" && bar % 4 !== 3);
    if (melodyActive) {
      for (let step = 0; step < melodySteps; step++) {
        const motifIndex = (bar * melodySteps + step) % track.motif.length;
        const target = melodyBase + track.motif[motifIndex] * .72;
        const note = step === 0 || (isAction && step === 2)
          ? nearestChordTone(target, chord, 24)
          : nearestScaleTone(target);
        const lead = isGentle ? (bar % 4 < 2 ? "violins" : "oboe") : progress > .62 && (isHeroic || isAction) ? "trumpets" : "violins";
        const duration = isAction || isWind ? .72 : 1.55;
        const velocity = (.34 + intensity * .38) * (lead === "oboe" ? .72 : 1);
        score.note(lead, note, beat + step * 4 / melodySteps, duration, velocity, step % 2 ? .16 : -.12);
      }
    }

    if (isGentle && bar % 2 === 0) {
      const highRoot = nearestChordTone(melodyBase + 7, chord, 24);
      score.note("harp", highRoot, beat, .85, .24 + intensity * .18, -.48);
      score.note("harp", nearestChordTone(highRoot + 5, chord, 24), beat + 2, .85, .2 + intensity * .16, .48);
    }

    if (isAction) {
      score.drum("taiko", beat, .38 + intensity * .36, -.18);
      score.drum("taiko", beat + 2, .32 + intensity * .3, .2);
      if (bar % 2 === 1) score.drum("timpani", beat + 3, .28 + intensity * .28);
      if (bar % 4 === 0) score.drum("boom", beat, .36 + intensity * .3);
      if (bar % 8 === 0 || bar === track.bars - 1) score.drum("cymbal", beat, .13 + intensity * .15, .25);
    } else if (isHeroic) {
      if (bar % 4 === 0 && (bar > 0 || track.style === "victory")) score.drum("boom", beat, .25 + intensity * .28);
      if (progress > .45 && bar % 2 === 0) score.drum("timpani", beat, .22 + intensity * .22, -.2);
      if (progress > .62 && bar % 4 === 0) score.drum("cymbal", beat, .09 + intensity * .12, .25);
    } else if (isWind && bar % 4 === 0) {
      score.drum("timpani", beat, .16 + intensity * .16, -.22);
    } else if (track.style === "day" && bar % 8 === 4) {
      score.drum("boom", beat, .13 + intensity * .13);
    }
  }
}

function addSchroederReverb(left, right, style) {
  const wet = style === "cave" ? .2 : style === "night" || style === "rain_night" || style === "wind_night" ? .18 : style === "combat" || style === "intro_storm" ? .1 : .14;
  const feedback = style === "cave" ? .69 : .63;
  const delaysLeft = [0.0297, 0.0371, 0.0411, 0.0437].map((seconds) => Math.floor(seconds * SAMPLE_RATE));
  const delaysRight = [0.0307, 0.0329, 0.0393, 0.0451].map((seconds) => Math.floor(seconds * SAMPLE_RATE));
  const combLeft = delaysLeft.map((size) => new Float32Array(size));
  const combRight = delaysRight.map((size) => new Float32Array(size));
  const positionsLeft = delaysLeft.map(() => 0);
  const positionsRight = delaysRight.map(() => 0);
  for (let i = 0; i < left.length; i++) {
    let reverbedLeft = 0;
    let reverbedRight = 0;
    for (let comb = 0; comb < combLeft.length; comb++) {
      const pl = positionsLeft[comb];
      const pr = positionsRight[comb];
      const delayedLeft = combLeft[comb][pl];
      const delayedRight = combRight[comb][pr];
      combLeft[comb][pl] = left[i] + delayedLeft * feedback;
      combRight[comb][pr] = right[i] + delayedRight * feedback;
      positionsLeft[comb] = (pl + 1) % combLeft[comb].length;
      positionsRight[comb] = (pr + 1) % combRight[comb].length;
      reverbedLeft += delayedLeft;
      reverbedRight += delayedRight;
    }
    left[i] += (reverbedLeft * .21 + reverbedRight * .04) * wet;
    right[i] += (reverbedRight * .21 + reverbedLeft * .04) * wet;
  }
}

function master(left, right) {
  let peak = 0;
  let sumSquares = 0;
  for (let i = 0; i < left.length; i++) {
    left[i] = Math.tanh(left[i] * 1.24);
    right[i] = Math.tanh(right[i] * 1.24);
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    sumSquares += left[i] * left[i] + right[i] * right[i];
  }
  const gain = .91 / Math.max(.01, peak);
  const fadeIn = SAMPLE_RATE * 2;
  const fadeOut = SAMPLE_RATE * 4.5;
  for (let i = 0; i < left.length; i++) {
    const fade = Math.min(1, i / fadeIn, (left.length - 1 - i) / fadeOut);
    left[i] *= gain * smooth(fade);
    right[i] *= gain * smooth(fade);
  }
  return { peak: peak * gain, rms: Math.sqrt(sumSquares / (left.length * 2)) * gain };
}

async function encode(left, right) {
  const encoder = await encodeOgg({ sampleRate: SAMPLE_RATE, channels: 2, quality: 5 });
  const chunks = [];
  const blockSize = SAMPLE_RATE * 4;
  for (let offset = 0; offset < left.length; offset += blockSize) {
    chunks.push(encoder.encode([left.subarray(offset, offset + blockSize), right.subarray(offset, offset + blockSize)]));
  }
  chunks.push(encoder.flush());
  encoder.free();
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function inspectOgg(buffer) {
  let offset = 0;
  let page = 0;
  let lastGranule = 0n;
  let channels = 0;
  let sampleRate = 0;
  while (offset < buffer.length) {
    if (buffer.toString("ascii", offset, offset + 4) !== "OggS") throw new Error(`Invalid Ogg capture at byte ${offset}`);
    const flags = buffer[offset + 5];
    const granule = buffer.readBigInt64LE(offset + 6);
    const sequence = buffer.readUInt32LE(offset + 18);
    const segmentCount = buffer[offset + 26];
    if (sequence !== page) throw new Error(`Unexpected Ogg page sequence ${sequence}, expected ${page}`);
    if (page === 0 && (flags & 2) === 0) throw new Error("Ogg stream is missing the beginning-of-stream flag");
    let bodyLength = 0;
    for (let segment = 0; segment < segmentCount; segment++) bodyLength += buffer[offset + 27 + segment];
    const bodyOffset = offset + 27 + segmentCount;
    if (page === 0) {
      if (buffer[bodyOffset] !== 1 || buffer.toString("ascii", bodyOffset + 1, bodyOffset + 7) !== "vorbis") throw new Error("Missing Vorbis identification header");
      channels = buffer[bodyOffset + 11];
      sampleRate = buffer.readUInt32LE(bodyOffset + 12);
    }
    if (granule >= 0) lastGranule = granule;
    offset = bodyOffset + bodyLength;
    page++;
    if (offset === buffer.length && (flags & 4) === 0) throw new Error("Ogg stream is missing the end-of-stream flag");
  }
  if (offset !== buffer.length || channels !== 2 || sampleRate !== SAMPLE_RATE) throw new Error("Unexpected Ogg stream layout");
  return { pages: page, channels, sampleRate, seconds: Number(lastGranule) / sampleRate };
}

await mkdir(OUTPUT_DIR, { recursive: true });
const manifest = [];
for (const track of TRACKS) {
  process.stdout.write(`Rendering ${track.title}... `);
  const score = new Score(track);
  orchestrate(score);
  addSchroederReverb(score.left, score.right, track.style);
  const stats = master(score.left, score.right);
  const encoded = await encode(score.left, score.right);
  const stream = inspectOgg(encoded);
  if (Math.abs(stream.seconds - score.duration) > .1) throw new Error(`${track.title} duration mismatch: ${stream.seconds}s`);
  const file = `${track.id}.ogg`;
  await writeFile(join(OUTPUT_DIR, file), encoded);
  manifest.push({
    id: track.id,
    title: track.title,
    file,
    scene: track.style,
    seconds: Number(stream.seconds.toFixed(2)),
    bytes: encoded.length,
    sha256: createHash("sha256").update(encoded).digest("hex"),
    oggPages: stream.pages,
    peak: Number(stats.peak.toFixed(4)),
    rms: Number(stats.rms.toFixed(4)),
    sampleRate: SAMPLE_RATE,
  });
  process.stdout.write(`${score.duration.toFixed(1)}s, ${(encoded.length / 1_048_576).toFixed(2)} MiB\n`);
}

await writeFile(join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify({ generatedAt: "2026-08-13", tracks: manifest }, null, 2)}\n`);
console.log(`Rendered ${manifest.length} original tracks to ${OUTPUT_DIR}`);
