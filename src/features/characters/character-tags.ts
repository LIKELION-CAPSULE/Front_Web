export function characterTags(description: string) {
  return description
    .split(/\s*·\s*|\s+[-–—]\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => `#${tag.replace(/\s+/g, '_')}`)
}
