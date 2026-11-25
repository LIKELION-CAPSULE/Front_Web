# 채린 정지 이미지 (새 모델 Aliving2D, chaerin-v2)

`local-assets/chaerin-v3` 모델(2026-11-25, 상의·목 그림이 바뀐 채린)을 팀 엔진으로 기본 포즈·기본 의상·투명 배경에서 렌더한 이미지예요(원본 모델·엔진은 포함하지 않음). 2배 해상도.
폴더·파일 이름의 `v2`는 모델 형식(Aliving2D v2)을 뜻해요. 코드 import를 바꾸지 않으려고 v3 렌더도 같은 이름으로 두었어요.

이 폴더의 그림은 모두 **모델 렌더**예요. 채린이 나오는 **일러스트**(다시 렌더하지 않음)는 따로 있어요: `../chaerin-call-bg/`(방 배경, 캐릭터 없음), `src/assets/welcome-banners/chaerin-banner-v1.*`, `src/assets/reports/completion-*/chaerin-*`.

| 파일 | 표시 크기(1x) | 구도 | 이전 파일(대체 대상) |
|---|---|---|---|
| `chaerin-v2-hero.webp` | 760×900 | 머리 → 허리 | 옛 `chaerin-live2d-v1/chaerin-hero.webp`(삭제됨) |
| `chaerin-v2-card.webp` | 800×600 | 머리 → 가슴 | 옛 `chaerin-live2d-v1/chaerin-card.webp`(삭제됨) |
| `chaerin-v2-avatar.webp` | 512×512 | 머리 → 어깨 | (새로 추가, 프로필·작은 썸네일용) |
| `chaerin-v2-full.webp` | 900×1200 | 머리 → 손끝(무릎 위) | (새로 추가) |

엔진 뷰 값은 `renders.json`. 다시 만들기: dev 서버 실행 후 `scripts/render-mate-stills.mjs`(또는 표정 렌더 스크립트, 아래).
통화 배경(`../chaerin-call-bg/chaerin-call-bg-*.webp`, 방 그림)은 캐릭터가 없어 그대로 써요. 옛 v1 폴더는 2026-11-24 정리했어요.

## 표정 썸네일 (`expressions/`)

내 메이트 표정 컬렉션 타일에 쓰는 얼굴 크롭이에요. 위 정지 이미지와 같은 성격의 렌더 결과물이고, 원본 모델·엔진은 들어 있지 않아요.

- 파일: v2 표정 이름마다 하나(`sulky`, `happy`, `contempt`, `yawn`, `angry`, `laugh`, `shy`, `focus`)와 기본 얼굴 `neutral.webp`
- 크기: 192×192(표시 96px, 2배), 투명 배경, 모델 y 118…348(이마 → 턱) 정사각 크롭
- 엔진 뷰 값: `expressions/expressions.json`
- 코드에서 쓰는 곳: `src/features/mates/expression-thumbnails.ts`(v2 이름 → 이미지)

다시 만들기(로컬 mock dev 서버가 `local-assets/`의 모델·엔진을 `/__local-assets`로 제공해야 해요):

```sh
npx vite --port 5231 --strictPort --host 127.0.0.1 &
PLAYWRIGHT_MODULE=<playwright 패키지의 index.mjs 경로> \
PLAYWRIGHT_CHROMIUM=<설치된 Chromium 실행 파일 경로, 선택> \
  node scripts/render-chaerin-expressions.mjs http://127.0.0.1:5231 src/assets/characters/chaerin-v2/expressions
```

스크립트는 앱과 같은 v2 플레이어(`CapsuleV2Player`, `AlivingRenderer`가 쓰는 것)로 표정을 적용해 1.2초 동안 움직인 뒤
5번 찍고, 서로 가장 비슷한 한 장을 남겨요(눈 깜빡임이 섞이지 않게).

## 표정 상반신 정지 렌더 (`expressions-bust/`)

내 메이트 패널의 큰 채린이 Live2D를 그리지 않을 때(움직임 줄이기 설정) 고른 표정을 보여 주는 정지 그림이에요.
`chaerin-v2-hero.webp`와 같은 캔버스·같은 엔진 뷰로 렌더해서, 히어로 그림 자리에 그대로 바꿔 끼워도 위치가 어긋나지 않아요
(알파 영역 IoU 0.9999).

- 파일: v2 표정 이름마다 하나(`sulky`, `happy`, `contempt`, `yawn`, `angry`, `laugh`, `shy`, `focus`). 기본 얼굴은 히어로 그림 자체예요.
- 크기: 1520×1800(표시 760×900, 2배), 투명 배경, 모델 y 31…769(머리 → 허리), 장당 약 240kB
- 엔진 뷰 값: `expressions-bust/expressions.json`(= `renders.json`의 `chaerin-v2-hero`)
- 코드에서 쓰는 곳: `src/features/mates/expression-busts.ts`. 파일마다 따로 두고, 필요할 때만 받아요. 번들에는 들어가지 않아요.

다시 만들기(위와 같은 준비 후 `--bust`):

```sh
PLAYWRIGHT_MODULE=<playwright 패키지의 index.mjs 경로> \
PLAYWRIGHT_CHROMIUM=<설치된 Chromium 실행 파일 경로, 선택> \
  node scripts/render-chaerin-expressions.mjs http://127.0.0.1:5231 src/assets/characters/chaerin-v2/expressions-bust --bust
```

## 로그인 조는 모습 (`chaerin-v2-doze.webp`)

로그인 화면 「졸던 채린 깨우기」의 정지 그림 경로(운영의 로그인 메이트 API 전, 움직임 줄이기, WebGL 없음)에서 처음 보이는 조는 모습이에요.
깨면 `expressions-bust/yawn.webp` → `expressions-bust/happy.webp`로 크로스페이드해요(같은 hero 뷰라 위치가 그대로 겹쳐요).

- 크기: 1520×1800(표시 760×900, 2배), 투명 배경, `chaerin-v2-hero.webp`와 같은 캔버스·엔진 뷰(model y 31…769)
- 포즈(플레이어 `track`, Live2D 표준 ID): `ParamEyeLOpen 0`, `ParamEyeROpen 0`, `ParamAngleX -4`, `ParamAngleY -30`, `ParamAngleZ 7`,
  `ParamMouthOpenY 0.05` — 코드의 `DOZE_STILL_POSE`(`src/features/auth/login-variants/doze/doze-motion.ts`)와 같아야 해요
  (Live2D가 준비되면 이 포즈에서 졸기 동작을 이어 받아 크로스페이드해요).
- 다시 만들기: 위 표정 렌더와 같은 준비(로컬 mock dev 서버)에서, 플레이어를 hero 뷰로 만들고 매 프레임 위 포즈를 `track`한 뒤 1.6초 뒤 캔버스를 저장해요.
