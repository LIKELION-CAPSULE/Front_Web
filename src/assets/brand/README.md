# 앱 서체 배포 기록

## Hahmlet

- 용도: 연결 기록 캡슐 카드·캡슐 병의 대표 문장(`--font-story`). 홈 인사 말풍선·일반 UI·실시간 채팅은 Pretendard다.
- 원본: [Google Fonts Hahmlet 가변 TTF](https://github.com/google/fonts/blob/main/ofl/hahmlet/Hahmlet%5Bwght%5D.ttf), 2026-11-03 수령(원본 TTF SHA-256 `892bffe530255770a7435226154a02f519055ff6bedf64254f37f21d15a59279`, 3,559,144바이트).
- 배포 파일: `HahmletVariable.woff2`(696,968바이트, SHA-256 `7ad51babea6e64d1874edb42e3293851f33b6fecda621642423a6d4c7bb0fbdb`). 2026-11-26 위 원본 TTF를 fontTools 4.55.3(`fonttools ttLib.woff2 compress`, brotli 1.0.9)으로 WOFF2 압축만 했다. 글자 범위를 줄이지 않았고(서브셋 없음) 가변 축 `wght` 100–900을 유지한다. 다시 풀어 비교하면 3,998개 글리프 윤곽·cmap·나머지 테이블이 원본과 같고, WOFF2 형식이 다루지 않는 디지털 서명 테이블(`DSIG`)만 빠진다.
- 굵기: 100–900. 서비스에서는 story-title 700, story-quote 500을 사용한다.
- 저작권: Copyright 2020 The Hahmlet Project Authors.
- 라이선스: SIL Open Font License 1.1. [배포 원문](../../../public/licenses/Hahmlet-OFL.txt).
- 로딩: `font-display: swap`. 다운로드 실패 시 Pretendard로 표시한다.

(League Gothic `LeagueGothic.ttf`는 쓰던 스터디룸 상세 화면과 함께 2026-11-25 정리에서 삭제했다.)
