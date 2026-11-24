import { Component, type ReactNode } from 'react'

/**
 * Error boundary around an optional lazy part of the login stage (the heatmap logo chunk). A chunk that fails to load
 * (offline, a deploy replaced it) or throws while rendering only removes that part: the boundary renders nothing and
 * reports it once, and the static picture underneath stays. It never resets, so a failed `lazy()` is not retried in a
 * loop. The app has no root error boundary, so without this a failed chunk would take the whole login screen down.
 */
export class ChunkBoundary extends Component<{ onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(): void {
    this.props.onError?.()
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
