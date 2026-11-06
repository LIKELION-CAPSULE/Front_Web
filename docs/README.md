# CAPSULE 문서

| 문서 | 용도 |
|---|---|
| [BUG_AUDIT_2026-11-06.md](BUG_AUDIT_2026-11-06.md) | 기능 버그 9건 수정, Node 테스트 321개·추가 Playwright 시나리오 16개 통과, PNG·모바일 화면 자료와 실서버/실제 모델 검증 한계. 로컬 전용 |
| [API_CALL_OPTIMIZATION_2026-11-05.md](API_CALL_OPTIMIZATION_2026-11-05.md) · [JSON](API_CALL_OPTIMIZATION_2026-11-05.json) | API 중복·과도한 묶음 조회 최적화, 전후 요청 수, 메모리 재사용/무효화·heartbeat 정책·추가 개선 후보. 로컬 전용 |
| [API_AUDIT_2026-11-05.md](API_AUDIT_2026-11-05.md) · [JSON](API_AUDIT_2026-11-05.json) | 최신 Swagger 변경·25개 API별 호출 위치/실응답·20개 정상/5개 오류만 검증·메일 수신·브라우저 결과. 로컬 전용 |
| [REAL_ACCOUNT_API_TEST_GUIDE_2026-11-05.md](REAL_ACCOUNT_API_TEST_GUIDE_2026-11-05.md) | 17개 API 실계정 검증 순서·요청/응답 예시·화면 성공 기준·쿠키/갱신·heartbeat/이어하기 확인 방법. 로컬 전용 |
| [KAKAO_LOGIN_REVIEW_2026-11-05.md](KAKAO_LOGIN_REVIEW_2026-11-05.md) | 추가 카카오 자료 대조·반영. 등록된 로컬 포트 3000, 버튼 동의 안내, callback 오류 복귀, 비밀번호 재설정 경로·토큰 제거 |
| [STATE_AND_INSTANT_ACTION_REVIEW_2026-11-05.md](STATE_AND_INSTANT_ACTION_REVIEW_2026-11-05.md) | 추가 제공 문서의 네 순간 동작 코드·사전 대사·새 호감도 정책과 현재 코드/API 차이. 백엔드 반영 예정 |
| [API_INTEGRATION_2026-11-05.md](API_INTEGRATION_2026-11-05.md) | API 연결 결과, 환경 설정, 상태·자리 지킴 정책, 검증과 대기 항목. 현재 실행 기준 |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | 2026-11-05 코드 기준 프로젝트 구성, 현재 MVP, 두 프런트 앱의 데이터 흐름과 백엔드 연동 지점 |
| [BACKEND_API.md](BACKEND_API.md) | 최신 Railway Swagger 기반 API 25개·스키마 50개, 새 bannerUrl·실제 상태 코드 차이·현재 연동 상태 |
| [BACKEND_OPENAPI_2026-11-05.json](BACKEND_OPENAPI_2026-11-05.json) | 같은 날 내려받은 OpenAPI 3.1.0 원본 스냅샷. API 문서 검증·갱신 근거 |
| [CAPSULE_서비스_기획_정리.md](CAPSULE_서비스_기획_정리.md) | 사업계획서를 재구성한 원본 참고 문서. 기존 파일을 내용 수정 없이 이동 |
| [SERVICE_ANALYSIS.md](SERVICE_ANALYSIS.md) | 제품·사업·기술 분석, MVP 우선순위, 기획서와 와이어프레임의 차이 |
| [FIGMA_SCREEN_MAP.md](FIGMA_SCREEN_MAP.md) | 화면별 Figma 노드, 구현 경계, 미확정 정책 |
| [REFERENCE_RESEARCH.md](REFERENCE_RESEARCH.md) | 기존 45곳 조사 및 52곳 재조사 연결 |
| [WELCOME_HERO_RESEARCH.md](WELCOME_HERO_RESEARCH.md) | 52곳의 확인 범위·접근 오류·판단과 메인 히어로 적용 |
| [HOVER_SCRATCH_BANNERS.md](HOVER_SCRATCH_BANNERS.md) | 호버 지우기 전환·가로 배너 3종·설정·수정 지점·검증 |
| [HOME_AND_RECORDS.md](HOME_AND_RECORDS.md) | 홈 상태별 문구·룸 탐색 스크롤·기간별 기록·닉네임 이전 |
| [INTERACTIONS_AND_STUDY_GOALS.md](INTERACTIONS_AND_STUDY_GOALS.md) | 북마크·체크박스·공부 히트맵·목표 시간과 타이머 |
| [MY_PAGE.md](MY_PAGE.md) | 제목 행의 프로필/일정 아이콘 전환, 프로필·아바타 편집과 통합 일정 관리 |
| [REFERENCE_LICENSE_AUDIT.md](REFERENCE_LICENSE_AUDIT.md) | 실제 도입/참고 컴포넌트의 상업 이용 조건과 조치 |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | 통합 컬러·폰트 기준, 종료 리포트 유리 표면 예외, 배포 CSS 계층 순서 고정과 레이아웃 복구. 버튼 상태·외곽선·대비·검증 범위 |
| [DESIGN_TOKENS.json](DESIGN_TOKENS.json) | 같은 기준의 기본 팔레트·용도 색·서체·글자 역할·버튼 상태·대비 계산값 |
| [REPORT_COMPLETION_REVIEW_2026-11-05.md](REPORT_COMPLETION_REVIEW_2026-11-05.md) | 종료 리포트의 타이핑·분리 레이어·Tween UI 숫자·AnimateIcons·반복 CTA·상단 배치와 MVP 이후 지표 정리 |
| [DESIGN_CODE_AUDIT.md](DESIGN_CODE_AUDIT.md) | 기존 UI 정리·동작·검증 이력. 현재 컬러·폰트 기준과 적용 상태는 DESIGN_SYSTEM을 따름 |
| [STYLE_CASCADE_AUDIT_2026-11-03.md](STYLE_CASCADE_AUDIT_2026-11-03.md) | 스타일 우선순위 전수 검수. 충돌 7건·개선안 6개 수정 결과, 공부 독 복원과 후속 검증 |
| [archive/DESIGN_SYSTEM_2026-10-26.md](archive/DESIGN_SYSTEM_2026-10-26.md) | 이전 디자인 문서 원문 보관. 현재 통일 기준과 구분 |
| [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | 프로젝트 구조, 재사용 규칙, 데이터와 상태의 경계, 다음 구현 순서 |

목록 갱신일: **2026-11-06 (Asia/Seoul)**. 각 문서의 작성일·상태를 따릅니다. 10월 분석과 기존 디자인 이력은 현재 구현 완료나 새 기준 적용 완료를 뜻하지 않습니다. 원본 기획의 2026-10-12 진행률·수치·사업 가정도 현재 실측으로 간주하지 않습니다.

API 연동·카카오 로그인·상태/순간 동작 검토·백엔드 API·OpenAPI 스냅샷과 관련 프로젝트 개요는 사용자 요청에 따라 `.gitignore` 대상으로 바꾸고 Git 추적을 해제했습니다. 파일은 로컬에 보관하며, 새로 복제한 저장소에는 포함되지 않습니다. 이 목차의 다른 과거 문서 중에도 기존 `docs/*` 정책에 따라 로컬에만 있는 파일이 있습니다.
