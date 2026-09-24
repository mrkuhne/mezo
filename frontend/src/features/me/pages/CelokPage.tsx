import { useNavigate } from 'react-router-dom'
import { ContentIcon, Icon3D } from '@/shared/ui/clay'
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
  const { goal: weightGoal, goalResponse, pending: weightPending, isError: weightIsError } = useGoal()
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
  //
  // A két eset KÜLÖN mondatot kap (`todayIsPending` vs `todayIsError`): egy közös „most töltődik"
  // ág egy elhasalt lekérésre is betöltést állítana, ami pont az a hiba↔betöltés összemosás,
  // amit a ház hibaszabálya tilt (JournalPage.tsx:193 idióma).

  // Real mode's unresolved window yields an honest empty list (useDualQuery's `realEmpty`), so
  // rendering the page body then printed a fabricated "0 aktív · 0 parkol" + an empty PERMAH ring
  // before any data arrived. The whole screen is a skeleton until the list resolves (CelPage idiom).
  if (isPending) return <ScreenSkeleton />

  // A genuinely failed fetch and "no goals yet" both surface as an empty `goals` array — without
  // `isError` the 500 rendered the same inviting empty state, the conflation the house error
  // standard forbids (JournalPage.tsx:193 idiom). Stale-but-present goals fall through to the list.
  if (isError && goals.length === 0) {
    return (
      <MozaikPage tone="sage" className="enc-page enc-celok">
        <PageHead glass onBack={() => navigate('/me')} label="Én" />
        <PageBody>
          <GhostState message="Nem sikerült betölteni a célokat." ctaLabel="Újra" onCta={refetch} />
        </PageBody>
      </MozaikPage>
    )
  }

  return (
    <MozaikPage tone="sage" className="enc-page enc-celok">
      <PageHead glass onBack={() => navigate('/me')} label="Én">
        <button type="button" className="enc-pill" onClick={() => navigate('/me/goals/new')}>＋ Új cél</button>
      </PageHead>
      <PageBody principle="Ami nincs naplózva, az nem nulla — az üres.">
        <EntranceGroup>
          <div className="enc-title rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <span className="nm">Célok</span>
            <div className="mz-eyebrow">{active.length} aktív · {parked.length} parkol</div>
          </div>
          <div className="enc-hero uv-halo rise" style={{ '--d': '40ms' } as React.CSSProperties}>
            <PermahRing counts={counts} total={active.length} />
            <div className="enc-hero-copy">
              {active.length === 0
                ? <>Még nincs aktív célod. <strong>Egy cél, két-három pillér</strong> — a többit a naplód hozza.</>
                : todayIsPending
                  ? <>A pillérek a meglévő naplódból számolnak. <strong>A heti irány most töltődik</strong> — a célok és pilléreik addig is itt élnek.</>
                  : todayIsError
                    ? <>A pillérek a meglévő naplódból számolnak. <strong>A heti irányt most nem sikerült lekérni</strong> — a célok és pilléreik addig is itt élnek.</>
                    : <>A pillérek a meglévő naplódból számolnak. <strong>{arrowCounts.up}↗ · {arrowCounts.flat}→ · {arrowCounts.down}↘</strong> ezen a héten.</>}
            </div>
          </div>
          <div className="lg-dimband rise" style={{ '--d': '90ms' } as React.CSSProperties} aria-label="Életterületek">
            {DIMENSION_ORDER.map((d) => (
              <span key={d} className={`lg-dimchip ${DIMENSIONS[d].cls} ${counts[d] ? '' : 'empty'}`}>
                <ContentIcon name={DIMENSIONS[d].icon} size={16} />{DIMENSIONS[d].label}{counts[d] ? <b> {counts[d]}</b> : null}
              </span>
            ))}
          </div>
          <Mosaic>
            {active.map((g, i) => (
              <LifeGoalTile key={g.id} goal={g} summary={summaryByGoalId.get(g.id)} delayMs={130 + i * 40} onClick={() => navigate(`/me/goals/${g.id}`)} />
            ))}
            <button type="button" className="mz-tile enc-newtile uv-empty rise" style={{ '--d': `${130 + active.length * 40}ms` } as React.CSSProperties}
              onClick={() => navigate('/me/goals/new')} aria-label="Új cél">
              <Icon3D name="t-ring" size={40} />
              <b>＋ Új cél</b>
              <small>Mezo pilléreket javasol</small>
            </button>
          </Mosaic>
          {parked.map((g, i) => (
            <div key={g.id} className={`lg-parkrow rise ${DIMENSIONS[g.dimension].cls}`} style={{ '--d': `${300 + i * 40}ms` } as React.CSSProperties}>
              <button type="button" className="lg-parkrow-nav" onClick={() => navigate(`/me/goals/${g.id}`)} aria-label={`${g.title} · parkol`}>
                <ContentIcon name={DIMENSIONS[g.dimension].icon} size={32} />
                <div className="grow"><div className="nm">{g.title}</div><div className="sb">{g.status === 'draft' ? 'tervezett' : 'parkol'} · {DIMENSIONS[g.dimension].label}</div></div>
              </button>
              <button type="button" className="act" onClick={() => changeStatus(g.id, 'active')} aria-label={`${g.title} · vissza aktívra`}>Vissza</button>
            </div>
          ))}
          {/* Jelek (mezo-iizd.7, prototípus celok.html:106): a hub alján egy sor nyitja a
              transzparencia-oldalt. A parkrow-nyelvet viszi, de teljes egészében gomb — CSAK
              `lg-parkrow`, mert a `lg-parkrow-nav` (későbbi, azonos specificitású szabály)
              nullázná a sor 10px 13px paddingjét, és a sor alacsonyabb lenne a park-soroknál. */}
          <button type="button" className="enc-xrow glass rise"
            style={{ '--d': `${300 + parked.length * 40}ms`, '--c': 'var(--dv-sage)' } as React.CSSProperties}
            onClick={() => navigate('/me/goals/signals')} aria-label="Jelek · mit figyel a rendszer">
            <span className="uv-well"><Icon3D name="t-signal" size={34} /></span>
            <div className="grow">
              <div className="nm">Jelek · mit figyel a rendszer</div>
              <div className="sb">{signals.length} forrás · {liveSignals} él · {signals.length - liveSignals} alszik</div>
            </div>
            <span className="chev" aria-hidden="true">›</span>
          </button>
          {/* Súlycél (mezo-iizd.4): a spec D5 szerint a súlycél a Célok alá költözött, és a
              .4 óta az Én-hub heroja életcél-összegzés — tehát a /me/goals/weight bejárata
              ITT van, különben a súly-parancsnokság elárvul. */}
          <button type="button" className="enc-xrow glass rise"
            style={{ '--d': `${340 + parked.length * 40}ms`, '--c': 'var(--dv-coral)' } as React.CSSProperties}
            onClick={() => navigate('/me/goals/weight')} aria-label="Súlycél">
            <span className="uv-well"><Icon3D name="t-weight" size={34} /></span>
            <div className="grow">
              <div className="nm">Súlycél</div>
              <div className="sb">
                {/* Három állapot, nem kettő: egy ELHASALT /api/goals olvasás ugyanabba az üres
                    alakba esik, mint a „nincs célod", tehát az `isError` nélkül a sor egy
                    hálózati hibát mért hiányként jelentett (mezo-iizd.4 final review, 4. lelet). */}
                {weightPending
                  ? 'töltöm…'
                  : weightIsError
                    ? 'a súlycél most nem elérhető'
                    : goalResponse != null && weightGoal != null
                      ? `${TRAJECTORY_LABEL[goalResponse.trajectory]} · ${hu1(weightGoal.currentWeight)} → ${hu1(weightGoal.targetWeight)} kg`
                      : 'nincs aktív súlycél'}
              </div>
            </div>
            <span className="chev" aria-hidden="true">›</span>
          </button>

          {done.length > 0 && (
            <>
              <div className="mz-eyebrow enc-sec rise" style={{ '--d': '380ms' } as React.CSSProperties}>Lezárt célok</div>
              {done.map((g, i) => (
                <button key={g.id} type="button" className={`lg-parkrow lg-donerow rise ${DIMENSIONS[g.dimension].cls}`}
                  style={{ '--d': `${400 + i * 40}ms` } as React.CSSProperties}
                  onClick={() => navigate(`/me/goals/${g.id}`)} aria-label={`${g.title} · kész`}>
                  <ContentIcon name={DIMENSIONS[g.dimension].icon} size={32} />
                  <div className="grow">
                    <div className="nm">{g.title}</div>
                    <div className="sb">{STATUS_LABEL[g.status]} · {DIMENSIONS[g.dimension].label}</div>
                  </div>
                  <span className="lg-donetick" role="img" aria-label="kész"><Icon3D name="t-tick" size={26} /></span>
                </button>
              ))}
            </>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
