# 세계관 배경 (worlds)

메이트 세계관 EP.01~05의 배경 그림이다(2026-11-28). `chaerin/`, `dohyun/`에 세계관마다 두 장씩 있다.

- `ep0N-landscape.webp` 1600×1200: 내 메이트 세계관 카드 썸네일과 상세 창에 쓴다.
- `ep0N-portrait.webp` 1200×1600: 세로 화면용이다. 아직 쓰는 화면은 없다.

인물이 없는 배경이다. 가운데 아래는 Live2D 메이트가 들어갈 자리라 비워 두었다.

생성 정보는 폴더마다 있는 `world-bg-manifest.json`에 있다. Codex 내장 이미지 생성(`image_gen`)을 썼고, 가로판을 먼저 만든 뒤 그 그림을 참고로 세로판을 만들었다. 프롬프트·참고 이미지 해시·캐릭터 자리 범위도 기록했다.

운영 번들에는 들어가지 않는다. `src/features/mates/mate-world-samples.ts`(개발·로컬 mock 전용 기획 예시)에서만 불러오고, 이 모듈은 `import.meta.env.DEV`일 때만 동적으로 불러온다. 운영의 세계관 내용과 그림은 백엔드가 보낸다(`mate-worlds.ts` `worldContentFromServer`). 그 전까지 운영에서는 「준비 중」 자리로 보인다.
