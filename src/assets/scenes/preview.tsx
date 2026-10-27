import { useState } from 'react'
import { sceneArtwork, type SceneId } from '@/features/rooms/artwork'
import { RoomArtwork } from '@/features/rooms/components/RoomArtwork'
import { authPosters } from '@/features/auth/posters'
import '@/styles/index.css'
import './preview.css'

const ids = Object.keys(sceneArtwork) as SceneId[]
const sources = new Map(authPosters.map((poster) => [poster.id, poster.src]))
const ratios = { landscape: '가로 16:9', card: '카드 4:3', portrait: '세로 3:4' }
type Ratio = keyof typeof ratios

export default function ArtworkPreview() {
  const [ratio, setRatio] = useState<Ratio>('landscape')
  const [background, setBackground] = useState(true)
  const [subject, setSubject] = useState(true)
  const [desk, setDesk] = useState(true)
  const [fullBody, setFullBody] = useState(false)
  const [seated, setSeated] = useState(true)
  const [title, setTitle] = useState(true)
  return (
    <main
      className="artwork-preview"
      data-ratio={ratio}
      data-background={background}
      data-subject={subject}
      data-desk={desk}
    >
      <header className="artwork-preview-header">
        <p>CAPSULE · ASSET WORKSPACE</p>
        <h1>9가지 공부 공간, 따로 바꾸는 레이어</h1>
        <p>
          메인화면은 책상 없이 앉아 있는 구도예요. 배경·전신 캐릭터·책상·제목을 따로 확인할 수
          있어요.
        </p>
      </header>
      <div className="artwork-preview-controls" aria-label="레이어 미리보기 설정">
        <label>
          <input
            type="checkbox"
            checked={seated}
            onChange={(event) => setSeated(event.target.checked)}
          />
          메인화면 구도
        </label>
        <label>
          화면 비율
          <select value={ratio} onChange={(event) => setRatio(event.target.value as Ratio)}>
            {Object.entries(ratios).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={background}
            onChange={(event) => setBackground(event.target.checked)}
          />
          배경
        </label>
        <label>
          <input
            type="checkbox"
            checked={subject}
            onChange={(event) => setSubject(event.target.checked)}
          />
          캐릭터 전경
        </label>
        <label>
          <input
            type="checkbox"
            checked={desk}
            onChange={(event) => setDesk(event.target.checked)}
          />
          책상 전경
        </label>
        <label>
          <input
            type="checkbox"
            checked={fullBody}
            onChange={(event) => setFullBody(event.target.checked)}
          />
          전신 확인
        </label>
        <label>
          <input
            type="checkbox"
            checked={title}
            onChange={(event) => setTitle(event.target.checked)}
          />
          제목
        </label>
      </div>
      <div className="artwork-preview-grid">
        {ids.map((id) => {
          const art = sceneArtwork[id]
          return (
            <article className="artwork-preview-card" key={id} data-artwork-id={id}>
              <div className="artwork-preview-stage">
                <RoomArtwork
                  showDesk={desk}
                  roomId={id}
                  variant={
                    fullBody
                      ? 'fullbody'
                      : seated
                        ? 'seated'
                        : ratio === 'landscape'
                          ? 'hero'
                          : 'card'
                  }
                  showTitle={title && !fullBody}
                  eager
                />
              </div>
              <div className="artwork-preview-info">
                <h2>{art.title.replace(/\s+/g, ' ')}</h2>
                <p>
                  {id} · {art.mood}
                </p>
                <nav aria-label={`${art.title.replace(/\s+/g, ' ')} 에셋`}>
                  <a href={sources.get(id)} target="_blank" rel="noreferrer">
                    원본 포스터
                  </a>
                  <a href={art.background} target="_blank" rel="noreferrer">
                    공부 장면 배경 WebP
                  </a>
                  <a href={art.seatedBackground} target="_blank" rel="noreferrer">
                    메인화면 배경 WebP
                  </a>
                  <a href={art.subject} target="_blank" rel="noreferrer">
                    전신 전경 WebP
                  </a>
                  <a href={art.desk} target="_blank" rel="noreferrer">
                    책상 전경 WebP
                  </a>
                  <a href={art.titleImage} target="_blank" rel="noreferrer">
                    투명 제목 WebP
                  </a>
                </nav>
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}
