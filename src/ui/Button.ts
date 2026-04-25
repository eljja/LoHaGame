import Phaser from "phaser";
import { COLORS } from "../config";
import { audio } from "../systems/AudioManager";

export interface ButtonOpts {
  label: string;
  width?: number;
  height?: number;
  fontSize?: number;
  bg?: number;
  hover?: number;
  border?: number;
  textColor?: string;
  onClick: () => void;
  disabled?: boolean;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: ButtonOpts
): Phaser.GameObjects.Container {
  const w = opts.width ?? 180;
  const h = opts.height ?? 48;
  const bg = opts.bg ?? COLORS.panel;
  const hover = opts.hover ?? 0x1b2a5e;
  const border = opts.border ?? COLORS.panelBorder;

  const container = scene.add.container(x, y);
  const rect = scene.add.rectangle(0, 0, w, h, bg, 1).setStrokeStyle(2, border);
  rect.setOrigin(0.5);
  const txt = scene.add
    .text(0, 0, opts.label, {
      fontFamily: "Galmuri11, monospace",
      fontSize: `${opts.fontSize ?? 16}px`,
      color: opts.textColor ?? "#eaf0ff",
      align: "center",
    })
    .setOrigin(0.5);

  container.add([rect, txt]);
  container.setSize(w, h);

  const setDisabled = (d: boolean) => {
    rect.setAlpha(d ? 0.35 : 1);
    txt.setAlpha(d ? 0.5 : 1);
    (container as any).disabled = d;
  };

  container.setInteractive(
    new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
    Phaser.Geom.Rectangle.Contains
  );
  if (container.input) container.input.cursor = "pointer";
  container.on("pointerover", () => {
    if ((container as any).disabled) return;
    rect.setFillStyle(hover);
  });
  container.on("pointerout", () => rect.setFillStyle(bg));
  container.on("pointerdown", () => {
    if ((container as any).disabled) {
      audio.resume();
      audio.play("error");
      return;
    }
    rect.setFillStyle(COLORS.accent);
    scene.tweens.add({ targets: container, scale: 0.96, duration: 60, yoyo: true });
    audio.resume();
    audio.play("click");
  });
  container.on("pointerup", () => {
    if ((container as any).disabled) return;
    rect.setFillStyle(hover);
    opts.onClick();
  });

  if (opts.disabled) setDisabled(true);
  (container as any).setDisabled = setDisabled;
  (container as any).setLabel = (s: string) => txt.setText(s);
  return container;
}

export type ButtonNode = Phaser.GameObjects.Container & {
  setDisabled: (d: boolean) => void;
  setLabel: (s: string) => void;
};
