// ============================================================
// Mezo · SzokasaidPage (mezo-mgpr) — /me/rutin/szokasok, prototype rutin-formalodas.html
// `pg-lista` ×1.18. The habit list left the hub for its own page: four STAGE FILTER tiles
// (multi-toggle; none selected = everything shows, so there is no fifth "Mind" tile), then
// one full-width tile per habit — name top-left with its stage, the reps as the big numeral,
// the automaticity ring with its % on the right, and the remaining-time row at the bottom.
//
// Honesty rules carried over from the formation view (mezo-08zl): under minReps there is no
// percentage (the ring prints "—") and no deadline, only what is missing; a missing recent
// rate yields no weeks estimate; a miss slows the curve and never resets it — no streaks,
// no red (ADR 0010). The page never ticks a habit.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHabitCatalog, useHabitFormations } from '@/data/hooks'
import type { HabitDefInfo, HabitFormation } from '@/data/types'
import { etaPhrase, FORMATION_STAGES, stageIndexOf } from '@/features/me/logic/habitFormation'
import { cn } from '@/shared/lib/cn'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

// Stage tones on the app's tokens (prototype STAGES colors): mut → gold → deep gold → sage.
const STAGE_TONE = [
  { c: 'var(--mz-ink-mut)', w: 'var(--surface-recess)', s: 'color-mix(in srgb, var(--text-primary) 30%, transparent)' },
  { c: 'var(--accent-base)', w: 'var(--mz-cell-gold-bg)', s: 'color-mix(in srgb, var(--accent-base) 45%, transparent)' },
  { c: 'var(--accent-deep)', w: 'var(--mz-cell-gold-bg)', s: 'color-mix(in srgb, var(--accent-base) 50%, transparent)' },
  { c: 'var(--mz-cell-sage-ink)', w: 'var(--mz-cell-sage-bg)', s: 'color-mix(in srgb, var(--mz-cell-sage-ink) 50%, transparent)' },
] as const

const PRINCIPLE = 'Minden csempe a saját ívét mutatja: az ismétlésszám a nagy szám, az ív a '
  + 'becsült automatizmus. A kihagyás lassítja a görbét, de sosem nullázza — nincs megtört '
  + 'lánc, nincs piros.'

function rise(delayMs: number): CSSProperties {
  return { '--d': `${delayMs}ms` } as CSSProperties
}

/** Estimate present = the server answered AND the honesty gate is open (minReps reached). */
function hasEstimate(f: HabitFormation | undefined): f is HabitFormation & { automaticityPct: number } {
  return f != null && f.thresholdPct > 0 && f.automaticityPct != null
}

function stageIdxOf(f: HabitFormation | undefined): number {
  return hasEstimate(f) ? stageIndexOf(f.automaticityPct) : 0
}

/** The prototype's `arcSvg`: the automaticity ring with its % (or an honest dash) inside. */
function Arc({ pct, color }: { pct: number | null; color: string }) {
  const r = 21
  const c = 2 * Math.PI * r
  const off = c * (1 - (pct ?? 0) / 100)
  return (
    <svg className="rt-harc" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r={r} fill="none" stroke="color-mix(in srgb, var(--text-primary) 9%, transparent)" strokeWidth="5" />
      <circle
        cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="13" fill="var(--text-primary)">
        {pct != null ? `${pct}%` : '—'}
      </text>
    </svg>
  )
}

export function SzokasaidPage() {
  const navigate = useNavigate()
  const { catalog, isPending, isError, refetch } = useHabitCatalog()
  const [filter, setFilter] = useState<Set<number>>(new Set())

  // Active chains' active defs — the same "running habits" rule as the hub's aktív szokás cell:
  // a paused chain does not run, so its defs are not on this list either.
  const defs = (catalog?.chains ?? [])
    .filter((c) => c.isActive)
    .sort((a, b) => a.position - b.position)
    .flatMap((c) => [...c.defs].sort((a, b) => a.position - b.position))
    .filter((d) => d.isActive)
  const formations = useHabitFormations(defs.map((d) => d.habitKey))

  if (defs.length === 0) {
    return (
      <MozaikPage tone="gold">
        <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin" />
        <PageBody>
          {isPending ? <GhostState message="Szokások betöltése…" lines={3} />
            : isError ? <GhostState message="Nem sikerült betölteni a szokásokat." ctaLabel="Újra" onCta={refetch} />
              : <GhostState message="Még nincs aktív szokásod — az Építs ajtó indítja az elsőt." />}
        </PageBody>
      </MozaikPage>
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

  const tile = (d: HabitDefInfo, order: number) => {
    const f = formations.get(d.habitKey)
    const enough = hasEstimate(f)
    const si = stageIdxOf(f)
    const tone = STAGE_TONE[si]
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
      <button
        key={d.habitKey}
        type="button"
        className="rt-htile rise"
        style={{ ...rise(60 + order * 30), '--hc': tone.c, '--hw': tone.w, '--hs': tone.s } as CSSProperties}
        onClick={() => navigate(`/me/rutin/szokas/${d.habitKey}`)}
        data-testid={`habit-tile-${d.habitKey}`}
      >
        <span className="rt-htop">
          <span className="rt-hleft">
            <span className="rt-hnm">{d.title}</span>
            <span className="rt-hstage">{enough ? FORMATION_STAGES[si].label : 'még gyűlik az adat'}</span>
            <span className="rt-hreps">{f?.reps ?? '—'}<small>ismétlés</small></span>
          </span>
          <span className="rt-hright">
            <Arc pct={enough ? f.automaticityPct : null} color={tone.c} />
          </span>
        </span>
        <span className="rt-heta"><b>{etaBig}</b><span>{etaSub}</span></span>
      </button>
    )
  }

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={() => navigate('/me/rutin')} label="‹ Rutin" />
      <PageHero big={`${visible.length}`} name="Szokásaid" sub="formálódás szerint rendezve" />
      <PageBody principle={PRINCIPLE}>
        <EntranceGroup replayKey={[...filter].join('-')}>
          <div className="rt-fgrid rise" style={rise(40)}>
            {FORMATION_STAGES.map((s, i) => {
              const tone = STAGE_TONE[i]
              return (
                <button
                  key={s.label}
                  type="button"
                  className={cn('rt-ftile', filter.has(i) && 'on', counts[i] === 0 && 'is-zero')}
                  aria-pressed={filter.has(i)}
                  style={{ '--fc': tone.c, '--fw': tone.w, '--fs': tone.s } as CSSProperties}
                  onClick={() => toggle(i)}
                >
                  <span className="rt-fdots" aria-hidden="true">
                    {FORMATION_STAGES.map((x, j) => <i key={x.label} className={cn(j <= i && 'on')} />)}
                  </span>
                  <b>{counts[i]}</b>
                  <small>{s.label}</small>
                </button>
              )
            })}
          </div>
          <div className="rt-hgrid">
            {visible.map((d, i) => tile(d, i))}
          </div>
          {visible.length === 0 && (
            <p className="rt-hint">Ebben a szakaszban most nincs szokásod.</p>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
