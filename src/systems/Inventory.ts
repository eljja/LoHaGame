import Phaser from "phaser";
import { ITEMS } from "../data/items";
import type { ItemId } from "../types";

export const INVENTORY_SLOTS = 20;

export type Slot = { id: ItemId; count: number; dur?: number } | null;

export class Inventory extends Phaser.Events.EventEmitter {
  slots: Slot[] = new Array(INVENTORY_SLOTS).fill(null);

  add(id: ItemId, count = 1): number {
    const def = ITEMS[id];
    let remaining = count;
    // 기존 스택에 더하기 (내구도 아이템은 stack=1이라 자동으로 새 슬롯으로 감)
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
        const slot: { id: ItemId; count: number; dur?: number } = { id, count: add };
        if (def.maxDurability != null && def.stack === 1) {
          slot.dur = def.maxDurability;
        }
        this.slots[i] = slot;
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

  /** 슬롯 인덱스를 지정해 해당 슬롯 1개를 제거. 내구도 아이템 파손에 쓰임. */
  removeSlot(idx: number): void {
    if (this.slots[idx]) {
      this.slots[idx] = null;
      this.emit("change");
    }
  }

  /**
   * 내구도를 1 감소시킨다. 반환값:
   *  - broken: true → 아이템이 부서져 슬롯이 비워졌다
   *  - hasDurability: false → 이 아이템은 내구도가 없다
   */
  useDurability(idx: number): { broken: boolean; hasDurability: boolean; dur?: number; max?: number } {
    const s = this.slots[idx];
    if (!s) return { broken: false, hasDurability: false };
    const def = ITEMS[s.id];
    if (def.maxDurability == null) return { broken: false, hasDurability: false };
    s.dur = (s.dur ?? def.maxDurability) - 1;
    if (s.dur <= 0) {
      this.slots[idx] = null;
      this.emit("change");
      return { broken: true, hasDurability: true, dur: 0, max: def.maxDurability };
    }
    this.emit("change");
    return { broken: false, hasDurability: true, dur: s.dur, max: def.maxDurability };
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

  /** 해당 도구가 있는 첫 슬롯 인덱스 (없으면 -1) */
  findToolSlot(tool: "rod" | "axe" | "pickaxe" | "gun"): number {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && ITEMS[s.id].tool === tool) return i;
    }
    return -1;
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

  /** 최고 곡괭이가 있는 슬롯 인덱스를 반환. 없으면 -1. */
  bestPickaxeSlot(): number {
    let best = -1;
    let bestTier: 0 | 1 | 2 = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s) {
        const t = ITEMS[s.id].pickaxeTier;
        if (t && t > bestTier) { bestTier = t; best = i; }
      }
    }
    return best;
  }

  bestWeapon(): { id: ItemId; dmg: number; slotIdx: number } {
    let best: { id: ItemId; dmg: number; slotIdx: number } = { id: "stick" as ItemId, dmg: 3, slotIdx: -1 }; // 맨손 3
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s) {
        const dmg = ITEMS[s.id].weaponDamage;
        if (dmg && dmg > best.dmg) best = { id: s.id, dmg, slotIdx: i };
      }
    }
    return best;
  }

  /** 지정 무기 제외 최고 무기를 찾는다 (예: 권총이 탄 없을 때). */
  bestWeaponExcept(excludeId: ItemId): { id: ItemId; dmg: number; slotIdx: number } {
    let best: { id: ItemId; dmg: number; slotIdx: number } = { id: "stick" as ItemId, dmg: 3, slotIdx: -1 };
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && s.id !== excludeId) {
        const dmg = ITEMS[s.id].weaponDamage;
        if (dmg && dmg > best.dmg) best = { id: s.id, dmg, slotIdx: i };
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
