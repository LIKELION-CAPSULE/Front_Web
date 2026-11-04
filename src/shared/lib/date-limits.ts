export const MIN_CALENDAR_YEAR = 2026
export const MIN_CALENDAR_DATE = `${MIN_CALENDAR_YEAR}-01-01`
export const MIN_CALENDAR_MONTH = `${MIN_CALENDAR_YEAR}-01`

/** ISO calendar values compare lexically; a field may impose a later minimum, such as today. */
export function clampCalendarDate(value: string, min = MIN_CALENDAR_DATE) {
  const minimum = min < MIN_CALENDAR_DATE ? MIN_CALENDAR_DATE : min
  return value < minimum ? minimum : value
}

export function clampCalendarMonth(value: string) {
  return value < MIN_CALENDAR_MONTH ? MIN_CALENDAR_MONTH : value
}
