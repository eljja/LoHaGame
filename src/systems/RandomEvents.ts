import Phaser from "phaser";
import { getStore } from "./GameStore";
import { audio } from "./AudioManager";

interface RandomEventsDeps {
  /** 플레이어 위치에서 떠오르는 +X 텍스트 효과 (WorldScene.spawnPickupFx). */
  spawnPickupFx: (tx: number, ty: number, text: string, color?: string) => void;
}

/** 매일 아침 무작위 이벤트를 돌린다.
 *  - 25% 확률로 "오늘의 사건" 발동 (선택의 무게 있음, 하루 한정).
 *  - 그 외엔 55% 확률로 작은 무작위 이벤트 (선물/단발).
 *  dayChange 후 2.5초 뒤 트리거. */
export function setupRandomEvents(scene: Phaser.Scene, deps: RandomEventsDeps): void {
  const store = getStore(scene);
  store.time.on("dayChange", () => {
    scene.time.delayedCall(2500, () => {
      if (Math.random() < 0.25) {
        rollMajorEvent(scene, deps);
      } else if (Math.random() < 0.55) {
        rollMorningEvent(scene, deps);
      }
    });
    // 어제 사건들 만료 처리
    expireYesterdayEvents(scene);
  });
  // 폭풍은 밤이 되는 순간 발동
  store.time.on("phaseChange", (phase: "day" | "night") => {
    if (phase === "night") triggerStormIfDue(scene);
  });
}

/** 어제 시작된 사건들을 정리: 좌초 고래 사라짐, 동굴 울림 만료, 보강 플래그 리셋. */
function expireYesterdayEvents(scene: Phaser.Scene): void {
  const store = getStore(scene);
  // 좌초 고래 — 어제 떠밀려와 처리 안 한 것은 까마귀에게
  const expired = store.map.entities.filter(
    (e) => e.type === "whale_carcass" && (e.meta?.spawnedDay ?? 0) < store.time.day
  );
  if (expired.length > 0) {
    for (const e of expired) store.map.removeEntity(e.id);
    store.pushLog("🐦 까마귀 떼가 어제의 고래를 다 뜯어먹었다.");
  }
  // 동굴 울림은 그날 자정에 자연 만료 (caveEchoDay !== today 면 더 이상 적용 안 됨)
  // 폭풍 보강 플래그는 폭풍 종료 후 자동 리셋되므로 여기서는 따로 처리 안 함
}

/** 폭풍 예보된 밤 → 천막 보강 안 했으면 천막 파괴. */
function triggerStormIfDue(scene: Phaser.Scene): void {
  const store = getStore(scene);
  if (!store.flags.stormIncomingDay || store.flags.stormIncomingDay !== store.time.day) return;

  audio.play("thunder");
  scene.cameras.main.flash(400, 200, 220, 255);
  scene.cameras.main.shake(800, 0.012);

  if (store.flags.shelterReinforced) {
    store.pushLog("🌪 폭풍이 휘몰아친다! 보강한 천막은 흔들리지만 버텨낸다.");
  } else {
    const tents = store.map.entities.filter((e) => e.type === "tent_placed");
    if (tents.length > 0) {
      for (const t of tents) store.map.removeEntity(t.id);
      store.pushLog(`💥 폭풍에 천막 ${tents.length}개가 무너졌다! 다시 짓자.`);
      store.flags.hasTent = false;
    } else {
      store.pushLog("🌪 폭풍이 휘몰아친다. (다행히 천막이 없어 잃을 게 없었다.)");
    }
  }
  store.flags.stormIncomingDay = 0;
  store.flags.shelterReinforced = false;
}

/** 선택의 무게 있는 큰 사건 — 24시간 시한 또는 다가올 위협. */
function rollMajorEvent(scene: Phaser.Scene, deps: RandomEventsDeps): void {
  const store = getStore(scene);
  const day = store.time.day;
  const candidates: Array<() => void> = [];

  // ① 좌초 고래 — 해변 sand 타일 무작위 위치에 등장
  candidates.push(() => {
    const map = store.map;
    const sandTiles: Array<{ tx: number; ty: number }> = [];
    for (let ty = 0; ty < map.size; ty++) {
      for (let tx = 0; tx < map.size; tx++) {
        if (map.terrain[ty][tx] !== "sand") continue;
        if (map.entityAt(tx, ty)) continue;
        sandTiles.push({ tx, ty });
      }
    }
    if (sandTiles.length === 0) return;
    const spot = Phaser.Utils.Array.GetRandom(sandTiles) as { tx: number; ty: number };
    let maxId = 0;
    for (const e of map.entities) if (e.id > maxId) maxId = e.id;
    map.entities.push({
      id: maxId + 1,
      type: "whale_carcass",
      tx: spot.tx, ty: spot.ty,
      meta: { spawnedDay: day },
    });
    store.pushLog("🐋 거대한 고래가 해변에 떠밀려왔다! 내일 아침까지 처리하지 않으면 까마귀에게 빼앗긴다.");
    // 방향 힌트
    const dx = spot.tx - store.playerTx;
    const dy = spot.ty - store.playerTy;
    const ns = dy < 0 ? "북" : "남";
    const ew = dx < 0 ? "서" : "동";
    const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
    store.pushLog(`   → 약 ${dist}칸 ${ns}${ew}쪽 해변. 탭하면 대량의 자원을 얻을 수 있다.`);
    audio.play("boss_alert");
  });

  // ② 폭풍 예보 — 천막이 있고 아직 폭풍 예보 없을 때만
  if (store.map.entities.some((e) => e.type === "tent_placed") && !store.flags.stormIncomingDay) {
    candidates.push(() => {
      store.flags.stormIncomingDay = day;
      store.flags.shelterReinforced = false;
      store.pushLog("🌪 하늘이 심상치 않다. 오늘 밤 폭풍이 올 것 같다!");
      store.pushLog("   → 천막을 탭해 보강할 수 있다 (나뭇가지 ×8 소비). 보강 안 하면 무너진다.");
      audio.play("thunder");
    });
  }

  // ③ 동굴 울림 — 동굴 입구가 있고 곡괭이가 있을 때만
  if (
    store.map.entities.some((e) => e.type === "cave_entrance") &&
    store.inv.bestPickaxeTier() >= 1 &&
    store.flags.caveEchoDay !== day
  ) {
    candidates.push(() => {
      store.flags.caveEchoDay = day;
      store.pushLog("👁 오늘 동굴에서 이상한 울림이 들린다. 깊이 들어갈수록 무언가 풍부할 것 같다.");
      store.pushLog("   → 오늘 동굴 채굴 산출 +50%. 단, 위험도도 높아질지도...");
      audio.play("boss_alert");
    });
  }

  if (candidates.length === 0) {
    // 후보 없으면 작은 이벤트로 폴백
    rollMorningEvent(scene, deps);
    return;
  }
  const pick = Phaser.Utils.Array.GetRandom(candidates) as () => void;
  pick();
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
