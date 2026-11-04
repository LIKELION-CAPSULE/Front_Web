/** Keep the reset credential in component memory and remove every URL copy. */
export function passwordResetLocation(href: string) {
  const url = new URL(href)
  const token = url.searchParams.get('token') || null
  url.searchParams.delete('token')
  return { token, cleanPath: url.pathname + url.search + url.hash }
}
