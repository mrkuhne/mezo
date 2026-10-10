import { buildArcPoints, pointXY } from '@/features/today/logic/dayArc'
import { useCheckins, useDayRecap } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { CLAY_TO_3D } from '@/shared/ui/clay'
import type { ClayIconName, Icon3DName } from '@/shared/ui/clay'
import { Area, Btn, Card, Hero, Mark, Note, Row, Section } from '@/shared/ui/folyadek'
import { RitualFoot } from '@/features/ritual/components/RitualFoot'

// `CLAY_TO_3D` covers every context-free meaning; `i-sport` is ambiguous app-wide (Aktivitás vs.
// the Sport tile), and here it is always a logged or scheduled sport session — the volleyball.
const EVENT_ICON: Partial<Record<ClayIconName, Icon3DName>> = { 'i-sport': 't-volley' }
const iconOf = (icon: ClayIconName): Icon3DName => EVENT_ICON[icon] ?? CLAY_TO_3D[icon] ?? 't-day'

/** The recap data still speaks the text glyph „✓" for "done" (useDayRecap); the view shows
 *  that meaning as the tick mark instead, so the glyph is stripped from the visible meta. */
const stripTick = (meta: string) => meta.replace(/\s*✓\s*/g, ' ').trim()

/** How high the day arc stands at `t` (0 at the two ends, highest at midday) — dayArc's own Bézier. */
const arcHeight = (t: number) => 100 - pointXY(t).y

/**
 * Napzárás act 2 — A napod íve (mezo-ilsj, spec §4; Folyadék mezo-n4wf5.2, prototype `napzaras.2`).
 * The day arc is a liquid surface now: the kit `Area` drawn through dayArc.ts's points
 * (`buildArcPoints`/`pointXY` reused as-is) — one stop per check-in slot plus bedtime, labelled with
 * its time, and a dot on every check-in that is DONE. `workoutTime: null` is a deliberate
 * simplification: this is a retrospective recap, and the workout already gets its own row below from
 * `useDayRecap`. `Area` spaces its points evenly, so the surface is sampled at the stops and halfway
 * between each pair — every dot then sits exactly on the surface.
 * On a thin day (ADR 0010) this NEVER renders a "nothing happened" gap list — the verdict turns to
 * the soft acceptance line above whatever recap events DO exist.
 */
export function DayStoryStep({ onNext }: { onNext: () => void }) {
  const date = localDateString()
  const { checkins } = useCheckins()
  const { events, thinDay } = useDayRecap(date)
  const points = buildArcPoints({ checkins, workoutTime: null })

  const values = points.flatMap((p, i) => {
    const next = points[i + 1]
    return next ? [arcHeight(p.t), arcHeight((p.t + next.t) / 2)] : [arcHeight(p.t)]
  })
  const dots = points.map((p) => (p.kind === 'checkin-done' ? arcHeight(p.t) : null))
  const done = checkins.filter((c) => c.state === 'done').length

  return (
    <>
      <Hero
        label="A napod íve"
        verdict={thinDay ? 'Ma ennyi fért bele. Az is számít.' : 'Így telt a mai nap.'}
        sub={checkins.length > 0 && done === checkins.length ? 'Minden pont megvan.' : `${done} / ${checkins.length} pont megvan.`}
      >
        <div className="nrz-arc" role="img" aria-label="A napod íve — összegzés">
          <Area values={values} dots={dots} labels={points.map((p) => p.label)} height={132} />
        </div>
        <Note>A felszín a napod íve reggeltől lefekvésig, a pontok a kitöltött check-inek.</Note>
      </Hero>
      {events.length > 0 && (
        <>
          <Section n={1} title="A nap számai" />
          <Card>
            {events.map((ev, i) => {
              const meta = stripTick(ev.meta)
              // The tick shows only where the data said „✓" on a done row (a finished workout, a
              // reflected focus); a glyph-only meta then reads „kész", as on the approved prototype.
              const ticked = ev.done && ev.meta.includes('✓')
              return (
                <Row
                  key={`${ev.icon}-${ev.label}-${i}`}
                  icon={iconOf(ev.icon)}
                  title={ev.label}
                  value={ticked ? meta || 'kész' : meta || undefined}
                  right={ticked ? <Mark state="done" label={meta ? 'kész' : undefined} /> : undefined}
                  className={ev.done ? 'nrz-ok' : undefined}
                />
              )
            })}
          </Card>
        </>
      )}
      <RitualFoot><Btn grow onClick={onNext}>Tovább</Btn></RitualFoot>
    </>
  )
}
