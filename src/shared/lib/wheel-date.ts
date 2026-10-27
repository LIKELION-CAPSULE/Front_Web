export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function wheelDate(year: number, month: number, day: number, min?: string) {
  const validMonth = Math.max(1, Math.min(12, month))
  const validDay = Math.max(1, Math.min(daysInMonth(year, validMonth), day))
  const date = `${String(year).padStart(4, '0')}-${String(validMonth).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`
  return min && date < min ? min : date
}
