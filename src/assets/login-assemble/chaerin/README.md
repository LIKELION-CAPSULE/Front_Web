# 채린 분해 레이어 (로그인 "채린 깨우기" 변신 연출용) — 새 모델(Aliving2D, chaerin-v2)

`local-assets/chaerin-v2`의 실제 모델을 팀 엔진(`engine.js`)으로 기본 파라미터·기본 의상 상태에서 그룹별로 렌더해 뽑은 레이어예요.
모델 원본·엔진 코드는 들어 있지 않아요(렌더 이미지만).

- 좌표계: 모델 캔버스 1280×1280을 3배로 렌더한 3840×3840. `manifest.json`의 `x/y/width/height`가 각 레이어 위치(3배 px).
  모델 px = 값 / 3.
- `z` 0 → 8 순서(뒷머리, 치마, 몸, 얼굴, 입, 눈, 속눈썹·눈꺼풀, 눈썹, 앞머리)로 겹치면 `full.webp`와 같아요(평균 오차 0.007/255).
- 앞머리 레이어에는 "머리카락 위로 비치는 눈썹"이 함께 들어 있어요(그리는 순서가 앞머리 뒤라서).
- 현재 쓰임: 변신 연출에서 9개 레이어를 한 컨테이너에 묶어 하나의 마스크로 채우고, `full.webp`는 실루엣·idle 카드 사진·static 폴백에 써요.
  (예전 분해/폴리곤 메시/뼈대 연출과 그 에셋 `*.poly.svg`, `*.mesh.webp`, `manifest.rig`는 제거했어요.)

## 엔진 화면과 정확히 맞추기
엔진은 `setView(zoom, cx, cy)`로 그려요(canvas 크기에 1280×1280을 contain으로 맞춘 뒤 zoom, (cx, cy)를 중심으로).
캔버스 CSS 크기 `cw×ch`, 뷰 `(zoom, cx, cy)`일 때 모델 px 1당 CSS px `k = min(cw, ch) / 1280 * zoom`,
모델 점 `(mx, my)`의 화면 위치 = `(cw/2 + (mx - cx) * k, ch/2 + (my - cy) * k)`.
레이어 박스 = 위 식에 `(x/3, y/3)`을 넣은 위치, 크기 `width/3 * k`, `height/3 * k`.
(엔진에도 `model.toScreen(x, y)`가 있어요. 같은 결과.) 구현은 `src/features/mate-render/aliving-view.ts`
(`computeBustCamera`, `computeAlivingLayerBox`)에 있어요.

## 다시 뽑기
dev 서버(localhost:3000) 실행 후 `node .temp/login-assemble/v2-extract.mjs <출력폴더>` →
`process2.py <출력폴더> <이 폴더> <미리보기폴더>` (Pillow 필요). 이전(Cubism) 레이어 백업: `.temp/login-assemble/v1-backup/`.
(`manifest.json`은 위 스크립트가 만든 뒤 mesh/poly/rig 항목을 뺀 상태예요. `polymesh*.py`는 더 이상 쓰지 않아요.)
