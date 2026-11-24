# 연결 화면 에셋

| 파일 | 용도 |
| --- | --- |
| `hangup-handset-3d.webp` | 연결 끊기 연출 중 화면 가운데에 나타났다 아래로 돌며 사라지는 3D 수화기 (480×480, 투명 배경) |
| `hangup-handset-3d-red.webp` | 같은 수화기의 종료 버튼 빨강 버전(`?color=%23c4142f`). 돌아가는 동안 보라색에서 이 색으로 바뀐다 |
| `handset-render.html` | 위 이미지의 원본. three.js로 직접 모델링·렌더링한 장면이며 외부 이미지나 생성 서비스를 쓰지 않았다 |

수화기는 똑바로 든 📞 자세로 렌더링되어 있다. 화면에서는 CSS가 시계 방향으로 약 135° 돌려 내려놓은 ⌒ 자세로 만든다.

## 다시 렌더링하기

개발 서버(`npm run dev`, 3000번)를 켠 뒤 다음을 실행한다. `color`와 `angle` 쿼리로 색과 자세를 바꿀 수 있다.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
  --default-background-color=00000000 --window-size=640,640 --virtual-time-budget=8000 \
  --screenshot=handset.png "http://localhost:3000/src/assets/connection/handset-render.html?angle=135"

python3 -c "from PIL import Image; Image.open('handset.png').convert('RGBA').resize((480, 480), Image.LANCZOS).save('src/assets/connection/hangup-handset-3d.webp', 'WEBP', quality=90, method=6)"
```
