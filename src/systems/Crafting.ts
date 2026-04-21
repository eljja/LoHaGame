import { RECIPES } from "../data/recipes";
import type { Recipe } from "../types";
import type { Inventory } from "./Inventory";

export class Crafting {
  constructor(
    private inv: Inventory,
    private getFlags: () => { hasBonfire: boolean; hasTent: boolean; discoveredRecipes?: string[] }
  ) {}

  /** 플레이어가 발견한 레시피만 반환. */
  listRecipes(): Recipe[] {
    const flags = this.getFlags();
    const discovered = flags.discoveredRecipes;
    if (!discovered || discovered.length === 0) return RECIPES;
    return RECIPES.filter((r) => discovered.includes(r.id));
  }

  canCraft(recipe: Recipe): { ok: boolean; reason?: string } {
    if (recipe.requires) {
      const f = this.getFlags();
      for (const r of recipe.requires) {
        if (r === "bonfire" && !f.hasBonfire) return { ok: false, reason: "모닥불이 필요하다" };
        if (r === "tent" && !f.hasTent) return { ok: false, reason: "천막이 필요하다" };
      }
    }
    for (const input of recipe.inputs) {
      if (!this.inv.has(input.id, input.count)) return { ok: false, reason: "재료 부족" };
    }
    return { ok: true };
  }

  craft(recipe: Recipe): boolean {
    if (!this.canCraft(recipe).ok) return false;
    for (const input of recipe.inputs) this.inv.remove(input.id, input.count);
    this.inv.add(recipe.result.id, recipe.result.count);
    return true;
  }
}
