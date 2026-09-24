// ============================================================
// Mezo · PeopleJeloltekPage — Emberek S4 candidate inbox (mezo-06o0.3)
// Source of truth: docs/design_2.0/prototypes/src/emberek-body.html renderJel(), ×1.18.
// S4's job — the nightly-run "new/returning name" candidate-inbox data flow (accept/reject)
// — is now wired: usePeople()'s `candidates` (status === 'candidate') render as `.ppl-candt`
// gold cards, each with an accept ("Felveszem") / reject ("Nem ő az / nem kell") pair
// straight through `decidePerson`. The foot line is always shown (prototype's own copy,
// not an empty-only aside) and the empty state renders only when there is no candidate left.
//
// Üveg (mezo-me75u.7, prototype `jeloltek()`): a gold t-lens halo hero; each candidate is ONE
// gold glass card (t-lens, the flat JELÖLT chip, the quote, the evidence line) with a flat
// „Nem ő az / nem kell" and a lit gold „Felveszem" (t-tick); no candidate = the dashed empty line.
// ============================================================
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Icon3D } from '@/shared/ui/clay'
import { usePeople } from '@/data/hooks'

export function PeopleJeloltekPage() {
  const navigate = useNavigate()
  const { candidates, decidePerson } = usePeople()

  return (
    <MozaikPage tone="gold" className="ppl-page ppl-jel">
      <PageHead glass onBack={() => navigate('/me/people')} label="Kapcsolatok" />
      <PageHero art="t-lens" accent="var(--dv-amber)" big={candidates.length} name="Jelöltek" />
      <PageBody>
        <EntranceGroup>
          {candidates.length === 0 && (
            <div className="ppl-empty uv-empty rise">
              Nincs több jelölt — az éjszakai kör hajnalban néz újra.
            </div>
          )}
          {candidates.map((c, i) => (
            <div key={c.id} className="ppl-candt glass rise" style={{ '--d': `${i * 40}ms`, '--i': i + 1 } as React.CSSProperties}>
              <div className="ppl-candt-head">
                <Icon3D name="t-lens" size={38} />
                <b>Új arc · {c.name}</b>
                <span className="ppl-candchip">JELÖLT</span>
              </div>
              <div className="ppl-candt-q">{c.notes.split('\n')[0]}</div>
              <div className="ppl-candt-ev">visszatérő név · éjszakai kör</div>
              <div className="ppl-candbtns">
                <button type="button" className="ppl-ghost" onClick={() => decidePerson(c.id, 'reject')}>
                  Nem ő az / nem kell
                </button>
                <button type="button" className="ppl-cta-gold" onClick={() => decidePerson(c.id, 'accept')}>
                  <Icon3D name="t-tick" size={18} /> Felveszem
                </button>
              </div>
            </div>
          ))}
          <p className="ppl-foot rise" style={{ '--d': '120ms' } as React.CSSProperties}>
            Jelöltet csak visszatérő, ismeretlen név kap. Az elvetett nevet nem javasolja újra.
          </p>
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
