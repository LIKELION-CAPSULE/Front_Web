# 앱 서체 배포 기록

## Hahmlet

- 용도: 상세 룸 배너 제목, 리포트·캡슐 카드의 대표 문장. 홈 인사 말풍선·일반 UI·실시간 채팅은 Pretendard다.
- 원본: [Google Fonts Hahmlet 가변 TTF](https://github.com/google/fonts/blob/main/ofl/hahmlet/Hahmlet%5Bwght%5D.ttf), 2026-11-03 수령. 파일 내용은 수정하지 않고 로컬 파일명만 `HahmletVariable.ttf`로 정리했다.
- SHA-256: `892bffe530255770a7435226154a02f519055ff6bedf64254f37f21d15a59279`
- 굵기: 100–900. 서비스에서는 story-title 700, story-quote 500을 사용한다.
- 저작권: Copyright 2020 The Hahmlet Project Authors.
- 라이선스: SIL Open Font License 1.1. [배포 원문](../../../public/licenses/Hahmlet-OFL.txt).
- 로딩: `font-display: swap`. 캡슐 카드의 미리보기와 PNG는 `loadStoryFont()` 결과를 함께 사용하며, 다운로드 실패 시 둘 다 Pretendard로 표시한다.

기존 Pretendard·로고·생성 에셋의 출처는 상위 [에셋 문서](../README.md)를 따른다.
