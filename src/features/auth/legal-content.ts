/** Use the bundled document while the API returns an empty body or a draft placeholder. */
export function hasLegalContent(content: string | null | undefined): content is string {
  if (!content?.trim()) return false
  const text = content.replace(/[\s()[\]_*#.!…]/g, '')
  return !/^(?:(?:서비스)?이용약관|개인정보처리방침)?(?:본문|내용)?준비중(?:입니다|이에요)?$/.test(text)
}
