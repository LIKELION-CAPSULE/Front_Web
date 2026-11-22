import type { DeviceSelection } from './device-controller.ts'

const KEY = 'capsule:media-devices:v1'
export function readDevicePreferences(storage: Pick<Storage, 'getItem'>): DeviceSelection {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? 'null')
    if (typeof value === 'object' && value !== null) {
      const saved = value as Record<string, unknown>
      const id = (value: unknown) => typeof value === 'string' && value.length <= 1024 ? value : ''
      return { camera: id(saved.camera), microphone: id(saved.microphone) }
    }
  } catch { /* Storage can be unavailable or contain an obsolete value. */ }
  return { camera: '', microphone: '' }
}
export function saveDevicePreferences(storage: Pick<Storage, 'setItem'>, value: DeviceSelection) {
  try { storage.setItem(KEY, JSON.stringify(value)) } catch { /* Keep the in-memory choice. */ }
}
