# CAPSULE 문서

웹 베타의 최신 기획 기준은 **2026-11-22 최종 PRD와 화면별 수정 지시서**입니다. 첨부 원문을 내용 수정 없이 보관했습니다. 기존 스터디 버전 문서는 구현 이력·참고 자료이며, 새 기획의 구현 완료를 뜻하지 않습니다.

| 문서 | 용도 |
|---|---|
| [DESIGN_CHANGE_NOTICE_PM.md](DESIGN_CHANGE_NOTICE_PM.md) · [백엔드](DESIGN_CHANGE_NOTICE_BACKEND.md) | 기획 대비 바뀐 화면을 화면별로 PM·백엔드에 통보하는 문서. 01 로그인(바탕화면·통화 창 메이트·숨은 CAPSULE)부터 화면이 끝날 때마다 추가 |
| [API_FRONT_GAP_2026-11-25.md](API_FRONT_GAP_2026-11-25.md) | **현재 API 연결 기준.** 프런트가 부르는 엔드포인트 중 없어지거나 바뀐 것, 바로 깨지는 지점(우선순위), 기능별 새 API 대응(로그인 메이트·설정·크레딧·초대·기록·내 메이트·상세·대화방·알림·평가·초기화), 해소된/남은 백엔드 요청, 연결 작업 순서 |
| [BACKEND_OPENAPI_2026-11-25.json](BACKEND_OPENAPI_2026-11-25.json) · [변경표](BACKEND_OPENAPI_DIFF_2026-11-25.md) | 11/25 OpenAPI 원본(41개 경로·44개 작업·114개 스키마, SHA-256 기록)과 11/22 대비 추가·삭제·세션→연결 이름 변경·스키마 필드 변화·OpenAPI 표기 오류 |
| [REQUEST.md](REQUEST.md) | 기능 14개 묶음별 백엔드·PM·디자인 요청. 현재 API 호환 수정과 최종 베타 서버 변경 대기를 구분. 로컬 전용 |
| [API_AUDIT_2026-11-22.md](API_AUDIT_2026-11-22.md) · [JSON](API_AUDIT_2026-11-22.json) | 현재 27개 API·서비스 검증·50개 타입/195개 필드 대조, 연결 시작·heartbeat·재전송·닉네임·오류 수정. 로컬 전용 |
| [CAPSULE_WEB_BETA_API_GAPS_2026-11-22.md](CAPSULE_WEB_BETA_API_GAPS_2026-11-22.md) | 공개/개발 계약 대조·사용자 확인의 음성/이전 대화/크레딧 API 준비 전 상태·미등록 남학생·실제 연동 경계. 로컬 전용 |
| [CAPSULE_WEB_BETA_P0_PLAN_2026-11-22.md](CAPSULE_WEB_BETA_P0_PLAN_2026-11-22.md) | 최종 문서 기반 목표·P0 30개/P1 11개 상태·사용법/PIP 설정/기록·보관 화면 복귀·11차 사용자 승인 임시 채린 제작물/이름 매핑·외부 의존 사항. 로컬 전용 |
| [CAPSULE_WEB_BETA_PRD_2026-11-22.md](CAPSULE_WEB_BETA_PRD_2026-11-22.md) | 12/1 웹 베타 최종 PRD 원문. 메이트 2명·1:1 연결, 음성·PIP, 친밀도, 출석·초대 크레딧, 유료 결제 제외. 로컬 전용 |
| [CAPSULE_WEB_BETA_SCREEN_CHANGES_2026-11-22.md](CAPSULE_WEB_BETA_SCREEN_CHANGES_2026-11-22.md) | 기존 와이어프레임의 화면별 수정·삭제·신규 요구사항 원문. 디자인·FE·BE 담당, 모바일 제외 명시. 로컬 전용 |
| [BACKEND_OPENAPI_2026-11-22.json](BACKEND_OPENAPI_2026-11-22.json) | (기록) `api.capsule.ai.kr`의 11/22 비교 기준 명세. 24개 경로·27개 작업, 공통 성공 응답 `success/data`와 스트리밍 대화. 로컬 전용 |
| [BACKEND_OPENAPI_RECHECK_2026-11-22.json](BACKEND_OPENAPI_RECHECK_2026-11-22.json) · [비교 결과](BACKEND_OPENAPI_DIFF_2026-11-22.json) | 13:37 KST 재조회 원본·요청/응답/스키마 전체 비교. 기존 명세와 동일, 24개 경로·27개 작업·69개 스키마. 로컬 전용 |
| [MVP 제한 해제·더미 데이터 교체 안내](../src/features/dummy/README.md) | 2026-11-09 전체 기능 활성화, 더미 값·파일·검색 표식·계정별 저장·실제 API 교체 순서. Git 추적 대상 |
| [BUG_AUDIT_2026-11-06.md](BUG_AUDIT_2026-11-06.md) | 기능 버그 9건 수정, Node 테스트 321개·추가 Playwright 시나리오 16개 통과, PNG·모바일 화면 자료와 실서버/실제 모델 검증 한계. 로컬 전용 |
| [API_CALL_OPTIMIZATION_2026-11-05.md](API_CALL_OPTIMIZATION_2026-11-05.md) · [JSON](API_CALL_OPTIMIZATION_2026-11-05.json) | API 중복·과도한 묶음 조회 최적화, 전후 요청 수, 메모리 재사용/무효화·heartbeat 정책·추가 개선 후보. 로컬 전용 |
| [API_AUDIT_2026-11-05.md](API_AUDIT_2026-11-05.md) · [JSON](API_AUDIT_2026-11-05.json) | 최신 Swagger 변경·25개 API별 호출 위치/실응답·20개 정상/5개 오류만 검증·메일 수신·브라우저 결과. 로컬 전용 |
| [REAL_ACCOUNT_API_TEST_GUIDE_2026-11-05.md](REAL_ACCOUNT_API_TEST_GUIDE_2026-11-05.md) | 17개 API 실계정 검증 순서·요청/응답 예시·화면 성공 기준·쿠키/갱신·heartbeat/이어하기 확인 방법. 로컬 전용 |
| [KAKAO_LOGIN_REVIEW_2026-11-05.md](KAKAO_LOGIN_REVIEW_2026-11-05.md) | 추가 카카오 자료 대조·반영. 등록된 로컬 포트 3000, 버튼 동의 안내, callback 오류 복귀, 비밀번호 재설정 경로·토큰 제거 |
| [STATE_AND_INSTANT_ACTION_REVIEW_2026-11-05.md](STATE_AND_INSTANT_ACTION_REVIEW_2026-11-05.md) | 추가 제공 문서의 네 순간 동작 코드·사전 대사·새 호감도 정책과 현재 코드/API 차이. 백엔드 반영 예정 |
| [API_INTEGRATION_2026-11-05.md](API_INTEGRATION_2026-11-05.md) | 이전 API 연결 결과, 환경 설정, 상태·자리 지킴 정책. 현재 도메인·응답 처리 기준은 루트 README의 현재 API 연동 항목 참고 |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | 2026-11-05 코드 기준 프로젝트 구성, 현재 MVP, 두 프런트 앱의 데이터 흐름과 백엔드 연동 지점 |
| [BACKEND_API.md](BACKEND_API.md) | 2026-11-25 OpenAPI·백엔드 코드 기준 44개 API, 공통 계약·흐름(연결·이벤트·말 걸기·크레딧·초대·친밀도·설정·모델)·작업별 오류 코드·84개 스키마 사전 |
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

목록 갱신일: **2026-11-25 (Asia/Seoul)**. 각 문서의 작성일·상태를 따릅니다. 10월 분석과 기존 디자인 이력은 현재 구현 완료나 새 기준 적용 완료를 뜻하지 않습니다. 원본 기획의 2026-10-12 진행률·수치·사업 가정도 현재 실측으로 간주하지 않습니다.

최종 문서 해석 기준:

- 화면별 수정 지시서의 기존 화면 설명과 11/18 위키 참고는 변경 전 정보입니다. **11/22 갱신 내용과 각 화면의 `✏️ 수정할 내용`**을 기준으로 읽습니다. 베타에서는 유료 결제·수동 판매·패스·영수증을 모두 제외합니다.
- 개발 범위는 **데스크톱 웹(1440px), 모바일 제외**입니다. PRD 비기능 요구사항과 일부 화면 설명에 남은 모바일 390px·모바일 PIP 표기는 화면별 문서 첫 줄의 명시적 범위보다 우선하지 않습니다. 원문은 그대로 보존했습니다.
- 베타는 2026-12-01~12-14, 최대 100명입니다. P0는 12/1 필수, P1은 12/1 목표이며 미완료 시 베타 중 추가하는 범위입니다. 친밀도 단계별 시간 등 추천값과 카메라 반응 범위·남학생 메이트 설정 등 미결 항목은 확정 요구사항과 구분합니다.

API 연동·카카오 로그인·상태/순간 동작 검토·백엔드 API·OpenAPI 스냅샷과 관련 프로젝트 개요는 사용자 요청에 따라 `.gitignore` 대상으로 바꾸고 Git 추적을 해제했습니다. 파일은 로컬에 보관하며, 새로 복제한 저장소에는 포함되지 않습니다. 이 목차의 다른 과거 문서 중에도 기존 `docs/*` 정책에 따라 로컬에만 있는 파일이 있습니다.
