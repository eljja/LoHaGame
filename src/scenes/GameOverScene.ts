import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { makeButton } from "../ui/Button";
import { SaveManager } from "../systems/SaveManager";
import { getStore } from "../systems/GameStore";
import { audio } from "../systems/AudioManager";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOverScene");
  }

  create(): void {
    const cam = this.cameras.main;
    cam.fadeIn(600, 0, 0, 0);

    audio.play("death");
    audio.playBgm("gameover");

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a0208, 0x1a0208, 0x000000, 0x000000, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 깜빡이는 붉은 점들
    for (let i = 0; i < 60; i++) {
      const p = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(0.5, 2),
        0xff4466,
        Phaser.Math.FloatBetween(0.3, 0.8)
      );
      this.tweens.add({ targets: p, alpha: 0, duration: Phaser.Math.Between(1000, 3000), yoyo: true, repeat: -1 });
    }

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, "생존 실패", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "72px",
      color: "#ff5a6a",
      stroke: "#2a0008",
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: 0.7, duration: 1400, yoyo: true, repeat: -1 });

    const store = getStore(this);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Day ${store.time.day}에 이야기는 막을 내렸다.`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "22px",
      color: "#cfd8ff",
    }).setOrigin(0.5);

    makeButton(this, GAME_WIDTH / 2 - 140, GAME_HEIGHT - 90, {
      label: "🔁 다시 도전",
      width: 240,
      height: 52,
      fontSize: 18,
      onClick: () => {
        SaveManager.clear();
        getStore(this).resetNewGame();
        this.scene.start("IntroScene");
      },
    });
    makeButton(this, GAME_WIDTH / 2 + 140, GAME_HEIGHT - 90, {
      label: "🏠 타이틀",
      width: 240,
      height: 52,
      fontSize: 18,
      onClick: () => {
        SaveManager.clear();
        this.scene.start("TitleScene");
      },
    });
  }
}
