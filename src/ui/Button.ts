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

  // scrollFactor 0: worldCam이 스크롤 좌표로 hit test하지 않도록.
  // Phaser의 Camera.ignore()는 Container 자체가 아닌 자식에만 cameraFilter를 적용해
  // worldCam이 button container를 여전히 hit test한다. scrollFactor=0으로
  // worldCam도 screen-space 좌표로 판정하도록 강제한다.
  container.setScrollFactor(0);
  // Hit area는 Rectangle(0, 0, w, h)로 잡는다. Phaser InputManager는 hit-test 시
  // gameObject.displayOriginX/Y를 좌표에 더하는데, Container의 displayOrigin은
  // 항상 width*0.5, height*0.5이다 (Container.js의 readonly getter). 따라서 setSize(w,h)
  // 이후 로컬 hit-test 좌표가 (w/2, h/2)만큼 양수 방향으로 보정되므로
  // (0,0,w,h)로 잡아야 화면상의 버튼 영역과 정확히 일치한다.
  // (-w/2, -h/2, w, h)로 잡으면 (w/2, h/2)만큼 좌상으로 어긋난다.
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, w, h),
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
