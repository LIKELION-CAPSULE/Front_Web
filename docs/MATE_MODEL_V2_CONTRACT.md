# 메이트 모델(v2) API 필드 계약 초안

작성일: 2026-11-24 · 상태: **초안(백엔드 미확정)** · 적용 범위: 내 메이트·메이트 상세·연결 기록 미리보기(1단계)

연결 화면·PIP(`SessionModel`)는 아직 Cubism 경로이며 2단계에서 같은 필드로 옮길 예정이에요.

## 프런트가 읽는 위치

메이트 상세 응답(`MateContentPort.load` → `checkedMateDetail`)의 `model` 객체예요.

```jsonc
{
  "characterId": 3,
  "model": {
    "format": "aliving2d",                                         // 선택. 'aliving2d' | 'cubism'
    "modelJsonUrl": "https://api.example.com/assets/chaerin-v2/model/model.json",
    "engineUrl": "https://api.example.com/assets/aliving2d/engine.js",      // v2면 필수
    "playerUrl": "https://api.example.com/assets/aliving2d/player.js",      // 선택
    "reactionsUrl": "https://api.example.com/assets/aliving2d/reactions.json" // 선택
  }
}
```

| 필드 | 필수 | 의미 |
|---|---|---|
| `modelJsonUrl` | 예 | v2: Aliving2D `model.json`(파츠 PNG는 같은 폴더 기준 상대 경로). Cubism: `*.model3.json` |
| `format` | 아니요 | 형식 힌트. 없으면 URL 끝(`/model.json` → v2, `.model3.json` → Cubism)으로 판정. 해시 붙은 CDN 파일명이면 꼭 보내 주세요 |
| `engineUrl` | v2면 예 | `engine.js`. 없으면 Live2D를 띄우지 않고 v2 정지 이미지를 보여요 |
| `playerUrl` | 아니요 | `player.js`. 없으면 `engineUrl`과 같은 폴더의 `player.js` |
| `reactionsUrl` | 아니요 | 반응 표(`capsule-reactions` v2+). 미리보기는 쓰지 않지만 2단계 연결 화면에서 사용 |
| `scale`, `offsetX`, `offsetY` | 아니요 | Cubism 전용 배치값. v2는 무시(구도는 프런트가 계산) |

## 규칙

- **엔진 스크립트 출처 제한**: `engineUrl`·`playerUrl`·`reactionsUrl`은 웹 페이지와 같은 출처이거나 `VITE_API_BASE_URL`의 출처여야 해요(`isAllowedEngineUrl`). 다른 CDN 출처면 정지 이미지로 대체해요. 엔진을 별도 CDN에 둘 계획이면 허용 목록 확장이 필요해요.
- `model.json`·파츠 PNG는 플레이어가 `fetch`로 읽으므로 다른 출처라면 CORS 허용이 필요해요.
- 값이 문자열이 아니거나 http(s)가 아닌 v2 필드는 조용히 버리고 정지 이미지로 대체해요(상세 전체를 실패시키지 않음). `modelJsonUrl` 자체가 잘못되면 기존처럼 상세가 502 오류예요.
- 표정: v2 플레이어는 `model.json`의 `expressions[].name`(영문) 또는 `label`(한글)을 받아요. 해금 표정 목록(`expressionFile`)이 옛 Cubism 파일명이어도 프런트가 `src/features/mate-render/expression-map.ts`로 바꿔요. 새로 정한다면 v2 이름(`happy`) 또는 라벨(`행복`)을 보내 주세요.

## 대체(폴백) 순서

1. 움직임 줄이기 설정 → 정지 이미지(엔진 요청 없음)
2. `model` 없음 / `modelJsonUrl` 없음 → 정지 이미지
3. v2인데 `engineUrl` 없음·출처 불허 → 정지 이미지
4. 엔진·모델 로드 실패 → 정지 이미지 + "다시 시도"
5. 그 밖의 모델 URL(Cubism 등) → 기존 Cubism 미리보기(호환 경로)

정지 이미지: 채린은 `src/assets/characters/chaerin-v2/chaerin-v2-hero.webp`, 다른 메이트는 서버 이미지.

## 로컬 mock

`src/features/local-demo/ports.ts`가 `LOCAL_V2_*_URL`(`/__local-assets/chaerin-v2/...`)을 위 형태로 돌려줘요. dev 서버(`server/local-assets.ts`)에서만 제공되며 운영 번들의 미리보기 경로에는 들어가지 않아요.
