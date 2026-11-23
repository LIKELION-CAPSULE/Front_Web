# 채린 분해 레이어 (로그인 조립 연출용) — 새 모델(Aliving2D, chaerin-v2)

`local-assets/chaerin-v2`의 실제 모델을 팀 엔진(`engine.js`)으로 기본 파라미터·기본 의상 상태에서 그룹별로 렌더해 뽑은 레이어예요.
모델 원본·엔진 코드는 들어 있지 않아요(렌더 이미지만).

- 좌표계: 모델 캔버스 1280×1280을 3배로 렌더한 3840×3840. `manifest.json`의 `x/y/width/height`가 각 레이어 위치(3배 px).
  모델 px = 값 / 3.
- `z` 0 → 8 순서(뒷머리, 치마, 몸, 얼굴, 입, 눈, 속눈썹·눈꺼풀, 눈썹, 앞머리)로 겹치면 `full.webp`와 같아요(평균 오차 0.007/255).
- 앞머리 레이어에는 "머리카락 위로 비치는 눈썹"이 함께 들어 있어요(그리는 순서가 앞머리 뒤라서).
- `*.mesh.webp`: 같은 파츠들의 실제 변형 격자(warp grid, 파츠마다 최대 10×10) — 흰 선과 점, 레이어 픽셀 위에만.

## 엔진 화면과 정확히 맞추기
엔진은 `setView(zoom, cx, cy)`로 그려요(canvas 크기에 1280×1280을 contain으로 맞춘 뒤 zoom, (cx, cy)를 중심으로).
캔버스 CSS 크기 `cw×ch`, 뷰 `(zoom, cx, cy)`일 때 모델 px 1당 CSS px `k = min(cw, ch) / 1280 * zoom`,
모델 점 `(mx, my)`의 화면 위치 = `(cw/2 + (mx - cx) * k, ch/2 + (my - cy) * k)`.
레이어 박스 = 위 식에 `(x/3, y/3)`을 넣은 위치, 크기 `width/3 * k`, `height/3 * k`.
(엔진에도 `model.toScreen(x, y)`가 있어요. 같은 결과.)

## 분해 시안 기준값 (1440 무대, 참고용)
`perspective 1500px`, 무대 `rotateX(-10deg) rotateY(-32deg)`, 레이어 `translateZ((z-4) * 85px)`, 모델 높이 ≈ 무대의 70%.
시안: `.temp/login-assemble/explode-mock.html?ry=-32&rx=-10&gap=85&s=0.18&dx=80&dy=10`

## 다시 뽑기
dev 서버(localhost:3000) 실행 후 `node .temp/login-assemble/v2-extract.mjs <출력폴더>` →
`process2.py <출력폴더> <이 폴더> <미리보기폴더>` (Pillow 필요). 이전(Cubism) 레이어 백업: `.temp/login-assemble/v1-backup/`.

## 폴리곤 메시·리깅 오버레이 (연출용)
- `*.poly.svg`: 레이어 외곽선을 따라 만든 삼각형 메시(Live2D ArtMesh 느낌). **엔진의 실제 변형 구조가 아니라 각 레이어 알파에서 만든 장식용**이에요.
  viewBox = 그 레이어 박스(`x/y/width/height`)라서 레이어 이미지와 같은 박스에 겹치면 맞아요.
  `path.mesh-edges`(선, 위→아래로 정렬돼 있어 stroke-dashoffset로 그려 나가는 연출 가능), `g.mesh-verts`(꼭짓점 원).
- `manifest.rig`: 기본 포즈에서 추정한 관절 10개(머리·목·가슴·골반·어깨·팔꿈치·손목, 3배 frame px)와 뼈 9개. 역시 장식용.
- 다시 만들기: `.temp/login-assemble/polymesh.py`, `polymesh-svg.py` (scipy, scikit-image 필요).
