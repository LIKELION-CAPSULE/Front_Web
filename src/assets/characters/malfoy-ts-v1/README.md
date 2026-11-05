# 말포이 TS · 밤의 호그와트 도서관

2026-11-05 · 내장 `image_gen.imagegen`으로 생성한 새 캐릭터 이미지 세트입니다. 사용자 지정 룸 제목은 **밤의 호그와트 도서관**입니다. 채린의 현재 정적 이미지 역할을 기준으로 PNG 마스터 14개와 WebP 15개(제목 크롭 포함)를 보관합니다.

긴 가운데 가르마 백금발, 녹색 눈, 은색 링 귀걸이, 초록/은색 타이와 에메랄드 안감의 검정 로브를 고정합니다. 호수의 녹청색 빛·고딕 석조 아치·짙은 목재 서가·작은 독서등으로 슬리데린 분위기의 야간 도서관을 표현합니다.

| 역할 | PNG 마스터 | 웹 파일 |
| --- | --- | --- |
| 기준 전신 · 투명 | `masters/malfoy-ts-fullbody-v1.png` | `web/malfoy-ts-fullbody-v1.webp` |
| 홈 카드 전경 · 투명 | `masters/malfoy-ts-home-subject-v1.png` | `web/malfoy-ts-home-subject-v1.webp` |
| 공부 상태 | `masters/malfoy-ts-study-v1.png` | `web/malfoy-ts-study-v1.webp` |
| 반응 상태 | `masters/malfoy-ts-reaction-v1.png` | `web/malfoy-ts-reaction-v1.webp` |
| 휴식·호감 상태 | `masters/malfoy-ts-affection-v1.png` | `web/malfoy-ts-affection-v1.webp` |
| 홈 환영 배너 | `masters/malfoy-ts-welcome-banner-v1.png` | `web/malfoy-ts-welcome-banner-v1.webp` |
| 룸 상세 배너 | `masters/hogwarts-night-detail-banner-v1.png` | `web/hogwarts-night-detail-banner-v1.webp` |
| 로그인·룸 포스터 | `masters/hogwarts-night-poster-v1.png` | `web/hogwarts-night-poster-v1.webp` |
| 공부 장면 배경 | `masters/hogwarts-night-background-v1.png` | `web/hogwarts-night-background-v1.webp` |
| 홈 바닥 배경 | `masters/hogwarts-night-seated-background-v1.png` | `web/hogwarts-night-seated-background-v1.webp` |
| 완료·캡슐 카드 세로 원본 | `masters/malfoy-ts-completion-v1.png` | `web/malfoy-ts-completion-v1.webp` |
| 최신 리포트 v3 · 빈 배경 | `masters/hogwarts-night-completion-background-v3.png` | `web/hogwarts-night-completion-background-v3.webp` |
| 최신 리포트 v3 · 투명 인물 | `masters/malfoy-ts-completion-character-v3.png` | `web/malfoy-ts-completion-character-v3.webp` |
| 투명 룸 제목 원본 | `masters/hogwarts-night-title-v1.png` | `web/hogwarts-night-title-v1.webp` |
| 투명 룸 제목 · 화면용 크롭 | 위 PNG를 알파 경계 기준으로 크롭 | `web/hogwarts-night-title-v1-trimmed.webp` |

## 역할 연결

`asset-map.json`에서 캐릭터·룸·배너·포스터·제목·리포트 경로를 확인할 수 있습니다. 파일 경로는 이 폴더 기준입니다.

- 공부 화면: `scene.background` + `scene.subject`.
- 홈 카드: `home.background` + `home.subject`.
- 상태 전환: `characterArtwork.study`, `reaction`, `affection`.
- 최신 종료 리포트: `completion.backgroundSrc` + 투명 `completion.foregroundSrc`.
- 캡슐 카드 및 PNG 저장: 배경을 포함한 세로 완성형 `completion.src`.
- 룸 제목: 화면에서는 `scene.titleImage`의 크롭 WebP를 사용합니다. 글자 내용은 **밤의 호그와트 도서관**입니다.

배너에는 글자·버튼을 굽지 않고 HTML로 별도 표시합니다. 포스터에만 같은 룸 제목을 포함합니다. 투명 인물과 제목은 알파를 보존하고, 가로세로 비율을 유지해서 표시하세요.

## 생성 기록과 검증

`generation-manifest.json`에 전체 프롬프트·입력 이미지의 역할·실제 생성 결과를, `asset-metadata.json`에 실제 해상도·파일 크기·SHA-256·투명도 검사를 기록합니다. `crop-manifest.json`은 제목의 결정적 크롭 범위를 기록합니다. `REFERENCES.md`는 검색한 시각 레퍼런스와 채택한 요소를 설명합니다.

파일의 `malfoy-ts` / `hogwarts-night-library`는 신규 에셋 식별자입니다. 프런트 캐릭터 등록과 백엔드 숫자 ID 연결 시 이 역할 매핑을 사용합니다.

피그마: [말포이 TS · 밤의 호그와트 도서관 · 최신 에셋 세트](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL?node-id=1692-10658)

검증 완료: 이미지 29개 디코딩·원본 바이트·해시·해상도 일치, 투명 원본 4개 및 WebP 알파 일치, 역할 매핑 17개 경로 존재, 배너 3:1·인물 2:3 비율 확인. 피그마 미리보기 15개와 리포트 조합 레이어 2개의 이미지 채움 및 전체 섹션 시각 검수를 완료했습니다. 피그마 개별 이미지 ID·원본 해상도 PNG 내보내기 배율은 `figma-index.json`에 기록합니다.
