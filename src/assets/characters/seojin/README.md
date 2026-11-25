# 서도현 정지 이미지 (모델 묶음 `seojin`, Aliving2D)

`local-assets/seojin` 모델을 팀 엔진(앱과 같은 `CapsuleV2Player`)으로 기본 포즈·투명 배경에서 렌더한 **임시** 이미지예요. 정식 일러스트가 오면 교체해요. 원본 모델·엔진은 저장소에 넣지 않아요(운영은 백엔드 API로만 받아요).

크기와 구도는 채린 v2 정지 이미지와 **같은 엔진 뷰**예요(`renders.json` = `../chaerin-v2/renders.json`의 값). 그래서 미리보기·통화 화면의 구도 계산(`aliving-view.ts`)이 두 메이트에 그대로 맞고, 정지 이미지와 실시간 모델이 겹쳐요. 2배 해상도.

| 파일 | 표시 크기(1x) | 구도 | 쓰는 곳 |
|---|---|---|---|
| `seojin-hero.webp` | 760×900 | 머리 → 허리 | 메이트 상세·내 메이트·연결 기록(로딩 전·실패·움직임 줄이기) |
| `seojin-card.webp` | 800×600 | 머리 → 가슴 | 홈 카드, 통화 화면 대체 이미지 |
| `seojin-avatar.webp` | 512×512 | 머리 → 어깨 | 내 기록 코멘트·범례, 작은 썸네일 |
| `seojin-full.webp` | 900×1200 | 머리 → 무릎 위 | (예비, 채린과 같은 세트) |
| `expressions/*.webp` | 96×96 | 이마 → 턱 | (지금은 안 씀) 예전 내 메이트 표정 컬렉션 썸네일(`neutral` 포함 9개) |
| `expressions-bust/*.webp` | 760×900 | 히어로와 같은 뷰 | (지금은 안 씀) 움직임 줄이기에서 고른 표정의 정지 그림 |

다시 만들기(로컬 mock dev 서버가 `/__local-assets/seojin/`을 제공해야 해요):

```sh
npx vite --port 5231 --strictPort &
PLAYWRIGHT_MODULE=<playwright 패키지의 index.mjs 경로> \
PLAYWRIGHT_CHROMIUM=<설치된 Chromium 실행 파일 경로, 선택> \
  node scripts/render-mate-stills.mjs http://127.0.0.1:5231 seojin src/assets/characters/seojin
```

`--only stills|expressions|bust`로 한 묶음만 만들 수 있어요. 그림마다 조금씩 떨어진 시점의 5장 중 가장 전형적인 1장을 남겨 눈 깜빡임이 섞이지 않게 해요.
