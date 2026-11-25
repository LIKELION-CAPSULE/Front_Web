import test from 'node:test'
import assert from 'node:assert/strict'
import { startModeToApply } from '../src/features/mates/connection-start-mode.ts'
import { SettingsSaveQueue } from '../src/features/mates/settings-save-queue.ts'
import type { UserSettings } from '../src/shared/api/types.ts'

test('cached ADVANCED, server BASIC, settings GET late, connected at once: the connection stays BASIC', async () => {
  // The start response said BASIC (DemoProvider starts the connection there); the browser cache says ADVANCED.
  let mode: 'basic' | 'advanced' = 'basic'
  let local: 'basic' | 'advanced' = 'advanced'
  const applied = new Set<string>()
  let release!: (value: UserSettings) => void
  const queue = new SettingsSaveQueue({
    load: () => new Promise<UserSettings>(resolve => { release = resolve }),
    save: async () => null,
    applyServer: value => { if (value.defaultMode) local = value.defaultMode === 'ADVANCED' ? 'advanced' : 'basic' },
    timers: { set: () => 0, clear: () => {} },
  })
  const loading = queue.load()
  const apply = () => {
    const next = startModeToApply({ connectionId: '7', applied, confirmed: queue.confirmed('defaultMode'), mode: local })
    if (next) { applied.add('7'); mode = next }
  }
  apply() // the call screen opens before the GET returns
  assert.equal(mode, 'basic', 'the unconfirmed cache is not applied')
  release({ defaultMode: 'BASIC' })
  await loading
  apply() // the GET arrived: the confirmed setting applies
  assert.equal(mode, 'basic')
  assert.equal(applied.has('7'), true)
})

test('a mode the user changed in this session applies at once; the toggle on top is never overridden', () => {
  assert.equal(startModeToApply({ connectionId: '7', applied: new Set(), confirmed: true, mode: 'advanced' }), 'advanced')
  assert.equal(startModeToApply({ connectionId: '7', applied: new Set(['7']), confirmed: true, mode: 'basic' }), null, 'chosen on the call screen (or already applied)')
  assert.equal(startModeToApply({ connectionId: undefined, applied: new Set(), confirmed: true, mode: 'basic' }), null)
})
