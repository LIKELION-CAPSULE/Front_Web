import type { MateContentPort } from '@/features/mates/mate-contract'
import { resetScopes } from '@/features/mates/mate-contract'
import { ApiError } from '@/shared/api/client'
import { matePortrait } from '@/features/mates/artwork'
import type { ReviewScenario } from './catalog'

/** A silent WAV for testing the audio controls; this is not a mate's voice asset. */
function silentSample() {
  const bytes = new Uint8Array(44 + 16000), view = new DataView(bytes.buffer)
  const text = (at: number, value: string) => [...value].forEach((character, index) => view.setUint8(at + index, character.charCodeAt(0)))
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, 16000, true)
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`
}

/** Explicit review-only port; production receives neither this implementation nor these values. */
export function createReviewMatePort(scenario: ReviewScenario): MateContentPort {
  let revision = 1, loads = 0, resets = 0
  function trace(operation: string, input: unknown) { window.dispatchEvent(new CustomEvent('capsule-review:mate-operation', { detail: { operation, input } })) }
  return {
    load: async (userId, characterId) => {
      trace('load', { userId, characterId }); loads++
      await new Promise(resolve => setTimeout(resolve, scenario.fault === 'mate-pending' ? 600 : 80))
      if (scenario.fault === 'mate-load' && loads === 1) throw new ApiError('요청을 처리하지 못했어요.', 503)
      return {
        characterId,
        // The existing image-stage factory stands in for a real model in the UI workbench.
        model: { modelJsonUrl: scenario.fault === 'mate-model' && loads === 1 ? '/__review/missing-mate-preview.webp' : matePortrait('chaerin') },
        voiceSampleUrl: scenario.fault === 'mate-audio' ? '/__review/missing-sample.wav' : silentSample(),
        conversationRevision: `review-${revision}`,
      }
    },
    resetConversation: async input => {
      trace('reset', input); resets++
      await new Promise(resolve => setTimeout(resolve, 120))
      if (scenario.fault === 'mate-reset' && resets === 1) throw new ApiError('요청을 처리하지 못했어요.', 503)
      if (scenario.fault === 'mate-conflict' && resets === 1) { revision++; throw new ApiError('요청을 처리하지 못했어요.', 409) }
      if (input.expectedRevision !== `review-${revision}`) throw new ApiError('요청을 처리하지 못했어요.', 409)
      const previousRevision = `review-${revision}`
      revision++
      return { characterId: input.characterId, previousRevision, revision: `review-${revision}`, cleared: scenario.fault === 'mate-partial' ? ['messages'] : [...resetScopes] }
    },
  }
}
