import { WIN_DAY } from "../config";
import type { GameStore } from "./GameStore";

export function getDangerSignals(store: GameStore): string[] {
  const signals: string[] = [];

  if (store.flags.pendingStormDay === store.time.day) {
    signals.push("⛈ 오늘 폭풍");
  } else if (store.flags.pendingStormDay === store.time.day + 1) {
    signals.push("🌫 내일 폭풍");
  }

  if (store.time.day <= WIN_DAY) {
    if (store.time.day % 10 === 0) signals.push("🌊 오늘 해양 위협");
    else if ((store.time.day + 1) % 10 === 0) signals.push("🌊 내일 해양 위협");
  }

  if (store.time.phase === "night") {
    if (!store.inv.has("torch") && !store.isInLightArea(store.playerTx, store.playerTy)) {
      signals.push("🌑 어두운 밤");
    } else {
      signals.push("🔥 밤 대비됨");
    }
  } else if (store.time.hour >= 16) {
    signals.push(store.inv.has("torch") ? "🌇 해질녘 대비됨" : "🌇 해질녘 횃불 필요");
  }

  if (store.stats.thirst <= 20) signals.push("💧 갈증 위험");
  if (store.stats.hunger <= 20) signals.push("🍗 허기 위험");
  if (store.stats.energy <= 18) signals.push("⚡ 탈진 위험");
  if (store.stats.hp <= 35) signals.push("❤ 체력 위험");

  return signals.slice(0, 3);
}

export function formatDangerSignals(store: GameStore): string {
  const signals = getDangerSignals(store);
  return signals.length > 0 ? signals.join("  ") : "위험 신호 없음";
}
