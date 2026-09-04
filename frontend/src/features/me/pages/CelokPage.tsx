import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { GhostState } from '@/shared/ui/GhostState'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { MozaikPage, PageHead, PageBody, Mosaic } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLifeGoals, useLifeGoalMutations, useLifeGoalToday, useSignalCatalog, useGoal } from '@/data/hooks'
import type { LifeGoalDimension, TrendArrow } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS, DIMENSION_ORDER, STATUS_LABEL } from '@/features/me/logic/lifegoalLabels'
import { TRAJECTORY_LABEL } from '@/features/me/logic/goalLabels'
import { hu1 } from '@/shared/lib/huNum'
import { PermahRing } from '@/features/me/components/PermahRing'
import { LifeGoalTile } from '@/features/me/components/LifeGoalTile'

// Célok hub (mezo-iizd.1, prototype celok.html #panel): hero ring + companion line, the PERMAH
// chip band, one tile per active goal and the parked list.
export function CelokPage() {
  const navigate = useNavigate()
  const { goals, isPending, isError, refetch } = useLifeGoals()
  const { changeStatus } = useLifeGoalMutations()
  const { today, isPending: todayIsPending, isError: todayIsError } = useLifeGoalToday()
  const { entries: signals = [] } = useSignalCatalog()
  const liveSignals = signals.filter((s) => s.live).length
  const active = goals.filter((g) => g.status === 'active')
  const parked = goals.filter((g) => g.status === 'parked' || g.status === 'draft')
  // A `done` cél mostanáig SEHOL nem jelent meg (sem a mozaikban, sem a parkolt sorban) — egy
  // lezárt cél eltűnt minden felületről, pedig a GET /api/life-goals visszaadja (mezo-iizd.4).
  // Külön szekció, nem a mozaikban: a mozaik az ÉLŐ célok tere, egy kész cél emlék.
  const done = goals.filter((g) => g.status === 'done')
  const { goal: weightGoal, goalResponse, pending: weightPending } = useGoal()
  const counts = Object.fromEntries(DIMENSION_ORDER.map((d) => [d, active.filter((g) => g.dimension === d).length])) as Record<LifeGoalDimension, number>
  const summaryByGoalId = new Map(today.goals.map((s) => [s.goalId, s]))
  // `insufficient` is excluded from the hero counters on purpose — same guardrail as the tile/
  // pillar arrows: too little data must never masquerade as a direction, not even a `→` one.
  const arrowCounts = today.goals.reduce(
    (acc, s) => { if (s.arrow !== 'insufficient') acc[s.arrow] += 1; return acc },
    { up: 0, flat: 0, down: 0 } as Record<Exclude<TrendArrow, 'insufficient'>, number>,
  )
  // `useLifeGoalToday`'s own loading/error resolve independently of the goal list above (the
  // list can be ready while `today` is still in flight or has failed) — `realEmpty: {goals:[]}`
  // means an unresolved/failed fetch silently reduces to the SAME shape as "no active goals had
  // any data this week", so counting off it unconditionally prints a fabricated "0↗ · 0→ · 0↘"
  // instead of the honest neutral sentence below (LifeGoalTile/PillarCard `honest` idiom).
  const todayHonest = todayIsPending || todayIsError

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
                : todayHonest
                  ? <>A pillérek a meglévő naplódból számolnak. <strong>A heti irány most töltődik</strong> — a célok és pilléreik addig is itt élnek.</>
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
          {/* Jelek (mezo-iizd.7, prototípus celok.html:106): a hub alján egy sor nyitja a
              transzparencia-oldalt. A parkrow-nyelvet viszi, de teljes egészében gomb — CSAK
              `lg-parkrow`, mert a `lg-parkrow-nav` (későbbi, azonos specificitású szabály)
              nullázná a sor 10px 13px paddingjét, és a sor alacsonyabb lenne a park-soroknál. */}
          <button type="button" className="lg-parkrow rise"
            style={{ '--d': `${300 + parked.length * 40}ms`, marginTop: 10 } as React.CSSProperties}
            onClick={() => navigate('/me/goals/signals')} aria-label="Jelek · mit figyel a rendszer">
            <ClayIcon name="i-retegek" size={22} />
            <div style={{ flex: 1 }}>
              <div className="nm" style={{ color: 'var(--text-primary)' }}>Jelek · mit figyel a rendszer</div>
              <div className="sb">{signals.length} forrás · {liveSignals} él · {signals.length - liveSignals} alszik</div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 12 }}>›</span>
          </button>
          {/* Súlycél (mezo-iizd.4): a spec D5 szerint a súlycél a Célok alá költözött, és a
              .4 óta az Én-hub heroja életcél-összegzés — tehát a /me/goals/weight bejárata
              ITT van, különben a súly-parancsnokság elárvul. */}
          <button type="button" className="lg-parkrow rise"
            style={{ '--d': `${340 + parked.length * 40}ms`, marginTop: 10 } as React.CSSProperties}
            onClick={() => navigate('/me/goals/weight')} aria-label="Súlycél">
            <ClayIcon name="i-suly" size={22} />
            <div style={{ flex: 1 }}>
              <div className="nm" style={{ color: 'var(--text-primary)' }}>Súlycél</div>
              <div className="sb">
                {weightPending
                  ? 'töltöm…'
                  : goalResponse != null && weightGoal != null
                    ? `${TRAJECTORY_LABEL[goalResponse.trajectory]} · ${hu1(weightGoal.currentWeight)} → ${hu1(weightGoal.targetWeight)} kg`
                    : 'nincs aktív súlycél'}
              </div>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: 12 }}>›</span>
          </button>

          {done.length > 0 && (
            <>
              <div className="mz-eyebrow rise" style={{ '--d': '380ms', padding: '12px 2px 6px' } as React.CSSProperties}>Lezárt célok</div>
              {done.map((g, i) => (
                <button key={g.id} type="button" className="lg-parkrow lg-donerow rise"
                  style={{ '--d': `${400 + i * 40}ms` } as React.CSSProperties}
                  onClick={() => navigate(`/me/goals/${g.id}`)} aria-label={`${g.title} · kész`}>
                  <ClayIcon name={DIMENSIONS[g.dimension].icon} size={22} />
                  <div style={{ flex: 1 }}>
                    <div className="nm">{g.title}</div>
                    <div className="sb">{STATUS_LABEL[g.status]} · {DIMENSIONS[g.dimension].label}</div>
                  </div>
                  <span className="lg-donetick" aria-hidden="true">✓</span>
                </button>
              ))}
            </>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
