# 로컬 확인용 모델

로컬 더미 모드(`VITE_DATA_SOURCE=mock`)의 개발 서버에서 채린 Live2D를 실제로 움직이게 하는 모델 파일을 두는 곳이다. 파일이 없으면 앱은 정지 이미지로 대체한다.

| 폴더 | 내용 | 쓰는 화면 (2026-11-24) |
|---|---|---|
| `chaerin/` | 옛 채린. Cubism(`model.model3.json`, `files/000.moc3`, 텍스처, physics/CDI, 표정 004~011) | 연결 화면, PIP. v2로 옮기는 중 |
| `chaerin-v3/` | **현재 채린**(2026-11-25). Aliving2D 자체 형식(`model/model.json`, `model/parts/*.png`)과 엔진(`engine/engine.js`, `player.js`, `reactions.default.json`). v2와 파츠·표정·의상·모션·엔진이 같고 **상의·목 그림**(`002_topwear`, `003_topwear@oc4ad1`, `004_neck`, `005_neck@oc4ad1`)과 `model.json`만 다름 | 로그인 「졸던 채린 깨우기」, 홈·내 메이트·메이트 상세·연결·PIP·연결 기록 |
| `chaerin-v2/` | 이전 채린(옛 상의). v3와 같은 형식 | 앱은 더 쓰지 않음. 개발 서버는 비교용으로 계속 제공(`/__local-assets/chaerin-v2`) |
| `seojin/` | 서도현(두 번째 메이트, 화면 이름 서도현·id `dohyun`). Aliving2D(`model/model.json`, `model/parts/*.png`)와 엔진(`engine/engine.js`, `player.js`, `reactions.default.json`, 채린 v2와 바이트 동일) | 홈·메이트 상세·내 메이트·연결·PIP·연결 기록 (2026-11-25) |
| `avatars/` | 사용자 아바타용 Live2D 무료 샘플 6종(Cubism). 각 모델의 `runtime/` 폴더만 제공: `hiyori_ko/hiyori_pro`, `haru_greeter_ja`, `natori_ko`, `chitose_ja`, `epsilon_ja/epsilon_pro`, `wanko_ja`. `thumbnails/*.png`는 `scripts/capture-avatar-thumbnails.mjs`가 만든다(없으면 실루엣) | 가입 1단계 아바타 고르기, 계정 설정 프로필 탭 (2026-11-25) |

- 개발 서버 플러그인 `server/local-assets.ts`가 `/__local-assets/chaerin/*`, `/__local-assets/chaerin-v3/*`, `/__local-assets/chaerin-v2/*`, `/__local-assets/seojin/*`, `/__local-assets/avatars/*`에서 **허용 목록에 있는 런타임 파일만** 제공한다. `avatars`는 고른 변형의 `runtime/` 안 json·moc3·png와 `thumbnails/*.png`만 열고, cmo3·can3·psd 같은 원본 작업 파일은 열지 않는다. `public/` 밖에 두므로 운영 빌드에는 들어가지 않는다.
- 코드에서 쓰는 주소: `src/features/local-demo/local-asset-urls.ts`의 `LOCAL_MODEL_URL`, `LOCAL_V2_*_URL`, 아바타는 `src/features/local-demo/local-avatars.ts`의 `LOCAL_AVATARS`(구도 값 포함)
- 채린 정지 이미지 다시 만들기(저장소의 `src/assets/characters/chaerin-v2/`, 폴더 이름은 그대로 두고 v3로 렌더): `PLAYWRIGHT_MODULE=… node scripts/render-mate-stills.mjs http://127.0.0.1:5231 chaerin-v3 <임시 폴더>` 뒤 `chaerin-v3-*.webp`를 `chaerin-v2-*.webp` 이름으로 바꿔 넣기(같은 크기·구도, 품질 0.86/0.92). 졸기 정지 이미지는 [README](../src/assets/characters/chaerin-v2/README.md#로그인-조는-모습-chaerin-v2-dozewebp)
- 서도현 정지 이미지 다시 만들기(저장소의 `src/assets/characters/seojin/`): `PLAYWRIGHT_MODULE=… node scripts/render-mate-stills.mjs http://127.0.0.1:5231 seojin src/assets/characters/seojin`
- 아바타 썸네일 만들기: 개발 서버(mock)를 띄운 뒤 `PLAYWRIGHT_MODULE=… node scripts/capture-avatar-thumbnails.mjs http://127.0.0.1:5231`. 결과는 `local-assets/avatars/thumbnails/<key>.png`(머리·어깨, 투명 PNG)
- 아바타 모델은 Live2D 「무상 제공 마테리얼」이다. 표기 의무와 개별 조건은 [상업 이용 기록](../docs/REFERENCE_COMMERCIAL_USE.md)을 따른다. 모델 색·모양을 바꾸지 않는다.
- 운영에서는 이 파일을 쓰지 않는다. 모델 URL은 백엔드 API로 받는다([계약 초안](../docs/MATE_MODEL_V2_CONTRACT.md)).

## 받는 방법
팀 공유 드라이브의 **`capsule-local-assets-YYYY-MM-DD.zip`** 묶음을 받아 압축을 풀고 안의 `README.md`를 따른다. 요약하면 다음과 같다.

```bash
./install.sh <Front_Web 경로>   # local-assets/chaerin, chaerin-v2 복사와 필수 파일 확인
npm run dev                     # VITE_DATA_SOURCE=mock
# http://localhost:3000/__local-assets/chaerin-v3/model/model.json 이 열리면 성공
# (chaerin-v3는 2026-11-25 묶음부터. 없으면 채린은 정지 이미지로 나옴)
```

## 저장소에 올리지 않음
이 저장소는 **공개 저장소**이고 모델·엔진은 팀 내부 라이선스 자산이다. 이 README를 빼고 `local-assets/*`는 Git에 올리지 않는다(`.gitignore`). 묶음도 비공개 경로로만 공유한다.
