import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { makeButton } from "../ui/Button";
import { audio } from "../systems/AudioManager";

/**
 * 3막 오프닝: 항해 → 폭풍·좌초 → Day 1.
 * 모든 비주얼은 Phaser Graphics + 이모지 텍스트로 생성.
 */
export class IntroScene extends Phaser.Scene {
  private elapsed = 0;
  private DURATION = 24000;
  private done = false;

  constructor() {
    super("IntroScene");
  }

  create(): void {
    const cam = this.cameras.main;
    cam.fadeIn(600, 0, 0, 0);

    audio.playBgm("title");
    audio.play("wave");

    // === 배경 레이어들 ===
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x020511, 0x02041a, 0x0e2040, 0x071027, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 별 (0~7s 시)
    const stars: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 120; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT * 0.55);
      const s = this.add.circle(sx, sy, Phaser.Math.FloatBetween(0.5, 1.6), 0xffffff, Phaser.Math.FloatBetween(0.4, 1));
      stars.push(s);
    }

    // 달
    const moon = this.add.circle(GAME_WIDTH - 180, 150, 55, 0xf0f4ff, 1);
    const moonHalo = this.add.circle(GAME_WIDTH - 180, 150, 90, 0x6fd1ff, 0.12);

    // 바다
    const seaY = GAME_HEIGHT * 0.58;
    const sea = this.add.graphics();
    sea.fillGradientStyle(0x0c2a58, 0x0c2a58, 0x020915, 0x020915, 1);
    sea.fillRect(0, seaY, GAME_WIDTH, GAME_HEIGHT - seaY);
    // 물결 파티클 대체용
    const waves: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 40; i++) {
      const w = this.add.rectangle(
        Phaser.Math.Between(0, GAME_WIDTH),
        Phaser.Math.Between(seaY, GAME_HEIGHT),
        Phaser.Math.Between(30, 90),
        2,
        0xbfd8ff,
        Phaser.Math.FloatBetween(0.1, 0.35)
      );
      waves.push(w);
      this.tweens.add({
        targets: w,
        x: w.x - Phaser.Math.Between(60, 140),
        duration: Phaser.Math.Between(3000, 6000),
        repeat: -1,
        yoyo: true,
        ease: "Sine.InOut",
      });
    }

    // 거대 여객선
    const shipContainer = this.add.container(GAME_WIDTH * 0.2, seaY - 40);
    const hull = this.add.graphics();
    hull.fillStyle(0x14202e, 1);
    hull.fillRoundedRect(-150, 0, 300, 60, 8);
    hull.fillStyle(0x2a3a50, 1);
    hull.fillRoundedRect(-130, -40, 260, 40, 6);
    // 창문 불빛
    for (let i = -110; i <= 110; i += 20) {
      hull.fillStyle(0xffe28a, 1);
      hull.fillRect(i, -30, 8, 10);
      hull.fillRect(i, 15, 8, 10);
    }
    // 굴뚝
    hull.fillStyle(0x1a1a1a, 1);
    hull.fillRect(-40, -70, 22, 30);
    hull.fillRect(20, -70, 22, 30);
    hull.fillStyle(0xd13232, 1);
    hull.fillRect(-40, -70, 22, 6);
    hull.fillRect(20, -70, 22, 6);
    shipContainer.add(hull);

    // 연기
    const smokeEmitters: Phaser.GameObjects.Arc[] = [];
    const makeSmoke = () => {
      const p = this.add.circle(shipContainer.x - 29, shipContainer.y - 70, 8, 0xaab3c2, 0.6);
      smokeEmitters.push(p);
      this.tweens.add({
        targets: p,
        y: p.y - 140,
        alpha: 0,
        scale: 2,
        duration: 3500,
        ease: "Sine.Out",
        onComplete: () => p.destroy(),
      });
    };

    // 폭풍 레이어 (처음엔 숨김)
    const stormOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000510, 0);
    stormOverlay.setDepth(10);
    const rain: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 160; i++) {
      const r = this.add.rectangle(
        Phaser.Math.Between(-100, GAME_WIDTH),
        Phaser.Math.Between(-GAME_HEIGHT, GAME_HEIGHT),
        2,
        14,
        0x9fbfff,
        0
      );
      rain.push(r);
    }

    const lightning = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setDepth(20);

    // 섬 (3막)
    const islandG = this.add.graphics().setDepth(5);
    islandG.setAlpha(0);
    islandG.fillStyle(0x0a1420, 1);
    islandG.fillTriangle(GAME_WIDTH - 480, seaY, GAME_WIDTH + 80, seaY, GAME_WIDTH - 160, seaY - 200);
    islandG.fillStyle(0x1a3322, 1);
    islandG.fillTriangle(GAME_WIDTH - 420, seaY, GAME_WIDTH - 40, seaY, GAME_WIDTH - 220, seaY - 150);

    // 대사
    const caption = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 110, "", {
        fontFamily: "Galmuri11, monospace",
        fontSize: "22px",
        color: "#eaf0ff",
        align: "center",
        wordWrap: { width: GAME_WIDTH - 200 },
      })
      .setOrigin(0.5)
      .setDepth(30);

    // 스킵 버튼
    makeButton(this, GAME_WIDTH - 110, 40, {
      label: "⏭ 스킵",
      width: 140,
      height: 36,
      fontSize: 14,
      onClick: () => this.finish(),
    }).setDepth(40);

    // 1) 항해 (0~7s)
    this.tweens.add({ targets: shipContainer, x: GAME_WIDTH * 0.55, duration: 7000, ease: "Sine.InOut" });
    this.tweens.add({ targets: shipContainer, y: shipContainer.y - 4, duration: 2500, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    const smokeTimer = this.time.addEvent({ delay: 220, callback: makeSmoke, loop: true });
    this.showCaption(caption, "366명을 태운 여객선이 남태평양을 항해하고 있었다.", 500, 6000);

    // 2) 폭풍 시작 (7s)
    this.time.delayedCall(7000, () => {
      audio.playBgm("combat");
      audio.play("wave");
      this.tweens.add({ targets: [moon, moonHalo], alpha: 0, duration: 1500 });
      this.tweens.add({ targets: stars, alpha: 0, duration: 1500 });
      this.tweens.add({ targets: stormOverlay, fillAlpha: 0.55, duration: 2000 });
      this.tweens.add({ targets: rain, alpha: 0.6, duration: 1000 });
      for (const r of rain) {
        this.tweens.add({
          targets: r,
          y: r.y + GAME_HEIGHT + 200,
          x: r.x - 80,
          duration: Phaser.Math.Between(600, 1200),
          repeat: -1,
          onRepeat: () => {
            r.x = Phaser.Math.Between(0, GAME_WIDTH);
            r.y = -40;
          },
        });
      }
      this.showCaption(caption, "갑자기 폭풍이 몰려왔다. 파도는 집채만 하고 하늘이 찢어졌다.", 0, 5500);
    });

    // 3) 번개 / 흔들림 (10s)
    this.time.delayedCall(10000, () => {
      const flash = () => {
        this.tweens.add({ targets: lightning, fillAlpha: 0.8, duration: 80, yoyo: true, hold: 40 });
        audio.play("thunder");
      };
      flash();
      this.time.delayedCall(700, flash);
      this.time.delayedCall(1600, flash);
      this.cameras.main.shake(3500, 0.01);
    });

    // 4) 충돌 및 기울어짐 (13s)
    this.time.delayedCall(13000, () => {
      audio.play("thunder");
      audio.play("hurt");
      this.cameras.main.shake(600, 0.04);
      this.tweens.add({
        targets: lightning,
        fillAlpha: 1,
        duration: 120,
        yoyo: true,
      });
      this.tweens.add({ targets: shipContainer, angle: -22, x: GAME_WIDTH * 0.7, y: shipContainer.y + 30, duration: 2000, ease: "Cubic.Out" });
      this.showCaption(caption, "뱃머리가 암초에 박혔다. 선체가 두 동강 났다.", 0, 3000);
    });

    // 5) 섬 드러남 + 주인공 (16s)
    this.time.delayedCall(16000, () => {
      this.tweens.add({ targets: islandG, alpha: 1, duration: 1500 });
      this.tweens.add({ targets: stormOverlay, fillAlpha: 0.25, duration: 3500 });
      // 주인공 실루엣(해변에 떠밀려옴)
      const hero = this.add.text(GAME_WIDTH * 0.5, GAME_HEIGHT + 40, "🧑", { fontSize: "48px" }).setOrigin(0.5).setDepth(15);
      this.tweens.add({ targets: hero, y: seaY + 30, duration: 2500, ease: "Sine.Out" });
      this.showCaption(caption, "366명 중 단 한 사람만이 파도에 떠밀려 섬에 닿았다.", 0, 4500);
      smokeTimer.remove();
    });

    // 6) Day 1 타이포 (21s)
    this.time.delayedCall(21000, () => {
      const cover = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setDepth(50);
      this.tweens.add({ targets: cover, fillAlpha: 1, duration: 1500 });
      this.time.delayedCall(800, () => {
        const d1 = this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, "Day 1", {
            fontFamily: "Galmuri11, monospace",
            fontSize: "72px",
            color: "#eaf0ff",
          })
          .setOrigin(0.5)
          .setAlpha(0)
          .setDepth(51);
        const sub = this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, "— 생존자 1명 —", {
            fontFamily: "Galmuri11, monospace",
            fontSize: "22px",
            color: "#9fb7ff",
          })
          .setOrigin(0.5)
          .setAlpha(0)
          .setDepth(51);
        this.tweens.add({ targets: [d1, sub], alpha: 1, duration: 1200 });
      });
    });

    this.time.delayedCall(this.DURATION, () => this.finish());
  }

  update(_t: number, delta: number): void {
    this.elapsed += delta;
  }

  private showCaption(text: Phaser.GameObjects.Text, msg: string, delay: number, duration: number): void {
    this.time.delayedCall(delay, () => {
      text.setText(msg);
      text.setAlpha(0);
      this.tweens.add({ targets: text, alpha: 1, duration: 600 });
      this.time.delayedCall(duration - 600, () => {
        this.tweens.add({ targets: text, alpha: 0, duration: 500 });
      });
    });
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(650, () => {
      this.scene.start("WorldScene");
      this.scene.launch("HUDScene");
    });
  }
}
