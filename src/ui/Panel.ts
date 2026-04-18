import Phaser from "phaser";
import { COLORS } from "../config";

export function drawPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { fill?: number; alpha?: number; border?: number }
): Phaser.GameObjects.Rectangle {
  const rect = scene.add.rectangle(x, y, w, h, opts?.fill ?? COLORS.panel, opts?.alpha ?? 0.92);
  rect.setStrokeStyle(2, opts?.border ?? COLORS.panelBorder);
  rect.setOrigin(0, 0);
  return rect;
}
