// ============================================================
// Mezo · DayLoadPanel — a Napi terhelés SAJÁT OLDALA (mezo-yty6). Az első
// prototípus-kör alsó drawere helyett teljes Mozaik-oldal: szűk volt a bontásnak.
// Oldal-ÁLLAPOT, nem route (ProgramDayView idiom) — a még nem mentett vázlat
// így éli túl a be-/kilépést. Izmonként egy poszter-kártya a ~8 szett/edzés
// session-cap ellen, a hozzájáruló gyakorlatokkal.
// ============================================================
import type { MesoDay } from '@/data/types'
import { dayMuscleLoad, dayTone } from '@/features/train/logic/mesoLoad'
import { muscleColor } from '@/features/train/logic/muscleColors'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip, type PageTone } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const TONE: Record<string, PageTone> = { coral: 'coral', sage: 'sage', rose: 'rose', gold: 'gold' }

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

  return (
    <MozaikPage tone={TONE[dayTone(day.type)] ?? 'coral'}>
      <PageHead onBack={onBack} label={`‹ ${day.type}`} />
      <EntranceGroup>
        <PageHero
          icon="i-edzes"
          big={sets}
          name={`Napi terhelés · ${day.day} · ${day.type}`}
          sub={`szett · ~${minutes} perc · ${day.exercises.length} gyakorlat`}
        />
        <PageBody principle="A plafon nem tiltás — ha átléped, a modell átosztást javasol egy másik napra.">
          <div className="rise" style={{ marginBottom: 11 }}>
            <StatStrip>
              <StatCell value={sets} label="szett" />
              <StatCell value={`~${minutes}`} label="perc" />
              <StatCell value={rows.length} label="izomcsoport" />
              <StatCell value={flagged || '✓'} label="plafon-közel" over={flagged > 0} />
            </StatStrip>
          </div>
          <div className="mz-eyebrow rise" style={{ padding: '0 2px 6px' }}>
            Izmonként · a ~{rows[0]?.cap ?? 8} szett/edzés plafon ellen
          </div>
          {rows.map((r, i) => {
            const fam = muscleColor(r.colorMuscle)
            const amber = r.nearCap || r.over
            return (
              <div
                key={r.group}
                data-testid="day-load-card"
                data-group={r.group}
                className="mz-lcard rise"
                style={{ background: fam.wash, ['--d' as string]: `${90 + i * 60}ms` }}
              >
                <div className="mz-lcard-head">
                  <span className="mz-lcard-pill" style={{ background: fam.wash, color: fam.deep }}>{r.label}</span>
                  {r.over && <span className="mz-lcard-flag">a plafon fölött</span>}
                  {!r.over && r.nearCap && <span className="mz-lcard-flag">közel a plafonhoz</span>}
                  <span className="mz-grow" />
                  <span className="mz-lcard-num" style={{ color: fam.deep }}>
                    {r.sets}<small>/ ~{r.cap}</small>
                  </span>
                </div>
                <div className="mz-lcard-bar">
                  <span
                    style={{
                      display: 'block', height: '100%', borderRadius: 5,
                      width: `${Math.min(100, Math.round((r.sets / r.cap) * 100))}%`,
                      background: amber ? 'var(--amber-deep)' : fam.deep,
                    }}
                  />
                </div>
                <div className="mz-lcard-chips">
                  {r.exercises.map((e) => (
                    <span className="mz-lcard-chip" key={e.exerciseId}>{e.name} +{e.sets}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
