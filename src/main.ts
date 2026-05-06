import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "./config";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { IntroScene } from "./scenes/IntroScene";
import { WorldScene } from "./scenes/WorldScene";
import { HUDScene } from "./scenes/HUDScene";
import { CaveScene } from "./scenes/CaveScene";
import { CombatScene } from "./scenes/CombatScene";
import { VictoryScene } from "./scenes/VictoryScene";
import { GameOverScene } from "./scenes/GameOverScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#05070f",
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [
    BootScene,
    TitleScene,
    IntroScene,
    WorldScene,
    HUDScene,
    CaveScene,
    CombatScene,
    VictoryScene,
    GameOverScene,
  ],
  render: {
    antialias: true,
  },
};

const game = new Phaser.Game(config);

game.events.once(Phaser.Core.Events.READY, () => {
  const splash = document.getElementById("boot-splash");
  if (splash) {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 600);
  }
});

// 전역 접근(디버그용)
(window as unknown as { __loha: Phaser.Game }).__loha = game;
