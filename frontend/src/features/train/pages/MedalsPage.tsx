// ============================================================
// Mezo · MedalsPage (Medálok) — Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `medals()`).
// The hero is a shelf of drops, one per medal (this month's deeper), with its key and the
// count; then the cabinet in two numbered cards — „E hónapban" and „Korábbról" — grouped by
// date. A medal is a capsule (`Rcap`): the liquid stands above the dashed line of the OLD
// record (previousValue / value); a reached target is the green capsule with no line.
//
// The server replays the entire existing set history to build this (spec
// 2026-07-30-medal-collection-design.md §3/§13), so the cabinet can already be full on first
// open — the hero's support line says so rather than letting it read as if every row
// happened live.
//
// Grouped by date, newest first. Within a date the incoming (server) order is kept — the
// cabinet is a chronological record and must not re-sort by tier. Every data hook, the
// grouping and the labels are verbatim from before this slice — only the face changed.
// ============================================================
import { useMedals } from '@/data/hooks'
import type { Medal } from '@/data/train/medalTypes'
import { MedalRow } from '@/features/train/components/folyadek'
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'
import {
  Card, EmptyTank, FrameBack, Hero, Lab, Legend, Note, Page, Section, Skel, Tags, useFrameTitle,
} from '@/shared/ui/folyadek'

interface DateGroup { date: string; medals: Medal[] }

// Newest date group first; medals within a date keep the incoming order (no
// tier re-sort — see the module note above).
function groupByDate(medals: Medal[]): DateGroup[] {
  const byDate = new Map<string, Medal[]>()
  for (const m of medals) {
    const list = byDate.get(m.date)
    if (list) list.push(m)
    else byDate.set(m.date, [m])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, ms]) => ({ date, medals: ms }))
}

function Groups({ groups }: { groups: DateGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.date} className="er-group">
          <Lab>{huMonthDayDow(g.date)}</Lab>
          {g.medals.map((m, i) => (
            <MedalRow key={`${m.type}-${m.exerciseName}-${m.date}-${m.setIndex ?? i}`} medal={m} />
          ))}
        </div>
      ))}
    </>
  )
}

export function MedalsPage() {
  const { data: medals, isPending } = useMedals()
  useFrameTitle({ title: 'Medálok', eyebrow: 'Edzés' })
  const back = <FrameBack className="fo-backpill" history fallback="/train">‹ Edzés</FrameBack>

  if (isPending) return <Page className="er-page">{back}<Skel blocks={[230, 64, 150, 150]} /></Page>

  if (medals.length === 0) {
    return (
      <Page className="er-page">
        {back}
        <Hero label="Medálok" verdict="Még nincs medálod." sub="Az első megdöntött rekord ide kerül." data-kalauz-anchor="medals-hero">
          <EmptyTank icon="t-record">Még nincs medálod — az első megdöntött rekord ide kerül.</EmptyTank>
        </Hero>
      </Page>
    )
  }

  const thisMonth = localDateString().slice(0, 7)
  const groups = groupByDate(medals)
  const now = groups.filter((g) => g.date.startsWith(thisMonth))
  const earlier = groups.filter((g) => !g.date.startsWith(thisMonth))
  const monthCount = medals.filter((m) => m.date.startsWith(thisMonth)).length
  const capsNote = <Note>A kapszulán a vonal a régi rekord — a folyadék fölötte áll. A zöld kapszula teljesített cél.</Note>

  return (
    <Page className="er-page er-cards">
      {back}
      {/* Honest backfill line (spec §13 "Backfill surprise"): the server replays the whole
          existing set history, so the cabinet can already be full on first open. */}
      <Hero
        label="Medálok"
        verdict={`${medals.length} medál, ebből ${monthCount} e hónapban.`}
        sub="A medálok visszamenőleg, a korábban logolt szetteid alapján épültek fel — nem mindegyiket élőben szerezted."
        data-kalauz-anchor="medals-hero"
      >
        <div className="er-shelf" aria-hidden="true">
          {medals.map((_, i) => <i key={i} className={i < monthCount ? 'new' : undefined} />)}
        </div>
        <Legend items={[
          { label: <><b>{monthCount}</b> e hónapban</>, color: 'var(--fo-gold)' },
          { label: <><b>{medals.length - monthCount}</b> korábbról</>, color: '#F3C766' },
        ]} />
        <Tags items={[{ icon: 't-record', label: `${medals.length} medál` }]} />
      </Hero>
      {now.length > 0 && (
        <>
          <Section n={1} title="E hónapban" />
          <Card><Groups groups={now} />{capsNote}</Card>
        </>
      )}
      {earlier.length > 0 && (
        <>
          <Section n={now.length > 0 ? 2 : 1} title="Korábbról" />
          <Card><Groups groups={earlier} />{now.length === 0 && capsNote}</Card>
        </>
      )}
    </Page>
  )
}
