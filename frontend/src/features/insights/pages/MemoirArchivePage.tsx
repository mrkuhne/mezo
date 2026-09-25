// ============================================================
// Mezo · MemoirArchivePage — the archive shelf (F7.5, mezo-d20.8.5), in üveg
// (mezo-me75u.8, block `uveg mezo1 memoar`). Source of truth:
// docs/design_2.0/prototypes/src/uveg-mezo-body.html `archivum()`: glass back pill,
// the lavender halo hero (t-scroll, big count), month heads, and one FLAT row per
// chapter (a lit „HÉT n" block, date + anchor count, serif title, clamped upright
// excerpt). Day One pattern: the whole row is ONE tap target and NAVIGATES to the
// chapter page (no modal — Daniel's call on the prototype).
// ============================================================
import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { Icon3D } from '@/shared/ui/clay'
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
    <MozaikPage tone="lav" className="mmo-page mmo-arch">
      <PageHead glass onBack={() => navigate('/mezo/memoir')} label="Memoár" />
      <PageHero
        art="t-scroll"
        accent="var(--dv-lav)"
        big={<>{entries.length}<small> fejezet</small></>}
        name="Memoár · archívum"
        sub={entries.length ? `${months} hónap közös történet` : 'a közös történet polca'}
      />
      <PageBody>
        <EntranceGroup className="col">
          {entries.length === 0 && (
            <div className="mmo-empty uv-empty rise" style={{ '--c': 'var(--dv-lav)' } as React.CSSProperties}>
              <p>Még nincs fejezet — az első memoár a hét zárásakor íródik meg.</p>
            </div>
          )}
          {groups.map((g, gi) => (
            <section key={g.label} className="mmo-month">
              <div className="mmo-mhead rise" style={{ '--d': `${gi * 60}ms` } as React.CSSProperties}>
                <strong>{g.label}</strong>
                <small>{g.entries.length} fejezet</small>
              </div>
              {g.entries.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  className="mmo-chap rise"
                  style={{ '--d': `${gi * 60 + (i + 1) * 40}ms` } as React.CSSProperties}
                  onClick={() => navigate(`/mezo/memoir/${e.weekStart}`)}
                >
                  <span className="mmo-wkb">
                    <small>Hét</small>{' '}
                    <b>{isoWeekNumber(e.weekStart)}</b>
                  </span>
                  <span className="grow">
                    <span className="meta">
                      <span className="d">{deriveWeekTitle(e.weekStart)}</span>
                      <span className="anc">
                        <Icon3D name="t-anchor" size={14} />
                        {e.anchors.length}
                        <span className="sr-only"> horgony</span>
                      </span>
                    </span>
                    <span className="ttl">{e.title}</span>
                    <span className="ex">{e.body.split('\n\n')[0]}</span>
                  </span>
                </button>
              ))}
            </section>
          ))}
        </EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}
