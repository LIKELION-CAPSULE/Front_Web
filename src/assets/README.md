# CAPSULE 에셋

메인 환영 배너는 새로 생성한 [채린·수아·다희 전용 가로 이미지 3종](welcome-banners/README.md)을 사용합니다. PNG 마스터·웹용 WebP·전체 생성 프롬프트를 함께 보관하며, 첫 방문/이어하기 문구와 버튼은 HTML로 분리합니다.

룸 상세는 배경·인물·좌석을 함께 그린 [상세 전용 완성형 배너 9종](room-detail-banners/README.md)을 사용합니다. 제목·소개는 HTML이며 생성 PNG·웹용 WebP·프롬프트 세트를 따로 보관합니다.

외부 이미지 URL이나 `Landing_Page` 경로를 런타임에 참조하지 않고 이 프로젝트 안의 파일을 사용합니다. `Landing_Page` 원본은 수정하지 않았습니다.

| 위치 | 원본 | 사용처 |
| --- | --- | --- |
| `brand/logo.webp` | `Landing_Page/src/assets/optimized/hero/logo.webp` | 공통 로고 |
| `brand/PretendardVariable.woff2` | `Landing_Page/src/assets/fonts/PretendardVariable.woff2` | 공통 타이포그래피 |
| `brand/FONT-LICENSE.txt` | 같은 폴더의 `LICENSE.txt` | Pretendard 라이선스 |
| `rooms/classroom.webp` | `optimized/hero/poster-1.webp` | 쌀쌀맞은 갸루짝꿍이 나에게만 친절하다! |
| `rooms/night-study.webp` | `optimized/hero/poster-3.webp` | 전교 1등을 이겨라 |
| `rooms/cat-library.webp` | `optimized/hero/poster-5.webp` | 냥냥이가 날 그렇게 쳐다보면 집중할 수가 없잖아!! |
| `rooms/fantasy.webp` | `optimized/hero/poster-4.webp` | 기존 포스터 보관 |
| `auth-posters/lantern.webp` | `optimized/hero/poster-2.webp` | 로그인 포스터 격자 |
| `auth-posters/fantasy.webp` | `optimized/story/room-select/fantasy.webp` | 로그인 포스터 격자 |
| `auth-posters/cat.webp` | `optimized/story/gallery-cat.webp` | 로그인 포스터 격자 |
| `auth-posters/iljin.webp` | `optimized/rooms/poster-8.webp` | 로그인 포스터 격자 |
| `auth-posters/jurassic.webp` | `optimized/story/gallery-jurassic.webp` | 로그인 포스터 격자 |
| `auth-posters/lab.webp` | `optimized/rooms/poster-9.webp` | 로그인 포스터 격자 |
| `auth-posters/joseon.webp` | `optimized/rooms/joseon.webp` | 로그인 포스터 격자 |
| `characters/kang-*.webp` | `optimized/story/study-session/kang-*.webp` | 채린 공부·반응·휴식 |
| `characters/han-*.webp` | `optimized/story/study-session/han-*.webp` | 수아 공부·반응·휴식 |
| `characters/ryu-*.webp` | `optimized/story/study-session/ryu-*.webp` | 다희 공부·반응·휴식 |
| `public/favicon.svg` | `Landing_Page/public/favicon.svg` | 파비콘 |
| `figma/` | 기존 읽기 전용 와이어프레임 분석에서 추출 | 대화·상태 아이콘 및 원본 참고 |

메인 룸 카드와 공부 장면에는 새 [레이어 에셋](scenes/README.md)을 사용합니다. 9종 모두 built-in image_gen으로 [전신 캐릭터/그룹](scenes/layered-v2/README.md)과 [메인화면용 바닥 배경](scenes/seated-v1/README.md)을 만들었습니다. 메인은 책상 없이 앉은 모습을 보여 주며, 공부·리포트는 분리된 책상 전경을 재사용합니다. 각 PNG 마스터·WebP·프롬프트·알파 검사 결과를 `scenes/`에 보관합니다. 원본 포스터 서체를 참조한 [투명 제목 9종](room-titles/README.md)도 `room-titles/`에 따로 보관합니다. `features/rooms/artwork.ts`의 `sceneArtwork.titleImage`로 연결하며 실제 제목 문자열도 별도로 관리합니다. 개발 서버의 `/src/assets/scenes/preview.html`에서 레이어와 화면 비율을 바꿔 볼 수 있습니다.

로그인 격자는 `Landing_Page/src/data/rooms.ts`의 실제 스터디룸 9종을 기준으로 합니다. 위의 `auth-posters` 7개와 기존 `rooms/classroom.webp`, `rooms/night-study.webp`를 사용합니다. 랜딩페이지의 최적화된 WebP를 그대로 복사했으며 런타임 경로는 공유하지 않습니다.

`features/characters/artwork.ts`에서 캐릭터 ID별 이미지, 크롭 위치, 대사, 포인트 색을 관리합니다. 전용 세션 이미지가 없는 도윤·모루는 새 배경·투명 캐릭터 레이어를 합성한 정지 장면을 사용합니다. `shared/ui/AvatarIllustration.tsx`는 코드로 그린 SVG이며 헤어·의상·외모 선택에 반응합니다.
