// ============================================================
// Mezo · FuelStackPage — the Kiegészítők hub (S2 manifest D1: today + tick + undo; Folyadék F5, mezo-n4wf5.5).
// Prototype: docs/design_2.0/prototypes/vilagos/fuel.js `stack()` (states: stack · .kesz · .ures · .tolt).
//
// Top to bottom:
//   the hero — today's doses as capsules by part of the day (full = taken, ringed = next), the verdict „Következik: …"
//     with the one-tap „Bevettem" on the liquid (the first untaken item of the earliest unfinished band), or „Mára minden
//     megvan.", or the empty / loading face,
//   one numbered section per part of the day (Reggel · Dél · Délután · Este) with its tickable rows; the band that is due
//     wears „most esedékes", a finished one goes quiet — none disappears,
//   „Protokoll és beállítás" — the three doors (Protokoll, Új elem, Gyógyszer) and the boundary line.
//
// Tick / undo ride the existing `useStackIntakeToggle` (the success toast's Visszavonás is bound to the created intake).
// A row opens the item box (`FuelStackItemGlass`), which always reads the FRESH row. The page has no error face: the
// hooks fall back to empty. The kalauz anchor `stack-hero` sits on the hero in both faces.
// ============================================================
import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIntakes, useProtocol, useStack, useStackDay } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { useM } from '@/shared/i18n'
import { Btn, Card, Chev, Hero, Note, Page, Row, Section, St, Tick, useFrameTitle } from '@/shared/ui/folyadek'
import { groupStackByBand, nextDueBand, type BandRow, type StackBand } from '@/features/fuel/logic/stackBands'
import { useStackIntakeToggle } from '@/features/fuel/logic/useStackIntakeToggle'
import { FuelStackItemGlass } from '@/features/fuel/components/FuelStackItemGlass'

/** Today's doses as capsules, grouped by part of the day (prototype `capsG`): full = taken, ringed = the next one.
 *  Without rows it is the quiet ghost row (empty protocol, loading). */
export function StackCaps({ bands, next, label }: { bands: StackBand[]; next?: BandRow | null; label?: string }) {
  if (bands.length === 0) {
    return (
      <div className="fk-caps fk-ghost" aria-hidden="true">
        {[0, 1, 2, 3].map(i => <span className="g" key={i}><span className="r"><i /><i /></span></span>)}
      </div>
    )
  }
  return (
    <div className="fk-caps" role="img" aria-label={label}>
      {bands.map(band => (
        <span className="g" key={band.key}>
          <span className="r">
            {band.rows.map(row => (
              <i key={row.occurrenceId}
                className={[row.taken && 'on', next?.occurrenceId === row.occurrenceId && 'nx'].filter(Boolean).join(' ') || undefined} />
            ))}
          </span>
          <small>{band.label}</small>
        </span>
      ))}
    </div>
  )
}

export function FuelStackPage() {
  const navigate = useNavigate()
  const M = useM().fuelKieg
  const { slots, wake, bed } = useStackDay()
  const { occurrences, pending: protocolPending } = useProtocol()
  const { pending: stackPending } = useStack()
  const intakes = useIntakes(localDateString())
  const { toggleIntake } = useStackIntakeToggle()
  const [openRow, setOpenRow] = useState<BandRow | null>(null)

  const bands = groupStackByBand(slots, intakes, { wake, bed })
  const dueBand = nextDueBand(bands)
  const rows = bands.flatMap(band => band.rows)
  const takenCount = rows.filter(row => row.taken).length
  const nextRow = dueBand
    ? bands.find(band => band.key === dueBand)?.rows.find(row => !row.taken) ?? null
    : null
  const loading = protocolPending || stackPending
  // The row living on the item box ALWAYS comes from the fresh projection, so its tick shows the new
  // state right after the mutation (the row itself is recomputed under us).
  const liveRow = openRow
    ? rows.find(row => row.occurrenceId === openRow.occurrenceId) ?? openRow
    : null
  const total = rows.length

  useFrameTitle({ eyebrow: total > 0 ? M.hub.eyebrow(takenCount, total) : M.hub.eyebrowEmpty })

  const caps = <div className="fk-g"><StackCaps bands={bands} next={nextRow} label={M.hub.capsAria(takenCount, total)} /></div>
  const doseOf = (row: BandRow) => row.dose ?? M.common.noDose

  return (
    <Page className="fk-page">
      {total === 0 ? (
        loading
          ? <Hero className="fk-ghero" data-kalauz-anchor="stack-hero" label={M.hub.label} verdict={M.hub.loading}>{caps}</Hero>
          : (
            <Hero className="fk-ghero" data-kalauz-anchor="stack-hero" label={M.hub.label} verdict={M.hub.emptyVerdict} sub={M.hub.emptySub}
              actions={<Btn onClick={() => navigate('/fuel/stack/manage/add')}>{M.common.setUpNew}</Btn>}>
              {caps}
            </Hero>
          )
      ) : nextRow ? (
        <Hero className="fk-ghero" data-kalauz-anchor="stack-hero" label={M.hub.labelCount(takenCount, total)}
          verdict={M.hub.next(nextRow.name)}
          sub={M.hub.nextSub(doseOf(nextRow), nextRow.zoneLabel, nextRow.entry.reason)}
          actions={<Btn onClick={() => { void toggleIntake(nextRow.entry) }}>{M.common.markTaken}</Btn>}>
          {caps}
        </Hero>
      ) : (
        <Hero className="fk-ghero" data-kalauz-anchor="stack-hero" label={M.hub.labelCount(takenCount, total)}
          verdict={M.hub.doneVerdict} sub={M.hub.doneSub}>
          {caps}
        </Hero>
      )}

      {bands.map((band, index) => (
        <Fragment key={band.key}>
          <Section n={index + 1} className="fk-bandsec" title={M.hub.band(band.label, band.doneCount, band.rows.length)}
            link={band.key === dueBand ? <St tone="plan">{M.hub.dueNow}</St> : undefined} />
          <Card className={band.doneCount === band.rows.length ? 'fk-dim' : undefined}>
            {band.rows.map(row => (
              <Row key={row.occurrenceId} as="div"
                left={<Tick on={row.taken} label={row.taken ? M.hub.tickUndo(row.name) : M.hub.tickTake(row.name)}
                  onClick={() => { void toggleIntake(row.entry) }} />}
                title={row.name}
                sub={row.taken && row.takenAtHHmm
                  ? M.hub.rowSubTaken(doseOf(row), row.zoneLabel, row.takenAtHHmm)
                  : M.hub.rowSub(doseOf(row), row.zoneLabel)}
                onClick={() => setOpenRow(row)} aria-label={M.hub.details(row.name)}
                right={<Chev />} />
            ))}
          </Card>
        </Fragment>
      ))}

      <Section n={bands.length + 1} title={M.hub.section} />
      <Card>
        <Row icon="t-protocol" title={loading ? M.hub.protocolPending : M.hub.protocol(occurrences.length)}
          sub={M.hub.protocolSub} onClick={() => navigate('/fuel/stack/protocol')} />
        <Row icon="t-gear" title={M.common.setUpNew} sub={M.common.setUpNewSub}
          onClick={() => navigate('/fuel/stack/manage/add')} />
        <Row icon="t-syringe" title={M.hub.medication} sub={M.hub.medicationSub}
          onClick={() => navigate('/fuel/gyogyszer')} />
        <Note>{M.common.note}</Note>
      </Card>

      {liveRow && <FuelStackItemGlass row={liveRow} onClose={() => setOpenRow(null)}
        onToggle={() => { void toggleIntake(liveRow.entry) }} />}
    </Page>
  )
}
