// ============================================================
// Mezo · DayLoadPanel — a Napi terhelés SAJÁT OLDALA (mezo-yty6; Folyadék mezo-n4wf5.3,
// prototype vilagos/edzes.js `weekEd(r, 'nap-terh')`). Oldal-ÁLLAPOT, nem route — a még nem
// mentett vázlat így éli túl a be-/kilépést. A hero izmonként egy edény a kb. 8 szett / edzés
// határ vízvonalával (dayMuscleLoad → sets, cap), alatta izmonként egy sor: szint a határhoz
// mérve és a hozzájáruló gyakorlatok.
// ============================================================
import type { MesoDay } from '@/data/types'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { dayMuscleLoad } from '@/features/train/logic/mesoLoad'
import { SESSION_MUSCLE_CAP } from '@/features/train/logic/setBudget'
import {
  Card, Facts, FrameBack, Hero, LevelMarks, Note, Page, Row, Section, St, Tags, Tubes, useFrameTitle,
} from '@/shared/ui/folyadek'

interface DayLoadPanelProps {
  day: MesoDay
  /** Estimated session minutes — computed by the caller (pages own the timing profile). */
  minutes: number
  onBack: () => void
}

export function DayLoadPanel({ day, minutes, onBack }: DayLoadPanelProps) {
  const rows = dayMuscleLoad(day)
  const sets = day.exercises.reduce((a, e) => a + e.workingSets, 0)
  const flagged = rows.filter((r) => r.nearCap || r.over).length
  const cap = rows[0]?.cap ?? SESSION_MUSCLE_CAP
  // the vessel is one set taller than the limit, so the limit's waterline stands inside it
  const rim = cap + 1

  useFrameTitle({ title: 'Napi terhelés', eyebrow: `${day.day} · ${day.type}` })

  return (
    <Page className="ew-page">
      <FrameBack className="ew-back" onBack={onBack}>‹ {day.type}</FrameBack>
      <Hero
        className="ew-hero"
        label={`Napi terhelés · ${day.day} · ${day.type}`}
        verdict={flagged ? `${flagged} izom közel jár a napi határhoz.` : 'Egy izom sincs a napi határ közelében.'}
        sub={`${sets} szett · ~${minutes} perc · ${day.exercises.length} gyakorlat`}
      >
        {rows.length > 0 && (
          <div className="ew-hg">
            <Tubes
              size="sm" height={92} gap={6}
              items={rows.map((r) => ({
                node: <Mchp muscle={r.colorMuscle} size={28} />,
                label: r.label,
                value: r.sets,
                note: `/ ~${r.cap}`,
                pct: (r.sets / rim) * 94,
                wl: (r.cap / rim) * 94,
                color: deepMuscle(r.colorMuscle),
                over: r.over,
              }))}
            />
          </div>
        )}
        <Facts items={[[sets, 'szett'], [`~${minutes}`, 'perc'], [rows.length, 'izom'], [flagged || '✓', 'határ-közel']]} />
      </Hero>

      <Section n={1} title={`Izmonként · a kb. ${cap} szett/edzés határhoz mérve`} />
      <Card>
        {rows.map((r) => (
          <Row
            key={r.group}
            data-testid="day-load-card"
            data-group={r.group}
            className="ew-dl"
            left={<Mchp muscle={r.colorMuscle} sm />}
            title={(
              <>
                {r.label}
                {r.over && <St tone="warn">a határ fölött</St>}
                {!r.over && r.nearCap && <St tone="warn">közel a határhoz</St>}
              </>
            )}
            more={(
              <>
                <LevelMarks pct={(r.sets / rim) * 100} color={deepMuscle(r.colorMuscle)} height={14} marks={[{ at: (r.cap / rim) * 100 }]} />
                <Tags items={r.exercises.map((e) => `${e.name} +${e.sets}`)} />
              </>
            )}
            value={<>{r.sets} <small>/ ~{r.cap}</small></>}
          />
        ))}
        <Note>A határ nem tiltás — ha átléped, a rendszer átosztást javasol egy másik napra.</Note>
      </Card>
    </Page>
  )
}
