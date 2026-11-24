/** One finished connection with a mate. The jar stacks exactly one capsule per record. */
export type CapsuleRecord = {
  id: string
  /** Epoch ms when the connection started. */
  startedAt: number
  /** Epoch ms when the connection ended. Used to decide whether the capsule is new since the last visit. */
  endedAt?: number
  /** Time spent together in this connection. Drives capsule size, brightness and the jar height. */
  durationSeconds: number
  /** The mate's line for that day, when the server provides one. */
  line?: string
  /** Target of the 「연결 기록 보기」 link (`/connections/:id`). */
  connectionId?: string
}

/** Per-mate colours. Every value is a CSS hex colour. */
export type CapsuleJarTheme = {
  /** Light half of the two-tone capsule (logo v2 body): highlight → shade. */
  lightHalf: string
  lightHalfShade: string
  /** Tinted half (logo v2 seam purple): highlight → shade. */
  tintHalf: string
  tintHalfShade: string
  /** Light the capsules give off and the jar fills with. */
  glow: string
  /** Back light of the panel. */
  rim: string
}
