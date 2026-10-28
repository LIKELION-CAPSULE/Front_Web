# 공부 완료 전용 이미지 v1

2026-10-28, 내장 `image_gen`으로 생성했습니다. 기존 개별 공부 이미지의 얼굴·헤어·복장을 참조해 밝게 웃는 새로운 장면을 만들었습니다.

| 친구 | PNG 마스터 | 웹용 WebP | 분위기 |
| --- | --- | --- | --- |
| 채린 | [chaerin-completion-v1.png](chaerin-completion-v1.png) | [chaerin-completion-v1.webp](chaerin-completion-v1.webp) | 노을빛 교실, 살짝 수줍은 웃음과 손인사 |
| 수아 | [sua-completion-v1.png](sua-completion-v1.png) | [sua-completion-v1.webp](sua-completion-v1.webp) | 밝은 창가와 책, 차분하고 따뜻한 웃음 |
| 다희 | [dahee-completion-v1.png](dahee-completion-v1.png) | [dahee-completion-v1.webp](dahee-completion-v1.webp) | 운동장 옆의 맑은 햇빛, 활기찬 웃음과 엄지 인사 |

세 장 모두 1024×1536입니다. 웹 파일은 cwebp 품질 88·method 6으로 인코딩했으며 합계 672,610바이트입니다. [전체 프롬프트와 참조 경로](generation-manifest.json), [크기·파일 크기·SHA-256](asset-metadata.json)을 함께 보관합니다.

`features/reports/completion-artwork.ts`에서 종료 화면·캡슐카드 미리보기·PNG 내보내기에 연결합니다. 세션에 함께한 친구만 선택할 수 있습니다. 홈·공부·휴식·친구 초상화의 기존 이미지는 교체하지 않았으며 다른 친구의 리포트·카드는 기존 장면을 사용합니다.

캡슐카드의 공식 로고는 `assets/brand/logo.webp`, 제목은 `features/rooms/artwork.ts`에 등록된 홈용 투명 제목 에셋을 별도로 합성합니다. 생성 이미지에는 글자나 로고를 굽지 않았습니다.
