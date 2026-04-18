import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config";
import { ITEMS } from "../data/items";
import type { EnemyDef, ItemId } from "../types";
import { getStore } from "../systems/GameStore";
import { makeButton, type ButtonNode } from "../ui/Button";
import { drawPanel } from "../ui/Panel";

interface InitData {
  enemy: EnemyDef;
}

export class CombatScene extends Phaser.Scene {
  private enemy!: EnemyDef;
  private enemyHp = 0;
  private enemySprite!: Phaser.GameObjects.Text;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBarMaxWidth = 420;
  private enemyNameText!: Phaser.GameObjects.Text;
  private flavor!: Phaser.GameObjects.Text;
  private log!: Phaser.GameObjects.Text;
  private defending = false;
  private buttons: ButtonNode[] = [];
  private turnLock = false;

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
    const cam = this.cameras.main;
    cam.fadeIn(400, 0, 0, 0);

    // 배경
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x150616, 0x150616, 0x05070f, 0x05070f, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 붉은 빛 번개
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

    // 적
    this.enemyNameText = this.add.text(GAME_WIDTH / 2, 80, `⚔ ${this.enemy.name}`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "30px",
      color: "#ff8a9a",
    }).setOrigin(0.5);

    // HP 바
    const bx = GAME_WIDTH / 2 - this.enemyHpBarMaxWidth / 2;
    const by = 120;
    this.add.rectangle(bx, by, this.enemyHpBarMaxWidth, 18, 0x220a10, 1).setOrigin(0, 0).setStrokeStyle(2, 0x6a2230);
    this.enemyHpBar = this.add.rectangle(bx, by, this.enemyHpBarMaxWidth, 18, 0xff5a6a, 1).setOrigin(0, 0);

    this.enemySprite = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, this.enemy.icon, { fontSize: "140px" }).setOrigin(0.5);
    this.tweens.add({ targets: this.enemySprite, y: this.enemySprite.y - 14, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    this.flavor = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110, this.enemy.flavor, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "15px",
      color: "#cfd8ff",
    }).setOrigin(0.5);

    // 주인공
    this.add.text(180, GAME_HEIGHT - 220, "🧑", { fontSize: "72px" }).setOrigin(0.5);

    // 로그
    drawPanel(this, 0, GAME_HEIGHT - 180, GAME_WIDTH, 180, { fill: 0x0a0f1e, alpha: 0.95 });
    this.log = this.add.text(320, GAME_HEIGHT - 164, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "14px",
      color: "#cfd8ff",
      wordWrap: { width: GAME_WIDTH - 360 },
      lineSpacing: 4,
    });

    this.buildButtons();
    this.pushLog(`⚠ ${this.enemy.name} 조우! 교전을 시작한다.`);
  }

  private buildButtons(): void {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];
    const store = getStore(this);
    const weapon = store.inv.bestWeapon();

    const actions: Array<[string, () => void, boolean?]> = [
      [`⚔ 공격 (${ITEMS[weapon.id as ItemId]?.name ?? "맨손"} · ${weapon.dmg})`, () => this.playerAttack()],
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

  private playerAttack(): void {
    const store = getStore(this);
    const weapon = store.inv.bestWeapon();
    const dmg = Math.round(weapon.dmg * (1 + store.stats.energy / 200) * Phaser.Math.FloatBetween(0.85, 1.15));
    this.enemyHp = Math.max(0, this.enemyHp - dmg);
    this.pushLog(`🩸 ${dmg} 데미지를 입혔다.`);
    this.tweens.add({ targets: this.enemySprite, angle: -8, duration: 80, yoyo: true });
    this.flashColor(this.enemySprite, 0xffffff);
    this.updateHpBar();
    this.afterPlayerTurn();
  }

  private playerDefend(): void {
    this.defending = true;
    this.pushLog("🛡 방어 태세를 취했다. 다음 공격 피해가 절반.");
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
    this.pushLog(`🩹 ${def.name}을(를) 사용했다.`);
    this.afterPlayerTurn();
  }

  private playerFlee(): void {
    if (!this.enemy.canFlee) return;
    if (Math.random() < 0.5) {
      this.pushLog("🏃 성공적으로 도망쳤다.");
      this.time.delayedCall(600, () => this.endCombat(false));
    } else {
      this.pushLog("도망에 실패했다!");
      this.afterPlayerTurn();
    }
  }

  private afterPlayerTurn(): void {
    this.turnLock = true;
    if (this.enemyHp <= 0) {
      this.time.delayedCall(500, () => this.victory());
      return;
    }
    this.time.delayedCall(600, () => this.enemyTurn());
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
    const drops: string[] = [];
    for (const l of this.enemy.loot) {
      if (Math.random() <= l.chance) {
        store.inv.add(l.id, l.count);
        drops.push(`${ITEMS[l.id].icon}${ITEMS[l.id].name}×${l.count}`);
      }
    }
    if (drops.length) this.pushLog(`🎁 획득: ${drops.join(", ")}`);
    if (this.enemy.kind === "sea") {
      store.flags.bossesDefeated.push(store.time.day);
    }
    this.tweens.add({ targets: this.enemySprite, alpha: 0, scale: 0.5, duration: 900, ease: "Back.In" });
    this.time.delayedCall(1200, () => this.endCombat(true));
  }

  private endCombat(_won: boolean, dead = false): void {
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

  private updateHpBar(): void {
    const w = this.enemyHpBarMaxWidth * (this.enemyHp / this.enemy.hp);
    this.tweens.add({ targets: this.enemyHpBar, width: Math.max(0, w), duration: 250 });
  }

  private pushLog(msg: string): void {
    const lines = (this.log.text ? this.log.text.split("\n") : []).concat(msg).slice(-5);
    this.log.setText(lines.join("\n"));
  }

  private flashColor(obj: Phaser.GameObjects.Text, _color: number): void {
    this.tweens.add({ targets: obj, alpha: 0.3, duration: 60, yoyo: true });
  }
}

void COLORS;
