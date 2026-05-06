import Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import type { Achievement } from "../data/achievements";

export function showAchievementToast(scene: Phaser.Scene, ach: Achievement): void {
  const w = 420;
  const h = ach.perk ? 96 : 70;
  const cx = GAME_WIDTH / 2;
  const targetY = 76;

  const c = scene.add.container(cx, -h).setDepth(600).setAlpha(0);

  const bg = scene.add
    .rectangle(0, 0, w, h, 0x0e1c06, 0.97)
    .setStrokeStyle(2, 0xffd700)
    .setOrigin(0.5, 0);

  const topLine = scene.add.text(-w / 2 + 14, 10, "🏆 도전 과제 달성!", {
    fontFamily: "Galmuri11, monospace",
    fontSize: "12px",
    color: "#ffd700",
  });

  const iconText = scene.add.text(-w / 2 + 14, 30, ach.icon, { fontSize: "26px" });
  const nameText = scene.add.text(-w / 2 + 50, 33, ach.name, {
    fontFamily: "Galmuri11, monospace",
    fontSize: "17px",
    color: "#eaf0ff",
    fontStyle: "bold",
  });

  const objs: Phaser.GameObjects.GameObject[] = [bg, topLine, iconText, nameText];

  if (ach.perk) {
    const perkText = scene.add.text(-w / 2 + 14, 62, `✨ 특성: ${ach.perk.desc}`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#b0f0a0",
    });
    objs.push(perkText);
  }

  c.add(objs);

  // Only uiCam should render this (ignore by worldCam)
  const worldCam = scene.cameras.main;
  if (worldCam) worldCam.ignore(c);

  // Slide down + fade in
  scene.tweens.add({
    targets: c,
    y: targetY,
    alpha: 1,
    duration: 380,
    ease: "Back.Out",
    onComplete: () => {
      scene.time.delayedCall(3200, () => {
        scene.tweens.add({
          targets: c,
          y: targetY - 24,
          alpha: 0,
          duration: 420,
          ease: "Quad.In",
          onComplete: () => c.destroy(),
        });
      });
    },
  });
}
