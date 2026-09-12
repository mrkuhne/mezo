// ============================================================
// Mezo · FuelStackItemGlass — egy kiegészítő részletező ÜVEGKÁRTYÁJA (Fuel Titanium S2,
// mezo-g2vl; manifeszt D1).
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `stackItemGlass` (:314) + a fuel-pages.css `.sx-item*` / `dialog.glass` blokkjai. Owner-döntés:
// „tapping a supplement opens a glass card with its details" — valódi paddinggal, színezett,
// szekcionált blokkokkal. Anatómia: üveg-hero (az adag a nagy szám) → chipek (sáv · eredet ·
// mai állapot) → egyérintéses pipa → termékadatok → „Miért így" → kamra-kapcsolat → határvonal.
//
// A kártya natív <GlassBox onClose={onClose} class="glass">: Escape és backdrop a platformtól, a `showModal`/`close`
// feature-detektált (a ház mintája: FuelEnergyHero). A jsdom nem hoz HTMLDialogElement-et.
//
// Őszinte-null: ha a termékről nem tudjuk, mennyi van egy egységben, NEM találunk ki darabszámot
// — megmondjuk, mit nem tudunk, és felajánljuk a beállítót. Az elhelyezés indoka a motorból jön
// (`placementReason`); ha nincs, nem írunk helyette kitalált miértet.
// ============================================================
import { useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStack } from '@/data/hooks'
import { ClayIcon } from '@/shared/ui/clay'
import type { BandRow } from '@/features/fuel/logic/stackBands'
import type { StackPlacementSource } from '@/data/types'
import { GlassBox } from '@/features/fuel/components/GlassBox'

const SOURCE_LABEL: Record<StackPlacementSource, string> = {
  rule: 'okos elhelyezés',
  llm: 'okos elhelyezés',
  user: 'saját döntés',
  fallback: 'alapértelmezett hely',
}

export function FuelStackItemGlass({ row, onClose, onToggle }: {
  row: BandRow
  onClose: () => void
  onToggle: () => void
}) {
  const titleId = useId()
  const navigate = useNavigate()
  const { stash } = useStack()
  const item = stash.find(candidate => candidate.id === row.itemId)
  const taken = row.taken


  const stock = item && item.stock != null
    ? `${item.stock}${item.stockUnit ? ` ${item.stockUnit}` : ''}`
    : null

  return (
    <GlassBox onClose={onClose}
      className="fsx-glass glass"
      labelledBy={titleId}
    >
      <div className="fsx-glass-hero">
        <span aria-hidden="true"><ClayIcon name="i-kiegeszito" size={56} /></span>
        <div>
          <strong>{row.dose ?? '—'}</strong>
          <small id={titleId}>{row.name} · naponta</small>
        </div>
      </div>

      <div className="fsx-glass-chips">
        <span>{row.zoneLabel} · {row.time}</span>
        <span>{row.entry.pinned ? 'kézi elhelyezés' : SOURCE_LABEL[row.entry.placementSource]}</span>
        <span className={taken ? 'is-on' : undefined}>
          {taken
            ? `bevéve${row.takenAtHHmm ? ` ${row.takenAtHHmm}` : ''}`
            : 'ma még nincs bevéve'}
        </span>
      </div>

      <button type="button" className={`fsx-glass-tick${taken ? ' is-done' : ''}`} onClick={onToggle}>
        <span aria-hidden="true"><ClayIcon name={taken ? 'i-hold' : 'i-stack'} size={26} /></span>
        <span>{taken ? 'Mégsem vettem be' : 'Bevettem'}</span>
        <b aria-hidden="true">{taken ? '↺' : '✓'}</b>
      </button>

      {row.dose || stock ? (
        <div className="fsx-glass-block is-dose">
          <div className="fsx-glass-block-head">
            <span aria-hidden="true"><ClayIcon name="i-polc" size={26} /></span>
            <strong>Ebből a termékből</strong>
          </div>
          <dl className="fsx-glass-rows">
            <div><dt>Napi adag</dt><dd>{row.dose ?? '—'}</dd></div>
            {item?.form && <div><dt>Kiszerelés</dt><dd>{item.form}</dd></div>}
            {stock && <div><dt>Készleten</dt><dd>{stock}</dd></div>}
            {row.entry.dailyTotalHint && (
              <div><dt>Napi összmennyiség</dt><dd>{row.entry.dailyTotalHint}</dd></div>
            )}
          </dl>
        </div>
      ) : (
        <div className="fsx-glass-block is-quiet">
          <div className="fsx-glass-block-head">
            <span aria-hidden="true"><ClayIcon name="i-polc" size={26} /></span>
            <strong>Termékadatok</strong>
          </div>
          <p>
            Nincs megadva, mennyi van egy egységben — a beállítóban pótolhatod, és megmondom, hány
            kell belőle.
          </p>
          <button type="button" className="fsx-glass-link"
            onClick={() => { onClose(); navigate('/fuel/stack/manage/add') }}>
            <span aria-hidden="true"><ClayIcon name="i-beallitas" size={26} /></span>
            <span>Beállítom</span>
            <b aria-hidden="true">›</b>
          </button>
        </div>
      )}

      <div className="fsx-glass-block is-why">
        <div className="fsx-glass-block-head">
          <span aria-hidden="true"><ClayIcon name="i-lang" size={26} /></span>
          <strong>Miért így</strong>
        </div>
        <p>
          {row.entry.reason
            ?? (row.entry.pinned
              ? `Ide raktad kézzel — ${row.zoneLabel}.`
              : 'Az elhelyezéshez nem tartozik indok.')}
        </p>
      </div>

      {item ? (
        <button type="button" className="fsx-glass-link is-shelf"
          onClick={() => { onClose(); navigate(`/fuel/kamra/${item.id}`) }}>
          <span aria-hidden="true"><ClayIcon name="i-kamra" size={30} /></span>
          <span>
            <strong>{item.name}</strong>
            <small>{stock ? `${stock} a kamrádban` : 'a kamrádban'}</small>
          </span>
          <b aria-hidden="true">›</b>
        </button>
      ) : (
        <div className="fsx-glass-block is-quiet">
          <div className="fsx-glass-block-head">
            <span aria-hidden="true"><ClayIcon name="i-kamra" size={26} /></span>
            <strong>Nincs a kamrádban</strong>
          </div>
          <p>
            A protokollodban ott van, a polcodon nem. Ha felveszed a Konyhában, innen is elérhető
            lesz.
          </p>
        </div>
      )}

      <p className="fsx-note">Tájékoztatás, nem orvosi tanács.</p>
      <button type="button" className="fsx-glass-close" onClick={onClose}>Bezárom</button>
    </GlassBox>
  )
}
