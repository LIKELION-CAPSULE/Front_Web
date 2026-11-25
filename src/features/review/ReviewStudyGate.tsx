import { App } from '@/app/App'
import { useDemo } from '@/features/demo/demo-context'
import { AppLoading } from '@/shared/ui/AppLoading'

/** Wait for the review image to load before opening the call preview. */
export function ReviewStudyGate() {
  const { state } = useDemo()
  return state.activeSession ? <App /> : <AppLoading label="메이트를 불러오고 있어요." />
}
