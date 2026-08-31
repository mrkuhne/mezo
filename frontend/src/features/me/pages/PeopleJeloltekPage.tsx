// ============================================================
// Mezo · PeopleJeloltekPage — Emberek S3 hub, "Jelöltek" sibling page (mezo-06o0.2)
// Source of truth: docs/design_2.0/prototypes/src/emberek-body.html renderJel()'s empty
// branch, ×1.18. Task 2 wires ONLY the honest empty state — the candidate-inbox data flow
// (nightly-run "new/returning name" detection, accept/reject) is S4's job; this page never
// fabricates a candidate list to fill the space in the meantime.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function PeopleJeloltekPage() {
  const navigate = useNavigate()

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me/people')} label="‹ Kapcsolatok" />
      <PageHero icon="i-kristaly" big={0} name="Jelöltek" />
      <PageBody>
        <EntranceGroup>
          <div className="ppl-empty rise">
            Nincs több jelölt — az éjszakai kör hajnalban néz újra.
          </div>
          <p className="ppl-foot rise" style={{ '--d': '40ms' } as React.CSSProperties}>
            Az éjszakai kör ismeretlen, visszatérő neveket figyel — innen egy koppintással
            felveheted őket.
          </p>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
