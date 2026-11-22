# CAPSULE 로고 v2 · 기하 정리와 캡슐 단독 심볼

2026-11-22. 이전 `capsule-logo-2026-11-22/`를 보존하고 별도로 만든 SVG 12종이다.

[Figma v2 가이드](https://www.figma.com/design/HpoEbOqfoDUwPq4zvYa6LL?node-id=2942-632) · 디자인 시스템 페이지 · `CAPSULE · 로고 v2 · 기하 정리 + 캡슐 단독 · 2026.11.22`

## 변경점

- **바탕:** 472×456, 반경 110의 정확한 둥근 사각형. 기존 바운딩 박스 비율을 유지하고 수평·수직 변과 네 모서리 반경을 통일했다.
- **캡슐 몸통:** 길이 364.04, 두께 159.90, 양 끝 반지름 79.95의 stadium. 직선과 정확한 원호를 쓰며 −31.12° 회전한다. 기존 윤곽에 맞춰 치수를 피팅했다.
- **이음매:** 반지름 47.20×78.86의 정확한 타원, 회전 −26.30°. 기존 타원 피팅 중심을 몸통 축으로 약 2.95px 옮겨 타원이 몸통 밖으로 돌출되지 않게 했다. 기울기와 크기는 기존 인상을 유지했다.
- **워드마크:** 기존 글자 아웃라인을 부드럽게 정리하고 연속 접선의 cubic Bézier로 다시 피팅했다. 곡선 구간 360→148개(약 59% 감소). C/A/P/S/U/L/E의 형태·굵기·간격과 A/P 내부 공간을 유지했다. 다른 글꼴로 대체하지 않았다.
- **가로 조합:** 기존 1992×456 viewBox, 워드마크 위치 (528,105), 심볼과 글자 사이 간격 56을 유지했다.
- **캡슐 단독:** 바탕 없는 335×266 viewBox를 추가했다. 심볼 좌표에서 (75,104)를 뺀 동일한 캡슐이다. 컬러는 몸통과 보라 타원, 화이트·블랙은 한 가지 잉크와 투명한 타원 이음매로 구성했다.

원본 래스터에서 생긴 기울어짐과 흔들림을 정리한 버전이며, 원본 벡터를 복구했다고 주장하는 파일은 아니다. 정확한 치수·위치·각도는 [geometry.json](geometry.json)에 기록했다.

## 파일 목록

| 형태 | 컬러 | 화이트 | 블랙 |
| --- | --- | --- | --- |
| 바탕 있는 심볼 | [capsule-symbol-color.svg](capsule-symbol-color.svg) | [capsule-symbol-white.svg](capsule-symbol-white.svg) | [capsule-symbol-black.svg](capsule-symbol-black.svg) |
| 캡슐 단독 | [capsule-glyph-color.svg](capsule-glyph-color.svg) | [capsule-glyph-white.svg](capsule-glyph-white.svg) | [capsule-glyph-black.svg](capsule-glyph-black.svg) |
| 워드마크 | [capsule-wordmark-color.svg](capsule-wordmark-color.svg) | [capsule-wordmark-white.svg](capsule-wordmark-white.svg) | [capsule-wordmark-black.svg](capsule-wordmark-black.svg) |
| 가로 조합 | [capsule-horizontal-color.svg](capsule-horizontal-color.svg) | [capsule-horizontal-white.svg](capsule-horizontal-white.svg) | [capsule-horizontal-black.svg](capsule-horizontal-black.svg) |

검토 자료:

- [트레이스본 / v2 / 내부 윤곽 겹침 비교](previews/trace-vs-v2-overlay.png): 검정 50%=v1, 보라 50%=v2. 원본과 같은 좌표·배율이다.
- [작은 크기와 12개 인라인 SVG 확인](previews/small-size-check.png)
- [메뉴 바 16·18px 확인](previews/menu-bar-16-18.png)
- `previews/symbol-{color,white,black}-{16,32,64}.png`: DPR 1, 실제 16×16 / 32×32 / 64×64 PNG 9개. 원래 비율을 유지하며 정사각 캔버스 안에 배치했다.
- [Figma 가이드 PNG](previews/figma-guide.png)
- [검사 결과](validation.json), [Figma 마스터 ID와 검사 결과](figma.json)

## 색과 내보내기 규칙

기존 SVG 팔레트와 그라데이션 방향을 그대로 사용했다.

| 영역 | 시작 → 끝 | SVG 방향 x1,y1 → x2,y2 |
| --- | --- | --- |
| 바탕 | `#B396FC` → `#7E54F6` | 0,0 → 0.6,1 |
| 몸통 왼쪽 | `#FFFFFF` → `#D4C3FA` | 0,0 → 0.5,1 |
| 몸통 오른쪽 | `#FFFFFF` → `#CAB2F9` | 0,0 → 0.6,1 |
| 이음매 | `#B397FC` → `#8053F2` | 0,0 → 0.6,1 |
| 워드마크 | `#7E54F6` 단색 | 해당 없음 |

화이트는 `#FFFFFF`, 블랙은 `#000000`만 사용한다. 단색 심볼의 캡슐 내부와 단색 단독 캡슐의 이음매는 투명하므로 실제 배경이 비친다.

- SVG 루트는 `viewBox`만 가지며 고정 `width`/`height`가 없다. 표시 크기는 사용하는 쪽에서 지정한다.
- 래스터·외부 링크·스크립트·텍스트·글꼴 의존이 없다. 글자는 모두 경로다.
- 그라데이션 ID는 `capsule-v2-{형태}-{색}-...` 접두사로 12개 파일 사이에서 고유하다. 같은 페이지에 서로 다른 파일을 인라인으로 넣어도 충돌하지 않는다.
- **동일한 SVG를 여러 번 인라인 복제할 때**는 인스턴스별 ID도 추가로 바꾸거나 `<img src="...svg">`를 사용한다. 파일별 접두사는 동일 파일의 중복 인라인까지 자동으로 해결하지 않는다.
- Figma 자체 SVG 내보내기는 width/height와 ID를 다시 생성할 수 있다. 이 내보내기 규칙이 필요한 경우 이 폴더의 정리본을 사용한다.

## 사용 규칙

- 심볼 최소 **폭 16px**, 가로 조합 최소 **폭 100px**: 기존 Figma 시트의 규칙을 이어 썼다.
- 워드마크 최소 **폭 80px**, 캡슐 단독 최소 **폭 24px**: 검토용 제안값이다. 실제 적용 위치에서 확정한다.
- 주변 여백은 **x = H/4**, H는 해당 자산의 보이는 높이. 여백은 viewBox 밖에서 확보한다.
- 메뉴 바처럼 16~18px 높이의 자리에는 심볼 또는 워드마크 단독을 사용한다. 가로 조합은 최소 폭 100px을 확보한다.
- 밝은 배경은 컬러·블랙, 어두운 배경은 화이트를 우선 사용한다. 캡슐 단독 컬러는 기존 보라 `#7E54F6`와 어두운 `#0F0E17`에서도 몸통·이음매가 보이는 것을 확인했다.
- 비율을 늘이거나 각도를 바꾸지 않고, 그라데이션 방향·색·가로 조합 간격을 유지한다.

**캡슐 단독 용도:** 배경 이스터에그, 색 배경 위 장식, 3D 모델링의 정면 투영 윤곽 기준. 앱 아이콘과 서비스 식별에는 바탕 있는 심볼을 우선 사용한다. 3D 모델링에서는 `geometry.json`의 stadium 길이·두께·각도와 타원을 참고한다. 단색 파일의 음각은 이음매 표현이므로 실제 3D 몸통 구멍으로 해석하지 않는다. SVG에는 3D 깊이 정보가 없다.

## 확인 결과와 Figma 구조

- 워드마크를 1464×239로 렌더링하여 v1과 비교: 알파 윤곽 IoU 약 **99.33%**, 채워진 면적 변화 약 **+0.003%**, 경계 차이 최대 약 **1.42px**. 캡슐과 타일은 의도적으로 정확한 도형으로 교체했다.
- 16·32·64px 심볼과 16·18px 높이 워드마크, 100px 폭 가로 조합을 DPR 1에서 확인했다. 외곽 잘림 없이 형태와 이음매가 보인다. 16px에서는 그라데이션 세부 표현이 줄어든다.
- 서로 다른 12종을 한 페이지에 인라인으로 넣고 표시를 확인했다. 구조 검사에서도 ID 충돌, 외부 리소스, 래스터, 글꼴 의존이 없었다.
- Figma는 `CAPSULE Logo v2 / Glyph`, `Symbol`, `Wordmark`, `Horizontal`의 네 세트, 각 `Tone=Color/White/Black`으로 구성했다. 심볼은 Glyph 인스턴스를, 가로 조합은 Symbol/Wordmark 인스턴스를 재사용한다. 단색 심볼은 타일에서 Glyph를 빼는 boolean이다.
- Figma 가이드는 마스터와 연결된 인스턴스·텍스트·벡터로 구성했다. 이미지 fill은 0개이며 12개 마스터 SVG 내보내기에 래스터·텍스트·스크립트가 없음을 확인했다. 기존 primary/white/black 변수와 가이드 텍스트 스타일·간격 변수를 재사용했다.
- 기존 v1 폴더와 Figma 노드는 보존했다. 웹 `src/`, 운영 `Brand` 컴포넌트와 `logo.webp`는 수정하지 않았다.
