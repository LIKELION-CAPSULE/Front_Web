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

## 다시 렌더링하기

개발 서버를 켠 뒤 렌더 스크립트를 실행한다. 파일 목록과 각 쿼리는 `scripts/render-capsule-stills.mjs`의 `CAPSULE_STILLS`에 있다. 이름 일부를 주면 그 파일만 다시 그린다.

```bash
npx vite --port 5231 --strictPort &
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
  node scripts/render-capsule-stills.mjs http://127.0.0.1:5231 [filled empty ...]
```

미리 보려면 `http://127.0.0.1:5231/src/assets/capsule/capsule-render.html?state=open&roll=118`을 연다(왼쪽 체크무늬, 오른쪽 밝은 배경).
