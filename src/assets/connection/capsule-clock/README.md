# 답장 대기 캡슐 탁상시계

통화 화면에는 아직 적용하지 않은 오프라인 에셋이다. 런타임 WebGL 컨텍스트는 추가하지 않는다.

| 파일 | 내용 |
| --- | --- |
| `capsule-clock-sprite.webp` | 투명 가로 시트, 3072×180, 12프레임, 한 프레임 256×180 |
| `capsule-clock-still.webp` | 첫 프레임 정지 폴백 |
| `clock-render.html` | Three.js 절차 모델과 고정 프레임 렌더러 |

공용 `capsuleGeometry`, `CAPSULE_ASPECT`, `CAPSULE_SEAM_X`를 그대로 사용한다. 내부 구슬 20개를 한 InstancedMesh로 만들었으며, 목 부분 2개가 아래로 순환 이동한다. 최종 렌더 삼각형 5,504개. 숨은 면은 회전 대칭으로 추정했고 유리는 반사·알파로 근사한다. 정확한 굴절·코스틱이나 참조와 동일한 유리 재질을 주장하지 않는다.

## 다시 렌더

mock Vite 서버를 띄우고 설치된 Playwright와 Chromium 경로를 환경 변수로 지정한다.

```sh
VITE_DATA_SOURCE=mock npx vite --port 53187 --strictPort
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs PLAYWRIGHT_CHROMIUM=/path/to/chrome node scripts/render-clock-sprite.mjs http://127.0.0.1:53187
python3 scripts/pack-clock-sprite.py
```

Node 스크립트가 개별 프레임과 구슬 matrix를 `/tmp/cx-3d-evidence/clock/`에 만들고, Python 스크립트(Pillow 필요)가 이를 검증해 이 폴더의 시트와 정지 WebP만 교체한다. 프레임 시트 미리보기도 임시 폴더에 남긴다. 다른 임시 경로를 쓰려면 두 명령에 같은 `CX_3D_EVIDENCE_DIR` 환경 변수를 지정한다. 개별 프레임·참조 이미지·품질 검토 증거는 런타임에서 사용하지 않아 저장소에 보관하지 않는다.

`?frame=0`~`11`, `?yaw=0`~`270`으로 프레임과 시점을 고른다. 검토 단계는 `?stage=blockout`, `structural-pass`, `form-refinement`, `material-pass`, `surface-pass`, `lighting-pass`, `interaction-pass`, `optimization-pass`다. 기본값은 최종 단계다.

## 추후 통화 화면 적용

답장 대기 상태에서만 스프라이트 URL을 불러오고, 표시 크기 64×45px이면 아래 크기로 사용한다. 장식은 `aria-hidden="true"`, 대기 안내 문구는 기존 접근성 텍스트를 유지한다.

```css
.capsule-clock {
  width: 64px;
  height: 45px;
  background-image: var(--clock-sprite);
  background-size: 768px 45px;
  animation: clock-flow 2.4s steps(12, end) infinite;
}
@keyframes clock-flow { to { background-position-x: -768px; } }
@media (prefers-reduced-motion: reduce) {
  .capsule-clock { animation: none; }
}
```

이미지 요청 실패 시 기존 점 3개로 돌아간다. 정지 이미지가 필요하면 `capsule-clock-still.webp`를 쓴다. 답장 도착 시 짧은 CSS scale 동작을 붙일 수 있으나 이번 작업에는 화면 코드 적용을 포함하지 않았다.

## 참조 생성

추가 API 키 없이 내장 imagegen 사용. 프롬프트: “Cute glossy 3D render for a game-style app UI, violet and lavender palette, no gold, no outlines, no text; tiny desk clock shaped like a capsule pill lying on its side, lavender-white glass chamber showing a glowing violet hourglass of twenty tiny orbs, matte violet end, two stubby feet; front and three-quarter views side by side; dark navy purple #141022 background.” 이후 같은 도구로 배경을 투명화했다. 이미지 정면 영역 분리는 검토 입력 정규화이며 최종 에셋은 참조 픽셀을 합성하지 않고 절차 모델을 렌더한 것이다.
