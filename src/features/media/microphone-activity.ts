/** Input activity only: a local volume gate, not speech recognition. */
export class MicrophoneActivity {
  private lastInputAt = Number.NEGATIVE_INFINITY
  private speaking = false

  reset() {
    this.lastInputAt = Number.NEGATIVE_INFINITY
    this.speaking = false
  }

  sample(rms: number, now: number) {
    if (!Number.isFinite(rms) || !Number.isFinite(now) || rms < 0) {
      this.reset()
      return false
    }
    // Separate entry/release levels and a short hold keep syllable gaps from flickering.
    if (rms >= (this.speaking ? 0.015 : 0.025)) this.lastInputAt = now
    this.speaking = now - this.lastInputAt < 300
    return this.speaking
  }
}

export function microphoneRms(samples: Float32Array) {
  if (!samples.length) return 0
  return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
}
