# 종료 리포트 분리 레이어 v3

2026-11-05, 내장 `image_gen`으로 기존 [전체 화면 장면 v2](../completion-scene-v2/chaerin-completion-scene-v2.webp)를 편집했습니다. 배경에서 인물을 제거하고, 같은 채린을 실제 알파가 있는 투명 전경으로 분리했습니다. PNG 마스터와 웹용 WebP를 모두 보관합니다.

| 에셋 | PNG 마스터 | 웹용 WebP | 크기·용량 |
|---|---|---|---|
| 빈 노을 교실 | [PNG](classroom-completion-background-v3.png) | [WebP](classroom-completion-background-v3.webp) | 1672×941 · WebP 176,768바이트 |
| 투명 채린 | [PNG](chaerin-completion-character-v3.png) | [WebP](chaerin-completion-character-v3.webp) | 1024×1536 · WebP 363,134바이트 |

[최종 프롬프트 2개·참조·생성 방식](generation-manifest.json), [파일 크기·SHA-256·투명도 검사](asset-metadata.json)를 함께 보관합니다. 교실은 cwebp 품질 88·method 6, 채린은 품질 90·alpha_q 100·method 6으로 인코딩했습니다. 브라우저에서 디코딩한 채린 WebP는 알파 0~254, 완전 투명 466,664픽셀을 확인했습니다. 모발의 부드러운 경계와 원래의 노을 림 라이트를 유지합니다.

`completion-artwork.ts`의 `backgroundSrc`·`foregroundSrc`로 연결합니다. 배경은 전체 화면에 채우고, 인물은 비율을 유지해 별도 영역에 표시합니다. 인물과 대화창은 같은 `.report-companion`에서 가로 중심을 공유합니다. 모바일에서도 동일한 분리 레이어를 사용합니다. 캡슐 카드 미리보기와 PNG 내보내기는 기존 세로 완료 이미지를 유지합니다.
