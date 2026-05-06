import Phaser from "phaser";
import { TILE_PX } from "../data/tiles";
import { getStore } from "./GameStore";

/** 토끼/늑대/멧돼지/곰이 무작위 방향으로 이동하는 AI 틱.
 *  WorldScene에서 호출하며 entityObjects 접근은 콜백으로 분리. */
export function setupWildlifeAI(
  scene: Phaser.Scene,
  getEntitySprite: (id: number) => Phaser.GameObjects.Text | undefined,
): void {
  scene.time.addEvent({
    delay: 2400,
    loop: true,
    callback: () => tickWildlife(scene, getEntitySprite),
  });
}

const MOVE_CHANCE: Record<string, number> = {
  rabbit: 0.55,
  wolf: 0.40,
  boar: 0.25,
  bear: 0.20,
};

const TWEEN_DURATION: Record<string, number> = {
  rabbit: 240, // 빠르고 통통 튀는 느낌
  wolf: 380,   // 느릿한 사냥꾼
  boar: 460,   // 우직하게 천천히
  bear: 520,   // 큰 덩치, 무거운 발걸음
};

function tickWildlife(
  scene: Phaser.Scene,
  getEntitySprite: (id: number) => Phaser.GameObjects.Text | undefined,
): void {
  // 씬이 일시정지 상태면 아무것도 하지 않음
  if (scene.scene.isPaused()) return;
  const store = getStore(scene);

  const animals = store.map.entities.filter(
    (e) => e.type === "rabbit" || e.type === "wolf" || e.type === "boar" || e.type === "bear",
  );
  for (const a of animals) {
    const chance = MOVE_CHANCE[a.type] ?? 0;
    if (Math.random() > chance) continue;
    const dirs: Array<[number, number]> = [
      [0, -1], [0, 1], [-1, 0], [1, 0],
    ];
    Phaser.Utils.Array.Shuffle(dirs);
    for (const [dx, dy] of dirs) {
      const nx = a.tx + dx;
      const ny = a.ty + dy;
      if (!store.map.isPassable(nx, ny)) continue;
      // 플레이어와 같은 타일은 피함
      if (nx === store.playerTx && ny === store.playerTy) continue;
      // 다른 엔티티가 있는 타일도 피함
      if (store.map.entityAt(nx, ny)) continue;
      const sprite = getEntitySprite(a.id);
      if (!sprite) continue;
      a.tx = nx;
      a.ty = ny;
      scene.tweens.add({
        targets: sprite,
        x: nx * TILE_PX + TILE_PX / 2,
        y: ny * TILE_PX + TILE_PX / 2,
        duration: TWEEN_DURATION[a.type] ?? 300,
        ease: "Sine.InOut",
      });
      break;
    }
  }
}
