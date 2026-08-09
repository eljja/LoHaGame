import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { makeButton } from "../ui/Button";
import { SaveManager } from "../systems/SaveManager";
import { getStore } from "../systems/GameStore";
import { audio } from "../systems/AudioManager";
import { formatRunHistoryLine, formatRunLegacy, loadRunHistory } from "../systems/RunHistory";

const LAST_UPDATE = "2026.08.10";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "title-island-v2").setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    const g = this.add.graphics();
    g.fillStyle(0x020713, 0.28);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillGradientStyle(0x020713, 0x020713, 0x061226, 0x061226, 0.16);
    g.fillRect(0, 0, GAME_WIDTH, 260);

    // 타이틀
    const title = this.add
      .text(GAME_WIDTH / 2, 106, "무인도에서의 50일", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "56px",
        color: "#eaf0ff",
        stroke: "#0b2040",
        strokeThickness: 6,
        shadow: { offsetX: 0, offsetY: 0, color: "#6fd1ff", blur: 18, fill: true },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: title, y: 102, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.add
      .text(GAME_WIDTH / 2, 166, "50일 동안 살아남아라", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "20px",
        color: "#9fb7ff",
      })
      .setOrigin(0.5);

    // 버튼
    const hasSave = SaveManager.hasSave();
    const btnX = GAME_WIDTH - 230;
    const btnY = 574;
    makeButton(this, btnX, btnY, {
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

    const continueBtn = makeButton(this, btnX, btnY + 66, {
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

    makeButton(this, btnX, btnY + 132, {
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

    const history = loadRunHistory();
    const hx = 48;
    const hy = 530;
    this.add.text(hx, hy, "생존자의 항해 기록", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "18px",
      color: "#cfd8ff",
    });
    this.add.text(
      hx,
      hy + 32,
      history.length > 0
        ? history.map((entry, i) => `${i + 1}. ${formatRunHistoryLine(entry)}`).join("\n")
        : "아직 기록된 도전이 없다.",
      {
        fontFamily: "Galmuri11, monospace",
        fontSize: "11px",
        color: "#c2cff7",
        lineSpacing: 6,
        wordWrap: { width: 610 },
      }
    );
    this.add.text(hx, 696, formatRunLegacy(), {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#ffd98a",
      lineSpacing: 6,
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 30, `ⓒ 무인도에서의 50일 · Phaser 3 · 최종 update ${LAST_UPDATE}`, {
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
