import Phaser from "phaser";
import { TILE_PX } from "../data/tiles";
import { getStore } from "./GameStore";
import { audio } from "./AudioManager";

/** 토끼/늑대/멧돼지/곰이 무작위 방향으로 이동하는 AI 틱.
 *  WorldScene에서 호출하며 entityObjects 접근은 콜백으로 분리. */
export function setupWildlifeAI(
  scene: Phaser.Scene,
  getEntitySprite: (id: number) => Phaser.GameObjects.Image | undefined,
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
  rabbit: 420,
  wolf: 520,
  boar: 620,
  bear: 720,
};

const SOUND_CHANCE: Record<string, number> = {
  rabbit: 0.035,
  wolf: 0.1,
  boar: 0.075,
  bear: 0.09,
};

function tickWildlife(
  scene: Phaser.Scene,
  getEntitySprite: (id: number) => Phaser.GameObjects.Image | undefined,
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
      if (sprite.getData("wildlifeMoving")) continue;
      const startX = sprite.x;
      const startY = sprite.y;
      const endX = nx * TILE_PX + TILE_PX / 2;
      const endY = ny * TILE_PX + TILE_PX / 2;
      a.tx = nx;
      a.ty = ny;
      if (dx !== 0) sprite.setFlipX(dx < 0);
      sprite.setData("wildlifeMoving", true);
      scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: TWEEN_DURATION[a.type] ?? 300,
        ease: "Sine.InOut",
        onUpdate: (tween) => {
          if (!sprite.active) return;
          const progress = tween.getValue() ?? 0;
          const hop = Math.sin(progress * Math.PI) * (a.type === "rabbit" ? 2.5 : 1);
          sprite.x = Phaser.Math.Linear(startX, endX, progress);
          sprite.y = Phaser.Math.Linear(startY, endY, progress) - hop;
        },
        onComplete: () => {
          if (!sprite.active) return;
          sprite.x = endX;
          sprite.y = endY;
          sprite.setData("wildlifeMoving", false);
        },
      });
      const distance = Math.abs(nx - store.playerTx) + Math.abs(ny - store.playerTy);
      if (distance <= 10 && Math.random() < (SOUND_CHANCE[a.type] ?? 0)) {
        audio.playAnimal(a.type as "rabbit" | "wolf" | "boar" | "bear", distance);
      }
      break;
    }
  }
}
