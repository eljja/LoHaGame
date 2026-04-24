import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, WIN_DAY } from "../config";
import { makeButton } from "../ui/Button";
import { SaveManager } from "../systems/SaveManager";
import { getStore } from "../systems/GameStore";
import { audio } from "../systems/AudioManager";

interface VictoryInit {
  raftEscape?: boolean;
  days?: number;
}

export class VictoryScene extends Phaser.Scene {
  private raftEscape = false;
  private daysSurvived = WIN_DAY;

  constructor() {
    super("VictoryScene");
  }

  init(data: VictoryInit): void {
    this.raftEscape = !!data?.raftEscape;
    this.daysSurvived = data?.days ?? WIN_DAY;
  }

  create(): void {
    const cam = this.cameras.main;
    cam.fadeIn(600, 0, 0, 0);

    audio.playBgm("victory");
    audio.play("victory");

    if (this.raftEscape) {
      this.drawRaftEnding();
    } else {
      this.drawRescueEnding();
    }

    const store = getStore(this);
    const bosses = store.flags.bossesDefeated.length;
    const achievements = store.flags.unlockedAchievements?.length ?? 0;

    this.add.text(GAME_WIDTH / 2, 270, `처치한 해양 보스: ${bosses}/5   ·   달성한 도전 과제: ${achievements}/9`, {
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

  // ── 기본: 50일 생존 → 구조선 엔딩 ───────────────────────
  private drawRescueEnding(): void {
    // 일출 배경
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xffd28a, 0xffd28a, 0xff9566, 0x6a3a58, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT * 0.55, 90, 0xffffff, 0.9);
    const seaY = GAME_HEIGHT * 0.6;
    const sea = this.add.graphics();
    sea.fillGradientStyle(0xff9566, 0xff9566, 0x1a2040, 0x1a2040, 1);
    sea.fillRect(0, seaY, GAME_WIDTH, GAME_HEIGHT - seaY);

    const ship = this.add.text(GAME_WIDTH / 2, seaY - 10, "🚢", { fontSize: "96px" }).setOrigin(0.5, 1);
    this.tweens.add({ targets: ship, y: ship.y - 4, duration: 2400, yoyo: true, repeat: -1 });

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
  }

  // ── 뗏목 엔딩: 조기 탈출 ────────────────────────────
  private drawRaftEnding(): void {
    // 어스름 하늘 — 푸른 새벽
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a4a8a, 0x2a4a8a, 0x66a0d0, 0x88c0e0, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 낮은 구름
    for (let i = 0; i < 6; i++) {
      const cx = Phaser.Math.Between(60, GAME_WIDTH - 60);
      const cy = Phaser.Math.Between(100, 280);
      const cloud = this.add.text(cx, cy, "☁", { fontSize: "52px", color: "#eaf2ff" }).setOrigin(0.5).setAlpha(0.7);
      this.tweens.add({ targets: cloud, x: cx + 20, duration: 3000 + i * 400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }

    // 바다
    const seaY = GAME_HEIGHT * 0.58;
    const sea = this.add.graphics();
    sea.fillGradientStyle(0x88c0e0, 0x88c0e0, 0x103060, 0x103060, 1);
    sea.fillRect(0, seaY, GAME_WIDTH, GAME_HEIGHT - seaY);

    // 파도 결
    for (let i = 0; i < 8; i++) {
      const y = seaY + 40 + i * 18;
      const w = this.add.text(Phaser.Math.Between(40, GAME_WIDTH - 80), y, "〰", {
        fontSize: "22px", color: "#eaf2ff",
      }).setAlpha(0.3);
      this.tweens.add({ targets: w, x: w.x + 40, duration: 2200, yoyo: true, repeat: -1 });
    }

    // 뒤로 멀어지는 섬
    const island = this.add.text(120, seaY + 30, "🏝", { fontSize: "72px" }).setOrigin(0.5).setAlpha(0.9);
    this.tweens.add({ targets: island, alpha: 0.35, scale: 0.7, duration: 5000 });

    // 뗏목 + 플레이어 (점점 앞으로 전진)
    const raftX = GAME_WIDTH / 2 - 100;
    const raftY = seaY + 90;
    const raft = this.add.text(raftX, raftY, "⛵", { fontSize: "88px" }).setOrigin(0.5);
    const person = this.add.text(raftX, raftY - 40, "🧑", { fontSize: "44px" }).setOrigin(0.5);
    this.tweens.add({
      targets: [raft, person],
      x: raftX + 300,
      y: "+=0",
      duration: 8000,
      ease: "Linear",
    });
    this.tweens.add({ targets: raft, y: raftY - 6, duration: 1400, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: person, y: person.y - 6, duration: 1400, yoyo: true, repeat: -1 });

    const title = this.add.text(GAME_WIDTH / 2, 120, "⛵ 섬 탈출 ⛵", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "60px",
      color: "#ffffff",
      stroke: "#0a2040",
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.03, duration: 1500, yoyo: true, repeat: -1 });

    this.add.text(GAME_WIDTH / 2, 196, `Day ${this.daysSurvived}에 뗏목을 만들어 바다로 나섰다.`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "20px",
      color: "#fff3d0",
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 228, `끝없는 수평선 위에서 새벽 바람이 뗏목을 밀어낸다...`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "14px",
      color: "#d0e4ff",
    }).setOrigin(0.5);
  }
}
