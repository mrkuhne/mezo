// ============================================================
// Mezo · FuelStackPage — a Kiegészítők hub (Fuel Titanium S2, mezo-g2vl; fagyasztott manifeszt
// D1: ma + pipa + visszavonás, a hub és a `/fuel/stack/today` ÖSSZEVONÁSA).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `stackPage` (:295) + `stackItemGlass` (:314), a fuel-pages.css `/* Kiegészítők */` (:246) és
// `.sx-*` blokkjaival. Anatómia fentről le:
//   a műszer — a bevéve/összes gyűrű + a „MIT VESZEK BE MA?" felirat + a KÖVETKEZIK egyérintéses
//     sor (a legkorábbi befejezetlen sáv első tétele), vagy a „mára minden megvan" sor,
//   az idősávok — egy-egy színmosott kártya (Reggel · Dél · Délután · Este), fejlécében
//     clay-szimbólum + sávfelirat + készültség, benne a pipálható sorok,
//   a két ajtó — Protokoll (D2) és Új elem (D3), poszter-anatómiával,
//   a csendes Gyógyszer-sor (D5: VÁLTOZATLAN, csak ide nyílik az ajtaja).
//
// Owner-döntések, amiket a markup hordoz:
//   • a mai lista idősávok szerint csoportosul, EGYÉRINTÉSES pipálással — ez a főszereplő,
//   • a most esedékes sáv kiemelten áll, de a többi NEM tűnik el,
//   • egy tétel koppintása ÜVEGKÁRTYÁT nyit a részleteivel — valódi paddinggal, színezett,
//     szekcionált blokkokkal.
//
// A pipa/visszavonás a meglévő `useStackIntakeToggle`-n megy: a siker-toast visszavonás-akciója
// változatlan viselkedés (mezo-vx9v), itt nem írunk új naplózási utat.
//
// Az üvegkártya natív <dialog>: az Escape és a backdrop a platform dolga. A jsdom nem hoz
// HTMLDialogElement-et, ezért a `showModal`/`close` feature-detektált (a ház mintája:
// FuelEnergyHero).
//
// Határvonal: minden adag-felületen ott áll, hogy ez tájékoztatás, nem orvosi tanács.
// ============================================================
import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIntakes, useProtocol, useStack, useStackDay } from '@/data/hooks'
import { localDateString } from '@/shared/lib/dates'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { groupStackByBand, nextDueBand, type BandKey, type BandRow, type StackBand }
  from '@/features/fuel/logic/stackBands'
import { useStackIntakeToggle } from '@/features/fuel/logic/useStackIntakeToggle'
import { FuelStackItemGlass } from '@/features/fuel/components/FuelStackItemGlass'

/** Egy-egy clay szimbólum és ház-hue sávonként (a prototípus `ZONE_STYLE`-ja ház-tokenekkel —
 *  a beégetett sötét hexeket nem vesszük át, a Kiegészítők a ház saját témájában él). */
const BAND_FACE: Record<BandKey, { icon: ClayIconName; color: string }> = {
  morning: { icon: 'i-hajnal', color: 'var(--amber)' },
  midday: { icon: 'i-ebed', color: 'var(--sage)' },
  afternoon: { icon: 'i-nap', color: 'var(--coral)' },
  evening: { icon: 'i-hold', color: 'var(--lav)' },
}

function BandRowView({ row, onToggle, onOpen }: {
  row: BandRow
  onToggle: () => void
  onOpen: () => void
}) {
  const taken = row.taken
  return (
    <div className={`fsx-row${taken ? ' is-done' : ''}`}>
      <button
        type="button"
        className="fsx-check"
        aria-pressed={taken}
        aria-label={`${row.name}: ${taken ? 'visszavonom' : 'bevettem'}`}
        onClick={onToggle}
      >
        <span aria-hidden="true">{taken ? '✓' : ''}</span>
      </button>
      <button type="button" className="fsx-row-main" aria-label={`${row.name} részletei`} onClick={onOpen}>
        <span className="fsx-row-art" aria-hidden="true"><ClayIcon name="i-kiegeszito" size={34} /></span>
        <span className="fsx-row-copy">
          <strong>{row.name}</strong>
          <small>
            {row.dose ?? 'adag nincs megadva'} · {row.zoneLabel}
            {taken && row.takenAtHHmm ? ` · bevéve ${row.takenAtHHmm}` : ''}
          </small>
        </span>
        <b aria-hidden="true">›</b>
      </button>
    </div>
  )
}

function BandCard({ band, due, onToggle, onOpen }: {
  band: StackBand
  due: boolean
  onToggle: (row: BandRow) => void
  onOpen: (row: BandRow) => void
}) {
  const face = BAND_FACE[band.key]
  const complete = band.doneCount === band.rows.length
  const headingId = useId()
  return (
    <section
      className={`fsx-band${due ? ' is-due' : ''}${complete ? ' is-complete' : ''}`}
      style={{ '--fsx-band-color': face.color } as React.CSSProperties}
      aria-labelledby={headingId}
    >
      <div className="fsx-band-head">
        <span className="fsx-band-art" aria-hidden="true"><ClayIcon name={face.icon} size={34} /></span>
        <strong id={headingId}>{band.label}</strong>
        <span className="fsx-band-count">{band.doneCount} / {band.rows.length}</span>
      </div>
      {band.rows.map(row => (
        <BandRowView
          key={row.occurrenceId}
          row={row}
          onToggle={() => onToggle(row)}
          onOpen={() => onOpen(row)}
        />
      ))}
    </section>
  )
}

/** A műszer: a napi készültség gyűrűje + a KÖVETKEZIK egyérintéses sor. */
function StackHero({ taken, total, next, onToggle }: {
  taken: number
  total: number
  next: BandRow | null
  onToggle: (row: BandRow) => void
}) {
  const progress = total > 0 ? Math.round((taken / total) * 100) : 0
  return (
    <div className="fsx-hero" data-kalauz-anchor="stack-hero">
      <span className="fsx-glow" aria-hidden="true" />
      <div
        className="fsx-ring"
        style={{ '--fsx-progress': String(progress) } as React.CSSProperties}
        role="progressbar"
        aria-label="Mai kiegészítő-haladás"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={taken}
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="fsx-ring-track" cx="60" cy="60" r="52" pathLength={100} />
          <circle className="fsx-ring-progress" cx="60" cy="60" r="52" pathLength={100} />
        </svg>
        <span aria-hidden="true">
          <strong>{taken}<small> / {total}</small></strong>
          <b>BEVÉVE MA</b>
        </span>
      </div>
      <div className="fsx-hero-copy">
        <span className="fsx-overline">MIT VESZEK BE MA?</span>
        {next ? (
          <button type="button" className="fsx-next" onClick={() => onToggle(next)}>
            <span className="fsx-next-art" aria-hidden="true"><ClayIcon name="i-kiegeszito" size={34} /></span>
            <span className="fsx-next-copy">
              <small>KÖVETKEZIK</small>
              <strong>{next.name}</strong>
              <em>{next.dose ?? 'adag nincs megadva'} · {next.zoneLabel}</em>
            </span>
            <b>BEVETTEM</b>
          </button>
        ) : (
          <p className="fsx-done">
            <span aria-hidden="true"><ClayIcon name="i-stack" size={26} /></span>
            <span>Mára minden megvan. Ha félrement valami, a pipát bármikor visszavonhatod.</span>
          </p>
        )}
      </div>
    </div>
  )
}

export function FuelStackPage() {
  const navigate = useNavigate()
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
  // Az üvegkártyán élő sor MINDIG a friss projekcióból jön, hogy a benne lévő pipa a
  // mutáció után azonnal az új állapotot mutassa (a sor maga újraszámolódik alattunk).
  const liveRow = openRow
    ? rows.find(row => row.occurrenceId === openRow.occurrenceId) ?? openRow
    : null

  return (
    <MozaikPage tone="sage" className="fsx-page">
      <EntranceGroup>
        <PageBody className="fsx-body">
          {rows.length > 0 ? (
            <>
              <StackHero
                taken={takenCount} total={rows.length} next={nextRow}
                onToggle={row => { void toggleIntake(row.entry) }}
              />
              {bands.map(band => (
                <BandCard
                  key={band.key}
                  band={band}
                  due={band.key === dueBand}
                  onToggle={row => { void toggleIntake(row.entry) }}
                  onOpen={setOpenRow}
                />
              ))}
            </>
          ) : (
            <div className="fsx-empty" data-kalauz-anchor="stack-hero">
              <span aria-hidden="true"><ClayIcon name="i-kiegeszito" size={72} /></span>
              <strong>{loading ? 'Protokoll betöltése…' : 'A protokollod még üres'}</strong>
              <p>
                Vedd fel az első kiegészítőt, és megmondom, mennyit vegyél be belőle, mikor és
                miért.
              </p>
            </div>
          )}

          <button type="button" className="fsx-poster is-protocol"
            onClick={() => navigate('/fuel/stack/protocol')}>
            <span className="fsx-poster-head">
              <span aria-hidden="true"><ClayIcon name="i-stack" size={30} /></span>
              <strong>Protokoll</strong>
              <b aria-hidden="true">↗</b>
            </span>
            <span className="fsx-poster-copy">
              <strong>{loading ? '—' : `${occurrences.length} elem`}</strong>
              <small>Mit miért szedsz, és ki tette a helyére.</small>
            </span>
          </button>

          <button type="button" className="fsx-poster is-setup"
            onClick={() => navigate('/fuel/stack/manage/add')}>
            <span className="fsx-poster-head">
              <span aria-hidden="true"><ClayIcon name="i-beallitas" size={30} /></span>
              <strong>Új elem</strong>
              <b aria-hidden="true">↗</b>
            </span>
            <span className="fsx-poster-copy">
              <strong>Új elem beállítása</strong>
              <small>Megmondom, mennyit vegyél be belőle, mikor és miért.</small>
            </span>
          </button>

          {/* D5: a gyógyszer-felület VÁLTOZATLAN — ez csak a meglévő ajtaja. */}
          <button type="button" className="fsx-quiet" onClick={() => navigate('/fuel/gyogyszer')}>
            <span aria-hidden="true"><ClayIcon name="i-injekcio" size={28} /></span>
            <span><strong>Gyógyszer</strong><small>A követett gyógyszered és a ciklusa</small></span>
            <b aria-hidden="true">↗</b>
          </button>

          <p className="fsx-note">Tájékoztatás, nem orvosi tanács.</p>
        </PageBody>
      </EntranceGroup>

      {liveRow && <FuelStackItemGlass row={liveRow} onClose={() => setOpenRow(null)}
        onToggle={() => { void toggleIntake(liveRow.entry) }} />}
    </MozaikPage>
  )
}
