import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { ITEMS } from "../data/items";
import type { EnemyDef, ItemId } from "../types";
import { getStore } from "../systems/GameStore";
import { makeButton, type ButtonNode } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { audio } from "../systems/AudioManager";

interface InitData {
  enemy: EnemyDef;
}

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export class CombatScene extends Phaser.Scene {
  private enemy!: EnemyDef;
  private enemyHp = 0;
  private enemySprite!: Phaser.GameObjects.Text;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBarMaxWidth = 380;
  private enemyNameText!: Phaser.GameObjects.Text;
  private log!: Phaser.GameObjects.Text;
  private defending = false;
  private buttons: ButtonNode[] = [];
  private turnLock = false;

  // 플레이어 HP 표시
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private playerHpBarBg!: Phaser.GameObjects.Rectangle;
  private playerHpText!: Phaser.GameObjects.Text;
  private playerHpBarMaxWidth = 240;

  constructor() {
    super("CombatScene");
  }

  init(data: InitData): void {
    this.enemy = data.enemy;
    this.enemyHp = data.enemy.hp;
    this.defending = false;
    this.turnLock = false;
    this.buttons = [];
  }

  create(): void {
    const store = getStore(this);
    const cam = this.cameras.main;
    cam.fadeIn(400, 0, 0, 0);

    audio.playBgm("combat");
    audio.play("boss_alert");

    // 배경
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x150616, 0x150616, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 붉은 빛 파티클
    for (let i = 0; i < 40; i++) {
      const p = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(0, GAME_HEIGHT),
        Phaser.Math.FloatBetween(1, 2.5),
        0xff6a88,
        Phaser.Math.FloatBetween(0.2, 0.6)
      );
      this.tweens.add({ targets: p, alpha: 0.1, duration: Phaser.Math.Between(1500, 3500), yoyo: true, repeat: -1 });
    }

    // ── 적 영역 ───────────────────────────────────────────
    this.enemyNameText = this.add.text(GAME_WIDTH / 2, 68, `⚔ ${this.enemy.name}`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "28px",
      color: "#ff8a9a",
    }).setOrigin(0.5);

    // 적 HP 바
    const bx = GAME_WIDTH / 2 - this.enemyHpBarMaxWidth / 2;
    const by = 108;
    this.add.rectangle(bx, by, this.enemyHpBarMaxWidth, 16, 0x220a10, 1).setOrigin(0, 0).setStrokeStyle(2, 0x6a2230);
    this.enemyHpBar = this.add.rectangle(bx, by, this.enemyHpBarMaxWidth, 16, 0xff5a6a, 1).setOrigin(0, 0);
    this.add.text(GAME_WIDTH / 2, 130, `HP: ${this.enemy.hp}`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#cc8899",
    }).setOrigin(0.5);

    // 적 스프라이트
    this.enemySprite = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, this.enemy.icon, { fontSize: "130px" })
      .setOrigin(0.5);
    this.tweens.add({ targets: this.enemySprite, y: this.enemySprite.y - 14, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, this.enemy.flavor, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "14px",
      color: "#cfd8ff",
    }).setOrigin(0.5);

    // ── 플레이어 영역 ──────────────────────────────────────
    this.add.text(60, GAME_HEIGHT - 228, "🧑", { fontSize: "68px" }).setOrigin(0.5);

    // 플레이어 HP 패널 (왼쪽 하단)
    drawPanel(this, 6, GAME_HEIGHT - 180, 278, 100, { fill: 0x0a1428, alpha: 0.9 });

    this.add.text(20, GAME_HEIGHT - 174, "❤ 로하 (플레이어)", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "12px",
      color: "#ff9fb7",
    });

    // HP 바 배경
    this.playerHpBarBg = this.add
      .rectangle(14, GAME_HEIGHT - 152, this.playerHpBarMaxWidth, 14, 0x1a0a10, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x5a2230);
    // HP 바
    this.playerHpBar = this.add
      .rectangle(14, GAME_HEIGHT - 152, this.playerHpBarMaxWidth, 14, 0x4aff8a, 1)
      .setOrigin(0, 0);

    this.playerHpText = this.add.text(14, GAME_HEIGHT - 132, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#eaf0ff",
    });

    this.updatePlayerHp();
    store.stats.on("change", () => this.updatePlayerHp(), this);

    // ── 로그 & 버튼 ───────────────────────────────────────
    drawPanel(this, 0, GAME_HEIGHT - 180, GAME_WIDTH, 180, { fill: 0x0a0f1e, alpha: 0.88 });

    this.log = this.add.text(296, GAME_HEIGHT - 164, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#cfd8ff",
      wordWrap: { width: GAME_WIDTH - 310 },
      lineSpacing: 4,
    });

    this.buildButtons();
    this.pushLog(`⚠ ${this.enemy.name} 조우! 교전 시작.`);
    this.pushLog("💡 공격하면 주사위 2개를 굴려 데미지가 결정된다.");
  }

  // ── 플레이어 HP 갱신 ───────────────────────────────────
  private updatePlayerHp(): void {
    const store = getStore(this);
    const hp = Math.max(0, store.stats.hp);
    const pct = hp / 100;
    const w = Math.max(0, this.playerHpBarMaxWidth * pct);
    this.playerHpBar.setSize(w, 14);

    const col = hp > 60 ? 0x4aff8a : hp > 30 ? 0xffcc44 : 0xff5a6a;
    this.playerHpBar.setFillStyle(col);
    this.playerHpText.setText(`HP: ${Math.ceil(hp)} / 100   ⚡ ${Math.ceil(store.stats.energy)}`);
  }

  private buildButtons(): void {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];
    const store = getStore(this);
    const weapon = store.inv.bestWeapon();
    const weaponName = ITEMS[weapon.id as ItemId]?.name ?? "맨손";

    const actions: Array<[string, () => void, boolean?]> = [
      [`🎲 공격 (${weaponName})`, () => this.playerAttack()],
      ["🛡 방어", () => this.playerDefend()],
      ["🎒 아이템", () => this.useItemPrompt()],
      [`🏃 도망 (${this.enemy.canFlee ? "50%" : "불가"})`, () => this.playerFlee(), !this.enemy.canFlee],
    ];
    const bw = 250;
    const gap = 10;
    const total = actions.length * bw + (actions.length - 1) * gap;
    const startX = (GAME_WIDTH - total) / 2 + bw / 2;
    actions.forEach(([label, cb, disabled], i) => {
      const b = makeButton(this, startX + i * (bw + gap), GAME_HEIGHT - 40, {
        label,
        width: bw,
        height: 48,
        fontSize: 14,
        disabled: !!disabled,
        onClick: () => {
          if (this.turnLock) return;
          cb();
        },
      }) as ButtonNode;
      this.buttons.push(b);
    });
  }

  // ── 주사위 굴리기 애니메이션 ───────────────────────────
  private rollDice(onComplete: (d1: number, d2: number) => void): void {
    const d1Final = Phaser.Math.Between(1, 6);
    const d2Final = Phaser.Math.Between(1, 6);

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 20;

    // 오버레이 배경
    const overlay = this.add
      .rectangle(cx, cy, 380, 200, 0x050a1a, 0.94)
      .setStrokeStyle(2, 0x4466aa)
      .setDepth(200);
    const title = this.add
      .text(cx, cy - 76, "🎲  주사위 굴리기!", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "20px",
        color: "#f0e040",
      })
      .setOrigin(0.5)
      .setDepth(201);

    const d1Text = this.add
      .text(cx - 72, cy - 10, "⚀", { fontSize: "80px" })
      .setOrigin(0.5)
      .setDepth(201);
    const plus = this.add
      .text(cx, cy - 10, "+", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "32px",
        color: "#aabbff",
      })
      .setOrigin(0.5)
      .setDepth(201);
    const d2Text = this.add
      .text(cx + 72, cy - 10, "⚀", { fontSize: "80px" })
      .setOrigin(0.5)
      .setDepth(201);
    const sumText = this.add
      .text(cx, cy + 72, "", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(201);

    void plus;

    // 굴리기 단계별 인터벌 (빠르게 시작 → 점점 느려짐)
    const intervals = [50, 55, 60, 70, 85, 100, 120, 150, 185, 220, 270, 350];
    let tick = 0;

    const doTick = () => {
      if (tick < intervals.length) {
        d1Text.setText(DICE_FACES[Math.floor(Math.random() * 6)]);
        d2Text.setText(DICE_FACES[Math.floor(Math.random() * 6)]);
        this.time.delayedCall(intervals[tick++], doTick);
      } else {
        // 최종값 표시
        d1Text.setText(DICE_FACES[d1Final - 1]);
        d2Text.setText(DICE_FACES[d2Final - 1]);
        audio.play("pickup");

        const sum = d1Final + d2Final;
        const label = sum >= 10 ? " ✨ 대성공!" : sum <= 4 ? " 😬 불운..." : "";
        const col = sum >= 10 ? "#ffd700" : sum <= 4 ? "#ff9944" : "#aaffaa";
        sumText.setText(`합계 ${sum}${label}`).setColor(col);

        // 주사위 바운스
        this.tweens.add({ targets: [d1Text, d2Text], scaleX: 1.35, scaleY: 1.35, duration: 90, yoyo: true, ease: "Back.Out" });

        this.time.delayedCall(720, () => {
          [overlay, title, d1Text, d2Text, sumText].forEach((o) => {
            this.tweens.add({ targets: o, alpha: 0, duration: 180, onComplete: () => o.destroy() });
          });
          this.time.delayedCall(200, () => onComplete(d1Final, d2Final));
        });
      }
    };
    this.time.delayedCall(50, doTick);
  }

  // ── 플레이어 행동 ──────────────────────────────────────
  private playerAttack(): void {
    this.turnLock = true;
    this.rollDice((d1, d2) => {
      const store = getStore(this);
      const weapon = store.inv.bestWeapon();

      // 데미지: 기본 × 에너지 보정 × 주사위 배율 (0.7~1.3)
      const diceSum = d1 + d2; // 2~12
      const diceMult = 0.7 + ((diceSum - 2) / 10) * 0.6;
      const energyMult = 1 + store.stats.energy / 200;
      const dmg = Math.max(1, Math.round(weapon.dmg * energyMult * diceMult));

      this.enemyHp = Math.max(0, this.enemyHp - dmg);

      const comment =
        diceSum >= 10 ? " ✨대성공!" :
        diceSum <= 4  ? " 😬빗나갈 뻔..." : "";
      this.pushLog(`🎲 ${d1}+${d2}=${diceSum}${comment} → 🩸 ${dmg} 데미지!`);

      audio.play("hit");
      this.tweens.add({ targets: this.enemySprite, angle: -10, duration: 80, yoyo: true });
      this.tweens.add({ targets: this.enemySprite, alpha: 0.3, duration: 60, yoyo: true });
      this.updateEnemyHpBar();
      this.afterPlayerTurn();
    });
  }

  private playerDefend(): void {
    this.defending = true;
    this.pushLog("🛡 방어 태세! 다음 공격 피해 절반.");
    this.afterPlayerTurn();
  }

  private useItemPrompt(): void {
    const store = getStore(this);
    const food = store.inv.slots.find((s) => s && ITEMS[s.id].consume?.hp);
    if (!food) {
      this.pushLog("사용할 회복 아이템이 없다.");
      return;
    }
    const def = ITEMS[food.id];
    store.inv.remove(food.id, 1);
    store.stats.apply(def.consume ?? {});
    this.pushLog(`🩹 ${def.name} 사용! HP 회복.`);
    audio.play("heal");
    this.afterPlayerTurn();
  }

  private playerFlee(): void {
    if (!this.enemy.canFlee) return;
    if (Math.random() < 0.5) {
      this.pushLog("🏃 도망 성공!");
      this.time.delayedCall(600, () => this.endCombat(false));
    } else {
      this.pushLog("도망 실패!");
      this.afterPlayerTurn();
    }
  }

  private afterPlayerTurn(): void {
    this.turnLock = true;
    if (this.enemyHp <= 0) {
      this.time.delayedCall(500, () => this.victory());
      return;
    }
    this.time.delayedCall(700, () => this.enemyTurn());
  }

  private enemyTurn(): void {
    const store = getStore(this);
    let dmg = Math.round(this.enemy.atk * Phaser.Math.FloatBetween(0.85, 1.25));
    if (this.defending) {
      dmg = Math.round(dmg * 0.5);
      this.defending = false;
    }
    store.stats.apply({ hp: -dmg });
    this.cameras.main.shake(200, 0.008);
    audio.play("hurt");
    this.pushLog(`💥 ${this.enemy.name}의 공격! ${dmg} 피해.`);
    this.time.delayedCall(400, () => {
      if (store.stats.hp <= 0) {
        this.pushLog("… 의식이 멀어진다.");
        this.time.delayedCall(900, () => this.endCombat(false, true));
      } else {
        this.turnLock = false;
      }
    });
  }

  private victory(): void {
    const store = getStore(this);
    this.pushLog(`✨ ${this.enemy.name}을(를) 쓰러뜨렸다!`);
    audio.play("victory");
    const drops: string[] = [];
    for (const l of this.enemy.loot) {
      if (Math.random() <= l.chance) {
        store.inv.add(l.id, l.count);
        drops.push(`${ITEMS[l.id].icon}${ITEMS[l.id].name}×${l.count}`);
      }
    }
    if (drops.length) {
      this.pushLog(`🎁 획득: ${drops.join(", ")}`);
      this.time.delayedCall(400, () => audio.play("pickup"));
    }
    if (this.enemy.kind === "sea") {
      store.flags.bossesDefeated.push(store.time.day);
    }
    this.tweens.add({ targets: this.enemySprite, alpha: 0, scale: 0.5, duration: 900, ease: "Back.In" });
    this.time.delayedCall(1200, () => this.endCombat(true));
  }

  private endCombat(_won: boolean, dead = false): void {
    getStore(this).stats.off("change", undefined, this);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(520, () => {
      if (dead) {
        this.scene.stop();
        this.scene.stop("WorldScene");
        this.scene.stop("HUDScene");
        this.scene.start("GameOverScene");
        return;
      }
      this.scene.stop();
      this.scene.resume("WorldScene");
      const world = this.scene.get("WorldScene") as import("./WorldScene").WorldScene;
      (world.resumeFromOverlay as () => void).call(world);
      this.scene.get("WorldScene").cameras.main.fadeIn(400, 0, 0, 0);
    });
  }

  private updateEnemyHpBar(): void {
    const w = this.enemyHpBarMaxWidth * (this.enemyHp / this.enemy.hp);
    this.tweens.add({ targets: this.enemyHpBar, width: Math.max(0, w), duration: 250 });
  }

  private pushLog(msg: string): void {
    const lines = (this.log.text ? this.log.text.split("\n") : []).concat(msg).slice(-5);
    this.log.setText(lines.join("\n"));
  }
}

void COLORS;
