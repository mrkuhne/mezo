// ============================================================
// Mezo · MemoirArchivePage — the archive shelf (F7.5, mezo-d20.8.5).
// Source of truth: docs/design_2.0/prototypes/mezo-memoar.html (archívum-idővonal).
// Day One pattern: month heads + one full-card chapter per week (the whole card
// is ONE tap target — Apple Journal's ambiguous-tap-zone lesson). A card
// NAVIGATES to the chapter page (no modal — Daniel's call on the prototype).
// ============================================================
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { ClayIcon } from '@/shared/ui/clay'
import { useMemoirArchive } from '@/data/hooks'
import { groupByMonth } from '@/features/insights/logic/memoirArchive'
import { isoWeekNumber } from '@/data/insights/weeklyHooks'
import { deriveWeekTitle } from '@/data/fuel/fuelWeekHooks'

export function MemoirArchivePage() {
  const navigate = useNavigate()
  const { data: entries } = useMemoirArchive()
  const groups = groupByMonth(entries)
  const months = new Set(entries.map((e) => e.weekStart.slice(0, 7))).size

  return (
    <MozaikPage tone="lav">
      <PageHead onBack={() => navigate('/mezo/memoir')} label="‹ Memoár" />
      <PageHero
        icon="i-memoar"
        iconSize={44}
        big={entries.length}
        name="Memoár · archívum"
        sub={entries.length ? `fejezet · ${months} hónap közös történet` : 'a közös történet polca'}
      />
      <PageBody>
        <EntranceGroup className="col">
          {entries.length === 0 && (
            <div className="mz-qcard rise" style={{ textAlign: 'center', padding: 24 }}>
              <span className="text-tertiary" style={{ fontSize: 13, lineHeight: 1.5 }}>
                Még nincs fejezet — az első memoár a hét zárásakor íródik meg.
              </span>
            </div>
          )}
          {groups.map((g, gi) => (
            <div key={g.label}>
              <div className="mz-march-mhead rise" style={{ '--d': `${gi * 60}ms` } as React.CSSProperties}>
                <span className="eb">{g.label}</span>
                <span className="n">{g.entries.length} fejezet</span>
              </div>
              {g.entries.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  className="mz-march-card rise"
                  style={{ '--d': `${gi * 60 + (i + 1) * 40}ms` } as React.CSSProperties}
                  onClick={() => navigate(`/mezo/memoir/${e.weekStart}`)}
                >
                  <span className="top">
                    <span className="wk">Hét {isoWeekNumber(e.weekStart)}</span>
                    <span className="d">{deriveWeekTitle(e.weekStart)}</span>
                    <span className="anc">
                      <ClayIcon name="i-retegek" size={11} />
                      {e.anchors.length}
                    </span>
                  </span>
                  <span className="ttl">{e.title}</span>
                  <span className="ex">{e.body.split('\n\n')[0]}</span>
                </button>
              ))}
            </div>
          ))}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
