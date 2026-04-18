import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, WIN_DAY } from "../config";
import { makeButton } from "../ui/Button";
import { SaveManager } from "../systems/SaveManager";
import { getStore } from "../systems/GameStore";

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super("VictoryScene");
  }

  create(): void {
    const cam = this.cameras.main;
    cam.fadeIn(600, 0, 0, 0);

    // 일출 배경
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xffd28a, 0xffd28a, 0xff9566, 0x6a3a58, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // 해
    this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT * 0.55, 90, 0xffffff, 0.9);
    // 파도
    const seaY = GAME_HEIGHT * 0.6;
    const sea = this.add.graphics();
    sea.fillGradientStyle(0xff9566, 0xff9566, 0x1a2040, 0x1a2040, 1);
    sea.fillRect(0, seaY, GAME_WIDTH, GAME_HEIGHT - seaY);

    // 구조선 실루엣
    const ship = this.add.text(GAME_WIDTH / 2, seaY - 10, "🚢", { fontSize: "96px" }).setOrigin(0.5, 1);
    this.tweens.add({ targets: ship, y: ship.y - 4, duration: 2400, yoyo: true, repeat: -1 });

    // 주인공 (해변)
    this.add.text(GAME_WIDTH / 2 - 280, seaY + 80, "🧑", { fontSize: "72px" }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2 - 280, seaY + 130, "🏝", { fontSize: "72px" }).setAlpha(0.7).setOrigin(0.5);

    const title = this.add.text(GAME_WIDTH / 2, 130, "🎉 생존 성공 🎉", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "64px",
      color: "#ffffff",
      stroke: "#a02020",
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.03, duration: 1500, yoyo: true, repeat: -1 });

    this.add.text(GAME_WIDTH / 2, 210, `${WIN_DAY}일을 버텨 구조선에 올랐다.`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "22px",
      color: "#fff3d0",
    }).setOrigin(0.5);

    const store = getStore(this);
    const bosses = store.flags.bossesDefeated.length;
    this.add.text(GAME_WIDTH / 2, 250, `처치한 해양 보스: ${bosses}/5`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "16px",
      color: "#ffe8bb",
    }).setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 90, {
      label: "🏠 타이틀로",
      width: 260,
      height: 52,
      fontSize: 18,
      onClick: () => {
        SaveManager.clear();
        this.scene.start("TitleScene");
      },
    });
  }
}
