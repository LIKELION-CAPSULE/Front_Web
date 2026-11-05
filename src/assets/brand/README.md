# 앱 서체 배포 기록

## Hahmlet

- 용도: 상세 룸 배너 제목, 리포트·캡슐 카드의 대표 문장. 홈 인사 말풍선·일반 UI·실시간 채팅은 Pretendard다.
- 원본: [Google Fonts Hahmlet 가변 TTF](https://github.com/google/fonts/blob/main/ofl/hahmlet/Hahmlet%5Bwght%5D.ttf), 2026-11-03 수령. 파일 내용은 수정하지 않고 로컬 파일명만 `HahmletVariable.ttf`로 정리했다.
- SHA-256: `892bffe530255770a7435226154a02f519055ff6bedf64254f37f21d15a59279`
- 굵기: 100–900. 서비스에서는 story-title 700, story-quote 500을 사용한다.
- 저작권: Copyright 2020 The Hahmlet Project Authors.
- 라이선스: SIL Open Font License 1.1. [배포 원문](../../../public/licenses/Hahmlet-OFL.txt).
- 로딩: `font-display: swap`. 캡슐 카드의 미리보기와 PNG는 `loadStoryFont()` 결과를 함께 사용하며, 다운로드 실패 시 둘 다 Pretendard로 표시한다.

## League Gothic

- 용도: 스터디룸 상세 하단에서 교차하는 영문 장식 글자. 채운 글자와 윤곽선 글자를 함께 쓰며 일반 UI 서체로 확장하지 않는다.
- 원본: [Google Fonts 공식 CSS](https://fonts.googleapis.com/css2?family=League+Gothic&display=swap)가 제공하는 [v13 TTF](https://fonts.gstatic.com/s/leaguegothic/v13/qFdR35CBi4tvBz81xy7WG7ep-BQAY7Krj7feObpH_-am.ttf), 2026-11-06 수령. 원본 내용은 수정하지 않고 `LeagueGothic.ttf`로 자체 호스팅한다.
- SHA-256: `54b176f16fec5bdbddb66153ce5ffe1def3c35b5e3a00b807b6aca687d2dd832`
- 굵기: 400. `font-display: swap`을 쓰며 크기·행 높이는 장식 영역 안에서만 지정한다.
- 저작권: Copyright 2010 The League Gothic Project Authors.
- 라이선스: SIL Open Font License 1.1. [배포 원문](../../../public/licenses/LeagueGothic-OFL.txt).

기존 Pretendard·로고·생성 에셋의 출처는 상위 [에셋 문서](../README.md)를 따른다.
