import type { DeviceKind, DeviceState, MediaSnapshot } from './types.ts'

const idleDevice = (): DeviceState => ({ status: 'idle', stream: null, error: '' })

export function deviceErrorMessage(error: unknown, kind: DeviceKind) {
  const label = kind === 'camera' ? '카메라' : '마이크'
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return `${label} 권한이 꺼져 있어요. 주소창의 사이트 설정에서 허용한 뒤 다시 시도해 주세요.`
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return `${label}를 찾지 못했어요. 장치가 연결되어 있는지 확인해 주세요.`
  if (name === 'NotReadableError' || name === 'AbortError')
    return `${label}를 사용할 수 없어요. 다른 앱에서 사용 중인지 확인해 주세요.`
  return `${label} 연결에 실패했어요. 장치를 확인한 뒤 다시 시도해 주세요.`
}

/** Owns live devices in memory. Never persists streams or requests permission on mount. */
export class DeviceController {
  private snapshot: MediaSnapshot = { camera: idleDevice(), microphone: idleDevice() }
  private listeners = new Set<() => void>()
  private generations: Record<DeviceKind, number> = { camera: 0, microphone: 0 }
  private pending: Partial<Record<DeviceKind, Promise<boolean>>> = {}
  private allGeneration = 0
  private readonly acquire: ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null

  constructor(acquire: ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null) { this.acquire = acquire }

  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private update(kind: DeviceKind, value: DeviceState) {
    this.snapshot = { ...this.snapshot, [kind]: value }
    this.listeners.forEach((listener) => listener())
  }
  request = (kind: DeviceKind): Promise<boolean> => {
    if (this.snapshot[kind].stream?.getTracks().some((track) => track.readyState === 'live'))
      return Promise.resolve(true)
    if (this.pending[kind]) return this.pending[kind]
    const generation = ++this.generations[kind]
    this.update(kind, { status: 'requesting', stream: null, error: '' })
    const pending = this.open(kind, generation).finally(() => {
      if (this.pending[kind] === pending) delete this.pending[kind]
    })
    this.pending[kind] = pending
    return pending
  }
  private async open(kind: DeviceKind, generation: number) {
    try {
      if (!this.acquire) {
        if (generation === this.generations[kind]) this.update(kind, {
          status: 'error', stream: null,
          error: 'HTTPS 또는 localhost에서 카메라·마이크를 사용할 수 있어요.',
        })
        return false
      }
      const stream = await this.acquire(kind === 'camera'
        ? { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user', frameRate: { ideal: 15, max: 24 } }, audio: false }
        : { video: false, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      if (generation !== this.generations[kind]) {
        stream.getTracks().forEach((track) => track.stop())
        return false
      }
      this.update(kind, { status: 'ready', stream, error: '' })
      for (const track of stream.getTracks()) {
        track.addEventListener('ended', () => {
          if (this.snapshot[kind].stream !== stream) return
          stream.getTracks().forEach((item) => item.stop())
          this.update(kind, { status: 'error', stream: null, error: `${kind === 'camera' ? '카메라' : '마이크'} 연결이 끊겼어요. 다시 연결해 주세요.` })
        }, { once: true })
      }
      return true
    } catch (error) {
      if (generation === this.generations[kind])
        this.update(kind, { status: 'error', stream: null, error: deviceErrorMessage(error, kind) })
      return false
    }
  }
  requestBoth = async () => {
    const generation = this.allGeneration
    await this.request('camera')
    // A navigation/skip while the camera prompt is pending must not open a microphone prompt.
    if (generation === this.allGeneration) await this.request('microphone')
  }
  stop = (kind?: DeviceKind) => {
    this.allGeneration++
    for (const device of kind ? [kind] : ['camera', 'microphone'] as const) {
      this.generations[device]++
      delete this.pending[device]
      this.snapshot[device].stream?.getTracks().forEach((track) => track.stop())
      this.update(device, idleDevice())
    }
  }
}
