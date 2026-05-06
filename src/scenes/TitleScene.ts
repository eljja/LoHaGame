import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { makeButton } from "../ui/Button";
import { SaveManager } from "../systems/SaveManager";
import { getStore } from "../systems/GameStore";
import { audio } from "../systems/AudioManager";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    const g = this.add.graphics();
    // 밤바다 그라디언트
    g.fillGradientStyle(0x05070f, 0x05070f, 0x0a1430, 0x0a1430, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // 달
    const moon = this.add.circle(GAME_WIDTH - 220, 160, 50, 0xe8eeff, 1);
    moon.setStrokeStyle(12, 0xf6faff, 0.1);
    // 별
    for (let i = 0; i < 80; i++) {
      const sx = Phaser.Math.Between(20, GAME_WIDTH - 20);
      const sy = Phaser.Math.Between(20, GAME_HEIGHT / 2);
      const star = this.add.circle(sx, sy, Phaser.Math.FloatBetween(0.5, 1.8), 0xffffff, Phaser.Math.FloatBetween(0.3, 1));
      this.tweens.add({ targets: star, alpha: 0.2, duration: Phaser.Math.Between(1500, 3500), yoyo: true, repeat: -1 });
    }
    // 바다
    const seaY = GAME_HEIGHT * 0.6;
    const sea = this.add.graphics();
    sea.fillGradientStyle(0x0c2750, 0x0c2750, 0x040b1c, 0x040b1c, 1);
    sea.fillRect(0, seaY, GAME_WIDTH, GAME_HEIGHT - seaY);
    // 섬 실루엣
    const island = this.add.graphics();
    island.fillStyle(0x06111f, 1);
    island.fillTriangle(GAME_WIDTH / 2 - 300, seaY, GAME_WIDTH / 2 + 320, seaY, GAME_WIDTH / 2, seaY - 180);
    island.fillTriangle(GAME_WIDTH / 2 + 60, seaY, GAME_WIDTH / 2 + 420, seaY, GAME_WIDTH / 2 + 220, seaY - 130);
    // 좌초된 배 실루엣
    const ship = this.add.text(GAME_WIDTH / 2 - 90, seaY - 20, "🚢", { fontSize: "96px" }).setOrigin(0.5, 1);
    ship.setAngle(-18);
    // 파도
    this.tweens.add({ targets: ship, y: ship.y + 6, duration: 2800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    // 타이틀
    const title = this.add
      .text(GAME_WIDTH / 2, 200, "무인도에서의 50일", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "56px",
        color: "#eaf0ff",
        stroke: "#0b2040",
        strokeThickness: 6,
        shadow: { offsetX: 0, offsetY: 0, color: "#6fd1ff", blur: 18, fill: true },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: title, y: 196, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.add
      .text(GAME_WIDTH / 2, 260, "— 50일 동안 살아남아라 —", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "20px",
        color: "#9fb7ff",
      })
      .setOrigin(0.5);

    // 버튼
    const hasSave = SaveManager.hasSave();
    const btnY = GAME_HEIGHT - 230;
    makeButton(this, GAME_WIDTH / 2, btnY, {
      label: "🆕  새 게임 시작",
      width: 320,
      height: 56,
      fontSize: 20,
      onClick: () => {
        getStore(this).resetNewGame();
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(420, () => this.scene.start("IntroScene"));
      },
    });

    const continueBtn = makeButton(this, GAME_WIDTH / 2, btnY + 72, {
      label: hasSave ? "📂  이어하기" : "📂  저장 없음",
      width: 320,
      height: 56,
      fontSize: 20,
      disabled: !hasSave,
      onClick: () => {
        const blob = SaveManager.load();
        if (!blob) return;
        const store = getStore(this);
        store.resetNewGame();
        store.loadFrom(blob);
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(420, () => {
          this.scene.start("WorldScene");
          this.scene.launch("HUDScene");
        });
      },
    });
    if (!hasSave) continueBtn.setAlpha(0.6);

    makeButton(this, GAME_WIDTH / 2, btnY + 144, {
      label: "🗑  저장 삭제",
      width: 320,
      height: 40,
      fontSize: 14,
      bg: 0x1a0f18,
      hover: 0x3a1520,
      border: 0x6a2230,
      onClick: () => {
        SaveManager.clear();
        this.scene.restart();
      },
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 30, "ⓒ 무인도에서의 50일 · Phaser 3", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "12px",
        color: "#5a6ba0",
      })
      .setOrigin(0.5);

    const muteBtn = makeButton(this, 80, 50, {
      label: audio.muted ? "🔇 음소거" : "🔊 소리",
      width: 140,
      height: 40,
      fontSize: 14,
      bg: 0x0c1228,
      onClick: () => {
        const m = audio.toggleMuted();
        (muteBtn as any).setLabel(m ? "🔇 음소거" : "🔊 소리");
        if (!m) audio.playBgm("title");
      },
    });

    this.cameras.main.fadeIn(500, 0, 0, 0);
    audio.playBgm("title");
    void COLORS; // 정적 참조 유지
  }
}
