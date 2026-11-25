# 내 크레딧 일러스트

내 크레딧 화면(`/credits`, `src/pages/CreditsPage.tsx`)의 3D 일러스트 3종. 화면 시안(2026-11-25)의 그림을 기준으로 만들었다.

| 파일 | 크기 | 쓰는 곳 |
|---|---|---|
| `credit-hero.webp` | 947×691 | 맨 위 크레딧 카드 오른쪽: 열린 캡슐, 별, 코인 4개, 궤도 링 |
| `credit-attendance.webp` | 480×431 | 출석 보상 카드: 체크 표시 달력 |
| `credit-invite.webp` | 480×471 | 친구 초대 카드: 선물상자 |

## 만든 방법
1. Figma AI 이미지 생성(`gpt-image-2.5-flare`)으로 단색 어두운 배경(#141022) 위에 생성. 작업 파일은 Figma 드래프트 "CAPSULE credits illustrations".
2. 배경색을 알파로 바꾸고(color-to-alpha, 노이즈 임계값 0.1) 내용 영역만 잘라 투명 WebP(품질 90)로 저장.

## 생성 프롬프트
- **캡슐**: Cute glossy 3D render for a game-style app UI, centered: a translucent purple capsule pill split open, the top half floating tilted up and to the right above the bottom clear glass half, a shiny golden star and a few soft purple round orbs inside the bottom half, soft violet inner glow. A thin glowing purple elliptical orbit ring sweeps around the capsule. Floating around at different depths: two lavender-purple coins with an embossed star and two shiny gold coins with an embossed star, a few small white four-point sparkles. Soft pastel 3D style, violet and lavender palette with gold accents. Plain solid very dark navy purple background (#141022), no text.
- **달력**: a rounded chunky desk calendar tilted slightly to the right, soft lavender-white body, purple top band with two glossy purple binder rings, a big glossy purple check mark on the face, two small white four-point sparkles. (같은 스타일·배경 문구)
- **선물상자**: a rounded chunky gift box seen slightly from above, soft lavender-white box, purple satin ribbon, a big glossy purple bow on top, three short gold spark lines above the top right corner, two small white four-point sparkles. (같은 스타일·배경 문구)
