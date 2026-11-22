export type LegalDocumentId = 'terms' | 'privacy'

/** Labels only. Account consent must display the server version, never the landing-page copy. */
export const legalDocuments = {
  terms: { title: '이용약관' },
  privacy: { title: '개인정보 처리방침' },
}
