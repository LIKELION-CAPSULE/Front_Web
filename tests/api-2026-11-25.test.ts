import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiClient, ApiError } from '../src/shared/api/client.ts'
import { DEVICE_ID_KEY, deviceHash, deviceId } from '../src/shared/api/device-hash.ts'
import { accountDetails, createServerAccountPort, mateDetailContent } from '../src/features/backend/server-ports.ts'
import { getCreditTransactions, getRecords, rateMessage } from '../src/features/backend/server-api.ts'
import { fromServerSettings, toServerSettings } from '../src/features/mates/connection-settings-sync.ts'
import { detectModelFormat } from '../src/features/mate-render/mate-source.ts'
import { isConnectionEnded } from '../src/features/backend/ended-connection.ts'

function memoryStorage() {
  const map = new Map<string, string>()
  return { map, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value) } }
}
function client(answer: (path: string, init: RequestInit) => unknown, seen: { path: string; method: string; body: unknown; auth: string | null }[] = []) {
  return new ApiClient(async (url, init) => {
    const path = String(url).replace('/api/backend', '')
    seen.push({ path, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init?.headers).get('authorization') })
    const value = answer(path, init!)
    if (value instanceof Response) return value
    return value === null ? new Response(null, { status: 204 }) : Response.json({ success: true, data: value })
  })
}

test('the device value is a stable random id per browser, sent as a 64-character SHA-256 hex', async () => {
  const storage = memoryStorage()
  const id = deviceId(storage)
  assert.match(id, /^[0-9a-f]{32}$/)
  assert.equal(deviceId(storage), id)
  assert.equal(storage.map.get(DEVICE_ID_KEY), id)
  const hash = await deviceHash(storage)
  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.equal(await deviceHash(storage), hash)
  assert.notEqual(await deviceHash(memoryStorage()), hash)
  const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.match(deviceId(blocked), /^[0-9a-f]{32}$/)
})

test('the server account port maps the profile, signs up with birth date and device value, and enters a referral after sign-in', async () => {
  const seen: { path: string; method: string; body: unknown; auth: string | null }[] = []
  let me = { userId: 7, nickname: '나', onboardingRequired: true, birthDate: null as string | null, honorific: null as string | null, aboutMe: null as string | null }
  const api = client((path, init) => {
    if (path === '/auth/email/signup') return { accessToken: 'token', userId: 7, onboardingRequired: true }
    if (path === '/me' && init.method === 'PATCH') { const body = JSON.parse(String(init.body)); me = { ...me, ...body, onboardingRequired: false }; return me }
    if (path === '/me') return me
    if (path === '/referrals/me') return { canEnterCode: true }
    if (path === '/referrals' && init.method === 'POST') return Response.json({ success: false, code: 'REFERRAL_SELF', message: 'REFERRAL_SELF' }, { status: 400 })
    if (path === '/referrals/FRIEND1000') return { inviterNickname: '민수', rewardOnFirstConnection: 1000 }
    if (path === '/referrals/NOPE') return Response.json({ success: false, code: 'REFERRAL_CODE_NOT_FOUND', message: 'x' }, { status: 404 })
    throw new Error(`unexpected ${path}`)
  }, seen)
  const port = createServerAccountPort(api, async () => 'd'.repeat(64))
  await port.signup({ verificationToken: 'v', password: 'p', nickname: '나', birthDate: '2000-01-01', agreedTermVersionIds: [1, 2], referralCode: 'FRIEND1000' })
  assert.deepEqual(seen.at(-1)?.body, { verificationToken: 'v', password: 'p', nickname: '나', agreedTermVersionIds: [1, 2], birthDate: '2000-01-01', deviceHash: 'd'.repeat(64) })
  assert.deepEqual(await port.read(7), { callName: '', aboutMe: '', referralRegistered: false })
  const result = await port.completeOnboarding(7, { nickname: '나', avatarId: 3, birthDate: '2000-01-01', referralCode: 'SELF' })
  assert.deepEqual(seen.find(request => request.method === 'PATCH')?.body, { nickname: '나', avatarId: 3, birthDate: '2000-01-01' })
  assert.deepEqual(seen.find(request => request.path === '/referrals')?.body, { code: 'SELF', deviceHash: 'd'.repeat(64) })
  assert.equal(result.me.onboardingRequired, false, 'a refused referral never fails onboarding')
  assert.deepEqual(result.details, { birthDate: '2000-01-01', callName: '', aboutMe: '' })
  await port.saveProfile(7, { nickname: '나', callName: '', aboutMe: '안녕' })
  assert.deepEqual(seen.at(-1)?.body, { nickname: '나', honorific: '', aboutMe: '안녕' })
  assert.deepEqual(await port.validateReferralCode!('friend1000'), { valid: true, inviterNickname: '민수' })
  assert.equal((await port.validateReferralCode!('nope')).valid, false)
  assert.equal(seen.find(request => request.path === '/referrals/FRIEND1000')?.auth, null, '39 is public')
  assert.deepEqual(accountDetails({ honorific: '민', aboutMe: null, birthDate: '2001-02-03' }), { birthDate: '2001-02-03', callName: '민', aboutMe: '' })
})

test('31 maps to the detail projection without nulls; the server copy wins and the model keeps the v2 fields', () => {
  const detail = mateDetailContent({ id: 4, name: '채린', oneLiner: '한 줄', world: null, myRole: '같은 반', intro: '', hashtags: ['#공부'], voiceSampleUrl: null,
    model: { format: 'ALIVING2D_V2', modelJsonUrl: 'https://cdn.example/chaerin/v5/model.json', engineUrl: null, playerUrl: null, reactionsUrl: null } }, 4)
  assert.deepEqual(detail, { characterId: 4, introduction: '한 줄', role: '같은 반', tags: ['#공부'], model: { modelJsonUrl: 'https://cdn.example/chaerin/v5/model.json', format: 'ALIVING2D_V2' } })
  assert.equal(detectModelFormat(detail.model!.modelJsonUrl, detail.model!.format), 'aliving2d')
  assert.equal(detectModelFormat('https://cdn.example/x.json', 'CUBISM'), 'cubism')
  assert.throws(() => mateDetailContent({ id: 5 }, 4), ApiError)
})

test('settings T-1…T-9 map to the server keys and back; browser-only fields never go out', () => {
  assert.deepEqual(toServerSettings({ talk: 'often', voice: false, volume: 101, speed: 'slow', mode: 'advanced', pipSize: 'large', holdToTalk: false, gaze: false }, true),
    { talkFrequency: 'OFTEN', voiceEnabled: false, voiceVolume: 100, voiceSpeed: 'SLOW', defaultMode: 'ADVANCED', pipSize: 'L', pipBubble: true })
  assert.deepEqual(toServerSettings({ holdToTalk: true, gaze: true }), {})
  assert.deepEqual(fromServerSettings({ talkFrequency: 'QUIET', voiceEnabled: true, voiceVolume: 70, voiceSpeed: 'FAST', pipBubble: false, defaultMode: 'BASIC', pipSize: 'S' }),
    { settings: { talk: 'quiet', voice: true, volume: 70, speed: 'fast', mode: 'basic', pipSize: 'small' }, pipBubble: false })
  assert.deepEqual(fromServerSettings({ talkFrequency: 'LOUD' as never }), { settings: {} })
})

test('data functions build the documented paths and queries', async () => {
  const seen: { path: string; method: string; body: unknown; auth: string | null }[] = []
  const api = client(() => ({}), seen)
  await getRecords(api, { range: 'WEEK', date: '2026-11-25', mateId: 4 })
  await getCreditTransactions(api, { filter: 'USE', cursor: null })
  await rateMessage(api, 'a b', null)
  assert.deepEqual(seen.map(request => [request.method, request.path]), [['GET', '/records?range=WEEK&date=2026-11-25&mateId=4'], ['GET', '/credits/transactions?filter=USE'], ['PUT', '/messages/a%20b/rating']])
  assert.deepEqual(seen[2]!.body, { rating: null })
})

test('CONNECTION_ENDED replaces SESSION_ENDED', () => {
  assert.equal(isConnectionEnded(new ApiError('x', 409, 'CONNECTION_ENDED')), true)
  assert.equal(isConnectionEnded(new ApiError('x', 409, 'SESSION_ENDED')), false)
})
