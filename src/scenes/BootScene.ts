import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { getStore } from "../systems/GameStore";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    // 로딩 바
    const barW = 420;
    const barH = 18;
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, barW + 6, barH + 6, 0x0b1028).setStrokeStyle(1, COLORS.panelBorder);
    const bar = this.add.rectangle(GAME_WIDTH / 2 - barW / 2, GAME_HEIGHT / 2, 1, barH, COLORS.accent).setOrigin(0, 0.5);
    const pct = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36, "0%", {
        fontFamily: "Galmuri11, monospace",
        color: "#8d9bd1",
        fontSize: "14px",
      })
      .setOrigin(0.5);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, "무인도에서의 50일", {
        fontFamily: "Galmuri11, monospace",
        color: "#eaf0ff",
        fontSize: "32px",
      })
      .setOrigin(0.5);

    this.load.on("progress", (v: number) => {
      bar.width = barW * v;
      pct.setText(`${Math.floor(v * 100)}%`);
    });

    this.load.image("title-island-v2", "assets/title-island-v2.jpg");

    // 최소 대기(타이틀 부드러운 전환)
    this.load.on("complete", () => {
      this.time.delayedCall(300, () => {
        bg.destroy();
        bar.destroy();
        pct.destroy();
        title.destroy();
        getStore(this);
        this.scene.start("TitleScene");
      });
    });
  }

  create(): void {}
}
