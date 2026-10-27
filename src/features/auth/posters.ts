import { roomPosters } from '@/features/rooms/posters'
import type { PosterImage } from '@/shared/ui/poster-mosaic/PosterMosaic'

export const authPosters: readonly PosterImage[] = Object.entries(roomPosters).map(([id, src]) => ({
  id,
  src,
}))
