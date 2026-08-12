// ============================================================
// Mezo · TodayRow — a Mai lap sora az iOS listanyelven (mezo-e26w).
// TUDATOSAN NEM a `shared/ui`-beli `ItemRow`: azt a Fuel „Mai" és a rutin-szerkesztő
// is rendereli, és ebben a változásban egyiket sem mozdítjuk (spec §7).
// Négy kísérő-alak — `tick` (MANUAL szokás pipálása) · `button` (tintás
// szöveggomb) · `chevron` (az EGÉSZ sor a gomb) · `none` (olvasható sor).
// Az `ItemRow`-tól szó szerint átvett négy viselkedési szabály:
//   • `linkUrl` → trailing ↗ az akció MELLETT, sosem helyette, és SOSEM a sor
//     saját <button>-jén belül (érvénytelen HTML + kattintás-ütközés).
//   • `disabled` (repülő írás) → a kontroll VISSZAVONÓDIK, nem halványul —
//     nem marad kattintható felület, így dupla koppintás nem indít másodikat.
//   • `actionLabel` `onAction` nélkül → inert szöveg, sosem halott gomb.
//   • `done` → áthúzott cím + telt karika, de az IKON NEM cserélődik ✓-ra
//     (az `ItemRow` cseréli; itt a karika hordozza a pipálást).
// Domain-mentes: csak prezentációs propok.
// ============================================================
import { cn } from '@/shared/lib/cn'
import type { RowAccessory } from '@/features/today/logic/rowAccessory'

export type RowTone = 'habit' | 'quest' | 'fuel' | 'check' | 'train' | 'plain'

export interface TodayRowProps {
  tone: RowTone
  icon: string
  title: string
  subtitle?: string | null
  /** Trailing HH:mm; csak akkor látszik, ha nincs kísérő kontroll. */
  time?: string | null
  accessory: RowAccessory | 'chevron'
  /** A szöveggomb felirata — `accessory: 'button'` esetén kötelező. */
  actionLabel?: string
  onAction?: () => void
  done?: boolean
  /** Külső tartalom új lapon; a trailing ↗-t rendereli. */
  linkUrl?: string | null
  /** Repülő írás — minden interaktív kontrollt visszavon a soron. */
  disabled?: boolean
}

export function TodayRow({
  tone, icon, title, subtitle, time, accessory, actionLabel, onAction, done, linkUrl, disabled,
}: TodayRowProps) {
  const live = Boolean(onAction) && !disabled

  const core = (
    <>
      <span className={cn('td-ic', tone !== 'plain' && `t-${tone}`)} aria-hidden="true">{icon}</span>
      <span className="td-tx">
        <span className="td-t1">{title}</span>
        {subtitle ? <span className="td-t2">{subtitle}</span> : null}
      </span>
    </>
  )

  const link = linkUrl ? (
    <a
      className="td-link np-press"
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title} megnyitása`}
    >
      ↗
    </a>
  ) : null

  const cls = cn('td-row', done && 'is-done')

  // chevron — az EGÉSZ sor a gomb. A link SOSEM kerül a gomb belsejébe.
  if (accessory === 'chevron') {
    const hit = (
      <button type="button" className="td-row-hit np-press" onClick={onAction} aria-label={title}>
        {core}
        <span className="td-chev" aria-hidden="true">›</span>
      </button>
    )
    return live ? <div className={cls}>{hit}{link}</div> : <div className={cls}>{core}{link}</div>
  }

  // tick — pipáló karika; a neve a sor címe, mert a karikának nincs látható szövege.
  if (accessory === 'tick') {
    return (
      <div className={cls}>
        {core}
        {link}
        {live ? (
          <button type="button" className={cn('td-tick', done && 'is-done')}
            onClick={onAction} aria-label={`${title} kipipálása`}>
            ✓
          </button>
        ) : done ? (
          <span className="td-tick is-done" aria-hidden="true">✓</span>
        ) : null}
      </div>
    )
  }

  // button — tintás szöveggomb; címke onAction nélkül inert szöveg.
  if (accessory === 'button') {
    return (
      <div className={cls}>
        {core}
        {link}
        {actionLabel && live ? (
          <button type="button" className="td-act np-press" onClick={onAction}>{actionLabel}</button>
        ) : actionLabel ? (
          <span className="td-act is-inert">{actionLabel}</span>
        ) : null}
      </div>
    )
  }

  // none — olvasható sor; ilyenkor (és csak ilyenkor) jöhet a trailing idő.
  return (
    <div className={cls}>
      {core}
      {link}
      {time ? <span className="td-tm">{time}</span> : null}
    </div>
  )
}
