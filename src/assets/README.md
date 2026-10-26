# CAPSULE 에셋

외부 이미지 URL이나 `Landing_Page` 경로를 런타임에 참조하지 않고 이 프로젝트 안의 파일을 사용합니다. `Landing_Page` 원본은 수정하지 않았습니다.

| 위치 | 원본 | 사용처 |
| --- | --- | --- |
| `brand/logo.webp` | `Landing_Page/src/assets/optimized/hero/logo.webp` | 공통 로고 |
| `brand/PretendardVariable.woff2` | `Landing_Page/src/assets/fonts/PretendardVariable.woff2` | 공통 타이포그래피 |
| `brand/FONT-LICENSE.txt` | 같은 폴더의 `LICENSE.txt` | Pretendard 라이선스 |
| `rooms/classroom.webp` | `optimized/hero/poster-1.webp` | 방과 후, 너와 나 |
| `rooms/night-study.webp` | `optimized/hero/poster-3.webp` | 전교 1등을 이겨라 |
| `rooms/cat-library.webp` | `optimized/hero/poster-5.webp` | 냥냥 독서실 |
| `rooms/fantasy.webp` | `optimized/hero/poster-4.webp` | 로그인 포스터 월 |
| `characters/kang-*.webp` | `optimized/story/study-session/kang-*.webp` | 채린 공부·반응·휴식 |
| `characters/han-*.webp` | `optimized/story/study-session/han-*.webp` | 수아 공부·반응·휴식 |
| `characters/ryu-*.webp` | `optimized/story/study-session/ryu-*.webp` | 다희 공부·반응·휴식 |
| `public/favicon.svg` | `Landing_Page/public/favicon.svg` | 파비콘 |
| `figma/` | 기존 읽기 전용 와이어프레임 분석에서 추출 | 대화·상태 아이콘 및 원본 참고 |

포스터를 넓은 슬롯에 사용할 때는 새 [레이어 에셋](scenes/README.md)을 사용합니다. 배경 3개와 투명 캐릭터 3개를 built-in image_gen으로 생성했으며, 각 PNG 마스터·WebP·프롬프트를 `scenes/`에 보관합니다. 제목은 `features/rooms/artwork.ts`에서 별도 DOM 텍스트로 관리합니다.

`features/characters/artwork.ts`에서 캐릭터 ID별 이미지, 크롭 위치, 대사, 포인트 색을 관리합니다. 전용 세션 이미지가 없는 도윤·모루는 새 배경·투명 캐릭터 레이어를 합성한 정지 장면을 사용합니다. `shared/ui/AvatarIllustration.tsx`는 코드로 그린 SVG이며 헤어·의상·외모 선택에 반응합니다.
