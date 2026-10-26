import { createContext, useContext } from 'react'
export type ToastMessage = { message: string; action?: { label: string; onClick: () => void } }
export const ToastContext = createContext<((message: ToastMessage) => void) | null>(null)
export function useToast() {
  const notify = useContext(ToastContext)
  if (!notify) throw new Error('ToastProvider is missing.')
  return notify
}
