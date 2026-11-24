# 웹 베타 P0 API 계약 확인 · 2026-11-22

## 최신 재확인 · 13:37 KST

**이후 API 호환 수정:** 27개 작업의 요청·응답·서비스 검증을 추가 대조하고 신규 시작의 `targetMinutes`, 복구 heartbeat 본문 등 프런트 불일치를 수정했다. 최신 구현은 [API 감사](API_AUDIT_2026-11-22.md)와 아래 직접 연결 행을 따른다. OpenAPI 자체는 동일하다.

2026-11-22 13:37:27 KST에 공개 OpenAPI·Swagger 설정·약관을 읽기 전용 GET으로 다시 확인했다. **24개 경로·27개 HTTP 작업·69개 스키마이며 기존 11/22 스냅샷과 JSON 전체가 동일하다.** 경로·작업의 추가/삭제, 요청 본문·파라미터·응답 정의·스키마·인증·서버 정의 변경은 없다. 설정에 별도 베타 API 그룹은 없으며, SERVICE 3·PRIVACY 4 약관은 여전히 본문 준비 중이다.

새 원본은 [재조회 스냅샷](BACKEND_OPENAPI_RECHECK_2026-11-22.json), 변경 목록·해시·현재 작업 목록은 [기계 비교 결과](BACKEND_OPENAPI_DIFF_2026-11-22.json)에 보관했다. **기능별로 어느 파트의 무엇을 기다리는지는 [REQUEST.md](REQUEST.md)를 따른다.** 인증 이후 실제 동작이나 이번 개발 브랜치 변경까지 검증한 결과는 아니다. 아래 소스 조사·구현 기록은 각 단계에서 확인한 커밋/범위 기준이다.

## 확인 근거

- 공개 [OpenAPI](https://api.capsule.ai.kr/v3/api-docs)를 다시 읽었다. 24개 경로·69개 스키마이며, 보관된 `BACKEND_OPENAPI_2026-11-22.json`과 JSON 내용이 같다. 이번 조회 원본은 `.temp/p0-api-discovery-2026-11-22.json`이다.
- 폐기 화면 정리 시 재조회한 `.temp/p0-api-cleanup-discovery-2026-11-22.json`도 같은 계약이다. 신규 크레딧·초대·프로필·지속 대화 경로를 가정하지 않는다.
- 로컬의 `API관련/API 최종` 자료도 기존 인증·룸·공부 세션·일정 계약이다.
- 현재 작업 공간에는 Spring 서버 소스가 없다. 프런트와 프록시를 수정할 수 있으며, 명세에 없는 서버 동작을 프런트의 성공 응답으로 대신 만들지 않는다.
- 연결된 GitHub에서 백엔드 소스도 확인했다. `LIKELION-CAPSULE/Backend_lab`의 `develop`은 2026-11-21 커밋 `de5aa98f352a173c9ba11c72b0eb27dfce281b15`이며, [가입 요청](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/user/dto/SignupRequest.java)은 인증 토큰·비밀번호·닉네임·약관 ID만, [프로필 수정](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/user/dto/UpdateMeRequest.java)은 닉네임·아바타 ID만 받는다. [내 정보 응답](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/user/dto/MeResponse.java)에도 생년월일·호칭·자기소개가 없다. 조회 시 열린 PR은 없었다. 근거는 `.temp/p0-account-backend-source-audit.json`이다. 배포 명세와 개발 브랜치 모두 새 계정 계약이 없는 상태이며, 백엔드 저장/청소년 제한을 구현한 것으로 취급하지 않는다.
- 사용자 확인: **남학생 메이트는 아직 백엔드에 등록되지 않았다.** 임의의 기존 남학생 캐릭터나 가짜 서버 ID로 채우지 않는다.
- 11/22 사용자 추가 확인: **음성·이전 대화·크레딧 관련 API는 아직 준비 전**이다. 이 세 범위는 계약 반영 대기로 유지하고, 현재 연결/종료 API로 처리할 수 있는 상태 복구와 프런트 오류 수정은 계속한다. 별도 베타 명세를 전제로 구현하거나 목업을 실제 연동으로 간주하지 않는다.

## 현재 계약으로 연결할 수 있는 범위

| 영역 | 현재 계약 | 프런트 처리와 한계 |
|---|---|---|
| 로그인·아바타 | 이메일/카카오/갱신/탈퇴, `/me`, `/avatars` | 기존 실제 인증을 유지한다. 생년월일·호칭·자기소개 필드는 별도 계약이 필요하다. |
| 메이트 목록 | `/home`의 `rooms[].characters[]`, `/rooms/{id}` | 승인된 출시 메이트 이름과 유효한 서버 ID만 새 목록에 매핑한다. 기존 9개 룸·19명으로 보충하지 않는다. 현재 승인 프로필은 채린이며, 남학생은 등록 대기다. |
| 직접 연결 · **현재 API 호환 수정** | `POST /sessions`의 구현은 `roomId`, `characterId`, `targetMinutes`를 요구한다. 목표는 3 또는 5~180의 5분 단위 | 사용자 API 우선 연동 요청에 따라 세 필드를 전송하고, 직접 연결은 기존 기본값 50을 사용한다. 화면의 카운트다운·자동 종료에는 사용하지 않는다. 서버의 목표 미달 대사 판단 등 새 무제한 정책은 아직 별도 변경이 필요하다. 상세 근거와 요청은 [API 감사](API_AUDIT_2026-11-22.md)·[REQUEST R09](REQUEST.md) 참조. |
| 연결 유지·복귀 | `/sessions/{id}/resume`, `/heartbeat`, `/events`, `/end` | 기존 시간 동기화와 실제 서버 종료를 재사용한다. 메이트 슬러그와 서버 세션 ID를 분리한다. 다른 메이트 화면이나 연결 이탈 시 미디어를 해제한다. |
| 텍스트 대화 | `/messages/stream`, `TEXT/QUICK`, SSE `reply/done/error` | 기본 모드 채팅을 연결한다. 기존 요청 ID·오류·재시도 규칙을 유지한다. |
| 음성 답변 | `MessageRequest.tts`, `MessageResponse.audioBase64` | 운반 필드는 있으나 확인한 개발 소스의 `DialogueService.audio()`는 `tts:true`에도 항상 `null`이다. 실제 TTS 생성·STT·고급 모델·차감/실패/취소는 아직 연동할 수 없다. |
| 연결 기록 | `/sessions/{id}/report` | 연결 시간·서버 마무리 대사·서버가 준 단계 이름을 사용한다. 카메라 관측값은 기존 기기 저장 스냅샷에서 분리해 읽는다. |

현재 `presentSeconds`는 카메라를 끈 구간도 자리 있음으로 셀 수 있는 기존 서버 규칙이다. 이를 새 기획의 **캠으로 확인한 함께한 시간**으로 바꿔 표시하지 않는다. 새 화면에서 연결 시간과 카메라 관측 시간을 분리하며, 서버의 캠 시간 저장·다른 기기 조회 계약은 대기다. `/home.todayStudySeconds`도 캠 측정 시간이 아니다. 문서에 없는 대체 라벨을 만들지 말라는 사용자 지시에 따라 히어로 수치는 숨기며, 올바른 캠 누적 시간 계약이 준비되면 문서의 **오늘 함께한 시간**으로 연결한다.

## 추가·변경이 필요한 계약

아래는 필요한 동작·데이터 목록이다. 서버 경로명과 요청 필드명은 합의 전이므로 임의로 확정하지 않는다.

| P0 범위 | 명세에서 확인되지 않은 내용 | 완료에 필요한 검증 |
|---|---|---|
| 메이트 상세·출시 데이터 | 연령 등급·태그·세계관·내 역할·인트로·세션 시작 전 Live2D 미리보기·목소리 샘플, 남학생 등록 | 승인된 메이트 2명의 상세 데이터·모델·샘플을 연결 전 조회 가능 |
| 지속 대화방·초기화 | 내부에는 사용자×캐릭터 대화방·기억이 있으나, 현재 연결의 최근 메시지와 이전 요약을 사용한다. 종료 요약 성공 시 원문 메시지를 삭제한다. 전체 기록 조회·네 범위 초기화 공개 계약은 없음 | 원문 보존 정책 변경과 조회/페이지 처리·다른 기기 동기화·초기화 범위/동시성 검증 |
| 연결·기록 | 캠으로 확인한 함께한 시간 저장, 대화 수, 새 해금 목록, 마지막 연결 메이트 | 홈·연결 기록·다른 기기에서 같은 값 조회 |
| 친밀도·분위기 | 최종 해금 레벨 정책, 하루 인정 상한·대화 없는 날 처리, 그날의 분위기, 표정·보이스 해금 | 서버 결과를 단계·진행·해금·표정에 적용. 기존 공부 레벨/호감도 값을 새 규칙으로 계산한 것으로 오인하지 않음 |
| 가입·청소년·프로필·설정 | 게시된 서비스 약관/개인정보 처리방침 전문, 생년월일·호칭·나에 대해·설정 저장, 만 14세 가입 제한·만 19세 미만 하루 3시간 집행 | 실제 게시 버전의 동의·이메일/카카오 서버 검증, 오전 5시 경계와 다른 기기 동시 이용 검증 |
| 음성·모드 | STT 전송·인식 결과·취소, 기본/고급 모델 선택, TTS 오류와 차감 확정 시점 | STT→입력 검사→모델→출력 검사→TTS 실제 왕복, 실패·중복 요청 처리 |
| 출석·초대 크레딧 | 잔액·원장·출석 지급/소멸·차감 순서·초대 코드·첫 연결 보상·최대 10명·중복 방지 | 1,500/1,000 정책과 기본 0·음성 20·고급 30·합산 50을 서버에서 확정 |
| 안전·운영·측정 | 생성 단계 제한·입출력/STT 탐지·경고/정지/초기화 상태·제재 로그, 베타 지표·원가·정원 설정 | 서버 안전 응답과 제재 집행, 개인정보 처리·로그 보관·운영 설정 확인 |

프런트의 브라우저 테스트는 격리된 모의 API로 요청·응답·화면 흐름을 검증한다. 운영 계정으로 새 가입·연결·음성·차감·초대·초기화·탈퇴를 실검증한 결과와 구분한다. 공개 명세 재조회만으로 인증 이후 실제 동작을 완료했다고 판정하지 않는다.

## 6차 확인: 대화 원문·음성·약관

11/22 재조회한 공개 명세는 여전히 **24개 경로·69개 스키마**이며 기존 스냅샷과 JSON이 같다. 백엔드의 현재 `develop`도 `de5aa98f352a173c9ba11c72b0eb27dfce281b15`로 일치했다. 브랜치 목록도 조회했으며 다른 베타 계약 주소/브랜치가 있다면 별도로 확인해야 한다. 원본은 `.temp/p0-ended-api-discovery-2026-11-22.json`과 `p0-dialogue-source-audit.json`이다.

- **음성:** [DialogueService.audio](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/dialogue/service/DialogueService.java#L698)는 생성 TODO와 `return null`만 있다. 필드 존재를 실제 TTS 구현으로 오해하지 않는다. `character_voice_samples`라는 마이그레이션도 [텍스트 말투 예시 JSON](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/resources/db/migration/V20261105_030616__dialogue_character_voice_samples.sql)이며 재생 가능한 목소리 파일이 아니다.
- **대화와 기억:** [ConversationRepository](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/dialogue/repository/ConversationRepository.java)는 사용자×캐릭터 대화방을 유지하고 [MemoryKeeper](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/dialogue/service/MemoryKeeper.java)는 사실 기억을 보관한다. 다만 [현재 답변 입력](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/dialogue/service/DialogueService.java#L315)은 이번 세션 메시지·이전 요약·기억을 사용하며, [종료 처리](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/dialogue/service/DialogueService.java#L554)는 요약이 저장되면 원문을 삭제한다. V-4는 단순히 조회 URL을 추가하는 것 외에 원문 보존 정책 변경도 필요하다. 기존 기기 캐시를 전체 서버 기록으로 표시하지 않는다.
- **설정:** 발견한 [SettingsController](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/dialogue/controller/SettingsController.java)는 `/internal/llm-lab/api/settings`의 운영자용 설정이다. 사용자 음성·기기 설정 저장 API로 연결하지 않는다.
- **약관:** 읽기 전용으로 조회한 [`GET /api/terms`](https://api.capsule.ai.kr/api/terms)는 SERVICE 버전 3, PRIVACY 버전 4 모두 `(… 본문 준비 중)`이다. 원본은 `.temp/p0-beta-terms-response-2026-11-22.json`이다. 이 초안이 truthy 문자열이라는 이유로 동의 가능하다고 판단하던 코드를 수정했다. 운영 약관 모달은 서버 전문만 사용하고 사전예약 랜딩페이지 문서를 대신 보여 주지 않는다. 원본 문서는 파일로 보존하되 운영 import에서 제외했다. 두 필수 문서의 유효한 버전/본문이 없거나, 화면에 없는 추가 필수 문서가 오면 가입·카카오 시작을 진행하지 않는다. 기존 이메일 로그인은 유지된다. 새 약관 본문을 프런트가 임의로 작성하지 않으며, 서버 전문 게시가 출시 의존 사항에 추가된다.

현재 계약에서 확인할 수 있는 `SESSION_ENDED`는 새 베타 제재/청소년 상태와 다르다. heartbeat·상태 이벤트·메시지 HTTP/SSE·종료·재개에서 이 코드가 오면 로컬 진행 상태를 해제하고 실제 보고서 조회로 이동하도록 수정했다. 추가 `/end`나 가짜 보고서를 만들지 않는다. 일시적 서버 오류에는 연결을 유지한다. 새 청소년 일일 집행·안전 경고/정지/초기화의 완료를 뜻하지 않는다.

자동 종료 전 메이트 인사는 화면 수정 지시서의 「자동 연결 끊기」에 따라 **PM이 작성하는 메이트별 대사**가 필요하다. 현재 `ReportResponse.closingLine`은 `/end`가 완료된 뒤 받는 보고서 대사이므로 종료 전 인사 계약으로 사용하지 않는다. 승인된 인사/전달 시점·음성이 준비될 때 연결하며, 프런트가 인사를 새로 쓰거나 종료 후 대사를 종료 전 성공으로 표시하지 않는다.

## 다음 작업

11/22 프런트 단독 P0/P1 병행 요청 후 새 사용법(H-3), PIP 말풍선 표시 설정(T-5), 내 기록의 메이트별 목록/연도 탐색(M-2), 전체 화면의 제목/포커스를 진행했다. 사용법 추가는 이전 튜토리얼 삭제 요청을 확인한 뒤 사용자가 최종 문서 기준으로 새로 추가하도록 선택했다. 말풍선 설정은 브라우저 표시 선호이며 계정별 로컬 저장만 한다. 서버 설정·음성·과금 요청을 보내지 않는다. M-2는 현재 기기의 검증된 보고서 캐시를 표시하며 전체 기록 동기화 계약을 대신하지 않는다.

프런트의 기기 선택·비용 표시·AI 고지·네이티브 PIP 창/모델 호스트 이동/복귀/정리는 구현했다. 기기는 브라우저 로컬 선택이며 서버 설정 저장은 아니다. STT 계약이 없어서 누르고 말하기는 비활성 상태다. TTS 운반 필드가 있다는 근거만으로 음성·립싱크·차감까지 완료했다고 처리하지 않는다.

T-2의 문서 음성 토글·안내도 구성했지만 운영에서는 꺼짐/비활성이다. 현재 음성 생성/차감/설정 저장을 성공으로 처리하거나 가짜 선호를 저장하지 않는다. 실제 켜기/끄기와 TTS·비용 정책이 연결돼야 이 항목을 완료할 수 있다.

모델 준비가 실패했던 임시 연결의 재개가 `SESSION_ENDED`를 반환하면 해당 임시 상태를 해제하고 기존 보고서 조회 경로로 이동한다. 프런트의 `EndedConnectionError.sessionId`는 서버가 발급했던 연결 ID를 오류 처리에 전달하는 로컬 문맥이며 wire 필드나 새 endpoint가 아니다. 재개 응답 ID가 예상과 다르거나 화면/계정이 바뀌면 현재 모델/계정에 반영하지 않는다. 서버가 새 기능을 구현했다고 가정하는 처리가 아니다.

기존 결제 주소는 친구 초대로 바꿨다. 내 크레딧과 친구 초대는 문서의 화면 구조만 만들었다. `BetaWallet`/`BetaInvitation`은 UI 표현용 타입이며 합의된 서버 경로나 wire 스키마가 아니다. 실제 컨텍스트는 `null`이고 수치는 `—`, 복사·보상 입력/요청은 비활성이다. 체험 잔액·원장·패스·초대 코드·보상 성공을 생성하지 않는다. S-2/S-3 크레딧·초대 P0가 완료됐다는 뜻이 아니다.

가입·온보딩의 생년월일 입력과 만 14세 경계 검증, 프로필의 호칭·나에 대해 입력 구조를 추가했다. `BetaAccountPort` 역시 **UI 작업 경계이며 서버 wire 계약이 아니다**. 운영 진입점에는 이 포트를 연결하지 않았으므로, 새 생년월일을 무시하고 기존 가입/온보딩 API로 성공 처리하지 않는다. 신규 가입은 이메일 발송 전에 중단하며, 미완료 온보딩은 기본 아바타를 선택해도 완료되지 않는다. 기존 계정 로그인·닉네임/아바타 수정은 현재 계약으로 유지한다. 호칭·나에 대해는 운영 화면에서 비활성이며 브라우저 저장소에 가짜 프로필을 저장하지 않는다. 신규 가입/온보딩 완료·추가 프로필 저장은 실제 계약 반영 후 연동해야 하는 출시 의존 사항이다.

검토 전용 `accountContract` 시나리오는 모의 포트에만 생년월일·호칭·소개를 보관해 전체 UI 흐름과 실패/재시도를 확인한다. 기존 가입/수정 fixture에는 기존 wire 필드만 전달한다. 모의 포트와 그 이벤트/데이터는 운영 빌드에 포함되지 않는다. 이 검증을 실제 서버 저장·기기 간 재조회·청소년 하루 3시간 집행의 완료 근거로 사용하지 않는다.

메이트 상세에도 `MateContentPort`라는 **UI 경계만** 추가했다. 서버 URL이나 wire 필드를 새로 확정하지 않는다. 운영에는 포트를 연결하지 않으며, 기존 승인 이미지와 기울기 효과를 유지한다. 목소리 샘플 버튼과 초기화 확인창의 실행 버튼은 실제 데이터/작업이 없으면 비활성이다. 상세를 보기 위해 임의의 세션을 만들거나 사용자 아바타 모델을 메이트 모델로 대신 사용하지 않는다.

백엔드 개발 커밋의 [RoomDetail](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/session/dto/RoomDetail.java)과 [RoomCharacter](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/session/dto/RoomCharacter.java)에는 연결 전 모델·샘플 URL이 없다. 내부 모듈의 [ContentTypes.CharacterInfo](https://github.com/LIKELION-CAPSULE/Backend_lab/blob/de5aa98f352a173c9ba11c72b0eb27dfce281b15/src/main/java/com/capsule/content/api/ContentTypes.java)에 모델·인트로가 있다는 것만으로 공개 상세 API가 있다고 판단하지 않는다. 근거는 `.temp/p0-mate-backend-source-audit.json`이다.

초기화 UI는 문서의 네 범위(대화 기록·기억·친밀도·해금)를 모두 확인한 성공 응답 뒤에만 선택한 메이트의 대화 캐시와 현재 친밀도 캐시를 무효화한다. 다른 메이트의 메시지와 과거 연결 보고서는 유지한다. 실패·일부 범위만 확인된 응답에는 캐시를 지우지 않는다. UI 경계의 revision은 오래된 확인으로 새 대화를 지우지 않게 하기 위한 요구 표현이며 확정 서버 필드가 아니다. 실제 계약에서는 원자적 삭제·동시 요청·다른 기기/진행 중 연결·늦은 응답·재시도 정책을 합의하고 검증해야 한다. 프런트의 메모리/일정 배열을 지우는 것으로 AI 기억 삭제를 대신하지 않는다.

검토 전용 `mateContract`는 기존 이미지 모델과 **무음 WAV**로 동작 상태만 확인한다. 모의 초기화 receipt가 네 범위를 반환한다고 실제 서버 데이터가 삭제됐음을 증명하지 않는다. 모의 포트·WAV 생성·검토 이벤트는 운영 빌드에 포함하지 않는다. D-1/D-4의 실제 모델·샘플/승인 콘텐츠·지속 대화방/초기화 연동은 여전히 미완료다.

운영 앱에서 이전 룸·목표 시간·공부·캡슐 카드·결제 페이지의 import를 제거했고, 계정별 서버 보고서/메시지만 새 브라우저 캐시로 이전한다. 서버 보고서 하나를 조회하는 계약을 재사용하며 전체 기록/지속 대화 동기화 API는 여전히 대기다. 카메라 스냅샷이 없으면 캠 시간은 `—`이며 `presentSeconds`를 대신 쓰지 않는다. 새 연결은 실제 모델 준비까지 성공해야 연결 화면으로 진입한다.

PIP 구현은 [Chrome의 Document PIP 설명](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/)의 사용자 동작에서 `requestWindow` 호출, 스타일 복사, `pagehide` 정리를 기준으로 한다. 기기 전환은 [MDN deviceId](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/deviceId)와 [기기 목록의 권한 제약](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices)에 맞춰 실제 브라우저가 공개한 목록과 정확한 ID를 사용한다. 브라우저 API 검증과 새 서버 계약의 실제 연동 검증은 구분한다.

가입/프로필과 메이트 상세의 입력·상태·오류 처리를 구성했다. 실제 계정 저장·상세 콘텐츠·초기화는 새 계약 반영 후 연결한다. 지속 대화·음성·크레딧·친밀도·안전·지표·캠 시간 저장과 실제 모델/장치 장시간 검증도 남아 있다. 카메라 반응 범위와 친밀도 수치는 최종 PRD의 미결·추천 상태를 유지한다.
