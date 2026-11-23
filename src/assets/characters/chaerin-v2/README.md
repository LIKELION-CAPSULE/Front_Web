# 채린 정지 이미지 (새 모델 Aliving2D, chaerin-v2)

`local-assets/chaerin-v2` 모델을 팀 엔진으로 기본 포즈·기본 의상·투명 배경에서 렌더한 이미지예요(원본 모델·엔진은 포함하지 않음). 2배 해상도.

| 파일 | 표시 크기(1x) | 구도 | 이전 파일(대체 대상) |
|---|---|---|---|
| `chaerin-v2-hero.webp` | 760×900 | 머리 → 허리 | `chaerin-live2d-v1/chaerin-hero.webp` |
| `chaerin-v2-card.webp` | 800×600 | 머리 → 가슴 | `chaerin-live2d-v1/chaerin-card.webp` |
| `chaerin-v2-avatar.webp` | 512×512 | 머리 → 어깨 | (새로 추가, 프로필·작은 썸네일용) |
| `chaerin-v2-full.webp` | 900×1200 | 머리 → 손끝(무릎 위) | (새로 추가) |

엔진 뷰 값은 `renders.json`. 다시 만들기: dev 서버 실행 후 `.temp/login-assemble/v2-renders.mjs`.
배경(`chaerin-live2d-v1/chaerin-call-bg-*.webp`, 방 그림)은 캐릭터가 없어 그대로 써요.
