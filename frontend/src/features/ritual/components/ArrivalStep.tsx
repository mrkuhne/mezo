import { Btn, Card, Hero, Jar, Section, Step } from '@/shared/ui/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { RitualFoot } from '@/features/ritual/components/RitualFoot'

/** What the five acts after this one are, in order — the „Ez jön" list. */
const AHEAD: { icon: Icon3DName; title: string; sub: string }[] = [
  { icon: 't-trend', title: 'A napod íve', sub: 'hogyan telt a mai nap' },
  { icon: 't-journal', title: 'A szavaid', sub: 'ami megmaradna belőle' },
  { icon: 't-ring', title: 'Nyitott hurkok', sub: 'amit még le lehet zárni' },
  { icon: 't-harvest', title: 'A mai termés', sub: 'amit ma összegyűjtöttél' },
  { icon: 't-sleep', title: 'Lezárva', sub: 'és jöhet az este' },
]

/**
 * Napzárás act 1 — Megérkezés (mezo-ilsj, spec §4; Folyadék mezo-n4wf5.2, prototype `napzaras.1`).
 * The hero is the day's jar: its level is the share of today's check-ins that are done (a number
 * the page already holds — never an invented score), then the list of the five acts ahead.
 * „A nap véget ért." / „Zárjuk le együtt." are the fixed arrival lines.
 */
export function ArrivalStep({ onNext, checkinsDone, checkinsTotal }: {
  onNext: () => void
  /** Today's finished check-ins and the day's slot count — the jar's level. Omitted: an empty jar, no number. */
  checkinsDone?: number
  checkinsTotal?: number
}) {
  const known = checkinsDone != null && checkinsTotal != null && checkinsTotal > 0
  return (
    <>
      <Hero
        label="Napzárás"
        verdict={<span className="nrz-vbig">A nap véget ért.</span>}
        sub="Zárjuk le együtt. Amit ma összegyűjtöttél, edénybe kerül, a végén fedelet kap. Kb. 3 perc."
      >
        <span className="nrz-hjar">
          <Jar size={88} pct={known ? (checkinsDone / checkinsTotal) * 100 : 0} text={known ? `${checkinsDone}/${checkinsTotal}` : undefined} />
        </span>
      </Hero>
      <Section n={1} title="Ez jön" />
      <Card>
        {AHEAD.map((a, i) => <Step key={a.title} time={`${i + 2}.`} icon={a.icon} title={a.title} sub={a.sub} />)}
      </Card>
      <RitualFoot><Btn grow onClick={onNext}>Kezdjük</Btn></RitualFoot>
    </>
  )
}
