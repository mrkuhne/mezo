// ============================================================
// Mezo · a „Miből látszik?" mélyoldalak közös üveg-anatómiája (Üvegesítés U8a, mezo-me75u.13)
// Paritás: docs/design_2.0/prototypes/uveg-uzenofal.html #minta/*, #elore/*, #kiserlet-oldal/*
// (owner OK 2026-09-24). A minta-, az előrejelzés- és a kísérlet-oldal UGYANAZT a keretet
// viseli: üveg vissza-pirula + jobbra a halk eyebrow, oldalanként EGY üveg-hero (`.glass`,
// egy akcentus a `--c`-n), alatta minden más lapos panel. Stílus: prototype.css
// `── uveg mezo mibol (` blokk.
// ============================================================
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

/** Az egy akcentus, amit egy felület visel (`.pdt-tone-*` → `--c`). A `mute` a lezárt,
 *  elengedett, elvetett állapot halk lilásszürkéje — sosem piros (guardrail). */
export type DetailTone = 'lav' | 'sage' | 'sky' | 'gold' | 'coral' | 'mute'

export const toneClass = (tone: DetailTone) => `pdt-tone-${tone}`

/** A mélyoldalak kerete: üveg vissza-pirula (`useBackTo` adja a célt és a nevét), jobbra az
 *  oldal halk eyebrow-ja, a test pedig egy belépő-koreográfia a `.rise` gyerekeknek. */
export function DetailFrame({ back, eyebrow, children }: {
  back: { label: string; onBack: () => void }
  eyebrow: string
  children: ReactNode
}) {
  return (
    <MozaikPage tone="lav" className="pdt-page">
      <PageHead glass label={back.label} onBack={back.onBack}>
        <small className="pdt-nav-eb">{eyebrow}</small>
      </PageHead>
      <PageBody>
        <EntranceGroup className="pdt-body">{children}</EntranceGroup>
      </PageBody>
    </MozaikPage>
  )
}

/** Szekció-fej: a cím nagy, a meta halk eyebrow jobbra (prototípus `.sec`). */
export function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return <div className="pdt-section-head rise"><h2>{title}</h2>{meta && <span>{meta}</span>}</div>
}

/** Állapot-pirula: ikon + szó, a saját tónusában (prototípus `.stp`). A szöveget a hívó adja
 *  úgy, ahogy mindig is szólt — a nagybetűt a CSS teszi rá. */
export function StatePill({ label, tone, art }: { label: ReactNode; tone: DetailTone; art: Icon3DName }) {
  return (
    <span className={cn('pdt-pill', toneClass(tone))}>
      <Icon3D name={art} size={15} />{label}
    </span>
  )
}

/**
 * A nagy nap-gyűrű (prototípus `.bring`): középen a szám (`value`, opcionálisan `/of`), alatta
 * az egység. `pct` a kitöltés 0–100. `unknown` = szaggatott pálya, üres kitöltés („tanulom").
 */
export function DayRing({ value, of, pct, unit, tone, unknown = false, ariaLabel }: {
  value: ReactNode
  of?: ReactNode
  pct: number
  unit: string
  tone: DetailTone
  unknown?: boolean
  ariaLabel?: string
}) {
  const fill = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className={cn('pdt-ring', toneClass(tone), unknown && 'is-unknown')}
      role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel}>
      <svg viewBox="0 0 80 80" aria-hidden="true" className="uv-ring">
        <circle className="uv-ring-track" cx="40" cy="40" r="34" pathLength={100} />
        {fill > 0 && (
          <circle className="uv-ring-prog" cx="40" cy="40" r="34" pathLength={100}
            style={{ strokeDasharray: `${fill} 100` } as CSSProperties} />
        )}
      </svg>
      <span className="pdt-ring-n">{value}{of != null && <i>/{of}</i>}</span>
      <span className="pdt-ring-u">{unit}</span>
    </div>
  )
}

/**
 * Az oldal EGYETLEN üveg-hero-ja (prototípus `.dhero`): fent a megvilágított kút az ikonnal,
 * az eyebrow + a cím, jobbra az állapot-pirula; alatta a hívó tartalma.
 */
export function DetailHero({ tone, art, well, eyebrow, title, pill, labelledBy, children }: {
  tone: DetailTone
  art: Icon3DName
  /** a kút tartalmának felülírása (pl. a domén-jel `data-pattern-domain` horgonnyal) */
  well?: ReactNode
  eyebrow: ReactNode
  title: ReactNode
  pill: ReactNode
  labelledBy?: string
  children?: ReactNode
}) {
  return (
    <section className={cn('glass pdt-hero rise', toneClass(tone))} aria-labelledby={labelledBy}
      style={{ '--i': 1 } as CSSProperties}>
      <div className="pdt-hero-top">
        <span className="pdt-well">{well ?? <Icon3D name={art} size={32} />}</span>
        <span className="pdt-hero-t"><small>{eyebrow}</small><b>{title}</b></span>
        {pill}
      </div>
      {children}
    </section>
  )
}

export interface DecisionButton {
  key: string
  label: string
  art: Icon3DName
  onClick: () => void
  /** a „nem" irány (Elvetem): meleg arany szó, sosem piros */
  no?: boolean
  disabled?: boolean
  pressed?: boolean
}

/** A döntés-gombsor a hero alján (prototípus `.acts.dec`): ikon fölött a szó, egyforma cellák. */
export function DecisionRow({ label, buttons }: { label: string; buttons: DecisionButton[] }) {
  return (
    <div className={cn('pdt-dec', buttons.length === 2 && 'is-two')} role="group" aria-label={label}>
      {buttons.map((button) => (
        <button key={button.key} type="button" className={cn(button.no && 'is-no')}
          disabled={button.disabled} aria-pressed={button.pressed} onClick={button.onClick}>
          <Icon3D name={button.art} size={24} />{button.label}
        </button>
      ))}
    </div>
  )
}

/** A három minta-döntés egy helyen — a hero és a mentett felismerés ugyanazt a sort viseli. */
export function patternDecisionButtons(onDecide: (verb: 'confirm' | 'monitor' | 'reject') => void,
  pressed?: { confirm?: boolean; monitor?: boolean; reject?: boolean }): DecisionButton[] {
  return [
    { key: 'confirm', label: 'Megerősítem', art: 't-tick', onClick: () => onDecide('confirm'), pressed: pressed?.confirm },
    { key: 'monitor', label: 'Figyeljük', art: 't-lens', onClick: () => onDecide('monitor'), pressed: pressed?.monitor },
    { key: 'reject', label: 'Elvetem', art: 't-skip', no: true, onClick: () => onDecide('reject'), pressed: pressed?.reject },
  ]
}

/** A döntések egysoros magyarázata a gombsor alatt (prototípus `.decnote`). */
export function DecisionNote() {
  return (
    <p className="pdt-decnote">
      <b>Megerősítem</b> — beépül a rólad szóló képbe · <b>Figyeljük</b> — tovább számolom, de nem
      tanulok belőle · <b>Elvetem</b> — befagy, többé nem hozom elő.
    </p>
  )
}

/** Őszinte üres / hiba / betöltés sor: szaggatott, üveg és fény nélkül (bible §3 rank 4). */
export function DetailState({ art, children, role, kind = 'empty' }: {
  art: Icon3DName
  children: ReactNode
  role?: 'status' | 'alert'
  kind?: 'empty' | 'loading'
}) {
  return (
    <div className={cn('pdt-state uv-empty rise', kind === 'loading' && 'is-loading')} role={role}>
      <Icon3D name={art} size={28} />
      <div className="pdt-state-body">{children}</div>
    </div>
  )
}
