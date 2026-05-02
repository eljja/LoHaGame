import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS, DEBUG_SPEED_KEY } from "../config";
import { getStore } from "../systems/GameStore";
import { drawPanel } from "../ui/Panel";
import { makeButton, type ButtonNode } from "../ui/Button";
import { audio } from "../systems/AudioManager";

/**
 * 영구 HUD: 상단바(일차/시계/스탯), 하단 로그, 낮/밤 틴트.
 */
export class HUDScene extends Phaser.Scene {
  private dayText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private clockText!: Phaser.GameObjects.Text;
  private statBars: Record<string, { bar: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = {};
  private tint!: Phaser.GameObjects.Rectangle;
  private logText!: Phaser.GameObjects.Text;
  private speedIndicator!: Phaser.GameObjects.Text;
  private comboBadge!: Phaser.GameObjects.Text;
  /** 시간 진행 인터벌 — RAF가 스로틀되어도 setInterval은 active tab에서 안정적으로 실행됨. */
  private timeIntervalId?: number;

  constructor() {
    super({ key: "HUDScene", active: false });
  }

  create(): void {
    const store = getStore(this);

    // 낮/밤 전체 틴트 (게임 씬 위에 덮음)
    this.tint = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.night, 0).setOrigin(0, 0).setDepth(-10);
    this.tint.setBlendMode(Phaser.BlendModes.MULTIPLY);

    // 상단 바
    drawPanel(this, 0, 0, GAME_WIDTH, 56, { fill: 0x070b1a, alpha: 0.9, border: COLORS.panelBorder });

    this.dayText = this.add
      .text(16, 28, "Day 1", { fontFamily: "Galmuri11, monospace", fontSize: "22px", color: "#eaf0ff" })
      .setOrigin(0, 0.5);
    this.phaseText = this.add
      .text(130, 28, "☀ 낮", { fontFamily: "Galmuri11, monospace", fontSize: "18px", color: "#ffd97a" })
      .setOrigin(0, 0.5);
    this.clockText = this.add
      .text(220, 28, "06:00", { fontFamily: "Galmuri11, monospace", fontSize: "18px", color: "#cfd8ff" })
      .setOrigin(0, 0.5);

    // 스탯 바 4개
    const stats: Array<[string, string, number]> = [
      ["hp", "❤", COLORS.danger],
      ["hunger", "🍗", COLORS.warn],
      ["thirst", "💧", COLORS.accent],
      ["energy", "⚡", COLORS.good],
    ];
    stats.forEach(([id, icon, color], idx) => {
      const x = 380 + idx * 200;
      this.add.text(x, 28, icon, { fontSize: "16px" }).setOrigin(0, 0.5);
      const bgBar = this.add.rectangle(x + 32, 28, 120, 14, 0x141c3a, 1).setOrigin(0, 0.5).setStrokeStyle(1, COLORS.panelBorder);
      const bar = this.add.rectangle(x + 32, 28, 120, 14, color, 1).setOrigin(0, 0.5);
      const label = this.add
        .text(x + 32 + 120 + 6, 28, "100", { fontFamily: "Galmuri11, monospace", fontSize: "13px", color: "#cfd8ff" })
        .setOrigin(0, 0.5);
      this.statBars[id] = { bar, label };
      void bgBar;
    });

    // 활성 콤보 뱃지 (클럭 옆)
    this.comboBadge = this.add
      .text(290, 28, "", { fontFamily: "Galmuri11, monospace", fontSize: "16px", color: "#a3e0ff" })
      .setOrigin(0, 0.5);
    this.refreshCombos();
    store.on("combosChanged", () => this.refreshCombos());

    // 배속 인디케이터
    this.speedIndicator = this.add
      .text(GAME_WIDTH - 90, 28, "", { fontFamily: "Galmuri11, monospace", fontSize: "14px", color: "#ffd97a" })
      .setOrigin(1, 0.5);

    // 음소거 토글
    const muteBtn = makeButton(this, GAME_WIDTH - 44, 28, {
      label: audio.muted ? "🔇" : "🔊",
      width: 52,
      height: 36,
      fontSize: 18,
      bg: 0x0c1228,
      onClick: () => {
        const m = audio.toggleMuted();
        (muteBtn as ButtonNode).setLabel(m ? "🔇" : "🔊");
      },
    });

    // 하단 로그 (최근 3줄) — 메뉴 버튼(x≤290) 오른쪽으로 이동
    this.logText = this.add
      .text(305, GAME_HEIGHT - 16, "", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "14px",
        color: "#9fb7ff",
        wordWrap: { width: 740 },
      })
      .setOrigin(0, 1);

    // 이벤트 바인딩
    store.time.on("dayChange", (d: number) => this.dayText.setText(`Day ${d}`));
    store.time.on("phaseChange", (phase: "day" | "night") => {
      this.phaseText.setText(phase === "day" ? "☀ 낮" : "🌙 밤");
      this.phaseText.setColor(phase === "day" ? "#ffd97a" : "#9fb7ff");
      this.tweens.add({
        targets: this.tint,
        fillAlpha: phase === "night" ? 0.5 : 0,
        duration: 2000,
      });
    });
    store.time.on("hourChange", () => this.clockText.setText(store.time.clockString()));
    store.stats.on("change", () => this.refreshStats());
    store.stats.on("warn", (stat: string) => this.onStatDepleted(stat));
    store.on("log", () => this.refreshLog());

    this.refreshStats();
    this.refreshLog();

    // 디버그 단축키
    this.input.keyboard?.on(`keydown-${DEBUG_SPEED_KEY}`, () => {
      const cur = store.time.speedMultiplier;
      store.time.speedMultiplier = cur === 1 ? 10 : cur === 10 ? 60 : 1;
      this.speedIndicator.setText(store.time.speedMultiplier > 1 ? `⏩ x${store.time.speedMultiplier}` : "");
    });

    // 시간 진행 — Phaser update()가 아닌 setInterval로 처리.
    // 일부 환경에서 RAF가 입력이 없을 때 스로틀되어 시간이 멈춰 보이는 문제 해결.
    // 100ms 주기 (active tab에서 정확히 보장됨, 백그라운드 탭에서만 throttle).
    const TICK_MS = 100;
    this.timeIntervalId = window.setInterval(() => this.advanceTime(TICK_MS), TICK_MS);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.timeIntervalId !== undefined) {
        clearInterval(this.timeIntervalId);
        this.timeIntervalId = undefined;
      }
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      if (this.timeIntervalId !== undefined) {
        clearInterval(this.timeIntervalId);
        this.timeIntervalId = undefined;
      }
    });
  }

  private advanceTime(deltaMs: number): void {
    const store = getStore(this);
    // 월드가 일시정지(오버레이 씬 활성)되어 있으면 시간도 정지.
    const worldActive = this.scene.isActive("WorldScene") && !this.scene.isPaused("WorldScene");
    const anyPanelOpen = this.scene.isVisible("CaveScene") || this.scene.isActive("CombatScene");
    if (!worldActive || anyPanelOpen) return;
    store.time.update(deltaMs);
    store.stats.tick(deltaMs * store.time.speedMultiplier, store.time.phase);
    this.clockText.setText(store.time.clockString());
  }

  private onStatDepleted(stat: string): void {
    const store = getStore(this);
    const barEntry = this.statBars[stat];
    if (barEntry) {
      // 해당 스탯 바 빨간 깜빡임
      this.tweens.add({
        targets: barEntry.bar,
        alpha: 0.1,
        duration: 150,
        yoyo: true,
        repeat: 5,
        onComplete: () => barEntry.bar.setAlpha(1),
      });
    }
    const msgs: Record<string, string> = {
      energy: "⚡ 행동력이 0이 됐다! 탈진 상태 — HP가 서서히 감소한다. 잠들어서 회복하라.",
      hunger: "🍗 허기가 극에 달했다! 음식을 먹지 않으면 HP가 계속 줄어든다.",
      thirst: "💧 극도로 목마르다! 물을 마시지 않으면 HP가 빠르게 줄어든다.",
    };
    if (msgs[stat]) store.pushLog(msgs[stat]);
  }

  private refreshStats(): void {
    const s = getStore(this).stats;
    const map: Record<string, number> = { hp: s.hp, hunger: s.hunger, thirst: s.thirst, energy: s.energy };
    const dangerColors: Record<string, number> = {
      hp: COLORS.danger, hunger: 0xff6600, thirst: 0xff4444, energy: 0xff4444,
    };
    const normalColors: Record<string, number> = {
      hp: COLORS.danger, hunger: COLORS.warn, thirst: COLORS.accent, energy: COLORS.good,
    };
    for (const k of Object.keys(this.statBars)) {
      const v = map[k];
      this.statBars[k].bar.width = (v / 100) * 120;
      this.statBars[k].label.setText(Math.floor(v).toString());
      // 20 이하면 빨간색으로 변색
      const col = v <= 20 ? dangerColors[k] : normalColors[k];
      this.statBars[k].bar.setFillStyle(col);
    }
  }

  private refreshLog(): void {
    const logs = getStore(this).logs.slice(0, 3).reverse();
    this.logText.setText(logs.join("\n"));
  }

  private refreshCombos(): void {
    const store = getStore(this);
    const icons: Record<string, string> = {
      forge: "🏭",
      home_base: "🏠",
      farm: "🌾",
      signal_network: "📡",
    };
    const list = [...store.activeCombos].map((c) => icons[c]).join(" ");
    this.comboBadge.setText(list);
  }
}
