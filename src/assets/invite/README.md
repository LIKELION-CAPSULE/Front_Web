# 친구 초대 일러스트

친구 초대 화면(`/credits/invite`, `src/pages/InvitePage.tsx`, `features/credits/components/InviteHeroArt.tsx`)의 3D 일러스트. 화면 시안(2026-11-27)을 기준으로 만들었다. 캡슐이 채워지는 연출과 마스코트가 기뻐하는 연출을 하려고 레이어를 나눠 만들었다.

| 파일 | 크기 | 쓰는 곳 |
|---|---|---|
| `invite-dome.webp` | 840×891 | 히어로 가운데: 빈 자리 10개(2줄×5)가 있는 캡슐 돔 |
| `invite-capsule.webp` | 120×236 | 돔 폴백 그림(WebGL이 없을 때)의 자리에 들어가는 캡슐. 초대 현황 줄은 2026-11-28부터 공용 3D 캡슐 정지 렌더(`src/assets/capsule/capsule-filled.webp`·`capsule-empty.webp`)를 쓴다 |
| `invite-mascot-left.webp` | 400×504 | 히어로 왼쪽 마스코트(윙크, 주먹) |
| `invite-mascot-right.webp` | 400×504 | 히어로 오른쪽 마스코트(눈웃음, 만세) |

돔 자리 중심(돔 그림 기준 %): 가로 29.5 · 40.2 · 50.8 · 61.5 · 72.1, 세로 38.1 · 56.4. 바뀌면 `InviteHeroArt.tsx`의 `SLOT_X`/`SLOT_Y`도 바꾼다.

## 만든 방법
1. Figma AI 이미지 생성(`gpt-image-2.5-flare`)으로 단색 어두운 배경(#141022) 위에 생성. 작업 파일은 Figma 드래프트 "CAPSULE credits illustrations". 두 마스코트는 같은 디자인이 되도록 한 장에 함께 생성한 뒤 나눴다.
2. 배경색을 알파로 바꾸고(color-to-alpha, 노이즈 임계값 0.1) 내용 영역만 잘라 투명 WebP로 저장.

## 생성 프롬프트
- **돔**: Cute glossy 3D render for a game-style app UI, straight front view, centered: a capsule collection display machine. A large clear glass dome sits on a round chunky lavender-grey metallic base. Inside the dome there is a neat grid of exactly 10 EMPTY rounded vertical pill-shaped slots in two rows of five, each slot a dark smoky purple glass well with a soft rim, all slots completely empty. On top of the dome a small round glossy purple knob with a little purple pennant flag on a thin pole. On the front center of the base a round glowing purple button emblem with a small white capsule icon. Soft violet inner glow inside the dome, a glowing purple ring of light on the floor around the base. Soft pastel 3D style, violet and lavender palette. Plain solid very dark navy purple background (#141022), no text, no characters, no other objects.
- **마스코트 2종**: two matching original mascot characters side by side with a wide empty gap between them, full body, same character design. Each is a small chubby round plush-like creature wearing a soft violet purple hooded body suit, round creamy white-lavender face, big shiny dark eyes, pink blush cheeks, tiny stubby arms and legs, a small round bump on top of the hood. LEFT: turned three-quarters to the right, winking, small open happy mouth, pumping one fist up. RIGHT: turned three-quarters to the left, eyes closed in happy arcs, big open smile, both arms raised. (같은 스타일·배경 문구)
- **캡슐**: one single capsule pill standing perfectly upright, straight front view, the top half soft glossy lavender-white, the bottom half vivid glossy violet purple, a thin seam between halves, a crisp white specular highlight on the left side, soft violet glow around it. (같은 스타일·배경 문구)
