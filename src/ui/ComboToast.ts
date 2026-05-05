import Phaser from "phaser";
import { GAME_WIDTH } from "../config";

/** 활성 콤보의 메타 — 토스트 표시용 */
export const COMBO_META: Record<string, { icon: string; name: string; effect: string; color: number }> = {
  forge:          { icon: "🏭", name: "화로 가동",   effect: "모닥불 + 돌무더기 3개 → 돌 채집 ×2",       color: 0xff8a3a },
  home_base:      { icon: "🏠", name: "거점 연결",   effect: "천막 + 모닥불 → 잠자기 HP +30",            color: 0x6acc88 },
  farm:           { icon: "🌾", name: "텃밭 형성",   effect: "씨앗 4개 → 성장 1일 단축",                  color: 0xb0e060 },
  signal_network: { icon: "📡", name: "봉화망 가동", effect: "점화 봉화 3개 → 다음 보스 약화 70%",        color: 0xffe070 },
};

export function showComboToast(scene: Phaser.Scene, comboId: string): void {
  const meta = COMBO_META[comboId];
  if (!meta) return;

  const w = 460;
  const h = 78;
  const cx = GAME_WIDTH / 2;
  const targetY = 78;

  const c = scene.add.container(cx, -h).setDepth(600).setAlpha(0);

  const bg = scene.add
    .rectangle(0, 0, w, h, 0x0a1428, 0.97)
    .setStrokeStyle(2, meta.color)
    .setOrigin(0.5, 0);

  const topLine = scene.add.text(-w / 2 + 14, 10, "🌟 콤보 발동!", {
    fontFamily: "Galmuri11, monospace",
    fontSize: "12px",
    color: Phaser.Display.Color.IntegerToColor(meta.color).rgba,
  });

  const iconText = scene.add.text(-w / 2 + 14, 30, meta.icon, { fontSize: "30px" });
  const nameText = scene.add.text(-w / 2 + 56, 30, meta.name, {
    fontFamily: "Galmuri11, monospace",
    fontSize: "20px",
    color: "#eaf0ff",
    fontStyle: "bold",
  });
  const effectText = scene.add.text(-w / 2 + 56, 56, meta.effect, {
    fontFamily: "Galmuri11, monospace",
    fontSize: "11px",
    color: "#a3b4e8",
  });

  c.add([bg, topLine, iconText, nameText, effectText]);

  // 월드 카메라는 무시 (uiCam만 렌더)
  const worldCam = scene.cameras.main;
  if (worldCam) worldCam.ignore(c);

  // 슬라이드 다운 + 페이드 인 → 일정 시간 후 슬라이드 업 + 페이드 아웃
  scene.tweens.add({
    targets: c,
    y: targetY,
    alpha: 1,
    duration: 380,
    ease: "Back.Out",
    onComplete: () => {
      scene.time.delayedCall(2800, () => {
        scene.tweens.add({
          targets: c,
          y: targetY - 24,
          alpha: 0,
          duration: 380,
          ease: "Quad.In",
          onComplete: () => c.destroy(),
        });
      });
    },
  });
}
