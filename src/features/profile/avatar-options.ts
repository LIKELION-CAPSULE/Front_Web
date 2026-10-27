import type { AvatarSettings } from '../demo/types'

export const avatarCategories: { id: keyof AvatarSettings; label: string }[] = [
  { id: 'hair', label: '헤어' },
  { id: 'outfit', label: '의상' },
  { id: 'appearance', label: '외모' },
  { id: 'background', label: '배경' },
]
export const figureColors = [
  '#45405f',
  '#efd5b2',
  '#865e5d',
  '#292c49',
  '#e4a8b7',
  '#8a74bd',
  '#b37851',
  '#7c9b9b',
]
export const avatarShades = [
  '#e6e0f3',
  '#ece5fb',
  '#dde6e4',
  '#eae0e8',
  '#e5e6dc',
  '#e1dff0',
  '#e9dfd7',
  '#e0e7ef',
]
