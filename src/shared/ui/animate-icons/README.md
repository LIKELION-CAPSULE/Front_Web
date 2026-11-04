# AnimateIcons Lucide

제품 아이콘은 앞으로도 [AnimateIcons Lucide 카탈로그](https://animateicons.in/icons/lucide)에서 의미가 맞는 것을 찾아 사용합니다. MVP 이후 화면도 같은 기준입니다. 공통 `Icon`을 통해 쓰며, 새 아이콘이 필요하면 공식 소스를 확인한 뒤 이 폴더와 `icons.ts` 매핑에 추가합니다. 자체 SVG 윤곽이나 다른 아이콘 세트를 임의로 추가하지 않습니다. 일러스트·차트·장식용 파티클은 아이콘 교체 대상이 아닙니다.

현재 41종을 [고정 커밋의 공식 소스](https://github.com/Avijit07x/animateicons/tree/49b3c297b4fa3364e9c24f5208ce6c22aa35bac8/icons/lucide)에서 가져왔습니다. 각 아이콘의 실제 SVG와 Motion variants를 유지합니다. [원본 경로·해시·수정 내역](upstream.json), [MIT 원문](LICENSE.txt), 배포물의 [AnimateIcons 고지](../../../../public/licenses/AnimateIcons-MIT.txt)와 [Lucide/Feather 고지](../../../../public/licenses/AnimateIcons-Lucide-NOTICES.md)를 보존합니다.

- 홈 House, 기록 ChartColumn, 친구/호감도 Heart, 공부 레벨 BookOpen, 레벨업 Sparkles, 크레딧 Coins, 선물 Gift, 보이스 Headphones 등 의미별로 연결합니다.
- 기존 24px viewBox와 요청 위치의 크기·색·회전·북마크 채움을 유지합니다. 제품의 글자·버튼 안에 올바르게 들어가도록 공식 소스의 바깥 `m.div`만 `m.span`으로 바꿨습니다. `cn` 경로와 마우스 이벤트 타입도 로컬 환경에 맞췄으며, 모션 감소는 공통 실시간 구독을 사용해 설정을 해제한 뒤에도 정상 재생합니다.
- `Icon`은 버튼/링크/라벨 전체의 포인터 진입·키보드 초점으로 원본 애니메이션을 한 번 재생합니다. 아이콘만 있는 비대화형 영역은 해당 아이콘에 포인터를 올렸을 때만 재생합니다. 검색창처럼 복합 입력 영역에는 `data-icon-trigger`를 지정해 입력 영역 전체의 포인터 진입·초점·클릭으로 재생합니다. 기본은 반복하지 않습니다. `Icon name="heart" loop`는 현재 호감도에 사용하는 명시적 예외로, 원본 Heart 모션(0.8초)을 0.7초 간격으로 무한 반복합니다. 해당 하트는 호버로 다시 시작하거나 멈추지 않으며 모션 감소에서는 정지합니다. 자동 점수 적립은 없습니다.
- SVG는 `overflow: visible`로 표시해 원본 모션 중 viewBox 밖으로 이동하는 시작 아이콘의 끝이 잘리지 않게 합니다. 버튼 안의 크기·간격은 유지합니다.
- `inert`, disabled, `aria-disabled` 조작은 재생하지 않습니다. 모션 감소에서는 정지합니다. 아이콘은 `aria-hidden`이며 버튼의 기존 이름·상태를 유지합니다.
- 예전 `motion="draw|nudge|pulse"`와 전용 CSS는 제거했습니다. 아이콘별 움직임은 공식 AnimateIcons 소스가 결정합니다.
