import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { drawPanel } from "./Panel";
import { makeButton } from "./Button";
import { getStore } from "../systems/GameStore";
import { WIN_DAY } from "../config";

export class JournalPanel {
  private container?: Phaser.GameObjects.Container;
  constructor(private scene: Phaser.Scene) {}

  open(): void {
    if (this.container) this.close();
    const store = getStore(this.scene);
    const w = 700;
    const h = 540;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;

    const c = this.scene.add.container(0, 0).setDepth(200);
    const overlay = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0).setInteractive();
    const panel = drawPanel(this.scene, x, y, w, h, { fill: 0x0b1228, alpha: 0.98 });
    const title = this.scene.add.text(x + 20, y + 18, "📖 생존 일지", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "24px",
      color: "#eaf0ff",
    });

    const bosses = store.flags.bossesDefeated;
    const remaining = WIN_DAY - store.time.day;
    const nextBoss = Math.ceil(store.time.day / 10) * 10;
    const summary = [
      `Day ${store.time.day} / ${WIN_DAY}`,
      `구조선까지 ${remaining}일 남음`,
      `다음 해양 습격: Day ${nextBoss} ${bosses.includes(nextBoss) ? "(격퇴)" : ""}`,
      `쓰러뜨린 보스: ${bosses.length > 0 ? bosses.map((d) => `Day${d}`).join(", ") : "없음"}`,
      `모닥불: ${store.flags.hasBonfire ? "있음" : "없음"}   /   천막: ${store.flags.hasTent ? "있음" : "없음"}`,
      `수색한 배 상자: ${store.flags.lootedCrates}/3`,
      "",
      "━━ 최근 기록 ━━",
    ].join("\n");
    const body = this.scene.add.text(x + 22, y + 70, summary, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "14px",
      color: "#cfd8ff",
      lineSpacing: 4,
    });
    const logsText = store.logs.slice(0, 20).join("\n");
    const logs = this.scene.add.text(x + 22, y + 250, logsText, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#9fb7ff",
      wordWrap: { width: w - 44 },
      lineSpacing: 3,
    });

    c.add([overlay, panel, title, body, logs]);

    const close = makeButton(this.scene, x + w - 80, y + 30, {
      label: "닫기 (Esc)",
      width: 120,
      height: 36,
      fontSize: 13,
      onClick: () => this.close(),
    });
    c.add(close);
    this.scene.input.keyboard?.once("keydown-ESC", () => this.close());
    this.container = c;
  }

  close(): void {
    this.container?.destroy();
    this.container = undefined;
  }
  get isOpen(): boolean {
    return !!this.container;
  }
}
