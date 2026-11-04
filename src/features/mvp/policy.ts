export const MVP_ROOM_ID = 'dawn-library'
export const MVP_CHARACTER_ID = 'chaerin'
export const MVP_GOAL_MINUTES = 3

export const isMvpRoom = (id: string) => id === MVP_ROOM_ID
export const isMvpCharacter = (id: string) => id === MVP_CHARACTER_ID

// Normalized source coordinates keep the same characters clear in SVG and Canvas.
export const classroomClearRegions = {
  group: [[0.38, 0], [0.61, 0], [0.64, 0.34], [0.75, 0.72], [0.76, 1], [0.24, 1], [0.26, 0.72], [0.34, 0.34]],
  banner: [[0.60, 0], [0.74, 0], [0.76, 0.34], [0.79, 0.72], [0.78, 1], [0.54, 1], [0.55, 0.72], [0.58, 0.34]],
} as const
