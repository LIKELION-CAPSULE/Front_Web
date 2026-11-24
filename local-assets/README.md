# 로컬 확인용 모델

로컬 더미 모드(`VITE_DATA_SOURCE=mock`)의 개발 서버에서 채린 Live2D를 실제로 움직이게 하는 모델 파일을 두는 곳이다. 파일이 없으면 앱은 정지 이미지로 대체한다.

| 폴더 | 내용 | 쓰는 화면 (2026-11-24) |
|---|---|---|
| `chaerin/` | 옛 채린. Cubism(`model.model3.json`, `files/000.moc3`, 텍스처, physics/CDI, 표정 004~011) | 연결 화면, PIP. v2로 옮기는 중 |
| `chaerin-v2/` | 새 채린. Aliving2D 자체 형식(`model/model.json`, `model/parts/*.png`)과 엔진(`engine/engine.js`, `player.js`, `reactions.default.json`) | 로그인 「채린 깨우기」, 내 메이트·메이트 상세·연결 기록 미리보기 |

- 개발 서버 플러그인 `server/local-assets.ts`가 `/__local-assets/chaerin/*`, `/__local-assets/chaerin-v2/*`에서 **허용 목록에 있는 런타임 파일만** 제공한다. `public/` 밖에 두므로 운영 빌드에는 들어가지 않는다.
- 코드에서 쓰는 주소: `src/features/local-demo/store.ts`의 `LOCAL_MODEL_URL`, `LOCAL_V2_*_URL`
- 운영에서는 이 파일을 쓰지 않는다. 모델 URL은 백엔드 API로 받는다([계약 초안](../docs/MATE_MODEL_V2_CONTRACT.md)).

## 받는 방법
팀 공유 드라이브의 **`capsule-local-assets-YYYY-MM-DD.zip`** 묶음을 받아 압축을 풀고 안의 `README.md`를 따른다. 요약하면 다음과 같다.

```bash
./install.sh <Front_Web 경로>   # local-assets/chaerin, chaerin-v2 복사와 필수 파일 확인
npm run dev                     # VITE_DATA_SOURCE=mock
# http://localhost:3000/__local-assets/chaerin-v2/model/model.json 이 열리면 성공
```

## 저장소에 올리지 않음
이 저장소는 **공개 저장소**이고 모델·엔진은 팀 내부 라이선스 자산이다. 이 README를 빼고 `local-assets/*`는 Git에 올리지 않는다(`.gitignore`). 묶음도 비공개 경로로만 공유한다.
