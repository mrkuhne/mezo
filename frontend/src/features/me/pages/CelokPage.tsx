import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { MozaikPage, PageHead, PageBody, Mosaic } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLifeGoals, useLifeGoalMutations, useLifeGoalToday } from '@/data/hooks'
import type { LifeGoalDimension, TrendArrow } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS, DIMENSION_ORDER } from '@/features/me/logic/lifegoalLabels'
import { PermahRing } from '@/features/me/components/PermahRing'
import { LifeGoalTile } from '@/features/me/components/LifeGoalTile'

// Célok hub (mezo-iizd.1, prototype celok.html #panel): hero ring + companion line, the PERMAH
// chip band, one tile per active goal and the parked list.
export function CelokPage() {
  const navigate = useNavigate()
  const { goals, isPending, isError, refetch } = useLifeGoals()
  const { changeStatus } = useLifeGoalMutations()
  const { today } = useLifeGoalToday()
  const active = goals.filter((g) => g.status === 'active')
  const parked = goals.filter((g) => g.status === 'parked' || g.status === 'draft')
  const counts = Object.fromEntries(DIMENSION_ORDER.map((d) => [d, active.filter((g) => g.dimension === d).length])) as Record<LifeGoalDimension, number>
  const summaryByGoalId = new Map(today.goals.map((s) => [s.goalId, s]))
  // `insufficient` is excluded from the hero counters on purpose — same guardrail as the tile/
  // pillar arrows: too little data must never masquerade as a direction, not even a `→` one.
  const arrowCounts = today.goals.reduce(
    (acc, s) => { if (s.arrow !== 'insufficient') acc[s.arrow] += 1; return acc },
    { up: 0, flat: 0, down: 0 } as Record<Exclude<TrendArrow, 'insufficient'>, number>,
  )

  // Real mode's unresolved window yields an honest empty list (useDualQuery's `realEmpty`), so
  // rendering the page body then printed a fabricated "0 aktív · 0 parkol" + an empty PERMAH ring
  // before any data arrived. The whole screen is a skeleton until the list resolves (CelPage idiom).
  if (isPending) return <ScreenSkeleton />

  // A genuinely failed fetch and "no goals yet" both surface as an empty `goals` array — without
  // `isError` the 500 rendered the same inviting empty state, the conflation the house error
  // standard forbids (JournalPage.tsx:193 idiom). Stale-but-present goals fall through to the list.
  if (isError && goals.length === 0) {
    return (
      <MozaikPage tone="sage">
        <PageHead onBack={() => navigate('/me')} label="‹ Én" />
        <PageBody>
          <GhostState message="Nem sikerült betölteni a célokat." ctaLabel="Újra" onCta={refetch} />
        </PageBody>
      </MozaikPage>
    )
  }

  return (
    <MozaikPage tone="sage">
      <PageHead onBack={() => navigate('/me')} label="‹ Én">
        <button type="button" className="pgact" style={{ marginLeft: 'auto' }} onClick={() => navigate('/me/goals/new')}>＋ Új cél</button>
      </PageHead>
      <PageBody principle="Ami nincs naplózva, az nem nulla — az üres.">
        <EntranceGroup>
          <div className="rise" style={{ '--d': '0ms', padding: '4px 0 10px' } as React.CSSProperties}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>Célok</span>
            <div className="mz-eyebrow">{active.length} aktív · {parked.length} parkol</div>
          </div>
          <div className="lg-hero rise" style={{ '--d': '40ms', marginBottom: 12 } as React.CSSProperties}>
            <PermahRing counts={counts} total={active.length} />
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 300 }}>
              {active.length === 0
                ? <>Még nincs aktív célod. <strong>Egy cél, két-három pillér</strong> — a többit a naplód hozza.</>
                : <>A pillérek a meglévő naplódból számolnak. <strong>{arrowCounts.up}↗ · {arrowCounts.flat}→ · {arrowCounts.down}↘</strong> ezen a héten.</>}
            </div>
          </div>
          <div className="lg-dimband rise" style={{ '--d': '90ms', marginBottom: 12 } as React.CSSProperties} aria-label="Életterületek">
            {DIMENSION_ORDER.map((d) => (
              <span key={d} className={`lg-dimchip ${DIMENSIONS[d].cls} ${counts[d] ? '' : 'empty'}`}>
                <i />{DIMENSIONS[d].label}{counts[d] ? <b> {counts[d]}</b> : null}
              </span>
            ))}
          </div>
          <Mosaic>
            {active.map((g, i) => (
              <LifeGoalTile key={g.id} goal={g} summary={summaryByGoalId.get(g.id)} delayMs={130 + i * 40} onClick={() => navigate(`/me/goals/${g.id}`)} />
            ))}
            <button type="button" className="mz-tile mz-w-white rise" style={{ '--d': `${130 + active.length * 40}ms`, border: '1.2px dashed rgba(216,72,31,0.4)', background: 'transparent', boxShadow: 'none', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties}
              onClick={() => navigate('/me/goals/new')} aria-label="Új cél">
              <ClayIcon name="i-cel" size={30} />
              <b style={{ fontSize: 12, color: 'var(--coral-deep)' }}>＋ Új cél</b>
              <small style={{ fontSize: 9.5, color: 'var(--text-secondary)' }}>Mezo pilléreket javasol</small>
            </button>
          </Mosaic>
          {parked.map((g, i) => (
            <div key={g.id} className="lg-parkrow rise" style={{ '--d': `${300 + i * 40}ms`, marginTop: 10 } as React.CSSProperties}>
              <button type="button" className="lg-parkrow-nav" onClick={() => navigate(`/me/goals/${g.id}`)} aria-label={`${g.title} · parkol`}>
                <ClayIcon name={DIMENSIONS[g.dimension].icon} size={22} />
                <div style={{ flex: 1 }}><div className="nm">{g.title}</div><div className="sb">{g.status === 'draft' ? 'tervezett' : 'parkol'} · {DIMENSIONS[g.dimension].label}</div></div>
              </button>
              <button type="button" className="act" onClick={() => changeStatus(g.id, 'active')} aria-label={`${g.title} · vissza aktívra`}>Vissza</button>
            </div>
          ))}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
