# API 문서 Git 이력 정리 · 2026-11-05

사용자가 GitHub에 이미 올라간 API 문서를 과거 기록에서도 제거하도록 요청했다. 별도 미러에서 필터링한 뒤 변경 범위를 검증하고 원격 브랜치 세 개를 원격 SHA 일치 조건과 원자적 push로 갱신했다. 이 기록도 `docs/*` 정책에 따른 로컬 문서다.

## 제거 범위

- `docs/BACKEND_API.md`
- `docs/BACKEND_OPENAPI_2026-11-05.json`
- `docs/PROJECT_OVERVIEW.md`
- 위 세 파일의 `.gitignore` 허용 예외

새로 만든 API 연동·카카오·상태/순간 동작 문서는 원격에 올라간 적이 없고 계속 Git에서 제외된다. API 구현 코드는 진행 중인 로컬 작업으로 유지했다.

## 원격 결과

| 브랜치 | 정리 후 커밋 |
|---|---|
| main | `20576c139a50c18547cb9f466e2afe2ef74ecb74` |
| dev | `c3e899e0826260a425c595d441350043f622c04c` |
| 31-fix-버그수정 | `4646d394f7cd2df7f64b36885033be21cfa2a246` |

처음 영향을 받은 커밋은 `ff35e26a12f5a9b5bda8f2270068b0028bbaffa1`이다. 총 세 커밋만 다시 썼으며, 문서 세 파일과 `.gitignore`를 제외한 파일 트리는 이전 커밋과 동일하다. 나머지 원격 브랜치의 SHA는 바뀌지 않았다.

GitHub에서 새로 받은 별도 bare clone에서 브랜치 13개·태그 0개를 확인했고, 모든 일반 브랜치의 전체 이력에 위 API 문서 경로가 없음을 검증했다.

## 로컬 작업 보존

현재 `30-add-api-연결` 브랜치와 관련 로컬/원격 추적 참조 다섯 개를 새 이력에 맞췄다. 참조 갱신 전후 작업 파일 670개의 해시가 같음을 확인했다. 여기에는 `.env.local`과 로컬 API 문서가 포함된다. 파일을 checkout/reset으로 덮어쓰지 않았다. 이전 문서의 staged 삭제는 새 기준 이력에서 이미 반영돼 사라졌다.

복구용 bundle·작업 파일 아카이브·패치·커밋 대응표·검증 결과는 로컬의 `/tmp/capsule-api-history-20261105-044924/`에 보관했다. 이 백업은 이전 이력을 포함하므로 원격에 push하지 않는다.

## 남아 있는 GitHub 참조

**GitHub 전체에서 완전히 삭제된 상태는 아니다.** 원격에서 아래 읽기 전용 PR 참조가 이전 SHA를 유지하는 것을 확인했다.

- `refs/pull/32/head` → `ff35e26a12f5a9b5bda8f2270068b0028bbaffa1`
- `refs/pull/33/head` → `d80b2fe7c1f843d8ac88fdaa5dfb18ba49e8c637`

GitHub의 PR 참조는 일반 push로 수정·삭제할 수 없다. 과거 SHA를 통한 캐시나 다른 사람의 clone/fork까지 제거한 것으로 간주하지 않는다. [GitHub 공식 안내](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)에 따르면 Support의 캐시·PR 정리는 민감 정보에 한정되고, 비민감 자료의 삭제는 지원하지 않는다. 문서 삭제를 위해 저장소나 PR 자체를 삭제하지 않았다.

다른 협업자는 새로 clone하거나 이전 커밋을 병합하지 않는 방식으로 작업을 옮겨야 한다. 정리 전 이력을 merge/push하면 제거한 문서가 다시 들어올 수 있다. 현재 사용자의 이 작업 폴더는 이미 새 이력으로 맞췄다.

## 함께 확인한 사항

- `BACKEND_API_ORIGIN`은 공개 API origin이므로 `.env.example`에 적어도 된다. 서버 프록시용 설정이다.
- 3분 공부 시작은 사용자가 배포 Swagger에서 성공을 확인했다고 전달했다. 기존 문서의 미확인 항목을 갱신했으며, 에이전트가 실계정으로 직접 실행한 것으로 기록하지 않았다.
