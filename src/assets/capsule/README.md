# 캡슐 정지 렌더

서비스의 모든 3D 캡슐은 한 모델을 쓴다. 정본은 `src/shared/three/capsule-model.ts`로, 내 메이트 유리병의 lathe 기하(로고 v2 비율·이음매)와 두 톤 유리 셰이더·안쪽 빛·후광이다. 색은 `src/shared/three/capsule-shape.ts`의 `BRAND_CAPSULE_COLORS`(채린 유리병 색과 같음).

실시간 장면(내 메이트 유리병, 내 기록 보드, 내 기록 빈 상태, 친구 초대 돔)은 이 모듈을 직접 그리고, 그림만 필요한 화면은 아래 정지 렌더를 쓴다. 화면마다 조명(`glow`)·각도·채도(`sat`)·크기를 조금씩 맞췄다.

| 파일 | 상태 | 쓰는 곳 |
| --- | --- | --- |
| `capsule-filled.webp` (224×224) | 채움: 빛남 | 친구 초대 진행 줄, 초대한 친구 칸 |
| `capsule-empty.webp` (224×224) | 빈 칸: 어두운 유리 | 친구 초대 진행 줄, 아직 빈 칸 |
| `capsule-upright.webp` (320×320) | 채움, 세워 둠 | 내 기록 빈 상태 장면의 WebGL 폴백 |
| `capsule-open.webp` (500×500) | 열림: 반쪽이 떠 있음 | 메이트 상세 히어로, 메이트 옆 캡슐 |
| `../attendance/path/reward-capsule.webp` (416×488) | 보상: 안에 별 | 홈 출석 길 7일차 보상 (출석 길 그림과 같은 틀 208×244의 2배) |

`capsule-render.html`이 원본이다. 렌더러 출력을 검은 배경과 흰 배경에 한 번씩 그려 비교해 투명도를 구하므로(빛은 가장 밝은 채널만큼, 연기 유리는 가린 만큼) 어두운 화면에서도 밝은 화면에서도 가장자리가 깨끗하다. 외부 이미지나 생성 서비스를 쓰지 않는다. 굴절·코스틱은 재현하지 않고 프레넬 테두리와 스튜디오 하이라이트로 근사한다.

## 쿼리

| 이름 | 기본값 | 뜻 |
| --- | --- | --- |
| `state` | `filled` | `filled` · `empty` · `open` · `reward` |
| `w`, `h` | 480 | 출력 크기(px) |
| `roll` | 90 | 화면에서 축 방향(도). 0이면 보라 반쪽이 오른쪽, 90이면 위 |
| `yaw`, `pitch` | 0 | 보는 쪽으로 돌림, 위에서 내려다봄(도) |
| `fill` | 0.78 | 짧은 변에 대한 캡슐 길이 |
| `glow` | 1 | 빛의 세기(상태별 기본값에 곱함) |
| `sat` | 1 | 색을 남기는 정도 |
| `open` | 1 | 열림 정도(`state=open`) |
| `rewardDecor` | 없음 | 있으면 출석 보상용 금색 이음 고리·별빛·바닥 빛 추가 |
| `rewardTime` | 없음 | 출석 열림 프레임 진행도(0~1), `state=open`과 함께 사용 |

## 다시 렌더링하기

개발 서버를 켠 뒤 렌더 스크립트를 실행한다. 파일 목록과 각 쿼리는 `scripts/render-capsule-stills.mjs`의 `CAPSULE_STILLS`에 있다. 이름 일부를 주면 그 파일만 다시 그린다.

```bash
npx vite --port 5231 --strictPort &
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
  node scripts/render-capsule-stills.mjs http://127.0.0.1:5231 [filled empty ...]
```

미리 보려면 `http://127.0.0.1:5231/src/assets/capsule/capsule-render.html?state=open&roll=118`을 연다(왼쪽 체크무늬, 오른쪽 밝은 배경).

## 출석 보상·수화기 재렌더와 출석 검사

7일차 보상은 장식과 열림 첫 프레임을 일치시키는 전용 명령으로 만든다. 아래 Node 명령에는 설치된 Playwright 모듈과 Chromium 실행 파일 경로를 지정한다. Python 명령은 Pillow가 필요하다.

```sh
VITE_DATA_SOURCE=mock npx vite --port 53187 --strictPort
# 별도 셸에서 실행
export PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
export PLAYWRIGHT_CHROMIUM=/path/to/chrome
node scripts/render-polish-assets.mjs http://127.0.0.1:53187
python3 scripts/pack-reward-sprite.py
node scripts/check-reward-opening.mjs http://127.0.0.1:53187
```

`render-polish-assets.mjs`는 수화기 보라·빨강 PNG와 보상 12프레임을 `/tmp/cx-3d-evidence/reward/`에 만든다. `pack-reward-sprite.py`는 이 프레임을 `reward-capsule.webp`와 1.2초 `reward-opening.webp`로 패킹하고 수화기 두 PNG를 480×480 WebP로 변환한다. 프레임 시트는 임시 폴더에만 남긴다. 일반 정지 캡슐만 갱신할 때는 앞 절의 명령에 `filled empty upright open`처럼 이름을 지정해 출석 전용 에셋을 제외한다.

`check-reward-opening.mjs`는 재사용 검사 화면 `scripts/fixtures/attendance-preview.html`에서 7일차 전환을 재현한다. 클릭 전 요청 없음, 성공 후 열림·정리, reduced-motion에서 지연 모듈·이미지 요청 생략을 확인한다. 캡처는 `/tmp/cx-3d-evidence/reward-check/`에 저장한다. 모든 임시 출력의 상위 경로는 `CX_3D_EVIDENCE_DIR`로 변경할 수 있다.

탁상시계 시트 재렌더는 [탁상시계 README](../connection/capsule-clock/README.md)를 참고한다.
