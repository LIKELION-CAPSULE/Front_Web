# 로컬 확인용 모델

`chaerin/`은 이 작업공간의 `Design_Auto/web/public/models/chaerin/`에서 복사한 런타임 묶음이다. 기존 사용자 제공 채린 데모 모델을 재사용하며 새 모델을 생성하지 않았다.

- `model.model3.json`, 실제 `000.moc3`, `001.png`, physics/CDI, 표정 JSON 8개.
- 원본 표정 이름 `expression1`~`expression8`을 유지한다. 감정/친밀도 해금 정책으로 임의 매핑하지 않는다.
- 모션 파일, 음성, 립싱크 설정은 없는 상태다.
- Vite 개발 서버의 `/__local-assets/chaerin/*`에서만 제공한다. `public/` 밖에 두며 운영 빌드에는 복사하지 않는다.
- `server/local-assets.ts`의 경로 허용 목록을 통해 런타임 파일만 제공한다. PSD/편집 프로젝트/검사 로그는 포함하지 않는다.

## 저장소에 올리지 않음
이 저장소는 공개 저장소라 `chaerin/` 모델 파일은 Git에 올리지 않는다(`.gitignore`). 팀 공유 드라이브에서 받아 `local-assets/chaerin/`에 넣으면 로컬 데모에서 Live2D가 움직인다. 파일이 없으면 정지 이미지로 대체된다.
