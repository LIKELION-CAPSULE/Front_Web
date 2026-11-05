import { useImperativeHandle, useState, type Ref } from 'react'

export type CountUpHandle = { show: (value: number | null) => void }

/**
 * Plain text of `format(value)`, with no wrapper element. An animation can show other values through `ref`;
 * `show(null)` returns to the real value.
 */
export function CountUpText({ value, format, ref }: { value: number; format: (value: number) => string; ref?: Ref<CountUpHandle> }) {
  const [shown, setShown] = useState<number | null>(null)
  useImperativeHandle(ref, () => ({ show: setShown }), [])
  return format(shown ?? value)
}
