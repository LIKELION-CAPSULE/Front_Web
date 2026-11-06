import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

test('capsule titles resolve server IDs and artwork aliases to their own room', async () => {
  const server = await createServer({ configFile: false, envDir: false, logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null }, resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } } })
  try {
    const { getCapsuleRoomArtwork } = await server.ssrLoadModule('/src/features/reports/capsule-room-artwork.ts')
    const hogwarts = getCapsuleRoomArtwork({ id: '11', name: '밤의 호그와트 도서관' })
    assert.equal(hogwarts.title, '밤의 호그와트 도서관')
    assert.match(hogwarts.titleImage, /hogwarts-night-title/)
    assert.equal(getCapsuleRoomArtwork({ id: 'report-512', name: '밤의호그와트도서관' }).titleImage, hogwarts.titleImage)
    const library = getCapsuleRoomArtwork({ id: '22', name: '다른 룸', artworkId: 'room-2' })
    assert.equal(library.tone, 'night')
    assert.doesNotMatch(library.titleImage, /classroom/)
    assert.equal(getCapsuleRoomArtwork({ id: 'dawn-library', name: '기존 교실' }).tone, 'classroom')
  } finally { await server.close() }
})
