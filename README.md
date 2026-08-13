# 무인도에서의 50일

### ▶ [🎮 지금 바로 플레이하기 (GitHub Pages)](https://eljja.github.io/LoHaGame/)

웹 브라우저에서 돌아가는 2D 서바이벌 게임. Phaser 3 + Vite + TypeScript.

## 스토리
366명이 탄 타이타닉형 여객선이 좌초되고 단 한 명의 생존자만이 무인도에 떠밀려 옵니다. 50일 뒤 구조선이 도착할 때까지 먹고·마시고·싸우며 버텨야 합니다.

## 플레이
- 1일 = **10분 실시간** (낮 5분 + 밤 5분), 총 50일.
- 모든 이동과 상호작용은 **화면 버튼 클릭**으로 조작합니다.
- 10일마다 해양 보스가 습격하고, 밤엔 오리지널 SCP풍 약몹이 조우할 수 있습니다.
- 동굴에서 돌/철/다이아를 채굴하고, 나무/돌로 무기와 도구를 제작하세요.

## 단축키 (선택)
- `I` — 인벤토리
- `C` — 제작
- `J` — 일지
- `Esc` — 패널 닫기
- `=` — 디버그 시간 배속 토글 (x1 → x10 → x60)

## 개발 / 실행

```bash
npm install
npm run dev          # http://localhost:5173
npm run audio:render # 오리지널 사운드트랙 재렌더링
npm run build        # dist/ 정적 산출물
npm run preview      # 빌드 결과 미리보기
```

## 구조

```
src/
  main.ts              Phaser.Game 부트
  config.ts            해상도·시간·팔레트 상수
  types.ts             공용 타입
  scenes/              Boot, Title, Intro, World, HUD, Cave, Combat, Victory, GameOver
  systems/             TimeSystem, PlayerStats, Inventory, Crafting, SaveManager, GameStore
  data/                items, recipes, zones, resources, enemies
  ui/                  Button, Panel, InventoryPanel, CraftingPanel, JournalPanel
```

## 배포 (GitHub Pages 자동배포)

`main` 또는 `claude/**` 브랜치에 푸시되면 GitHub Actions가 자동으로 빌드하여 GitHub Pages에 배포합니다.

**최초 1회 저장소 설정:**
1. GitHub 저장소 → **Settings** → **Pages**
2. **Source** 를 **GitHub Actions** 로 선택
3. 이후 푸시/머지 시 자동 배포됨

배포 URL: **<https://eljja.github.io/LoHaGame/>**

워크플로 로그는 저장소의 **Actions** 탭에서 확인 가능합니다.

## 크레딧 / 라이선스 참고
- 월드·캐릭터·전투 그래픽은 Phaser Canvas 기반 프로젝트 전용 텍스처를 사용하며, 타이틀과 오프닝 시네마틱은 프로젝트용 생성 이미지 에셋을 사용합니다.
- 음악은 이 게임을 위해 직접 작곡·합성·렌더링한 오리지널 시네마틱 하이브리드 오케스트라 사운드트랙 16곡을 사용합니다. 저음 현악 오스티나토·개방형 금관·대형 타악과 점층적 빌드업을 중심으로 타이틀·인트로·낮·밤·비·바람·동굴·전투·엔딩에 서로 다른 곡을 배치했으며, 외부 음악·샘플·루프·사운드폰트는 포함하지 않습니다.
- 바람·파도·비·번개·불·동물 등의 환경음은 Web Audio 레이어로 지형·낮밤·날씨에 따라 실시간으로 달라집니다.
- 악곡 생성 과정과 파일 검증은 `scripts/generate-original-score.mjs`, 권리 정보는 `public/audio/music/ORIGINAL_SCORE.md`에 기록되어 있습니다.
- 폰트: [Galmuri11](https://github.com/quiple/galmuri) (OFL).
- "SCP"풍 크리처는 **오리지널 명칭·외형**으로 오마주했습니다.
