// ============================================================
// Mezo · PrepFejlodesPage — the prep mosaic's Fejlődés tile opened into its
// own page (mezo-d20.3.8). Source: session-body.html #page-xp. Compact hero
// (i-growth + várható XP) + stat strip + skill progress bars (level-up chip
// on the row about to cross) + "Ma építed" per-muscle XP bars + the overload
// call-out. Only rendered when a forecast exists (mission-briefing's honest-
// empty gate — the hub tile itself vanishes without one).
// ============================================================
import { ClayIcon } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { clampPct } from '@/shared/lib/pct'
import { ATHLETIC_META } from '@/features/progression/logic/levelUpMeta'
import { MUSCLE_LABELS } from '@/data/train/train'
import { muscleColor } from '@/features/train/logic/muscleColors'
import type { PrepForecast } from '@/features/train/logic/prepBriefing'
import type { OverloadSummary } from '@/data/types'

export function PrepFejlodesPage({ forecast, workSets, overload, onBack }: {
  forecast: PrepForecast
  workSets: number
  overload?: OverloadSummary | null
  onBack: () => void
}) {
  const levelUps = forecast.skills.filter((s) => s.willLevelUp).length
  return (
    <MozaikPage tone="coral">
      <PageHead label="‹ Indítás" onBack={onBack} />
      <PageHero icon="i-growth" big={`+${forecast.totalXp}`} name="Várható XP" />
      <PageBody principle="A becslés a valós skill-profilodból jön — profil nélkül ez az oldal üresen sosem jelenik meg.">
        <StatStrip className="mt-sm">
          <StatCell value={workSets} label="szett dolgozik" />
          <StatCell value={forecast.skills.length} label="skill épül" />
          {levelUps > 0 && <StatCell value={levelUps} label="szintlépés-esély" />}
        </StatStrip>
        <EntranceGroup className="col gap-md mt-md">
          {forecast.skills.length > 0 && (
            <>
              <span className="mz-eyebrow">Skillek · a mai edzés hatása</span>
              <div className="col gap-md">
                {forecast.skills.map((s) => {
                  const meta = ATHLETIC_META[s.skillKey]
                  return (
                    <div key={s.skillKey} className="col gap-xs">
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{meta?.icon ?? '✨'} {meta?.name ?? s.skillKey}</span>
                        {s.willLevelUp
                          ? <span className="mz-qxp">▲ ma szintet léphetsz</span>
                          : <span className="text-tertiary" style={{ fontSize: 10.5 }}>+{s.xpEst} XP</span>}
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${clampPct(s.progressPct)}%`, background: s.willLevelUp ? 'var(--amber)' : 'var(--sage)', borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {forecast.muscles.length > 0 && (
            <>
              <span className="mz-eyebrow">Ma építed · izom-XP</span>
              <div className="col gap-sm">
                {forecast.muscles.map((m) => {
                  const fam = muscleColor(m.muscle)
                  return (
                    <div key={m.muscle} className="row" style={{ gap: 9, alignItems: 'center' }}>
                      <span style={{ width: 5, height: 22, borderRadius: 2, background: fam.rail, flexShrink: 0 }} />
                      <span className="flex-1" style={{ fontSize: 12, fontWeight: 700 }}>{MUSCLE_LABELS[m.muscle] ?? m.muscle}</span>
                      <span className="chip" style={{ fontSize: 9.5, background: fam.wash, color: fam.deep, border: 'none' }}>+{m.xp} XP</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {overload && (overload.weightUp + overload.repUp) > 0 && (
            <div className="mz-qcard">
              <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
                <ClayIcon name="i-lang" size={22} />
                <div className="mz-qgrow">
                  <div className="mz-qtitle" style={{ fontSize: 12 }}>
                    ⚡ Túlterhelés · {[
                      overload.weightUp > 0 ? `${overload.weightUp}× +súly` : null,
                      overload.repUp > 0 ? `${overload.repUp}× +rep` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  <div className="mz-qwhy">Ezek a gyakorlatok adják az XP-lökés nagyját ma.</div>
                </div>
              </div>
            </div>
          )}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
