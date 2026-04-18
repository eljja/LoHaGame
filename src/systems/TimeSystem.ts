import Phaser from "phaser";
import { DAY_PHASE_SECONDS, NIGHT_PHASE_SECONDS, WIN_DAY } from "../config";
import type { Phase } from "../types";

/**
 * 실시간으로 흘러가는 하루. 낮/밤 각 5분.
 * 이벤트:
 *  - "phaseChange"     (phase)
 *  - "dayChange"       (day)
 *  - "hourChange"      (hour)
 *  - "day10Tick"       (day)
 *  - "win"             ()
 */
export class TimeSystem extends Phaser.Events.EventEmitter {
  day = 1;
  hour = 6;
  phase: Phase = "day";
  /** 현재 phase에서 경과한 실시간 초 */
  elapsedInPhase = 0;
  paused = false;
  speedMultiplier = 1;

  get totalPhaseSeconds(): number {
    return this.phase === "day" ? DAY_PHASE_SECONDS : NIGHT_PHASE_SECONDS;
  }

  /** 낮 6시~18시, 밤 18시~6시 로 매핑 */
  private phaseHours(progress01: number): number {
    if (this.phase === "day") {
      // 6 → 18
      return Math.floor(6 + progress01 * 12);
    }
    // 18 → 30 (==6) over night
    const h = Math.floor(18 + progress01 * 12);
    return h >= 24 ? h - 24 : h;
  }

  update(deltaMs: number): void {
    if (this.paused) return;
    const seconds = (deltaMs / 1000) * this.speedMultiplier;
    this.elapsedInPhase += seconds;

    const progress = Phaser.Math.Clamp(this.elapsedInPhase / this.totalPhaseSeconds, 0, 1);
    const newHour = this.phaseHours(progress);
    if (newHour !== this.hour) {
      this.hour = newHour;
      this.emit("hourChange", this.hour);
    }

    if (this.elapsedInPhase >= this.totalPhaseSeconds) {
      this.nextPhase();
    }
  }

  nextPhase(): void {
    this.elapsedInPhase = 0;
    if (this.phase === "day") {
      this.phase = "night";
      this.hour = 18;
    } else {
      this.phase = "day";
      this.hour = 6;
      this.day += 1;
      this.emit("dayChange", this.day);
      if (this.day % 10 === 0 && this.day <= WIN_DAY) {
        this.emit("day10Tick", this.day);
      }
      if (this.day > WIN_DAY) {
        this.emit("win");
      }
    }
    this.emit("phaseChange", this.phase);
    this.emit("hourChange", this.hour);
  }

  /** 분 단위 시간 스킵(액션 비용용). phase 경계를 넘기면 자동 전환. */
  advanceMinutes(min: number): void {
    if (min <= 0) return;
    const secondsPerGameMinute = this.totalPhaseSeconds / (12 * 60); // 12 game hours per phase
    this.elapsedInPhase += min * secondsPerGameMinute;
    while (this.elapsedInPhase >= this.totalPhaseSeconds) {
      this.elapsedInPhase -= this.totalPhaseSeconds;
      // simulate one phase transition
      if (this.phase === "day") {
        this.phase = "night";
        this.hour = 18;
      } else {
        this.phase = "day";
        this.hour = 6;
        this.day += 1;
        this.emit("dayChange", this.day);
        if (this.day % 10 === 0 && this.day <= WIN_DAY) {
          this.emit("day10Tick", this.day);
        }
        if (this.day > WIN_DAY) {
          this.emit("win");
        }
      }
      this.emit("phaseChange", this.phase);
    }
    const progress = Phaser.Math.Clamp(this.elapsedInPhase / this.totalPhaseSeconds, 0, 1);
    this.hour = this.phaseHours(progress);
    this.emit("hourChange", this.hour);
  }

  /** 0..1 진행률 */
  get phaseProgress(): number {
    return this.elapsedInPhase / this.totalPhaseSeconds;
  }

  /** HUD 표시용 시계 문자열 */
  clockString(): string {
    const progress = this.phaseProgress;
    const totalMin = progress * 12 * 60;
    const baseH = this.phase === "day" ? 6 : 18;
    const h = (baseH + Math.floor(totalMin / 60)) % 24;
    const m = Math.floor(totalMin % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  toJSON() {
    return { day: this.day, hour: this.hour, phase: this.phase, elapsedInPhase: this.elapsedInPhase };
  }

  fromJSON(data: { day: number; hour: number; phase: Phase; elapsedInPhase: number }): void {
    this.day = data.day;
    this.hour = data.hour;
    this.phase = data.phase;
    this.elapsedInPhase = data.elapsedInPhase;
  }
}
