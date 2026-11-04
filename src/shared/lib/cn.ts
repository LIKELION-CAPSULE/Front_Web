import { extendTailwindMerge } from 'tailwind-merge'
import { designTypography } from '../design/tokens.ts'

// Custom text-* sizes must stay independent from text colors when merging.
const mergeClasses = extendTailwindMerge({
  extend: { theme: { text: Object.keys(designTypography) } },
})

export function cn(...classes: (string | false | null | undefined)[]) {
  return mergeClasses(classes.filter(Boolean).join(' '))
}
