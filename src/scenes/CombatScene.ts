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

  // 주사위 UI (항상 화면에 상주, 공격 시 애니메이션)
  private diceLabel!: Phaser.GameObjects.Text;
  private diceD1!: Phaser.GameObjects.Text;
  private dicePlus!: Phaser.GameObjects.Text;
  private diceD2!: Phaser.GameObjects.Text;
  private diceSum!: Phaser.GameObjects.Text;

  // 패리 시스템 — 적 공격 윈드업 시 좌→우 게이지가 차오르며,
  // 플레이어가 ⚔ 패리 버튼 / 스페이스바를 누른 위치에 따라 결과가 달라진다.
  private parryActive = false;
  private parryStartTime = 0;
  private parryDurationMs = 1500;
  private parryGfx?: Phaser.GameObjects.Graphics;
  private parryCursor?: Phaser.GameObjects.Rectangle;
  private parryLabel?: Phaser.GameObjects.Text;
  private parryBtn?: ButtonNode;
  private parryResolve?: (quality: "perfect" | "good" | "miss") => void;
  /** 다음 공격 ×2 데미지 (퍼펙트 패리 보상) */
  private nextAttackCrit = false;

  /** 연속 명중 콤보. 성공할 때마다 +1, 빗나가면 0으로 초기화. 데미지 ×1.2^combo. */
  private comboHits = 0;

  // 공격 타이밍 — 좌↔우 무한 진동, 탭하면 위치 결정.
  // 가운데(가우시안 중심) = 명중, 우측 끝 1% = 도망 성공.
  // sigma는 무기 데미지에 비례, 진동 속도는 (플레이어 dmg − 적 atk) 차이에 따라.
  private attackActive = false;
  private attackStartTime = 0;
  private attackCycleMs = 1500;
  private attackSigma = 0.15;
  private attackBarGfx?: Phaser.GameObjects.Graphics;
  private attackCursor?: Phaser.GameObjects.Rectangle;
  private attackLabel?: Phaser.GameObjects.Text;
  private attackBtn?: ButtonNode;
  private attackResolveCb?: (t: number) => void;
  private attackKeyHandler?: () => void;
  private attackPointerHandler?: () => void;

  // 방어 타이밍 — 좌→우 1회 이동. 시간 안에 탭하지 않으면 방어 실패(풀 피해).
  // 가운데(가우시안) = 피해 감소, 우측 끝 5% = 반격.
  // sigma는 적 공격력에 반비례 (강한 적일수록 좁음), 진행 속도는 atk 차이에 따라.
  private defenseActive = false;
  private defenseStartTime = 0;
  private defenseDurationMs = 1500;
  private defenseSigma = 0.20;
  private defenseBarGfx?: Phaser.GameObjects.Graphics;
  private defenseCursor?: Phaser.GameObjects.Rectangle;
  private defenseLabel?: Phaser.GameObjects.Text;
  private defenseBtn?: ButtonNode;
  private defenseResolveCb?: (t: number | null) => void;
  private defenseKeyHandler?: () => void;
  private defensePointerHandler?: () => void;

  constructor() {
    super("CombatScene");
  }

  init(data: InitData): void {
    this.enemy = data.enemy;
    this.enemyHp = data.enemy.hp;
    this.defending = false;
    this.turnLock = false;
    this.buttons = [];
    this.comboHits = 0;
    this.nextAttackCrit = false;
  }

  create(): void {
    const store = getStore(this);
    // 패널 사용 후 HUDScene이 최상단에 와있는 상태에서 combat이 launch되면
    // 씬 순서상 combat이 뒤에 그려져 화면이 가려지는 문제가 발생.
    // 자기 자신을 최상단으로 올려 항상 위에 렌더되도록 보장.
    this.scene.bringToTop();
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

    // 주사위 패널은 더 이상 사용하지 않음 (버튼/주사위 → 타이밍 게이지로 전환).
    // buildDicePanel() 함수는 레거시 보존용으로 남겨둠.

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
    store.stats.on("change", this.updatePlayerHp, this);

    // ── 로그 & 버튼 ───────────────────────────────────────
    drawPanel(this, 0, GAME_HEIGHT - 180, GAME_WIDTH, 180, { fill: 0x0a0f1e, alpha: 0.88 });

    this.log = this.add.text(296, GAME_HEIGHT - 164, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "13px",
      color: "#cfd8ff",
      wordWrap: { width: GAME_WIDTH - 310 },
      lineSpacing: 4,
    });

    this.pushLog(`⚠ ${this.enemy.name} 조우! 교전 시작.`);
    this.pushLog("💡 공격(↔)→방어(→) 자동 반복. 가운데에서 멈출수록 효과적.");

    // 자동 전투 루프 시작 — 잠시 대기 후 첫 공격 단계
    this.time.delayedCall(900, () => this.playerAttack());
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
    const weapon = this.effectiveWeapon();
    const weaponName = ITEMS[weapon.id as ItemId]?.name ?? "맨손";
    const slot = weapon.slotIdx >= 0 ? store.inv.slots[weapon.slotIdx] : null;
    const durStr = slot?.dur != null && ITEMS[weapon.id].maxDurability != null
      ? ` [${slot.dur}/${ITEMS[weapon.id].maxDurability}]`
      : "";
    const ammoStr = weapon.id === "pistol" ? ` (🔫${store.inv.count("bullet")}발)` : "";

    const actions: Array<[string, () => void, boolean?]> = [
      ["🎒 아이템", () => this.useItemPrompt()],
      [`🎲 공격 (${weaponName}${durStr}${ammoStr})`, () => this.playerAttack()],
      ["🛡 방어", () => this.playerDefend()],
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

  // ── 주사위 패널 빌드 (한 번만 생성, 재사용) ─────────────
  private buildDicePanel(): void {
    const cx = GAME_WIDTH / 2;
    const cy = 560; // flavor(500) 아래, 로그 패널(620) 위

    this.diceLabel = this.add
      .text(cx - 200, cy, "🎲 주사위", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "16px",
        color: "#8d9bd1",
      })
      .setOrigin(0.5);

    this.diceD1 = this.add
      .text(cx - 80, cy, "⚀", { fontSize: "56px" })
      .setOrigin(0.5)
      .setAlpha(0.45);
    this.dicePlus = this.add
      .text(cx, cy, "+", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "26px",
        color: "#6a7ab0",
      })
      .setOrigin(0.5)
      .setAlpha(0.45);
    this.diceD2 = this.add
      .text(cx + 80, cy, "⚀", { fontSize: "56px" })
      .setOrigin(0.5)
      .setAlpha(0.45);
    this.diceSum = this.add
      .text(cx + 210, cy, "대기", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "16px",
        color: "#6a7ab0",
      })
      .setOrigin(0.5);
  }

  // ── 주사위 굴리기 애니메이션 (상주 UI를 재활용) ──────────
  private rollDice(onComplete: (d1: number, d2: number) => void): void {
    const d1Final = Phaser.Math.Between(1, 6);
    const d2Final = Phaser.Math.Between(1, 6);

    // 활성 상태로 켜기
    this.diceD1.setAlpha(1);
    this.diceD2.setAlpha(1);
    this.dicePlus.setAlpha(1).setColor("#aabbff");
    this.diceLabel.setText("🎲 굴리는 중...").setColor("#f0e040");
    this.diceSum.setText("").setColor("#ffffff");

    // 굴리기 단계별 인터벌 (다시 절반: 이전 대비 1/2)
    const intervals = [13, 14, 15, 18, 21, 25, 30, 38, 46, 55, 68, 88];
    let tick = 0;

    const doTick = () => {
      if (tick < intervals.length) {
        this.diceD1.setText(DICE_FACES[Math.floor(Math.random() * 6)]);
        this.diceD2.setText(DICE_FACES[Math.floor(Math.random() * 6)]);
        // 살짝 덜덜 떨리는 효과
        this.diceD1.setAngle((Math.random() - 0.5) * 20);
        this.diceD2.setAngle((Math.random() - 0.5) * 20);
        this.time.delayedCall(intervals[tick++], doTick);
      } else {
        // 최종값 표시
        this.diceD1.setText(DICE_FACES[d1Final - 1]).setAngle(0);
        this.diceD2.setText(DICE_FACES[d2Final - 1]).setAngle(0);
        audio.play("pickup");

        const sum = d1Final + d2Final;
        const label = sum >= 10 ? "✨대성공" : sum <= 4 ? "😬불운" : "정상";
        const col = sum >= 10 ? "#ffd700" : sum <= 4 ? "#ff9944" : "#aaffaa";
        this.diceSum.setText(`= ${sum} ${label}`).setColor(col);
        this.diceLabel.setText("🎲 결과").setColor("#cfd8ff");

        // 주사위 바운스
        this.tweens.add({
          targets: [this.diceD1, this.diceD2],
          scaleX: 1.35,
          scaleY: 1.35,
          duration: 90,
          yoyo: true,
          ease: "Back.Out",
        });

        this.time.delayedCall(160, () => {
          // 결과를 잠시 표시한 후 원래 상태로 희미하게
          this.tweens.add({
            targets: [this.diceD1, this.diceD2, this.dicePlus],
            alpha: 0.45,
            duration: 100,
          });
          this.time.delayedCall(30, () => onComplete(d1Final, d2Final));
        });
      }
    };
    this.time.delayedCall(25, doTick);
  }

  /** 실제로 이번 턴 사용할 무기. 권총인데 탄이 없으면 다음 무기로 폴백. */
  private effectiveWeapon(): { id: ItemId; dmg: number; slotIdx: number } {
    const store = getStore(this);
    const best = store.inv.bestWeapon();
    if (best.id === "pistol" && !store.inv.has("bullet")) {
      return store.inv.bestWeaponExcept("pistol");
    }
    return best;
  }

  // ── 플레이어 행동 ──────────────────────────────────────
  /** 가우시안 곡선값 — 가운데(center)에서 1.0, 거리/sigma에 따라 종 모양으로 감소. */
  private gauss01(pos: number, center: number, sigma: number): number {
    const x = pos - center;
    return Math.exp(-(x * x) / (2 * sigma * sigma));
  }

  /** 공격력 차이에 따른 커서 속도 배수. 양수=내가 강함→느린 커서(쉬움). */
  private speedMultiplier(atkDiff: number): number {
    return Phaser.Math.Clamp(1 + atkDiff * 0.04, 0.4, 2.5);
  }

  private playerAttack(): void {
    this.turnLock = true;
    this.startAttackBar((t) => {
      const store = getStore(this);
      const weapon = this.effectiveWeapon();
      const weaponDef = ITEMS[weapon.id];

      // 우측 끝 1% = 도망 성공
      if (t >= 0.99) {
        this.pushLog("🏃 절묘한 회피로 도망쳤다!");
        audio.play("victory");
        this.time.delayedCall(800, () => this.endCombat(false));
        return;
      }

      // 권총 사용 시 탄약 1 소비
      if (weapon.id === "pistol") store.inv.remove("bullet", 1);

      // 가우시안 데미지 — 정중앙(t=0.5)에서 풀 데미지, 거리에 따라 부드럽게 감소
      const energyMult = 1 + store.stats.energy / 200;
      const baseDmg = weapon.dmg + store.perkBonusDmg;
      const critMult = this.nextAttackCrit ? 2 : 1;
      const gauss = this.gauss01(t, 0.5, this.attackSigma);
      // 콤보 누적 데미지 (1.2^combo). 첫 hit은 1.0배, 두 번째는 1.2, 세 번째 1.44, ...
      const comboMult = Math.pow(1.2, this.comboHits);
      const dmg = Math.max(0, Math.round(baseDmg * energyMult * gauss * critMult * comboMult));
      const wasCrit = this.nextAttackCrit;
      this.nextAttackCrit = false;

      this.enemyHp = Math.max(0, this.enemyHp - dmg);

      // 콤보 갱신 — 명중(gauss >= 0.20)이면 +1, 빗나감이면 0으로 초기화
      const isHit = gauss >= 0.20;
      const oldCombo = this.comboHits;
      if (isHit) {
        this.comboHits += 1;
      } else if (oldCombo >= 2) {
        this.pushLog(`💨 콤보 끊김! (${oldCombo}연타 종료)`);
        this.comboHits = 0;
      } else {
        this.comboHits = 0;
      }

      const comment =
        wasCrit         ? " ⚡크리티컬!" :
        gauss >= 0.85   ? " ✨정통!"   :
        gauss >= 0.55   ? " 적중"      :
        gauss >= 0.20   ? " 빗맞춤"    :
                          " 😬빗나감";
      const comboTag = this.comboHits >= 2 ? ` 🔥콤보×${this.comboHits}(${comboMult.toFixed(2)}배)` : "";
      this.pushLog(`🎯${comment} → 🩸 ${dmg} 데미지!${comboTag}`);

      if (dmg > 0) {
        audio.play("hit");
        this.tweens.add({ targets: this.enemySprite, angle: -10, duration: 80, yoyo: true });
        this.tweens.add({ targets: this.enemySprite, alpha: 0.3, duration: 60, yoyo: true });
        // 콤보 시각 효과: 2단 이상이면 적 위에 콤보 카운트 떠오름
        if (this.comboHits >= 2) this.spawnComboFx(this.comboHits);
      } else {
        audio.play("error");
      }
      this.updateEnemyHpBar();

      // 내구도 감소 (피해를 줬을 때만)
      if (dmg > 0 && weapon.slotIdx >= 0 && weaponDef.maxDurability != null) {
        const r = store.inv.useDurability(weapon.slotIdx);
        if (r.broken) {
          this.pushLog(`💥 ${weaponDef.name}이(가) 부서졌다!`);
          audio.play("error");
        } else if (r.hasDurability && r.dur! <= 5) {
          this.pushLog(`⚠ ${weaponDef.name} 내구도 ${r.dur}/${r.max} (거의 부서짐)`);
        }
      }

      // 다음 단계: 적이 살아있으면 방어 단계로 자동 전환
      if (this.enemyHp <= 0) {
        this.time.delayedCall(500, () => this.victory());
        return;
      }
      this.time.delayedCall(700, () => this.playerDefend());
    });
  }

  private playerDefend(): void {
    this.turnLock = true;
    this.startDefenseBar((t) => {
      const store = getStore(this);
      const baseDmg = Math.round(this.enemy.atk * Phaser.Math.FloatBetween(0.85, 1.25));

      // 시간 초과 = 방어 실패 = 풀 피해
      if (t === null) {
        this.pushLog(`😬 방어 실패! ${this.enemy.name}의 공격 ${baseDmg} 피해.`);
        store.stats.apply({ hp: -baseDmg });
        this.cameras.main.shake(220, 0.012);
        audio.play("hurt");
        this.time.delayedCall(450, () => this.endDefenseTurn());
        return;
      }

      // 우측 끝 5% = 반격 (콤보에도 누적)
      if (t >= 0.95) {
        const weapon = this.effectiveWeapon();
        const counterBase = weapon.dmg + store.perkBonusDmg;
        const counterCombo = Math.pow(1.2, this.comboHits);
        const counterDmg = Math.max(1, Math.round(counterBase * 1.5 * counterCombo));
        this.enemyHp = Math.max(0, this.enemyHp - counterDmg);
        this.comboHits += 1;
        const comboTag = this.comboHits >= 2 ? ` 🔥콤보×${this.comboHits}` : "";
        this.pushLog(`⚔ 반격 성공! 적에게 🩸${counterDmg} 데미지! 피해 0.${comboTag}`);
        audio.play("hit");
        this.cameras.main.flash(180, 200, 240, 255);
        this.tweens.add({ targets: this.enemySprite, angle: 12, duration: 100, yoyo: true });
        if (this.comboHits >= 2) this.spawnComboFx(this.comboHits);
        this.updateEnemyHpBar();
        this.time.delayedCall(600, () => this.endDefenseTurn());
        return;
      }

      // 가우시안 기반 피해 감소 (정중앙=무피해, 가장자리=풀피해)
      const blockGauss = this.gauss01(t, 0.5, this.defenseSigma);
      const dmgTaken = Math.max(0, Math.round(baseDmg * (1 - blockGauss)));

      const label =
        blockGauss >= 0.85 ? "✨ 완벽 방어!"  :
        blockGauss >= 0.55 ? "🛡 방어 성공"   :
        blockGauss >= 0.20 ? "⚠ 빗방어"      :
                             "😬 거의 못 막음";
      this.pushLog(`${label} → 피해 ${dmgTaken}.`);

      if (dmgTaken > 0) {
        store.stats.apply({ hp: -dmgTaken });
        audio.play("hurt");
        if (dmgTaken > baseDmg * 0.5) this.cameras.main.shake(150, 0.008);
      } else {
        audio.play("click");
      }
      this.time.delayedCall(420, () => this.endDefenseTurn());
    });
  }

  /** 방어 종료 후 처리 — 다음 공격 단계로 자동 전환. */
  private endDefenseTurn(): void {
    const store = getStore(this);
    if (this.enemyHp <= 0) { this.victory(); return; }
    if (store.stats.hp <= 0) {
      this.pushLog("… 의식이 멀어진다.");
      this.time.delayedCall(900, () => this.endCombat(false, true));
      return;
    }
    // 다음 단계: 공격 단계로
    this.time.delayedCall(700, () => this.playerAttack());
  }

  // ── 공격 타이밍 게이지 ──────────────────────────────────
  private startAttackBar(onTap: (t: number) => void): void {
    if (this.attackActive) return;
    this.attackActive = true;
    this.attackResolveCb = onTap;

    const store = getStore(this);
    const weaponDmg = this.effectiveWeapon().dmg + store.perkBonusDmg;

    // 무기 데미지에 비례한 sigma (강한 무기 = 넓은 명중대)
    this.attackSigma = Phaser.Math.Clamp(0.04 + weaponDmg / 200, 0.04, 0.25);

    // 진동 속도: atk 차이에 따라 (내가 강함 = 느림)
    const atkDiff = weaponDmg - this.enemy.atk;
    const oneTripMs = 1500 * this.speedMultiplier(atkDiff);
    this.attackCycleMs = oneTripMs * 2; // 한 사이클은 L→R→L

    this.attackStartTime = this.time.now;

    this.renderTimingBar({
      sigma: this.attackSigma,
      rightZonePct: 0.01,
      rightZoneColor: 0xffd97a,
      label: "🎯 멈춰! 가운데=명중, 우측끝(노랑)=도망",
      btnLabel: "🎯\n멈춤!",
      btnColor: { bg: 0x2a3a5a, hover: 0x3a4a7a, border: 0x6aaadc },
      onTap: () => this.resolveAttackBar(),
      kind: "attack",
    });
  }

  private resolveAttackBar(): void {
    if (!this.attackActive || !this.attackResolveCb) return;
    const elapsed = this.time.now - this.attackStartTime;
    const phase = (elapsed % this.attackCycleMs) / this.attackCycleMs;
    const t = (Math.sin(2 * Math.PI * phase - Math.PI / 2) + 1) / 2;

    const cb = this.attackResolveCb;
    this.attackActive = false;
    this.attackResolveCb = undefined;
    this.attackBarGfx?.destroy(); this.attackBarGfx = undefined;
    this.attackCursor?.destroy(); this.attackCursor = undefined;
    this.attackLabel?.destroy(); this.attackLabel = undefined;
    this.attackBtn?.destroy(); this.attackBtn = undefined;
    if (this.attackKeyHandler) {
      this.input.keyboard?.off("keydown-SPACE", this.attackKeyHandler);
      this.input.keyboard?.off("keydown-ENTER", this.attackKeyHandler);
      this.attackKeyHandler = undefined;
    }
    if (this.attackPointerHandler) {
      this.input.off("pointerdown", this.attackPointerHandler);
      this.attackPointerHandler = undefined;
    }
    cb(t);
  }

  // ── 방어 타이밍 게이지 ──────────────────────────────────
  private startDefenseBar(onTap: (t: number | null) => void): void {
    if (this.defenseActive) return;
    this.defenseActive = true;
    this.defenseResolveCb = onTap;

    const store = getStore(this);
    const weaponDmg = this.effectiveWeapon().dmg + store.perkBonusDmg;

    // 적 공격력에 반비례한 sigma (강한 적 = 좁은 방어대)
    this.defenseSigma = Phaser.Math.Clamp(0.30 - this.enemy.atk / 120, 0.05, 0.30);

    // 1회 trip 시간: atk 차이에 따라 (내가 강함 = 느림 = 쉬움)
    const atkDiff = weaponDmg - this.enemy.atk;
    this.defenseDurationMs = 1500 * this.speedMultiplier(atkDiff);

    this.defenseStartTime = this.time.now;

    this.renderTimingBar({
      sigma: this.defenseSigma,
      rightZonePct: 0.05,
      rightZoneColor: 0xff5a6a,
      label: "🛡 막아! 가운데=방어, 우측끝(빨강)=반격, 끝까지 가면 실패",
      btnLabel: "🛡\n막기!",
      btnColor: { bg: 0x2a4a18, hover: 0x3a6a28, border: 0x6adc4a },
      onTap: () => this.resolveDefenseBar(),
      kind: "defense",
    });
  }

  private resolveDefenseBar(): void {
    if (!this.defenseActive || !this.defenseResolveCb) return;
    const elapsed = this.time.now - this.defenseStartTime;
    const t = elapsed / this.defenseDurationMs;

    const cb = this.defenseResolveCb;
    this.defenseActive = false;
    this.defenseResolveCb = undefined;
    this.defenseBarGfx?.destroy(); this.defenseBarGfx = undefined;
    this.defenseCursor?.destroy(); this.defenseCursor = undefined;
    this.defenseLabel?.destroy(); this.defenseLabel = undefined;
    this.defenseBtn?.destroy(); this.defenseBtn = undefined;
    if (this.defenseKeyHandler) {
      this.input.keyboard?.off("keydown-SPACE", this.defenseKeyHandler);
      this.input.keyboard?.off("keydown-ENTER", this.defenseKeyHandler);
      this.defenseKeyHandler = undefined;
    }
    if (this.defensePointerHandler) {
      this.input.off("pointerdown", this.defensePointerHandler);
      this.defensePointerHandler = undefined;
    }

    if (t >= 1.0) cb(null); // timeout = 실패
    else cb(Phaser.Math.Clamp(t, 0, 1));
  }

  /** 공격/방어 공통 게이지 렌더링 (UI만 분리). */
  private renderTimingBar(opts: {
    sigma: number;
    rightZonePct: number;
    rightZoneColor: number;
    label: string;
    btnLabel: string;
    btnColor: { bg: number; hover: number; border: number };
    onTap: () => void;
    kind: "attack" | "defense";
  }): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 170;
    const barW = 480, barH = 28;
    const barX = cx - barW / 2;
    const barY = cy;

    const gfx = this.add.graphics();
    // 배경
    gfx.fillStyle(0x202840, 1);
    gfx.fillRect(barX, barY, barW, barH);
    // 가우시안 가시화 (3단 그라디언트 근사: ±2σ → ±σ → ±σ/2)
    const s = opts.sigma;
    gfx.fillStyle(0x4adc6a, 0.30);
    gfx.fillRect(barX + barW * Math.max(0, 0.5 - s * 2), barY, barW * Math.min(1, s * 4), barH);
    gfx.fillStyle(0x6aff8a, 0.50);
    gfx.fillRect(barX + barW * Math.max(0, 0.5 - s), barY, barW * Math.min(1, s * 2), barH);
    gfx.fillStyle(0xaaffaa, 0.70);
    gfx.fillRect(barX + barW * Math.max(0, 0.5 - s * 0.5), barY, barW * Math.min(1, s), barH);
    // 우측 끝 특수 영역
    gfx.fillStyle(opts.rightZoneColor, 0.85);
    gfx.fillRect(barX + barW * (1 - opts.rightZonePct), barY, barW * opts.rightZonePct, barH);
    // 테두리
    gfx.lineStyle(2, 0x6a7ab0, 1);
    gfx.strokeRect(barX, barY, barW, barH);

    // 커서
    const cursor = this.add.rectangle(barX, barY - 4, 6, barH + 8, 0xffffff, 1)
      .setOrigin(0, 0).setStrokeStyle(1, 0x000000);

    // 라벨 (깜빡임 애니메이션)
    const label = this.add.text(cx, barY - 28, opts.label, {
      fontFamily: "Galmuri11, monospace",
      fontSize: "14px",
      color: "#ffd97a",
    }).setOrigin(0.5);
    this.tweens.add({ targets: label, alpha: 0.6, duration: 300, yoyo: true, repeat: -1 });

    // 임시 버튼 — D-pad 방향키 높이(WorldScene cy=679)에 맞춰 배치.
    // 크기 156×156 (D-pad 78×78의 2배 = 원본 52×52의 3배). 정사각형.
    const btnSize = 156;
    const btnX = GAME_WIDTH - 120;
    // 방향키 위치(cy=679)와 동일 y에 배치 — CombatScene엔 d-pad 없으니 충돌 없음
    const btnY = 679;
    const btn = makeButton(this, btnX, btnY, {
      label: opts.btnLabel,
      width: btnSize,
      height: btnSize,
      fontSize: 32,
      bg: opts.btnColor.bg,
      hover: opts.btnColor.hover,
      border: opts.btnColor.border,
      onClick: opts.onTap,
    }) as ButtonNode;

    // 키 단축키 + 전체 화면 터치
    const keyHandler = () => opts.onTap();
    this.input.keyboard?.once("keydown-SPACE", keyHandler);
    this.input.keyboard?.once("keydown-ENTER", keyHandler);
    const pointerHandler = () => opts.onTap();
    this.input.once("pointerdown", pointerHandler);

    // 액션 버튼 숨기기
    this.buttons.forEach((b) => b.setVisible(false));

    // 상태 저장
    if (opts.kind === "attack") {
      this.attackBarGfx = gfx;
      this.attackCursor = cursor;
      this.attackLabel = label;
      this.attackBtn = btn;
      this.attackKeyHandler = keyHandler;
      this.attackPointerHandler = pointerHandler;
    } else {
      this.defenseBarGfx = gfx;
      this.defenseCursor = cursor;
      this.defenseLabel = label;
      this.defenseBtn = btn;
      this.defenseKeyHandler = keyHandler;
      this.defensePointerHandler = pointerHandler;
    }
  }

  // ── [LEGACY] 주사위 기반 공격/방어 ─────────────────────────
  // 현재는 사용하지 않음. 추후 재도입 가능성을 위해 보존.
  /** [LEGACY] 주사위 2개를 굴려 0.7~1.3 배율로 데미지 산정. */
  private playerAttackLegacyDice(): void {
    this.turnLock = true;
    this.rollDice((d1, d2) => {
      const store = getStore(this);
      const weapon = this.effectiveWeapon();
      const weaponDef = ITEMS[weapon.id];

      if (weapon.id === "pistol") store.inv.remove("bullet", 1);

      const diceSum = d1 + d2;
      const diceMult = 0.7 + ((diceSum - 2) / 10) * 0.6;
      const energyMult = 1 + store.stats.energy / 200;
      const baseDmg = weapon.dmg + store.perkBonusDmg;
      const critMult = this.nextAttackCrit ? 2 : 1;
      const dmg = Math.max(1, Math.round(baseDmg * energyMult * diceMult * critMult));
      const wasCrit = this.nextAttackCrit;
      this.nextAttackCrit = false;

      this.enemyHp = Math.max(0, this.enemyHp - dmg);

      const comment =
        wasCrit       ? " ⚡크리티컬!" :
        diceSum >= 10 ? " ✨대성공!" :
        diceSum <= 4  ? " 😬빗나갈 뻔..." : "";
      this.pushLog(`🎲 ${d1}+${d2}=${diceSum}${comment} → 🩸 ${dmg} 데미지!`);

      audio.play("hit");
      this.tweens.add({ targets: this.enemySprite, angle: -10, duration: 80, yoyo: true });
      this.tweens.add({ targets: this.enemySprite, alpha: 0.3, duration: 60, yoyo: true });
      this.updateEnemyHpBar();

      if (weapon.slotIdx >= 0 && weaponDef.maxDurability != null) {
        const r = store.inv.useDurability(weapon.slotIdx);
        if (r.broken) {
          this.pushLog(`💥 ${weaponDef.name}이(가) 부서졌다!`);
          audio.play("error");
        } else if (r.hasDurability && r.dur! <= 5) {
          this.pushLog(`⚠ ${weaponDef.name} 내구도 ${r.dur}/${r.max} (거의 부서짐)`);
        }
        this.buildButtons();
      }

      this.afterPlayerTurn();
    });
  }

  /** [LEGACY] 단순 방어 — defending 플래그만 세우고 적 턴에 절반 피해. */
  private playerDefendLegacy(): void {
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
    const baseDmg = Math.round(this.enemy.atk * Phaser.Math.FloatBetween(0.85, 1.25));

    // 적 공격 텔레그래프 (적이 빨갛게 깜박임)
    this.tweens.add({
      targets: this.enemySprite,
      tint: 0xff3050,
      duration: 200,
      yoyo: true,
      repeat: 2,
    });
    this.enemySprite.setTint(0xff5060);

    // 패리 게이지 시작
    this.startParry((quality) => {
      this.enemySprite.clearTint();

      let dmg = baseDmg;
      let logMsg = "";
      if (quality === "perfect") {
        dmg = 0;
        const reflect = Math.max(2, Math.round(baseDmg * 0.4));
        this.enemyHp = Math.max(0, this.enemyHp - reflect);
        this.updateEnemyHpBar();
        this.nextAttackCrit = true;
        logMsg = `✨ 퍼펙트 패리! 피해 0, 반격 🩸${reflect}, 다음 공격 ×2!`;
        audio.play("pickup");
        this.cameras.main.flash(180, 200, 240, 255);
      } else if (quality === "good") {
        dmg = Math.max(1, Math.round(baseDmg * 0.4));
        logMsg = `🛡 굿 패리! 피해 ${dmg} (감소).`;
        audio.play("click");
      } else {
        if (this.defending) {
          dmg = Math.round(baseDmg * 0.5);
          logMsg = `🛡 방어! 피해 ${dmg} (절반).`;
        } else {
          logMsg = `💥 ${this.enemy.name}의 공격! ${dmg} 피해.`;
        }
        audio.play("hurt");
        this.cameras.main.shake(200, 0.008);
      }
      this.defending = false;
      this.pushLog(logMsg);
      if (dmg > 0) store.stats.apply({ hp: -dmg });

      this.time.delayedCall(quality === "perfect" ? 600 : 400, () => {
        if (this.enemyHp <= 0) {
          this.victory();
          return;
        }
        if (store.stats.hp <= 0) {
          this.pushLog("… 의식이 멀어진다.");
          this.time.delayedCall(900, () => this.endCombat(false, true));
        } else {
          this.turnLock = false;
        }
      });
    });
  }

  /**
   * 패리 게이지를 표시하고 플레이어 입력을 기다린다.
   * 게이지는 좌→우로 1.5초간 차오른다.
   *  - 50~60%: PERFECT
   *  - 40~50% 또는 60~70%: GOOD
   *  - 그 외 / 미입력: MISS
   */
  private startParry(onResolve: (q: "perfect" | "good" | "miss") => void): void {
    if (this.parryActive) return;
    this.parryActive = true;
    this.parryStartTime = this.time.now;
    this.parryResolve = onResolve;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 170; // flavor 아래
    const barW = 480;
    const barH = 28;
    const barX = cx - barW / 2;
    const barY = cy;

    // 백그라운드 게이지 (영역 색칠)
    const gfx = this.add.graphics();
    gfx.fillStyle(0x202840, 1);
    gfx.fillRect(barX, barY, barW, barH);
    // 패배 영역 (좌측 0-40%)
    gfx.fillStyle(0x3a1018, 1);
    gfx.fillRect(barX, barY, barW * 0.40, barH);
    // GOOD 영역 (40-50%)
    gfx.fillStyle(0x4a4810, 1);
    gfx.fillRect(barX + barW * 0.40, barY, barW * 0.10, barH);
    // PERFECT 영역 (50-60%)
    gfx.fillStyle(0x186a30, 1);
    gfx.fillRect(barX + barW * 0.50, barY, barW * 0.10, barH);
    // GOOD 영역 (60-70%)
    gfx.fillStyle(0x4a4810, 1);
    gfx.fillRect(barX + barW * 0.60, barY, barW * 0.10, barH);
    // 패배 영역 (70-100%)
    gfx.fillStyle(0x3a1018, 1);
    gfx.fillRect(barX + barW * 0.70, barY, barW * 0.30, barH);
    gfx.lineStyle(2, 0x6a7ab0, 1);
    gfx.strokeRect(barX, barY, barW, barH);
    this.parryGfx = gfx;

    // 커서 (좌→우로 이동)
    const cursor = this.add.rectangle(barX, barY - 4, 6, barH + 8, 0xffffff, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x000000);
    this.parryCursor = cursor;

    // 라벨
    this.parryLabel = this.add.text(cx, barY - 28, "⚠ 패리! 초록 영역에서 탭!", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "16px",
      color: "#ffd97a",
    }).setOrigin(0.5);
    this.tweens.add({ targets: this.parryLabel, alpha: 0.6, duration: 300, yoyo: true, repeat: -1 });

    // 임시 패리 버튼 (기존 버튼 위)
    const btn = makeButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, {
      label: "🛡 패리! (스페이스/클릭)",
      width: 360,
      height: 56,
      fontSize: 18,
      bg: 0x2a4a18,
      hover: 0x3a6a28,
      border: 0x6adc4a,
      onClick: () => this.resolveParry(),
    }) as ButtonNode;
    this.parryBtn = btn;
    // 기존 액션 버튼 숨기기
    this.buttons.forEach((b) => b.setVisible(false));

    // 스페이스바 단축키
    const spaceHandler = () => this.resolveParry();
    this.input.keyboard?.once("keydown-SPACE", spaceHandler);

    // 시간 초과 시 MISS
    this.time.delayedCall(this.parryDurationMs + 50, () => {
      if (this.parryActive) this.resolveParry();
    });
  }

  /** 게이지 커서 위치를 매 프레임 업데이트 (패리/공격/방어) */
  update(): void {
    const cx = GAME_WIDTH / 2;
    const barW = 480;
    const barX = cx - barW / 2;

    // 패리 (적 공격) — 좌→우 1회
    if (this.parryActive && this.parryCursor && this.parryGfx) {
      const elapsed = this.time.now - this.parryStartTime;
      const t = Phaser.Math.Clamp(elapsed / this.parryDurationMs, 0, 1);
      this.parryCursor.x = barX + barW * t - 3;
    }

    // 공격 — 좌↔우 무한 진동 (sin 파)
    if (this.attackActive && this.attackCursor) {
      const elapsed = this.time.now - this.attackStartTime;
      const phase = (elapsed % this.attackCycleMs) / this.attackCycleMs;
      const t = (Math.sin(2 * Math.PI * phase - Math.PI / 2) + 1) / 2;
      this.attackCursor.x = barX + barW * t - 3;
    }

    // 방어 — 좌→우 1회. 끝까지 가면 자동 fail.
    if (this.defenseActive && this.defenseCursor) {
      const elapsed = this.time.now - this.defenseStartTime;
      const t = elapsed / this.defenseDurationMs;
      if (t >= 1.0) {
        this.resolveDefenseBar();
        return;
      }
      this.defenseCursor.x = barX + barW * t - 3;
    }
  }

  private resolveParry(): void {
    if (!this.parryActive || !this.parryResolve) return;
    const elapsed = this.time.now - this.parryStartTime;
    const t = Phaser.Math.Clamp(elapsed / this.parryDurationMs, 0, 1);

    let quality: "perfect" | "good" | "miss";
    if (t >= 0.50 && t <= 0.60) quality = "perfect";
    else if ((t >= 0.40 && t < 0.50) || (t > 0.60 && t <= 0.70)) quality = "good";
    else quality = "miss";

    this.parryActive = false;
    // UI 정리
    this.parryGfx?.destroy(); this.parryGfx = undefined;
    this.parryCursor?.destroy(); this.parryCursor = undefined;
    this.parryLabel?.destroy(); this.parryLabel = undefined;
    this.parryBtn?.destroy(); this.parryBtn = undefined;
    this.buttons.forEach((b) => b.setVisible(true));
    // 스페이스바 핸들러 정리 (한 번만 등록되었지만 안전하게)
    this.input.keyboard?.off("keydown-SPACE");

    const resolve = this.parryResolve;
    this.parryResolve = undefined;
    resolve(quality);
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
        store.discoverRecipes(l.id);
      }
    }
    if (drops.length) {
      this.pushLog(`🎁 획득: ${drops.join(", ")}`);
      this.time.delayedCall(400, () => audio.play("pickup"));
    }
    if (this.enemy.kind === "sea") {
      store.flags.bossesDefeated.push(store.time.day);
      store.checkTimedAchievements();
    }
    this.tweens.add({ targets: this.enemySprite, alpha: 0, scale: 0.5, duration: 900, ease: "Back.In" });
    this.time.delayedCall(1200, () => this.endCombat(true));
  }

  private endCombat(_won: boolean, dead = false): void {
    getStore(this).stats.off("change", this.updatePlayerHp, this);
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

  /** 적 위에 "콤보 ×N" 텍스트가 떠올랐다 사라지는 효과. */
  private spawnComboFx(combo: number): void {
    const x = this.enemySprite.x + Phaser.Math.Between(-40, 40);
    const y = this.enemySprite.y - 50;
    const color = combo >= 5 ? "#ffd700" : combo >= 3 ? "#ff9a3a" : "#ffe070";
    const fontSize = combo >= 5 ? 36 : combo >= 3 ? 30 : 24;
    const txt = this.add.text(x, y, `콤보 ×${combo}!`, {
      fontFamily: "Galmuri11, monospace",
      fontSize: `${fontSize}px`,
      color,
      stroke: "#0a0f22",
      strokeThickness: 4,
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(50).setScale(0.5);
    this.tweens.add({
      targets: txt,
      y: y - 60,
      scale: 1.3,
      duration: 220,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: txt,
          alpha: 0,
          duration: 380,
          ease: "Quad.In",
          onComplete: () => txt.destroy(),
        });
      },
    });
  }

  private pushLog(msg: string): void {
    const lines = (this.log.text ? this.log.text.split("\n") : []).concat(msg).slice(-5);
    this.log.setText(lines.join("\n"));
  }
}

void COLORS;
