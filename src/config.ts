export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;

/** 1일 = 600초 실시간 (낮 300 + 밤 300). */
export const DAY_LENGTH_SECONDS = 600;
export const DAY_PHASE_SECONDS = 300;
export const NIGHT_PHASE_SECONDS = 300;

/** 총 50일 생존해야 승리. */
export const WIN_DAY = 50;

/** 지역 간 이동 시 소비되는 게임 내 시간(분). */
export const ZONE_TRAVEL_MINUTES = 15;

/** 스탯 감소 비율(초당). 한 시간 기준이 아닌 초 단위로 상수화. */
export const STAT_DRAIN = {
  hunger: 0.07,
  thirst: 0.1,
  energyDay: 0.04,
  energyNight: 0,
};

/** 디버그 배속 키 */
export const DEBUG_SPEED_KEY = "EQUALS"; // `=` / `+`

/** 팔레트 */
export const COLORS = {
  ink: 0xeaf0ff,
  dim: 0x8d9bd1,
  panel: 0x0e1530,
  panelBorder: 0x2a376d,
  accent: 0x6fd1ff,
  warn: 0xffa94d,
  danger: 0xff5a6a,
  good: 0x8be58b,
  night: 0x0a1330,
  day: 0x1e3a6f,
};
