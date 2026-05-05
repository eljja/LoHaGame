import Phaser from "phaser";
import { GAME_WIDTH } from "../config";
import { WORLD_PX } from "../data/tiles";
import { getStore } from "./GameStore";
import { audio } from "./AudioManager";

const VP_Y = 56;
const VP_H = 552;

interface WeatherDeps {
  /** 월드 좌표계에 추가할 GameObject — `worldObjects.push(obj)` 와 `uiCam.ignore(obj)` 등록. */
  registerWorldObject: (obj: Phaser.GameObjects.GameObject) => void;
}

/** 월드 위로 떠다니는 구름 그림자. */
export function setupClouds(scene: Phaser.Scene, deps: WeatherDeps): void {
  const cloudCount = 4;
  for (let i = 0; i < cloudCount; i++) {
    spawnCloud(scene, deps, Math.random() * WORLD_PX);
  }
}

function spawnCloud(scene: Phaser.Scene, deps: WeatherDeps, startX: number): void {
  const y = Math.random() * WORLD_PX;
  const scale = 1.2 + Math.random() * 1.6;
  const cloud = scene.add
    .text(startX, y, "☁", { fontSize: "48px" })
    .setOrigin(0.5)
    .setAlpha(0.35 + Math.random() * 0.2)
    .setDepth(15)
    .setScale(scale);
  deps.registerWorldObject(cloud);
  const dur = 60000 + Math.random() * 60000;
  scene.tweens.add({
    targets: cloud,
    x: startX + WORLD_PX + 200,
    duration: dur,
    ease: "Linear",
    onComplete: () => {
      cloud.destroy();
      spawnCloud(scene, deps, -200 - Math.random() * 400);
    },
  });
}

/** 가끔 날씨가 변한다 (비/바람). 1.5분마다 굴림. */
export function setupWeather(scene: Phaser.Scene): void {
  scene.time.addEvent({
    delay: 90000,
    loop: true,
    callback: () => {
      if (scene.scene.isPaused()) return;
      const roll = Math.random();
      if (roll < 0.18) startRain(scene);
      else if (roll < 0.3) startWind(scene);
    },
  });
}

function startRain(scene: Phaser.Scene): void {
  const store = getStore(scene);
  store.pushLog("🌧 하늘이 어두워지더니 비가 내리기 시작한다.");
  audio.play("phase_night");
  const duration = 35000;
  const particles: Phaser.GameObjects.Text[] = [];
  const worldCam = scene.cameras.main;
  const spawn = () => {
    for (let i = 0; i < 3; i++) {
      const px = Math.random() * GAME_WIDTH;
      const d = scene.add
        .text(px, VP_Y - 10, "│", {
          fontSize: "14px",
          color: "#9fd5ff",
        })
        .setAlpha(0.55)
        .setDepth(45);
      worldCam.ignore(d);
      particles.push(d);
      scene.tweens.add({
        targets: d,
        y: VP_Y + VP_H,
        alpha: 0,
        duration: 420 + Math.random() * 180,
        ease: "Linear",
        onComplete: () => d.destroy(),
      });
    }
  };
  const spawner = scene.time.addEvent({ delay: 80, loop: true, callback: spawn });
  scene.time.delayedCall(duration, () => {
    spawner.remove(false);
    particles.forEach((p) => p.destroy());
    // 비 보너스: 더러운 물 1-2 추가 (빈 용기 같이)
    if (Math.random() < 0.75) {
      const n = Phaser.Math.Between(1, 2);
      store.inv.add("water_dirty", n);
      store.pushLog(`🌧 비가 그쳤다. 받아둔 빗물 (흙탕물 ×${n}) 획득.`);
    } else {
      store.pushLog("🌦 비가 그쳤다.");
    }
  });
}

function startWind(scene: Phaser.Scene): void {
  const store = getStore(scene);
  store.pushLog("🍃 해안에서 상쾌한 바람이 불어온다. 기분이 좋아진다.");
  store.stats.apply({ energy: 6 });
  const worldCam = scene.cameras.main;
  // 바람 이펙트: 작은 잎사귀 몇 개 화면 가로질러 이동
  for (let i = 0; i < 8; i++) {
    const startY = VP_Y + Math.random() * VP_H;
    const leaf = scene.add
      .text(-20, startY, Math.random() < 0.5 ? "🍃" : "·", { fontSize: "16px" })
      .setDepth(45)
      .setAlpha(0.8);
    worldCam.ignore(leaf);
    scene.tweens.add({
      targets: leaf,
      x: GAME_WIDTH + 20,
      y: startY + (Math.random() - 0.5) * 80,
      duration: 3500 + Math.random() * 1500,
      delay: i * 200,
      ease: "Sine.InOut",
      onComplete: () => leaf.destroy(),
    });
  }
}
