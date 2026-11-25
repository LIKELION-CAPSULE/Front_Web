import test from 'node:test'
import assert from 'node:assert/strict'
import { AVATAR_ALLOW } from '../server/local-assets.ts'
import { LOCAL_AVATARS, localAvatarItems, localAvatarImage, resolveLocalAvatarThumbnails } from '../src/features/local-demo/local-avatars.ts'

test('the avatar mount serves only runtime json, moc3 and png of the six chosen models, plus thumbnails', () => {
  for (const path of [
    '/hiyori_ko/hiyori_pro/runtime/hiyori_pro_t11.model3.json',
    '/hiyori_ko/hiyori_pro/runtime/hiyori_pro_t11.2048/texture_00.png',
    '/natori_ko/runtime/natori_pro_t06.moc3',
    '/natori_ko/runtime/exp/Smile.exp3.json',
    '/epsilon_ja/epsilon_pro/runtime/motion/Epsilon_idle_01.motion3.json',
    '/wanko_ja/runtime/wanko_touch.1024/texture_00.png',
    '/chitose_ja/runtime/chitose.physics3.json',
    '/haru_greeter_ja/runtime/haru_greeter_t05.pose3.json',
    '/thumbnails/hiyori.png',
  ]) assert.ok(AVATAR_ALLOW.test(path), path)

  for (const path of [
    '/chitose_ja/chitose_t01.cmo3', // editor sources next to runtime/
    '/chitose_ja/Readme.txt',
    '/haru_greeter_ja/haru_greeter_t05.cmo3',
    '/chitose_ja/runtime/chitose.cmo3',
    '/hiyori_ko/hiyori_free/runtime/hiyori_free_t08.model3.json', // the variant not chosen
    '/epsilon_ja/epsilon_free/runtime/Epsilon_free.moc3',
    '/chitose_ja/runtime/../chitose_t01.cmo3',
    '/chitose_ja/runtime/../../chaerin/model.model3.json',
    '/chitose_ja/runtime/..%2fchitose_t01.cmo3',
    '/chitose_ja/runtime/%2e%2e/chitose_t01.cmo3',
    '/chitose_ja/runtime/.hidden.json',
    '/chitose_ja/runtime/a/b/deep.json', // at most one sub-folder
    '/chitose_ja/runtime/chitose.model3.json.js',
    '/thumbnails/../chitose_ja/Readme.txt',
    '/thumbnails/Hiyori.png',
    '//etc/passwd',
  ]) assert.ok(!AVATAR_ALLOW.test(path), path)
})

test('the local GET /avatars lists six avatars with framing and falls back to silhouettes without thumbnails', async () => {
  const items = localAvatarItems()
  assert.equal(items.length, 6)
  for (const [index, item] of items.entries()) {
    assert.equal(item.id, 990401 + index)
    assert.ok(item.name)
    assert.match(item.model!.modelJsonUrl!, /^\/__local-assets\/avatars\/[\w/.-]+\.model3\.json$/)
    assert.ok(AVATAR_ALLOW.test(item.model!.modelJsonUrl!.slice('/__local-assets/avatars'.length)))
    assert.ok(item.model!.scale! > 0)
    // No thumbnail checked yet: silhouette data URL.
    assert.match(item.thumbnailUrl!, /^data:image\/svg\+xml/)
  }
  // Only the thumbnails that exist are used.
  await resolveLocalAvatarThumbnails(async (input) => new Response(null, { status: String(input).endsWith('/haru.png') ? 200 : 404 }), 'http://local.test')
  assert.equal(localAvatarImage(990402), '/__local-assets/avatars/thumbnails/haru.png')
  assert.match(localAvatarImage(990401), /^data:image\/svg\+xml/)
  assert.match(localAvatarImage(undefined), /^data:image\/svg\+xml/)
  assert.equal(LOCAL_AVATARS.map(avatar => avatar.key).join(), 'hiyori,haru,natori,chitose,epsilon,wanko')
})
