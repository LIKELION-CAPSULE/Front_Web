import { useContext, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { BackendContext } from '@/features/backend/backend-context'
import { LegalDocumentBody } from '@/features/auth/components/LegalDocumentBody'
import { legalDocuments, type LegalDocumentId } from '@/features/auth/data/legal-documents'
import { availableMates } from '@/features/mates/catalog'
import { beginTour } from '@/features/tour/tour-start'
import { Dialog } from '@/shared/ui/Dialog'

/**
 * Only links with a real destination are shown. 「서비스 소개」, 「고객 문의」 and the SNS marks (Discord, YouTube, X) are
 * left out until those pages and channels exist; add them back here with their addresses then.
 */
const LEGAL_LINKS: readonly LegalDocumentId[] = ['terms', 'privacy']

/** Draft (PM decision 2026-11-26, wording to be confirmed by the user). */
export const AI_NOTICE = 'CAPSULE의 메이트는 실제 사람이 아닌 AI 캐릭터이며, 메이트의 대화는 AI가 생성해요.'

export function SiteFooter() {
  const location = useLocation()
  const navigate = useNavigate()
  const [legal, setLegal] = useState<LegalDocumentId | null>(null)
  // The loading skeleton draws this footer before the backend is ready: no tour and no legal text then (both need
  // it). The tour walks through a mate's screens, so without a mate there is nothing to show yet.
  const backend = useContext(BackendContext)
  const tourReady = backend ? availableMates(backend.home).length > 0 : false
  return (
    <>
      <footer className="app-footer page-container">
        <div className="app-footer-start">
          <span className="app-footer-brand">CAPSULE</span>
          <nav aria-label="서비스 정보" className="app-footer-links">
            {/* 「사용법 보기」 starts the service tour (src/features/tour) from any screen; 「그만보기」 comes back here. */}
            <button type="button" className="mate-tutorial-trigger" data-tutorial-trigger disabled={!tourReady}
              onClick={() => navigate(beginTour(location.pathname + location.search))}>사용법 보기</button>
            {/* The same server terms as the login screen and the mobile notice, in the same dialog. */}
            {LEGAL_LINKS.map((id) => (
              <button key={id} type="button" disabled={!backend} aria-haspopup="dialog" onClick={() => setLegal(id)}>
                {legalDocuments[id].title}
              </button>
            ))}
          </nav>
        </div>
        <div className="app-footer-end">
          <span>오늘도, CAPSULE과 함께하세요 ♡</span>
        </div>
        {/* The AI disclosure (PM decision 2026-11-26): here once for the app screens, instead of a tag on every mate. */}
        <p className="app-footer-notice">{AI_NOTICE}</p>
      </footer>
      {/* Outside the footer so the dialog does not inherit its small, dimmed text. */}
      {backend && (
        <Dialog
          open={legal !== null}
          onClose={() => setLegal(null)}
          title={legal ? legalDocuments[legal].title : ''}
          // Wider than the 512px Dialog default for long legal text, as on the login screen.
          className="max-w-3xl"
        >
          {legal && <LegalDocumentBody document={legal} />}
        </Dialog>
      )}
    </>
  )
}
