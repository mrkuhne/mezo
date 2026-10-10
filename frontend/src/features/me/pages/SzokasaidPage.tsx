// ============================================================
// Mezo · SzokasaidPage (mezo-mgpr; Folyadék F2 mezo-n4wf5.2) — /nap/rutin/szokasok, prototype
// vilagos/nap.js `szokasok`. The hero's four vessels are the four STAGES (the riper, the higher
// the level; multi-toggle filters — none selected = everything shows, so there is no fifth
// "Mind"), then one row per habit: its automaticity as a small level, the stage, what is still
// ahead, and the repetitions.
//
// Honesty rules carried over from the formation view (mezo-08zl): under minReps there is no
// percentage (the level prints "—") and no deadline, only what is missing; a missing recent
// rate yields no weeks estimate; a miss slows the curve and never resets it — no streaks,
// no red (ADR 0010). The page never ticks a habit.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHabitCatalog, useHabitFormations } from '@/data/hooks'
import type { HabitDefInfo, HabitFormation } from '@/data/types'
import { RbBack } from '@/features/me/components/routineBits'
import { etaPhrase, FORMATION_STAGES, stageIndexOf } from '@/features/me/logic/habitFormation'
import { cn } from '@/shared/lib/cn'
import { Btn, Card, Empty, ErrorRow, Hero, Mini, Note, Page, Row, Section, useFrameTitle } from '@/shared/ui/folyadek'

/** Estimate present = the server answered AND the honesty gate is open (minReps reached). */
function hasEstimate(f: HabitFormation | undefined): f is HabitFormation & { automaticityPct: number } {
  return f != null && f.thresholdPct > 0 && f.automaticityPct != null
}

function stageIdxOf(f: HabitFormation | undefined): number {
  return hasEstimate(f) ? stageIndexOf(f.automaticityPct) : 0
}

/** The hero's verdict from the stage counts: how many run on their own, how many are on the way. */
function verdictOf(counts: number[]): string {
  const settled = counts[3]
  const onWay = counts[1] + counts[2]
  if (settled > 0 && onWay > 0) return `${settled} már magától megy, ${onWay} úton van oda.`
  if (settled > 0) return `${settled} már magától megy.`
  if (onWay > 0) return `${onWay} úton van afelé, hogy magától menjen.`
  return 'Még mind tudatos — az ismétlés viszi előre.'
}

export function SzokasaidPage() {
  const navigate = useNavigate()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const [filter, setFilter] = useState<Set<number>>(new Set())
  useFrameTitle({ title: 'Szokásaid', eyebrow: 'Rutinok · formálódás szerint' })

  // Active chains' active defs — the same "running habits" rule as the hub's aktív szokás fact:
  // a paused chain does not run, so its defs are not on this list either.
  const defs = (catalog?.chains ?? [])
    .filter((c) => c.isActive)
    .sort((a, b) => a.position - b.position)
    .flatMap((c) => [...c.defs].sort((a, b) => a.position - b.position))
    .filter((d) => d.isActive)
  const formations = useHabitFormations(defs.map((d) => d.habitKey))
  const toWizard = () => navigate('/nap/rutin/uj')

  if (defs.length === 0) {
    return (
      <Page>
        <RbBack label="Rutinok" fallback="/nap/rutin/epites" />
        <Card>
          {isPending ? <Note>Szokások betöltése…</Note>
            : isError ? <ErrorRow message="Nem sikerült betölteni a szokásokat." onRetry={refetch} />
              : (
                <Empty icon="t-harvest" actions={<Btn onClick={toWizard}>+ Új szokás</Btn>}>
                  Még nincs aktív szokásod — az „Új szokás” indítja az elsőt.
                </Empty>
              )}
        </Card>
      </Page>
    )
  }

  const counts = [0, 0, 0, 0]
  for (const d of defs) counts[stageIdxOf(formations.get(d.habitKey))] += 1

  const visible = defs
    .filter((d) => filter.size === 0 || filter.has(stageIdxOf(formations.get(d.habitKey))))
    // "formálódás szerint rendezve": the furthest-along first; no-estimate rows sink last.
    .sort((a, b) => {
      const fa = formations.get(a.habitKey)
      const fb = formations.get(b.habitKey)
      return (hasEstimate(fb) ? fb.automaticityPct : -1) - (hasEstimate(fa) ? fa.automaticityPct : -1)
    })

  const toggle = (i: number) => {
    setFilter((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const habitRow = (d: HabitDefInfo) => {
    const f = formations.get(d.habitKey)
    const enough = hasEstimate(f)
    const si = stageIdxOf(f)
    const settled = enough && f.automaticityPct >= f.thresholdPct
    const eta = enough ? etaPhrase(f.weeksToThresholdLo, f.weeksToThresholdHi) : null
    const etaBig = f == null ? '—'
      : !enough ? `${Math.max(0, f.minReps - f.reps)} ismétlés`
        : settled ? 'Beérett'
          : eta != null ? `${eta.big}` : '—'
    const etaSub = f == null ? 'még nincs becslés'
      : !enough ? 'a becslésig — addig nincs határidő'
        : settled ? 'a küszöb fölött — jó horgony egy új szokásnak'
          : eta != null ? 'van hátra ebben a tempóban' : 'nincs friss ismétlés — tempó nélkül nincs becslés'
    return (
        <Row
          key={d.habitKey} data-testid={`habit-tile-${d.habitKey}`}
          left={(
            <Mini
              pct={enough ? f.automaticityPct : 0}
              color={settled ? 'var(--fo-ok)' : undefined}
              value={enough ? `${f.automaticityPct}%` : '—'}
            />
          )}
          title={d.title}
          sub={(
            <>
              <span className="rb-stage">{enough ? FORMATION_STAGES[si].label : 'még gyűlik az adat'}</span>
              <span className="rb-eta"><b>{etaBig}</b> {etaSub}</span>
            </>
          )}
          value={<>{f?.reps ?? '—'}<small>ismétlés</small></>}
          right=""
          onClick={() => navigate(`/nap/rutin/szokas/${d.habitKey}`)}
        />
    )
  }

  return (
    <Page>
      <RbBack label="Rutinok" fallback="/nap/rutin/epites" />
      <Hero
        label={`${defs.length} aktív szokás · melyik szakaszt mutassam?`}
        verdict={verdictOf(counts)}
        sub="Egy szokás ereje a 28 napos pipáiból jön — nem a sorozatból."
        actions={<Btn onClick={toWizard}>+ Új szokás</Btn>}
      >
        {/* The four stages as four vessels: the riper the stage, the higher its level. */}
        <div className={cn('rb-stg', filter.size > 0 && 'filtered')}>
          {FORMATION_STAGES.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={cn('rb-stg-b', filter.has(i) && 'on')}
              aria-pressed={filter.has(i)}
              onClick={() => toggle(i)}
            >
              <span className="t"><i style={{ height: `${(i + 1) * 25}%` }} /><b>{counts[i]}</b></span>
              <small>{s.label}</small>
            </button>
          ))}
        </div>
      </Hero>

      <Section n={1} title={`Szokások · ${visible.length}`} />
      <Card>
        {visible.map((d) => habitRow(d))}
        {visible.length === 0 && <Empty icon="t-harvest">Ebben a szakaszban most nincs szokásod.</Empty>}
      </Card>
    </Page>
  )
}
