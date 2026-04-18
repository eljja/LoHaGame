import Phaser from "phaser";
import { STAT_DRAIN } from "../config";
import type { StatDelta, Phase } from "../types";

export class PlayerStats extends Phaser.Events.EventEmitter {
  hp = 100;
  hunger = 80;
  thirst = 80;
  energy = 90;
  dead = false;

  apply(delta: StatDelta): void {
    if (delta.hp != null) this.hp = Phaser.Math.Clamp(this.hp + delta.hp, 0, 100);
    if (delta.hunger != null) this.hunger = Phaser.Math.Clamp(this.hunger + delta.hunger, 0, 100);
    if (delta.thirst != null) this.thirst = Phaser.Math.Clamp(this.thirst + delta.thirst, 0, 100);
    if (delta.energy != null) this.energy = Phaser.Math.Clamp(this.energy + delta.energy, 0, 100);
    this.emit("change");
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.emit("death");
    }
  }

  tick(deltaMs: number, phase: Phase): void {
    if (this.dead) return;
    const s = deltaMs / 1000;
    this.hunger = Math.max(0, this.hunger - STAT_DRAIN.hunger * s);
    this.thirst = Math.max(0, this.thirst - STAT_DRAIN.thirst * s);
    this.energy = Math.max(0, this.energy - (phase === "day" ? STAT_DRAIN.energyDay : STAT_DRAIN.energyNight) * s);
    // 굶주림/탈수 피해
    if (this.hunger <= 0) this.hp -= 0.05 * s;
    if (this.thirst <= 0) this.hp -= 0.1 * s;
    this.hp = Phaser.Math.Clamp(this.hp, 0, 100);
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.emit("death");
    }
    this.emit("change");
  }

  restFull(): void {
    this.energy = 100;
    this.hp = Math.min(100, this.hp + 20);
    this.emit("change");
  }

  toJSON() {
    return { hp: this.hp, hunger: this.hunger, thirst: this.thirst, energy: this.energy };
  }

  fromJSON(d: { hp: number; hunger: number; thirst: number; energy: number }): void {
    this.hp = d.hp;
    this.hunger = d.hunger;
    this.thirst = d.thirst;
    this.energy = d.energy;
    this.dead = this.hp <= 0;
  }
}
