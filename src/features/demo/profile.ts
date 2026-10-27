import type { DemoState } from './types.ts'

export const DEFAULT_PROFILE_NAME = '꾸윙젠렝'
const LEGACY_PROFILE_NAME = '승희'

export function resolveProfileName(value: string) {
  const name = value.trim()
  return !name || name === LEGACY_PROFILE_NAME ? DEFAULT_PROFILE_NAME : name
}

/** Update the old demo nickname without resetting study history or custom profiles. */
export function migrateDemoProfile(state: DemoState): DemoState {
  const name = resolveProfileName(state.profile.name)
  let changed = name !== state.profile.name
  const messages =
    name === DEFAULT_PROFILE_NAME
      ? state.messages.map((message) => {
          if (message.sender !== 'character' || !message.text.includes(LEGACY_PROFILE_NAME))
            return message
          changed = true
          return {
            ...message,
            text: message.text
              .replaceAll(`${LEGACY_PROFILE_NAME}야,`, `${name},`)
              .replaceAll(LEGACY_PROFILE_NAME, name),
          }
        })
      : state.messages
  return changed ? { ...state, profile: { ...state.profile, name }, messages } : state
}
