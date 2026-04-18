import Phaser from "phaser";
import { ITEMS } from "../data/items";
import type { ItemId } from "../types";

export const INVENTORY_SLOTS = 20;

export type Slot = { id: ItemId; count: number } | null;

export class Inventory extends Phaser.Events.EventEmitter {
  slots: Slot[] = new Array(INVENTORY_SLOTS).fill(null);

  add(id: ItemId, count = 1): number {
    const def = ITEMS[id];
    let remaining = count;
    // 기존 스택에 더하기
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < def.stack) {
        const space = def.stack - s.count;
        const add = Math.min(space, remaining);
        s.count += add;
        remaining -= add;
      }
    }
    // 빈 슬롯
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(def.stack, remaining);
        this.slots[i] = { id, count: add };
        remaining -= add;
      }
    }
    this.emit("change");
    return count - remaining;
  }

  remove(id: ItemId, count = 1): boolean {
    let need = count;
    for (let i = 0; i < this.slots.length && need > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, need);
        s.count -= take;
        need -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this.emit("change");
    return need === 0;
  }

  count(id: ItemId): number {
    let total = 0;
    for (const s of this.slots) if (s && s.id === id) total += s.count;
    return total;
  }

  has(id: ItemId, count = 1): boolean {
    return this.count(id) >= count;
  }

  hasTool(tool: "rod" | "axe" | "pickaxe" | "gun"): boolean {
    return this.slots.some((s) => s && ITEMS[s.id].tool === tool);
  }

  bestPickaxeTier(): 0 | 1 | 2 {
    let best: 0 | 1 | 2 = 0;
    for (const s of this.slots) {
      if (s) {
        const t = ITEMS[s.id].pickaxeTier;
        if (t && t > best) best = t;
      }
    }
    return best;
  }

  bestWeapon(): { id: ItemId; dmg: number } {
    let best: { id: ItemId; dmg: number } = { id: "stick" as ItemId, dmg: 3 }; // 맨손 3
    for (const s of this.slots) {
      if (s) {
        const dmg = ITEMS[s.id].weaponDamage;
        if (dmg && dmg > best.dmg) best = { id: s.id, dmg };
      }
    }
    return best;
  }

  toJSON() {
    return this.slots.slice();
  }

  fromJSON(data: Slot[]): void {
    this.slots = data.slice();
    this.emit("change");
  }
}
