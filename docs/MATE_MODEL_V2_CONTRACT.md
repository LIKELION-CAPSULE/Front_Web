# 메이트 모델(v2) API 필드 계약 초안

작성일: 2026-11-24 · 상태: **초안(백엔드 미확정)** · 적용 범위: 미리보기(1단계: 내 메이트·메이트 상세·연결 기록), 연결 화면·PIP(2단계)

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
| `reactionsUrl` | 아니요 | 반응 표(`capsule-reactions` v2+). 앱은 서버가 보낸 표정을 쓰므로 지금은 불러오기만 하고 호출하지 않음(아래 "반응") |
| `scale`, `offsetX`, `offsetY` | 아니요 | Cubism 전용 배치값. v2는 무시(구도는 프런트가 계산) |

## 연결 화면·PIP (2단계): 세션 시작·재개 응답의 `character`

`POST /sessions`, `POST /sessions/{id}/resume` 응답의 `character`(`Figure`)에 **같은 필드**를 넣어 주세요. 프런트는 원본 응답에서 바로 읽어요(`SessionFigure`, `src/features/live2d/session-model.ts`).

```jsonc
"character": {
  "id": 3, "name": "채린", "profileImageUrl": "…",
  "format": "aliving2d",
  "modelJsonUrl": "https://api.example.com/assets/chaerin-v2/model/model.json",
  "engineUrl": "https://api.example.com/assets/aliving2d/v4/engine.js",
  "playerUrl": "https://api.example.com/assets/aliving2d/v4/player.js",     // 선택
  "reactionsUrl": "https://api.example.com/assets/aliving2d/v4/reactions.json" // 선택
}
```

| 상황 | 연결 화면 동작 |
|---|---|
| `modelJsonUrl` 없음 | 지금처럼 연결 진입을 막고 오류·다시 시도(기존 계약 유지) |
| Cubism(`.model3.json`) | 기존 Cubism 화면(호환 경로) |
| v2 + 허용된 `engineUrl` | v2 모델. 준비가 끝나야 화면 진입(최대 20초) |
| v2인데 `engineUrl` 없음·출처 불허 | 엔진을 받지 않고 **정지 이미지로 연결 진행**(말풍선 반응만) |
| v2 엔진·모델 로드 실패·20초 초과 | **정지 이미지로 연결 진행**(연결 자체는 막지 않음) |

### 표정·반응·말하기

- **표정**: 이벤트 응답(`EventResponse.characters[].expression`)·반응 응답(`ReactionResponse.characters[].expression`)·대화 응답(`MessageResponse.expression`)의 `ExpressionRef`를 그대로 써요. v2에서는 `name`(한국어 라벨, 예: `삐짐`)이나 v2 이름(`sulky`)을 읽고, `file`이 옛 Cubism 파일(`files/004.exp3.json`)이면 대응표로 바꿔요. 둘 다 없으면 표정을 바꾸지 않아요. Cubism 모델에는 지금처럼 `file`만 써요.
- **반응(트리거)**: 앱은 서버가 반응마다 보내 주는 표정·대사를 그대로 그려요. 엔진의 반응표(`react(trigger, intensity)`, `reactionsUrl`)는 **앱에서 호출하지 않아요**(서버 결정과 이중으로 표정을 바꾸지 않도록). 스테이지에 `react()`는 구현해 두었으니 서버가 표정을 보내지 않기로 바뀌면 그때 연결해요.
- **말하기**: 대사(대화 답장, 반응 대사)가 화면에 나오면 입 모양 모션(`talk(ms)`)을 재생해요. 음성이 아직 없어 말풍선 타이핑 속도(`speechPace`)로 길이를 계산해요(0.6~8초). 음성(TTS)이 생기면 오디오 길이로 바꿀 예정이에요.
- **우선순위**: 표정 스케줄러 규칙은 그대로예요(상태 변화 > 대사 > 몸짓). 예: 집중(상태) 표정이 유지되는 동안 온 대화 답장은 표정을 바꾸지 않고 입만 움직여요.

### 구도·시선·움직임 줄이기

- 구도: 통화 타일과 PIP 모두 카드 정지 이미지(`chaerin-v2-card`, 머리→가슴)를 `contain`·하단 정렬로 놓은 자리와 같게 그려요(`computeCallView`). 그래서 PIP로 옮겼을 때 본 화면에 남는 정지 이미지, 실패 시 정지 이미지, 살아 있는 모델의 위치가 같아요. `scale`·`offsetX`·`offsetY`는 v2에서 무시해요.
- 시선: 계정 설정의 「시선 따라오기」(기본 켜짐)가 켜져 있으면 통화 중에도 메이트가 마우스 커서 쪽을 봐요(카메라를 꺼도 됨). `AlivingSessionStage.setTracking`이 통화 화면 창(PIP로 옮기면 PIP 창)의 포인터를 `lookAt`으로 옮기며, 부드럽게 따라가고(감쇠) 고개는 엔진 범위의 75%까지만 돌리며, 포인터가 3.5초 멈추거나 창 밖으로 나가면 천천히 정면으로 돌아와요. 끄거나 움직임 줄이기면 정면이에요. 시선만 움직이고 표정·말하기·반응은 그대로예요. 웹캠 얼굴 방향을 모델에 옮기는 기능(`track()`)은 아직 없어요.
- PIP: 같은 모델(캔버스·WebGL·플레이어)을 PIP 창으로 옮기고 돌아올 때 다시 옮겨요. 다시 불러오지 않고, PIP 창의 프레임으로 계속 움직여요.
- 움직임 줄이기: 표정은 바뀌고, 입 모양 모션과 커서 추적은 꺼요.

## 규칙

- **엔진 스크립트 출처 제한**: `engineUrl`·`playerUrl`·`reactionsUrl`은 웹 페이지와 같은 출처이거나 `VITE_API_BASE_URL`의 출처여야 해요(`isAllowedEngineUrl`). 다른 CDN 출처면 정지 이미지로 대체해요. 엔진을 별도 CDN에 둘 계획이면 허용 목록 확장이 필요해요.
- `model.json`·파츠 PNG는 플레이어가 `fetch`로 읽으므로 다른 출처라면 CORS 허용이 필요해요.
- 값이 문자열이 아니거나 http(s)가 아닌 v2 필드는 조용히 버리고 정지 이미지로 대체해요(상세 전체를 실패시키지 않음). `modelJsonUrl` 자체가 잘못되면 기존처럼 상세가 502 오류예요.
- 엔진 파일은 **버전이 들어간 고정 주소**로 주세요(`docs/DESIGN_CHANGE_NOTICE_BACKEND.md` §11).
- 표정: v2 플레이어는 `model.json`의 `expressions[].name`(영문) 또는 `label`(한글)을 받아요. 해금 표정 목록(`expressionFile`)이 옛 Cubism 파일명이어도 프런트가 `src/features/mate-render/expression-map.ts`로 바꿔요. 새로 정한다면 v2 이름(`happy`) 또는 라벨(`행복`)을 보내 주세요.

## 미리보기 대체(폴백) 순서

1. 움직임 줄이기 설정 → 정지 이미지(엔진 요청 없음)
2. `model` 없음 / `modelJsonUrl` 없음 → 정지 이미지
3. v2인데 `engineUrl` 없음·출처 불허 → 정지 이미지
4. 엔진·모델 로드 실패 → 정지 이미지 + "다시 시도"
5. 그 밖의 모델 URL(Cubism 등) → 기존 Cubism 미리보기(호환 경로)

정지 이미지: 채린은 `src/assets/characters/chaerin-v2/chaerin-v2-hero.webp`, 다른 메이트는 서버 이미지.

## 서도현 (두 번째 메이트, 2026-11-25)

모델 묶음 이름은 `seojin`, 화면 이름은 서도현, 프런트 카탈로그 id는 `dohyun`이에요. 서버 캐릭터 이름 「서도현」(또는 「도현」)으로 연결돼요(`catalog.ts`의 `sourceNames`).

| 필드 | 값(서버가 보낼 것) |
|---|---|
| `format` | `aliving2d` |
| `modelJsonUrl` | 서버 저장소의 `seojin/model/model.json`(같은 폴더에 `parts/*.png`) |
| `engineUrl` / `playerUrl` | 채린 v2와 같은 `engine.js` / `player.js`(바이트 단위 동일. 같은 주소를 써도 돼요) |
| `reactionsUrl` | `reactions.default.json`(채린 v2와 동일) |
| 표정 | `expressions[].name` 8개가 채린 v2와 같아요: sulky, happy, contempt, yawn, angry, laugh, shy, focus. 한국어 라벨 대응도 같아요(`expression-map.ts`) |
| 모션 | idle, talk |
| 의상(`outfits`) | 없음. README에는 `setOutfit` 사용법이 있지만 이 모델의 model.json에는 `outfits`가 없어요 |
| 연령 등급 | 전연령(프런트 `ageRating: 'all'`). 2026-11-25 사용자 결정으로 15세 이용가에서 바꿨어요. 서버 연령 등급도 전연령으로 맞춰 주세요 |

- 해금 표정 4개(페르소나): 기본(무표정) → 기본 얼굴, 옅은 미소 → `laugh`(`happy`는 눈을 감고 크게 웃는 얼굴), 어이없음(장난) → `contempt`, 멋쩍음 → `shy`. 서버 해금 표에 이 매핑을 써 주세요.
- 정지 이미지(카드·히어로·아바타·전신, 표정 썸네일·흉상)는 모델 렌더 임시본이에요(`src/assets/characters/seojin/`, 채린 v2와 같은 뷰). 정식 일러스트가 오면 교체해요. 서버 `profileImageUrl`도 같은 카드 구도(머리→가슴, 4:3)면 맞아요.
- 시스템 프롬프트·세계관·키워드북은 서버 페르소나예요. 프런트에는 표시 문구(소개·역할·시작 상황·첫 대사)와 로컬 mock 대사만 있어요.

## 채린 모델 v3 (2026-11-25)

- 채린 모델 v3(상의 변경) — 백엔드에 v3 묶음 전달 필요. 같은 형식·파츠·표정·의상·엔진이고 상의·목 그림과 `model.json`만 바뀌었어요. 앱의 채린 정지 이미지(`src/assets/characters/chaerin-v2/`, 폴더 이름 유지)는 v3로 다시 렌더했으니, 운영 `modelJsonUrl`도 v3를 가리켜야 Live2D와 정지 이미지의 옷이 같아요.

## 로컬 mock

- 미리보기: `src/features/local-demo/ports.ts`가 캐릭터 id에 맞는 `LOCAL_V2_MODELS`(`/__local-assets/chaerin-v3/...`, `/__local-assets/seojin/...`)를 위 형태로 돌려줘요.
- 연결: `src/features/local-demo/transport.ts`가 세션 `character`에 같은 필드를 넣고, 이벤트·반응·대화 응답에 백엔드 시드와 같은 한국어 표정 이름(`집중`, `삐짐`, `웃음` …)과 짧은 대사를 넣어요.
- dev 서버(`server/local-assets.ts`)에서만 제공되며 운영 번들에는 `__local-assets` 경로가 없어요(빌드 결과 검색으로 확인).
