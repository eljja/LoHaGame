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
  strings: makeWave([1, .42, .28, .17, .11, .075, .052, .035, .024, .016]),
  brass: makeWave([1, .72, .45, .3, .18, .11, .075, .045]),
  woodwind: makeWave([1, .16, .34, .08, .13, .04, .06]),
  flute: makeWave([1, .12, .045, .018]),
  choir: makeWave([1, .34, .18, .12, .09, .055, .03]),
  harp: makeWave([1, .62, .43, .31, .22, .15, .1, .07, .04, .025]),
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
    const duration = kind === "cymbal" ? 3.6 : kind === "timpani" ? 1.7 : .9;
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
      if (kind === "timpani") {
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
    case "violins": return { wave: "strings", attack: .42, release: 1.15, sustain: .82, level: .145, detune: .0019, vibrato: 5.1, vibratoDepth: .0018, breath: .012, shimmer: .07 };
    case "violas": return { wave: "strings", attack: .5, release: 1.3, sustain: .86, level: .14, detune: .0016, vibrato: 4.7, vibratoDepth: .0015, breath: .009, shimmer: .04 };
    case "cellos": return { wave: "strings", attack: .38, release: 1.1, sustain: .88, level: .16, detune: .0012, vibrato: 4.3, vibratoDepth: .0013, breath: .008, shimmer: .025 };
    case "horns": return { wave: "brass", attack: .22, release: .75, sustain: .78, level: .115, detune: .0008, vibrato: 4.8, vibratoDepth: .0007, breath: .018, shimmer: .025 };
    case "trombones": return { wave: "brass", attack: .12, release: .55, sustain: .84, level: .12, detune: .0005, vibrato: 0, vibratoDepth: 0, breath: .014, shimmer: 0 };
    case "flute": return { wave: "flute", attack: .08, release: .32, sustain: .9, level: .13, detune: 0, vibrato: 5.4, vibratoDepth: .0014, breath: .055, shimmer: .035 };
    case "oboe": return { wave: "woodwind", attack: .07, release: .28, sustain: .88, level: .105, detune: 0, vibrato: 5, vibratoDepth: .0009, breath: .025, shimmer: .02 };
    case "choir": return { wave: "choir", attack: .8, release: 1.8, sustain: .9, level: .075, detune: .0018, vibrato: 4.1, vibratoDepth: .0012, breath: .02, shimmer: .06 };
    case "harp": return { wave: "harp", attack: .004, release: Math.min(2.5, duration), sustain: .1, level: .11, detune: .0004, vibrato: 0, vibratoDepth: 0, breath: 0, shimmer: .035 };
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

function orchestrate(score) {
  const { track } = score;
  const melodyBase = track.melodyBase;
  const isStorm = track.style === "combat" || track.style === "intro_storm";
  const isRain = track.style === "rain_day" || track.style === "rain_night";
  const isWind = track.style === "wind_day" || track.style === "wind_night";
  const isNightLike = track.style === "night" || track.style === "rain_night" || track.style === "wind_night";
  const chordLength = isStorm ? 2 : 4;

  for (let bar = 0; bar < track.bars; bar++) {
    const beat = bar * 4;
    const chord = track.chords[bar % track.chords.length];
    const intensity = intensityFor(track.style, bar, track.bars);
    const root = chord[0];

    score.note("cellos", root - 12, beat, 4.05, .7 + intensity * .25, -.22);
    score.note("cellos", chord[2] - 12, beat + (isStorm ? 2 : 0), chordLength, .42 + intensity * .18, .16);
    chord.slice(0, 3).forEach((note, index) => score.note("violas", note + 12, beat, 4.1, .45 + intensity * .34, (index - 1) * .3));
    chord.slice(1).forEach((note, index) => score.note("violins", note + 24, beat, 4.05, .35 + intensity * .32, .2 + index * .23));

    if (["title", "victory", "intro_calm", "intro_shore"].includes(track.style)) {
      chord.slice(0, 3).forEach((note, index) => score.note("choir", note + 12, beat, 4.15, intensity * .65, (index - 1) * .36));
    }

    if (intensity > .57 && !isNightLike && !isRain && track.style !== "cave" && track.style !== "gameover") {
      score.note("horns", root + 12, beat, 3.7, intensity * .76, -.14);
      score.note("horns", chord[2] + 12, beat, 3.7, intensity * .58, .18);
    }

    const arpSteps = isStorm || isWind ? 8 : track.style === "cave" || track.style === "rain_night" ? 2 : 4;
    for (let step = 0; step < arpSteps; step++) {
      if ((isNightLike || track.style === "cave") && score.rng() < .25) continue;
      const note = chord[(step * 2 + bar) % chord.length] + (isStorm ? 12 : 24);
      score.note("harp", note, beat + step * 4 / arpSteps, isWind ? .42 : .65, (isRain ? .3 : .42) + intensity * .3, (step % 2 ? .52 : -.52));
    }

    const melodyInstrument = track.style === "day" || track.style === "wind_day" || track.style === "intro_shore" ? (bar % 8 < 4 ? "flute" : "oboe")
      : isNightLike || isRain || track.style === "gameover" || track.style === "intro_calm" ? "oboe"
      : track.style === "cave" ? "flute" : "violins";
    const melodySteps = isStorm || isWind ? 4 : 2;
    for (let step = 0; step < melodySteps; step++) {
      const motifIndex = (bar * melodySteps + step) % track.motif.length;
      const note = melodyBase + track.motif[motifIndex];
      const restChance = track.style === "cave" ? .48 : isNightLike || isRain ? .28 : .1;
      if (score.rng() > restChance) score.note(melodyInstrument, note, beat + step * 4 / melodySteps, isStorm || isWind ? .85 : 1.65, .46 + intensity * .42, step ? .16 : -.12);
    }

    if (isStorm) {
      for (let eighth = 0; eighth < 8; eighth++) {
        const ostinato = chord[eighth % 2 ? 2 : 0] + 12;
        score.note(eighth % 2 ? "violas" : "cellos", ostinato, beat + eighth * .5, .34, .48 + intensity * .28, eighth % 2 ? .22 : -.22);
      }
      const drumScale = track.style === "combat" ? 1 : .72;
      score.drum("taiko", beat, (.48 + intensity * .35) * drumScale, -.18);
      score.drum("taiko", beat + 2, (.4 + intensity * .3) * drumScale, .2);
      if (bar % 4 === 3) score.drum("timpani", beat + 3, .58 + intensity * .3);
      if (bar % 8 === 0 || bar === track.bars - 1) score.drum("cymbal", beat, .22 + intensity * .18, .25);
      if (intensity > .74) score.note("trombones", root + 12, beat, 1.6, intensity * .7, -.08);
    } else if (["victory", "intro_shore"].includes(track.style) || (track.style === "title" && bar >= track.bars * .65)) {
      score.drum("timpani", beat, .28 + intensity * .3, -.2);
      if (bar % 4 === 0) score.drum("cymbal", beat, .13 + intensity * .12, .25);
    } else if ((track.style === "day" || track.style === "wind_day") && bar % 8 === 4) {
      score.drum("timpani", beat, .14 + intensity * .12, -.3);
    }
  }
}

function addSchroederReverb(left, right, style) {
  const wet = style === "cave" ? .34 : style === "night" || style === "rain_night" || style === "wind_night" ? .25 : style === "combat" || style === "intro_storm" ? .17 : .22;
  const feedback = style === "cave" ? .76 : .69;
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

await writeFile(join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify({ generatedAt: "2026-08-10", tracks: manifest }, null, 2)}\n`);
console.log(`Rendered ${manifest.length} original tracks to ${OUTPUT_DIR}`);
