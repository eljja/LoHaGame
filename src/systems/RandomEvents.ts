import Phaser from "phaser";
import { getStore } from "./GameStore";
import { audio } from "./AudioManager";

interface RandomEventsDeps {
  /** 플레이어 위치에서 떠오르는 +X 텍스트 효과 (WorldScene.spawnPickupFx). */
  spawnPickupFx: (tx: number, ty: number, text: string, color?: string) => void;
}

/** 매일 아침 무작위 이벤트를 돌린다. dayChange 후 2.5초 뒤 트리거. */
export function setupRandomEvents(scene: Phaser.Scene, deps: RandomEventsDeps): void {
  const store = getStore(scene);
  const dayChangeHandler = () => {
    if (store.flags.pendingStormDay != null && store.flags.pendingStormDay < store.time.day) {
      store.flags.pendingStormDay = undefined;
    }
    if (store.flags.pendingStormDay === store.time.day) {
      scene.time.delayedCall(1800, () => triggerForecastStorm(scene, deps));
      return;
    }
    if (store.time.day > 2 && store.flags.pendingStormDay == null && Math.random() < 0.18) {
      store.flags.pendingStormDay = store.time.day + 1;
      scene.time.delayedCall(1200, () => {
        store.pushLog("🌫 먼 바다 위로 먹구름이 뭉친다. 내일 아침 폭풍이 섬을 훑고 지나갈 것 같다.");
        audio.play("phase_night");
      });
    }
    if (Math.random() < 0.55) {
      scene.time.delayedCall(2500, () => rollMorningEvent(scene, deps));
    }
  };
  store.time.on("dayChange", dayChangeHandler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    store.time.off("dayChange", dayChangeHandler);
  });
}

function rollMorningEvent(scene: Phaser.Scene, deps: RandomEventsDeps): void {
  const store = getStore(scene);
  const events: Array<() => void> = [
    () => {
      // 갈매기가 물고기를 떨어뜨림
      store.inv.add("fish_raw", 1);
      store.pushLog("🕊 갈매기 한 마리가 머리 위를 지나가며 생 물고기를 떨어뜨렸다!");
      deps.spawnPickupFx(store.playerTx, store.playerTy - 1, "+🐟×1", "#9fd5ff");
      audio.play("pickup");
    },
    () => {
      // 해안가 유리병 편지
      store.pushLog("🫙 해변에 유리병이 떠밀려왔다. 안에는 오래된 기도문이 있다. 마음이 차분해진다.");
      store.stats.apply({ energy: 12, hp: 4 });
    },
    () => {
      // 야생 꿀벌의 선물 - 열매
      const n = Phaser.Math.Between(2, 3);
      store.inv.add("berry", n);
      store.pushLog(`🐝 꿀벌들이 발견한 열매를 나누어준다. 열매 ×${n}.`);
      deps.spawnPickupFx(store.playerTx, store.playerTy - 1, `+🫐×${n}`);
      audio.play("pickup");
    },
    () => {
      // 토끼가 둥지에 남긴 덩굴
      const n = Phaser.Math.Between(2, 3);
      store.inv.add("vine", n);
      store.pushLog(`🐇 토끼가 둥지에 남긴 덩굴 뭉치를 발견했다. 덩굴 ×${n}.`);
      deps.spawnPickupFx(store.playerTx, store.playerTy - 1, `+🌿×${n}`);
      audio.play("pickup");
    },
    () => {
      // 기묘한 꿈
      store.pushLog("💭 지난밤 꿈에서 구조선을 보았다. 왠지 의지가 솟구친다.");
      store.stats.apply({ energy: 20 });
    },
    () => {
      // 낡은 보물 지도가 든 유리병
      store.inv.add("treasure_map", 1);
      store.pushLog("🫙 파도에 떠밀려온 유리병 안에서 낡은 보물 지도(🗺)를 발견했다!");
      deps.spawnPickupFx(store.playerTx, store.playerTy - 1, "+🗺×1", "#ffd97a");
      audio.play("pickup");
    },
    () => {
      // 해풍 속 표류물
      if (Math.random() < 0.5) {
        store.inv.add("metal_scrap", 2);
        store.pushLog("⚙ 아침 해안에 금속 조각이 떠밀려왔다. 금속 조각 ×2.");
      } else {
        store.inv.add("cloth", 2);
        store.pushLog("🧵 바람에 실려온 낡은 천 조각을 주웠다. 천 조각 ×2.");
      }
      audio.play("pickup");
    },
    () => {
      // 빈 유리병 표류 — 유리병 무역의 입구
      store.inv.add("glass_bottle", 1);
      store.pushLog("🫙 해변에 빈 유리병이 떠밀려왔다. 인벤토리에서 재료를 담아 띄우면 선물이 돌아올지도...");
      deps.spawnPickupFx(store.playerTx, store.playerTy - 1, "+🫙×1", "#a0e0ff");
      audio.play("pickup");
    },
  ];
  const pick = Phaser.Utils.Array.GetRandom(events) as () => void;
  pick();
}

function triggerForecastStorm(scene: Phaser.Scene, deps: RandomEventsDeps): void {
  const store = getStore(scene);
  store.flags.pendingStormDay = undefined;
  const energyLoss = store.inv.has("tent") || store.flags.hasTent ? 8 : 16;
  const lostSticks = Math.min(store.inv.count("stick"), Phaser.Math.Between(0, 2));
  const lostVines = Math.min(store.inv.count("vine"), Phaser.Math.Between(0, 1));
  if (lostSticks > 0) store.inv.remove("stick", lostSticks);
  if (lostVines > 0) store.inv.remove("vine", lostVines);
  store.stats.apply({ energy: -energyLoss });
  const losses = [
    lostSticks > 0 ? `나뭇가지 ${lostSticks}개` : "",
    lostVines > 0 ? `덩굴 ${lostVines}개` : "",
  ].filter(Boolean).join(", ");
  store.pushLog(losses
    ? `⛈ 예고된 폭풍이 지나갔다. 몸을 웅크려 버텼지만 ${losses}가 흩어졌다.`
    : "⛈ 예고된 폭풍이 지나갔다. 큰 피해는 없지만 밤새 버티느라 기운이 빠졌다.");
  deps.spawnPickupFx(store.playerTx, store.playerTy, "⛈", "#9fb7ff");
  audio.play("phase_night");
}
