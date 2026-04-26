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
    const h = 560;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;

    const c = this.scene.add.container(0, 0).setDepth(200);
    const overlay = this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setOrigin(0, 0).setInteractive();
    const panel = drawPanel(this.scene, x, y, w, h, { fill: 0x0b1228, alpha: 0.98 });

    const title = this.scene.add.text(x + 20, y + 18, "📖 생존 일지", {
      fontFamily: "Galmuri11, monospace", fontSize: "24px", color: "#eaf0ff",
    });

    // ── 요약 정보 ──────────────────────────────────
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
    ].join("\n");

    const bodyTxt = this.scene.add.text(x + 22, y + 60, summary, {
      fontFamily: "Galmuri11, monospace", fontSize: "14px", color: "#cfd8ff", lineSpacing: 4,
    });

    // ── 구분선 ──────────────────────────────────────
    const divY = y + 186;
    const divLine = this.scene.add.text(x + 22, divY, "━━ 최근 기록 ━━", {
      fontFamily: "Galmuri11, monospace", fontSize: "14px", color: "#5566aa",
    });

    // ── 스크롤 가능한 로그 영역 ────────────────────
    const logAreaTop = divY + 22;
    const logAreaH = y + h - 20 - logAreaTop;
    const logAreaW = w - 50;

    const logsText = store.logs.slice(0, 80).join("\n");
    const logTxt = this.scene.add.text(x + 22, logAreaTop, logsText, {
      fontFamily: "Galmuri11, monospace", fontSize: "12px", color: "#9fb7ff",
      wordWrap: { width: logAreaW }, lineSpacing: 3,
    });

    // Geometry mask: 로그가 패널 밖으로 안 넘치도록
    const maskGfx = this.scene.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(x + 2, logAreaTop, logAreaW + 44, logAreaH);
    logTxt.setMask(maskGfx.createGeometryMask());

    // 스크롤 상태
    let scrollY = 0;
    const updateScroll = () => {
      const maxScroll = Math.max(0, logTxt.height - logAreaH);
      scrollY = Phaser.Math.Clamp(scrollY, 0, maxScroll);
      logTxt.setY(logAreaTop - scrollY);
    };

    // 스크롤 힌트
    const hintTxt = this.scene.add.text(x + w - 22, y + h - 12, "↑↓ 마우스 휠 스크롤", {
      fontFamily: "Galmuri11, monospace", fontSize: "11px", color: "#445588",
    }).setOrigin(1, 1);

    c.add([overlay, panel, title, bodyTxt, divLine, logTxt, hintTxt]);

    // 닫기 버튼
    const closeX = makeButton(this.scene, x + w - 40, y + 36, {
      label: "✕", width: 60, height: 48, fontSize: 24,
      bg: 0x2a0f18, hover: 0x4a1520, border: 0x8a2230,
      onClick: () => this.close(),
    });
    c.add(closeX);

    this.scene.input.keyboard?.once("keydown-ESC", () => this.close());

    // 씬 레벨 wheel 이벤트
    const wheelHandler = (_p: unknown, _gs: unknown, _dx: number, dy: number) => {
      scrollY += dy * 0.35;
      updateScroll();
    };
    this.scene.input.on("wheel", wheelHandler);
    (c as any)._wheelHandler = wheelHandler;

    const worldCam = this.scene.cameras.main;
    if (worldCam) worldCam.ignore(c);
    this.container = c;
  }

  close(): void {
    if (this.container) {
      const h = (this.container as any)._wheelHandler;
      if (h) this.scene.input.off("wheel", h);
    }
    this.container?.destroy();
    this.container = undefined;
  }

  get isOpen(): boolean {
    return !!this.container;
  }
}
