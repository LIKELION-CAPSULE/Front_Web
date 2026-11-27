/** UI projections for the beta. These are not an agreed backend wire contract. */
export type BetaCreditEntry = { id: string; at: number; description: string; kind: 'attendance' | 'invite' | 'use' | 'expiration'; change: number; balance: number }
export type BetaWallet = { attendance: number; invitation: number; usedToday: number; attendanceExpiresAt: number; entries: readonly BetaCreditEntry[] }
