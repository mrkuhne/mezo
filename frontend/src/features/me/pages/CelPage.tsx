import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ScreenSkeleton } from '@/shared/ui/ScreenSkeleton'
import { GhostState } from '@/shared/ui/GhostState'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLifeGoal, useLifeGoalMutations, useLifeGoalProgress } from '@/data/hooks'
import type { LifeGoalPillarInput, SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'
import { ARROW_CLASS, ARROW_GLYPH, DIMENSIONS, STATUS_LABEL } from '@/features/me/logic/lifegoalLabels'
import { PillarCard } from '@/features/me/components/PillarCard'
import { PillarCatalogSheet } from '@/features/me/sheets/PillarCatalogSheet'
import { pillarFromCatalog } from '@/features/me/logic/pillarFromCatalog'
import { huMonthDay } from '@/shared/lib/dates'

const MAX_PILLARS = 5

// Cél-oldal (mezo-iizd.1, prototype celok.html #page-g1): hero, pillar cards, Miért · ha–akkor,
// status actions. Scores/arrows/heatmap arrive with slice 2 — every numeric slot is honest `—`
// now (PillarCard's own contract). The prototype's chiprow/coach-card/pillar-count breakdown
// ("5 · 3 ↗ · 1 → · 1 ↘") are all scorer output — omitted here rather than faked (honest-state
// house rule); the eyebrow below just states the pillar count, which is real data.
export function CelPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { goal, isPending, isError, refetch, goalCount } = useLifeGoal(id)
  const { changeStatus, replacePillars, pending } = useLifeGoalMutations()
  const { progress, isPending: progressPending } = useLifeGoalProgress(goal?.id)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [period, setPeriod] = useState<'week' | 'month'>('week')

  if (isPending) return <ScreenSkeleton />
  // A failed list read leaves `goal` null exactly like a genuinely unknown id — printing
  // "Nincs ilyen cél." for a 500 is the loading/empty/error conflation the house error standard
  // forbids (JournalPage.tsx:193 idiom). Only a resolved-but-absent id is a real not-found;
  // a failed fetch with nothing cached gets a terminal error + retry instead.
  if (isError && goalCount === 0) {
    return (
      <MozaikPage tone="sage">
        <PageHead onBack={() => navigate('/me/goals')} label="‹ Célok" />
        <PageBody>
          <GhostState message="Nem sikerült betölteni a célt." ctaLabel="Újra" onCta={refetch} />
        </PageBody>
      </MozaikPage>
    )
  }
  if (!goal) {
    return (
      <MozaikPage tone="sage">
        <PageHead onBack={() => navigate('/me/goals')} label="‹ Célok" />
        <PageBody><p className="mz-eyebrow" style={{ padding: 24 }}>Nincs ilyen cél.</p></PageBody>
      </MozaikPage>
    )
  }

  const dim = DIMENSIONS[goal.dimension]
  const sub = [
    dim.label,
    goal.secondaryDimension ? DIMENSIONS[goal.secondaryDimension].label : null,
    `${huMonthDay(goal.startDate)} →${goal.targetDate ? ` ${huMonthDay(goal.targetDate)}` : ' nincs határidő'}`,
    STATUS_LABEL[goal.status],
  ].filter(Boolean).join(' · ')

  // Task 9 (mezo-iizd.5): while the progress query is still loading, the hero and every
  // PillarCard read exactly like "no data yet" (arrow.none glyph, no %) rather than a fake
  // 0% — `heroArrow` stays undefined until the fetch resolves; 'insufficient' itself is a
  // real TrendArrow value that ARROW_CLASS/ARROW_GLYPH already map to the same none/— look.
  const heroArrow = progressPending ? undefined : progress?.arrow
  const heroArrowClass = heroArrow ? ARROW_CLASS[heroArrow] : 'none'
  const heroGlyph = heroArrow ? ARROW_GLYPH[heroArrow] : '—'
  const pillarProgressById = new Map(
    progressPending ? [] : (progress?.pillars ?? []).map((p) => [p.pillarId, p]),
  )

  const addPillar = (e: SignalCatalogEntry) => {
    // The existing pillars go back WITH their ids so the replace updates those rows in place
    // instead of minting fresh UUIDs and orphaning their evaluation history (mezo-iizd.2);
    // `position` is server-derived from list order, so it is the only field stripped.
    const next: LifeGoalPillarInput[] = [
      ...goal.pillars.map(({ position: _p, ...rest }) => rest),
      pillarFromCatalog(e),
    ]
    replacePillars(goal.id, next)
    setCatalogOpen(false)
  }

  return (
    <MozaikPage tone={dim.wash === 'coral' ? 'coral' : dim.wash === 'white' || dim.wash === 'most' ? 'sage' : dim.wash}>
      <PageHead onBack={() => navigate('/me/goals')} label="‹ Célok">
        <button
          type="button"
          className="pgact"
          style={{ marginLeft: 'auto' }}
          onClick={() => setCatalogOpen(true)}
          disabled={goal.pillars.length >= MAX_PILLARS}
        >
          ＋ Pillér
        </button>
      </PageHead>
      <PageHero
        icon={dim.icon}
        big={(
          <span className={`lg-arrow ${heroArrowClass}`}>
            <span className="g" style={{ fontSize: 40 }}>{heroGlyph}</span>
            {heroArrow && heroArrow !== 'insufficient' && progress?.weeklyPct !== undefined && (
              <span className="v" style={{ fontSize: 22, fontWeight: 200 }}>{progress.weeklyPct}<span style={{ fontSize: 12 }}>%</span></span>
            )}
          </span>
        )}
        name={goal.title}
        sub={sub}
      />
      <PageBody principle="Az irány-nyíl 7 nap vs 21 nap · mindkettőben legalább 5 adat-nap kell.">
        <EntranceGroup replayKey={goal.pillars.length}>
          {goal.pillars.length > 0 && (
            <div className="lg-chiprow rise" style={{ '--d': '0ms' } as React.CSSProperties}>
              <button type="button" className={`lg-fchip ${period === 'week' ? 'on' : ''}`} onClick={() => setPeriod('week')}>Hét</button>
              <button type="button" className={`lg-fchip ${period === 'month' ? 'on' : ''}`} onClick={() => setPeriod('month')}>Hónap</button>
            </div>
          )}
          <div className="mz-eyebrow rise" style={{ '--d': '0ms', padding: '4px 2px 8px' } as React.CSSProperties}>Pillérek · {goal.pillars.length}</div>
          {goal.pillars.map((p, i) => (
            <PillarCard key={p.id} pillar={p} progress={pillarProgressById.get(p.id)} period={period} delayMs={40 + i * 40} />
          ))}
          {goal.pillars.length === 0 && <p className="mz-eyebrow rise" style={{ padding: '0 2px 10px' }}>Még nincs pillér — ＋ Pillér a katalógusból.</p>}
          {(goal.whyText || goal.ifThenPlans.length > 0) && (
            <>
              <div className="mz-eyebrow rise" style={{ '--d': '260ms', padding: '8px 2px 6px' } as React.CSSProperties}>Miért · ha–akkor</div>
              <div className="lg-why rise" style={{ '--d': '290ms' } as React.CSSProperties}>
                {goal.whyText && <div className="q">„{goal.whyText}”</div>}
                {goal.obstacleText && <div className="mz-eyebrow" style={{ marginTop: 8 }}>Akadály · {goal.obstacleText}</div>}
                <div style={{ marginTop: 8 }}>
                  {goal.ifThenPlans.map((pl, i) => (
                    <div key={i}>
                      <div className="lg-ifthen"><span className="ha">HA</span><span>{pl.ha}</span></div>
                      <div className="lg-ifthen" style={{ borderTop: 'none', paddingTop: 0 }}>
                        <span className="ha akkor">AKKOR</span>
                        <span>
                          {pl.akkor}
                          {pl.trigger
                            ? <em style={{ color: '#A2958A', fontStyle: 'normal' }}> · Mezo figyeli ({pl.trigger.source})</em>
                            : <em style={{ color: '#A2958A', fontStyle: 'normal' }}> · nincs hozzá jel</em>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="lg-actrow rise" style={{ '--d': '330ms' } as React.CSSProperties}>
            {goal.status === 'active' && <button type="button" disabled={pending} onClick={() => changeStatus(goal.id, 'parked')}>Parkolás</button>}
            {(goal.status === 'parked' || goal.status === 'draft') && <button type="button" disabled={pending} onClick={() => changeStatus(goal.id, 'active')}>Aktiválás</button>}
            {(goal.status === 'active' || goal.status === 'parked') && <button type="button" disabled={pending} onClick={() => changeStatus(goal.id, 'done')}>Lezárás</button>}
            {goal.status !== 'archived' && (
              <button type="button" disabled={pending} onClick={() => { changeStatus(goal.id, 'archived'); navigate('/me/goals') }}>Archiválás</button>
            )}
          </div>
        </EntranceGroup>
      </PageBody>
      {catalogOpen && <PillarCatalogSheet onClose={() => setCatalogOpen(false)} onPick={addPillar} />}
    </MozaikPage>
  )
}
