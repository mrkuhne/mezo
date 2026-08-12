// ============================================================
// Mezo · TodayList — egy szekció az iOS listanyelven (mezo-e26w): a fejléc a
// 16px-es sínen, a dobozon KÍVÜL áll (iOS grouped-list konvenció), a sorok
// EGY lekerekített dobozban, hajszálvonalas elválasztókkal. A doboz nem visel
// árnyékot — a `.5px` keret és a `--surface-card` háttér adja az elkülönülést.
// Domain-mentes: csak prezentációs propok.
// ============================================================
import type { ReactNode } from 'react'

export interface TodayListProps {
  /** A szekció neve; hiányában nincs fejléc (pl. egy önálló, cím nélküli doboz). */
  label?: string
  /** A fejlécben a név mögé kerülő darabszám. */
  count?: number
  /** A fejléc jobb szélén álló link/gomb (küldetés → /me/growth, fuel → napló). */
  action?: ReactNode
  children: ReactNode
}

export function TodayList({ label, count, action, children }: TodayListProps) {
  return (
    <div className="td-sec">
      {label && (
        <div className="td-sech">
          <b>{count != null ? `${label} · ${count}` : label}</b>
          {action}
        </div>
      )}
      <div className="td-list">{children}</div>
    </div>
  )
}
