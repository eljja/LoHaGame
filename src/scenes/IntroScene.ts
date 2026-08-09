import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { makeButton } from "../ui/Button";
import { audio } from "../systems/AudioManager";

/** Three-act cinematic opening: voyage, wreck, and the first shore. */
export class IntroScene extends Phaser.Scene {
  private readonly duration = 24000;
  private done = false;

  constructor() {
    super("IntroScene");
  }

  create(): void {
    this.done = false;
    this.cameras.main.fadeIn(650, 0, 0, 0);
    audio.playBgm("title");
    audio.play("wave");

    const voyage = this.cinematicImage("intro-voyage-v2", 0);
    const storm = this.cinematicImage("intro-storm-v2", 0).setAlpha(0);
    const shore = this.cinematicImage("intro-shore-v2", 0).setAlpha(0);

    this.tweens.add({ targets: voyage, scale: 1.075, x: GAME_WIDTH / 2 - 18, duration: 7600, ease: "Sine.InOut" });

    const vignette = this.add.graphics().setDepth(20);
    vignette.fillStyle(0x02050c, 0.32);
    vignette.fillRect(0, 0, GAME_WIDTH, 56);
    vignette.fillGradientStyle(0x02050c, 0x02050c, 0x02050c, 0x02050c, 0, 0, 0.72, 0.72);
    vignette.fillRect(0, GAME_HEIGHT - 150, GAME_WIDTH, 150);

    const act = this.add.text(42, 32, "프롤로그  ·  마지막 항해", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "15px",
      color: "#d6e5ff",
      stroke: "#07101e",
      strokeThickness: 4,
    }).setDepth(30).setOrigin(0, 0.5);

    const caption = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 74, "", {
      fontFamily: "Galmuri11, monospace",
      fontSize: "22px",
      color: "#f5f8ff",
      align: "center",
      wordWrap: { width: GAME_WIDTH - 220 },
      stroke: "#050910",
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 3, color: "#000000", blur: 8, fill: true },
    }).setOrigin(0.5).setDepth(31);

    makeButton(this, GAME_WIDTH - 92, 34, {
      label: "건너뛰기  »",
      width: 150,
      height: 36,
      fontSize: 13,
      onClick: () => this.finish(),
    }).setDepth(40);

    this.showCaption(caption, "366명을 태운 여객선이 남태평양을 항해하고 있었다.", 450, 5900);

    const rain: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 110; i++) {
      const drop = this.add.rectangle(
        Phaser.Math.Between(-100, GAME_WIDTH + 100),
        Phaser.Math.Between(-GAME_HEIGHT, GAME_HEIGHT),
        Phaser.Math.Between(1, 2),
        Phaser.Math.Between(18, 36),
        0xc5dcff,
        Phaser.Math.FloatBetween(0.18, 0.58),
      ).setAngle(-18).setDepth(15).setAlpha(0);
      rain.push(drop);
    }
    const lightning = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xeaf4ff, 0).setDepth(18);

    this.time.delayedCall(6800, () => {
      act.setText("프롤로그  ·  폭풍");
      audio.playBgm("combat");
      this.tweens.add({ targets: voyage, alpha: 0, duration: 1200 });
      this.tweens.add({ targets: storm, alpha: 1, scale: 1.065, duration: 1300, ease: "Sine.Out" });
      this.tweens.add({ targets: rain, alpha: 1, duration: 900 });
      for (const drop of rain) {
        this.tweens.add({
          targets: drop,
          x: drop.x - 300,
          y: drop.y + GAME_HEIGHT * 2,
          duration: Phaser.Math.Between(700, 1150),
          repeat: -1,
          onRepeat: () => {
            drop.x = Phaser.Math.Between(0, GAME_WIDTH + 260);
            drop.y = Phaser.Math.Between(-250, -30);
          },
        });
      }
      this.showCaption(caption, "갑자기 폭풍이 몰려왔다. 파도는 집채만 하고 하늘이 찢어졌다.", 100, 5100);
    });

    this.time.delayedCall(9600, () => {
      const flash = (strength = 0.75) => {
        this.tweens.add({ targets: lightning, fillAlpha: strength, duration: 60, hold: 35, yoyo: true });
        audio.play("thunder");
      };
      flash();
      this.time.delayedCall(680, () => flash(0.45));
      this.time.delayedCall(1450, () => flash(0.9));
      this.cameras.main.shake(2900, 0.008);
    });

    this.time.delayedCall(12600, () => {
      act.setText("프롤로그  ·  좌초");
      audio.play("thunder");
      audio.play("hurt");
      this.cameras.main.shake(700, 0.045);
      this.tweens.add({ targets: storm, scale: 1.14, angle: -1.5, duration: 1600, ease: "Cubic.Out" });
      this.tweens.add({ targets: lightning, fillAlpha: 1, duration: 90, hold: 50, yoyo: true });
      this.showCaption(caption, "뱃머리가 암초에 박혔다. 선체가 두 동강 났다.", 0, 2800);
    });

    this.time.delayedCall(15400, () => {
      act.setText("프롤로그  ·  생존자");
      audio.playBgm("title");
      this.tweens.add({ targets: storm, alpha: 0, duration: 1800 });
      this.tweens.add({ targets: rain, alpha: 0, duration: 1500 });
      this.tweens.add({ targets: shore, alpha: 1, scale: 1.055, x: GAME_WIDTH / 2 + 14, duration: 1900, ease: "Sine.Out" });
      this.time.delayedCall(1400, () => {
        this.tweens.add({ targets: shore, scale: 1.095, x: GAME_WIDTH / 2 - 10, duration: 4900, ease: "Sine.InOut" });
      });
      this.showCaption(caption, "366명 중 단 한 사람만이 파도에 떠밀려 섬에 닿았다.", 450, 4300);
    });

    this.time.delayedCall(20700, () => {
      const cover = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02050a, 0).setDepth(50);
      this.tweens.add({ targets: cover, fillAlpha: 1, duration: 1100 });
      this.time.delayedCall(700, () => {
        const day = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 24, "DAY 1", {
          fontFamily: "Galmuri11, monospace",
          fontSize: "70px",
          color: "#f4f7ff",
          stroke: "#15274a",
          strokeThickness: 7,
        }).setOrigin(0.5).setAlpha(0).setDepth(51);
        const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 52, "생존자 1명  ·  구조 신호 없음", {
          fontFamily: "Galmuri11, monospace",
          fontSize: "18px",
          color: "#9fb7d8",
        }).setOrigin(0.5).setAlpha(0).setDepth(51);
        this.tweens.add({ targets: [day, sub], alpha: 1, duration: 900 });
      });
    });

    this.time.delayedCall(this.duration, () => this.finish());
  }

  private cinematicImage(key: string, depth: number): Phaser.GameObjects.Image {
    return this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(depth);
  }

  private showCaption(text: Phaser.GameObjects.Text, message: string, delay: number, duration: number): void {
    this.time.delayedCall(delay, () => {
      text.setText(message).setAlpha(0).setY(GAME_HEIGHT - 66);
      this.tweens.add({ targets: text, alpha: 1, y: GAME_HEIGHT - 74, duration: 550, ease: "Sine.Out" });
      this.time.delayedCall(Math.max(500, duration - 550), () => {
        this.tweens.add({ targets: text, alpha: 0, duration: 420 });
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
