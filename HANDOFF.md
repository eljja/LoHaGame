# 핸드오프 문서 — 로하의 무인도 생존기

> 다른 Claude Code 세션/계정으로 이 프로젝트를 인계받을 때 가장 먼저 읽을 문서.
> 코드는 한국어 주석/문구가 많고, UI 레이블도 한국어다.

---

## 1. 프로젝트 한 줄 요약

**Phaser 3 + Vite + TypeScript** 로 만든 50일 무인도 생존 웹게임.
타이타닉형 여객선이 좌초되어 366명이 죽고 주인공 1명만 살아남은 설정. 50일 후 구조선이 올 때까지 버티는 게 기본 목표지만, 뗏목으로 조기 탈출 엔딩도 있다.

---

## 2. 기본 정보

| 항목 | 값 |
|---|---|
| **저장소** | `eljja/lohagame` |
| **개발 브랜치** | `claude/survival-game-web-gubAO` (모든 작업이 이 브랜치) |
| **작업 디렉토리** | `/home/user/LoHaGame` |
| **언어** | TypeScript (strict 아님), UI 한국어 |
| **런타임** | Phaser 3.80.1 |
| **빌드** | Vite 5 |
| **노드 모듈** | `phaser`, `vite`, `typescript` 외 의존성 거의 없음 |

### 자주 쓰는 명령
```bash
npm run dev         # dev 서버 (http://localhost:5173)
npm run typecheck   # tsc --noEmit
npm run build       # tsc + vite build → dist/
```

---

## 3. 상위 디렉토리 구조

```
/home/user/LoHaGame
├── index.html              # #game 컨테이너 + boot splash
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/                 # 정적 자산 (현재 거의 비어 있음 — 모든 그래픽은 emoji + Graphics)
└── src/
    ├── main.ts             # Phaser.Game 부트
    ├── config.ts           # GAME_WIDTH=1280, GAME_HEIGHT=800, COLORS, 시간 상수
    ├── types.ts            # ItemDef, EnemyDef, StatDelta 등 공용 타입
    ├── scenes/             # 9개 씬
    ├── systems/            # GameStore (싱글턴), TimeSystem, Inventory 등
    ├── data/               # items, recipes, enemies, tiles, achievements
    └── ui/                 # InventoryPanel, CraftingPanel, JournalPanel, BottleTradePanel, Button, Panel, AchievementToast
```

---

## 4. 게임 플로우

```
BootScene (preload 없음, 즉시 진입)
  → TitleScene (새 게임 / 이어하기 / 저장 삭제 + 음소거 토글)
      → IntroScene (Canvas 25초 애니메이션, 스킵 가능)
        → start("WorldScene") + launch("HUDScene")
            ├─ launch("CaveScene")    → 동굴 채굴 (자동으로 WorldScene pause)
            ├─ launch("CombatScene")  → 전투 (WorldScene pause)
            ├─ start("VictoryScene")  → 50일 생존 성공 / 뗏목 탈출
            └─ start("GameOverScene") → HP 0
```

`HUDScene` 은 항상 위에 떠 있는 영구 씬: 상단바(Day, 시계, ☀☾, 스탯 4종, 콤보 뱃지)와 하단 로그.

---

## 5. 핵심 시스템 (반드시 알아둘 것)

### 5.1 `GameStore` — 모든 상태의 싱글턴 (`systems/GameStore.ts`)
- Phaser registry(`game.registry`)에 `"store"` 키로 저장 → `getStore(scene)` 호출 시 동일 인스턴스 반환
- 자식 시스템: `time` (`TimeSystem`), `stats` (`PlayerStats`), `inv` (`Inventory`), `crafting` (`Crafting`), `map` (`WorldMap`)
- 플래그: `lootedCrates`, `hasTent`, `hasBonfire`, `bossesDefeated`, `unlockedAchievements`, `discoveredRecipes`, `fishCaught`, `nightSkyBuff`, `lastNightSkyDay`
- 도전과제·특성(perk) 보너스 getter (`perkGatherBonus`, `perkBonusDmg`, `perkBonusRestHp` ...)
- **공간 콤보**: `activeCombos: Set<...>` + `recomputeCombos(silent?)` — `forge`, `home_base`, `farm`, `signal_network` 4종 (5.7 절 참조)

### 5.2 `TimeSystem` — 실시간 흐름 (`systems/TimeSystem.ts`)
- 1일 = 600초 실시간 (낮 300 + 밤 300)
- 60일까지 가는 게 아니라 **50일** (`WIN_DAY = 50`)
- `update(deltaMs)` — 매 프레임 호출되어 `elapsedInPhase` 누적
- `advanceMinutes(min)` — 행동 비용으로 즉시 분 단위 점프
- 이벤트: `phaseChange`, `dayChange`, `hourChange`, `day10Tick`, `win`
- ⚠ `clockString()` 은 phase 진행률에서 분 단위로 시계를 계산. HUD가 매 setInterval 100ms 마다 갱신.

### 5.3 `WorldMap` — 64×64 타일 오픈월드 (`systems/WorldMap.ts`, `data/tiles.ts`)
- 동심원 배치: 깊은 바다 → 얕은 바다 → 해변 → 풀밭/숲/돌산/절벽 → 강
- mulberry32 결정적 PRNG로 시드 기반 생성
- 엔티티는 `WorldEntity { id, type, tx, ty, meta? }`
- `nightRespawn()` — 매일 아침에 `respawn:true` 엔티티 부족분 보충
- `entityAt`, `isPassable`, `reachableEntity`, `removeEntity` API

### 5.4 `Inventory` — 동적 슬롯 (`systems/Inventory.ts`)
- **cap 없음**. 시작 시 15개 빈 슬롯, `add()` 시 부족하면 `slots.push()` 로 무한 증가
- `INVENTORY_INITIAL_SLOTS = 15` 는 **cap이 아니라 최소 표시 슬롯 수**
- 도구 아이템(`stack === 1` && `maxDurability != null`)은 `dur` 필드로 내구도 추적
- `useDurability(idx)` → `{ broken, hasDurability, dur, max }` 반환

### 5.5 `Crafting` (`systems/Crafting.ts`)
- `listRecipes()` 는 `flags.discoveredRecipes` 에 있는 것만 반환
- `recipe.requires?: ["bonfire" | "tent"]` 는 **2칸 이내 인접한 설치물** 필요
- 25개 레시피 (data/recipes.ts) — 봉화대·뗏목·정화수 등
- 레시피 발견은 아이템 첫 획득 시 `discoverRecipes(itemId)` 호출

### 5.6 전투 — `CombatScene.ts` (가장 최근 큰 변경)
**완전히 자동 루프** 기반. 공격 게이지 → 방어 게이지 → 공격 → ... 무한 반복.
- `playerAttack()` — sin 파 좌↔우 무한 진동, 탭하면 위치 결정
  - 가운데 (가우시안 중심) = 명중, 우측 끝 1% = **도망 성공**
  - σ_attack = `clamp(0.04 + weaponDmg/200, 0.04..0.25)` → 강한 무기일수록 명중대 넓음
  - 진동 속도 = `1500ms × clamp(1 + atkDiff×0.04, 0.4..2.5) × 2` (cycleMs)
  - 데미지 = `baseDmg × energyMult × gauss(t, 0.5, σ) × critMult`
- `playerDefend()` — 좌→우 1회 이동, 끝까지 가면 **자동 실패**
  - 가운데 = 가우시안 기반 피해 감소, 우측 끝 5% = **반격** (×1.5 dmg, 피해 0)
  - σ_defense = `clamp(0.30 - enemyAtk/120, 0.05..0.30)` → 강한 적일수록 좁음
  - 1회 trip 시간 = `1500ms × clamp(1 + atkDiff×0.04, 0.4..2.5)`
  - 방어는 적 턴 자체를 대체 (parry는 부르지 않음)
- 입력: 스페이스 / 엔터 / 클릭 모두 가능
- 액션 버튼/주사위 그래픽은 더 이상 표시되지 않음 (코드는 레거시로 보존)

**전투 플로우**:
```
create() → 900ms → playerAttack()
  → resolveAttackBar
    ├─ flee zone (1%) → endCombat(false)
    ├─ enemy HP <=0 → victory()
    └─ else 700ms → playerDefend()
        → resolveDefenseBar
          ├─ counter zone (5%) → enemyHp -= dmg → endDefenseTurn()
          ├─ player HP <=0 → endCombat(false, dead=true)
          └─ else → endDefenseTurn()
            → 700ms → playerAttack()  (loop)
```

**레거시 보존** (호출 안 됨, 미래 사용 가능):
- `buildButtons`, `afterPlayerTurn`, `enemyTurn` (적 패리)
- `useItemPrompt`, `playerFlee`
- `playerAttackLegacyDice`, `playerDefendLegacy`
- `rollDice`, `buildDicePanel`

### 5.7 공간 빌딩 콤보 (`recomputeCombos()` in GameStore)
설치물 인접 패턴이 자동 발동. `renderEntities()` 가 호출될 때마다 재계산:

| 콤보 ID | 조건 | 효과 |
|---|---|---|
| `forge` 🏭 | 모닥불 + 인접 8칸에 돌무더기 3개 이상 | 돌 채집 ×2 |
| `home_base` 🏠 | 천막과 모닥불이 체비셰프 거리 2 이내 | 잠자기 HP +30 |
| `farm` 🌾 | 씨앗 4개가 3×3 안 | 성장 1일 단축 |
| `signal_network` 📡 | 점화된 봉화 3개 이상 | 다음 해양 보스 HP/atk 70% 감소 |

`HUDScene` 상단(좌측 클럭 옆)에 활성 콤보 아이콘 뱃지 표시.

### 5.8 동굴 푸시-유어-럭 (`CaveScene.ts`)
- 0~10 위험도 미터, 다이브 동안 누적
- 채굴 시 +1, 강하 시 +2
- 위험도 6 이상부터 (위험도 × 5%) 사고 확률
- 사고 시 70% 인벤 자원 1개 분실, 30% 미니보스 조우 (`pale_miner`)
- "즉시 탈출" 버튼은 항상 안전

### 5.9 동물 (Wildlife AI)
- `tickWildlife()` 가 2.4초 주기로 호출되며 토끼/늑대/멧돼지/곰 이동
- 종별 이동 확률: 🐇 55% / 🐺 40% / 🐗 25% / 🐻 20%
- 종별 트윈 시간: 240/380/460/520ms
- 다른 엔티티가 있는 타일은 회피
- 캡: 토끼 15, 늑대 10, 멧돼지 8, 곰 5 (`data/tiles.ts`)
- WorldScene 진입 시 동물 합계 < 10이면 즉시 `nightRespawn()` 호출 (저장 직후 빈 맵 복원용)

### 5.10 패널 (UI)
- `InventoryPanel`, `CraftingPanel`, `JournalPanel`, `BottleTradePanel` 모두 동일 패턴
- WorldScene 인스턴스 위에 컨테이너 추가 (depth=200)
- **반드시** `open()` 시작에 `this.scene.scene.bringToTop()` 호출 — HUDScene 보다 앞으로
- **반드시** `close()` 끝에 `this.scene.scene.bringToTop("HUDScene")` 호출 — HUD 복원
- 인벤·제작은 `GeometryMask` + `scene.input.on("wheel")` 휠 스크롤
- 휠 핸들러는 `(c as any)._wheelHandler` 에 저장해 `close` 시 `off` 로 정리

### 5.11 시간 진행 (`HUDScene` setInterval)
- ⚠ 일부 환경에서 입력이 없을 때 RAF가 스로틀되어 `update()` 가 안 도는 케이스 발생
- 해결: `window.setInterval(100ms)` 로 시간 진행 분리 (`HUDScene.advanceTime`)
- scene SHUTDOWN/DESTROY 이벤트에서 `clearInterval` 정리
- WorldScene 일시정지 (`isPaused`) 또는 CaveScene/CombatScene 활성 시 시간 멈춤

---

## 6. 결정적 버그/이슈 — 반드시 알아야 할 함정

### 6.1 Phaser Container `displayOriginX/Y` (Button hit area)
- Phaser Container 의 `displayOriginX = width × 0.5`, `displayOriginY = height × 0.5` (readonly)
- `setSize(w, h)` 후 `InputManager.PointWithinHitArea` 가 좌표에 displayOrigin 을 더한다
- 따라서 hit area Rectangle은 `(0, 0, w, h)` 로 잡아야 함 (centered가 아님)
- `(-w/2, -h/2, w, h)` 로 잡으면 클릭 영역이 좌상단으로 어긋남
- ✅ 현재 `Button.ts` 는 `(0, 0, w, h)` 로 정정됨

### 6.2 Phaser dual-camera input (D-pad / 메뉴 버튼)
- WorldScene 은 worldCam (스크롤하는 월드용) + uiCam (고정 UI용) 두 카메라 사용
- `Camera.ignore(container)` 는 **렌더링** 만 차단, 컨테이너 자체의 hit-test는 막지 않음
- worldCam 이 스크롤된 좌표로 hit-test 하면 UI 버튼 위치가 어긋남
- 해결: 모든 UI 버튼에 `setScrollFactor(0)` 적용 (Button.ts 에서 자동)

### 6.3 eventemitter3 `removeListener(event, fn=undefined, context)`
- `fn` 이 falsy면 **context 무관하게 해당 이벤트의 모든 리스너 삭제**
- ❌ `stats.off("change", undefined, this)` 는 HUDScene 의 stat 리스너까지 날아감
- ✅ 정확한 핸들러 함수 참조를 전달: `stats.off("change", this.updatePlayerHp, this)`

### 6.4 씬 z-order
- 씬 매니저는 배열 끝의 씬을 위에 렌더
- `scene.bringToTop(key)` 는 그 씬을 배열 끝으로 옮김
- 패널 open 시 World 를 top, close 시 HUD 를 top 으로 복귀시키는 패턴 사용 중
- CombatScene/CaveScene 은 `create()` 에서 자기 자신을 `bringToTop()` (배열 위치가 어디든 항상 위)

### 6.5 WorldScene 텍스트 위치
- 메뉴 버튼은 좌측 (x ≤ 290), D-pad는 우측 (x ≥ 1060)
- 텍스트는 그 사이 (x=305부터, wordWrap 740) 에서 수직 스택
  - `actionHintText` (`y=614`, **현재 invisible**)
  - `equipBarText` (`y=614`, equipBar 가 actionHint 자리로 올라옴)
  - HUDScene `logText` (`y=660`, top-anchored)

### 6.6 시간이 멈춰 보이는 문제 (해결됨)
- 위 5.11 참조 — setInterval 기반으로 변경됨

---

## 7. 디버그 단축키 (`config.ts`)

- `=` (DEBUG_SPEED_KEY) — 시간 배속 1× → 10× → 60× → 1× 순환
- `Z` — 잠자기 (인접한 천막/난파선)
- 화살표 / WASD 비슷한 키 — 이동
- `I` / `C` / `J` — 인벤 / 제작 / 일지 패널
- 스페이스 / 엔터 / 클릭 — 전투 게이지 멈춤

---

## 8. 미구현/제안 (이전 대화에서 나온 아이디어들)

### 게임성 개선 (사용자가 가장 관심 있는 영역)
- **매일 아침 "오늘의 사건" 카드** — 무작위 1~3개 이벤트 (고래 좌초, 폭풍, 동굴 울림 등). 매일을 특별하게.
- **366명의 기억 시스템** — 승객 유품 발견 → 한 줄 이야기 + 작은 패시브. 5개까지 휴대.
- **또 다른 생존자 (Day 20~30 트리거)** — 발자국·연기·환각. 아이/적대자/환영 분기.

### 명시적으로 보존된 레거시 코드 (재활용 가능)
- **주사위 전투** — `rollDice`, `buildDicePanel`, `playerAttackLegacyDice`, `playerDefendLegacy`
- **버튼 액션 전투** — `buildButtons`, `afterPlayerTurn`, `enemyTurn`(적 패리), `useItemPrompt`, `playerFlee`
- 모두 `CombatScene.ts` 내부에 그대로 존재. 호출만 안 됨.

### 알려진 단점
- 모든 그래픽이 emoji 기반 → 폰트 / OS에 따라 렌더 차이
- 사운드는 모두 `AudioManager.ts` 에서 Web Audio API 로 합성 (별도 에셋 없음)
- 저장은 `localStorage["loha-save"]` 단일 슬롯만

---

## 9. 코딩 컨벤션 (이 프로젝트 한정)

- **한국어 주석/문구 다수** — 사용자가 한국어로 게임을 즐김. 새 메시지도 한국어로.
- **Emoji 적극 활용** — UI 라벨, 로그 메시지, 엔티티 아이콘 모두 emoji
- **들여쓰기** 2-space
- **TypeScript strict 아님** — `any` 캐스팅 (`(container as any)._wheelHandler`) 가용
- **이벤트 emitter 패턴** — `Phaser.Events.EventEmitter` 상속 시스템 (`GameStore`, `TimeSystem`, `PlayerStats`, `Inventory`)
- **레거시 코드 절대 삭제 금지** — 사용자가 "코드는 남겨줘" 명시. 호출만 분리.

---

## 10. 사용자 선호 / 작업 스타일

- 짧고 직접적인 한국어 응답
- 변경 사항을 **요약 + 원인 + 수정** 3단으로 설명하는 걸 선호
- TodoWrite 적극 사용 (3+ 단계 작업)
- 매번 `tsc --noEmit` 으로 검증 후 커밋·푸시
- 커밋 메시지는 한국어, 종류 prefix (`feat:`, `fix:`, `ui:`, `perf:`) 사용
- 커밋 메시지 끝에 `https://claude.ai/code/...` URL 포함하지만 **세션 전환 시 무의미**해질 수 있음
- 사용자는 종종 "이거 적용되어 있어?" 같은 짧은 확인 질문을 던진다 — `git log` 와 `grep` 으로 빠르게 확인하고 답하면 됨

---

## 11. 빠른 인수인계 체크리스트

새 세션 시작 시 5분 안에 따라하면 되는 것:

1. `cd /home/user/LoHaGame` 작업 디렉토리 확인
2. `git status && git log --oneline -10` — 현재 브랜치 (`claude/survival-game-web-gubAO`) 확인
3. `npm install` (필요 시)
4. `npm run dev` — http://localhost:5173 에서 게임 확인
5. 이 문서의 6번 (버그/함정) 한 번 더 정독
6. `src/scenes/CombatScene.ts` 와 `src/systems/GameStore.ts` 가 가장 자주 만지는 파일 — 초기에 한 번 훑어보기

---

## 12. 마지막 작업 (commit `a380259`)

**인벤토리 cap 제거 — 동적 증가**

- `Inventory.add()` 가 빈 슬롯이 부족하면 `slots.push()` 로 새 슬롯 생성
- `INVENTORY_SLOTS` (cap) → `INVENTORY_INITIAL_SLOTS = 15` (시작 표시용)
- `InventoryPanel.renderGrid` 에서 `totalSlots = max(slots.length, INITIAL)` 로 동적
- `gridMaxScroll` 인스턴스 변수로 매 렌더 재계산

이전 작업: 인벤/제작 휠 스크롤, 패널 z-order 수정, 곰 추가, 전투 자동 루프, 동굴 위험도, 공간 콤보, 패리 시스템.

다음에 할 만한 것: 8번 (미구현/제안) 참조.

---

*문서 작성: commit `a380259` 시점 — `claude/survival-game-web-gubAO` 브랜치*
