export const number = (value: number) => value.toLocaleString('ko-KR')

export function duration(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}`
    : `${minutes}분`
}

export function measuredDuration(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  return safe < 60 ? `${Math.round(safe * 10) / 10}초` : duration(safe)
}

export function clock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  return [Math.floor(safe / 3600), Math.floor(safe / 60) % 60, safe % 60]
    .map((v) => String(v).padStart(2, '0'))
    .join(':')
}

export function dayKey(timestamp = Date.now()) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp)
}

export function businessDay(timestamp = Date.now()) {
  return dayKey(timestamp - 5 * 60 * 60 * 1000)
}

export function dateLabel(timestamp: number, withTime = false) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? ({ hour: '2-digit', minute: '2-digit', hour12: false } as const) : {}),
  }).format(timestamp)
}

export function safeReturnPath(value: string | null, fallback = '/credits') {
  return value?.startsWith('/') && !value.startsWith('//') && !/[\\\r\n]/.test(value)
    ? value
    : fallback
}
