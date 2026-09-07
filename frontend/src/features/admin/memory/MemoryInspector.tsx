import type { ReactNode } from 'react'

// The persistent right-hand inspector shared by all four memory views (mezo-4qyt.3). Purely
// presentational: a title, a collapse control, and whatever body the active view/selection
// hands it. `am-inspector`/`am-inspector.collapsed` (prototype.css §Admin memory explorer).

/**
 * `sourceKind` (or, for a run candidate, `candidateKind`) → the admin data-browser table name
 * (`AdminDataPage`'s `?table=` param). Kept as ONE exported record so every view's inspector
 * body shares it — an unmapped kind renders its ids as plain text, never a broken link (Step
 * 3.4 trap: "an unmapped sourceKind renders the ids as plain text, never a broken link").
 */
export const SOURCE_KIND_TABLE: Record<string, string> = {
  memory_item: 'memory_item',
  food_log: 'food_log',
  train_session: 'train_session',
  journal_note: 'journal_note',
  habit_tick: 'habit_tick',
  app_user: 'app_user',
}

/** Builds the data-browser deep link, or `null` when the kind has no mapped table. */
export function sourceLink(kind: string | null | undefined, id: string | null | undefined): string | null {
  if (!kind || !id) return null
  const table = SOURCE_KIND_TABLE[kind]
  if (!table) return null
  return `/admin/data?table=${encodeURIComponent(table)}&rowId=${encodeURIComponent(id)}`
}

export function MemoryInspector({
  title,
  collapsed,
  onToggleCollapse,
  children,
}: {
  title: string
  collapsed: boolean
  onToggleCollapse: () => void
  children: ReactNode
}) {
  return (
    <aside className={`am-inspector${collapsed ? ' collapsed' : ''}`}>
      <div className="hd">
        <b>{title}</b>
        <button
          type="button"
          data-collapse
          title={collapsed ? 'Kinyitás' : 'Összecsukás'}
          onClick={onToggleCollapse}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      {!collapsed && children}
    </aside>
  )
}

export function InspectorEmpty({ children = 'Válassz egy elemet a listából.' }: { children?: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function InspectorRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="row">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  )
}

export function InspectorSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="sec">{label}</div>
      <div className="txt">{children}</div>
    </>
  )
}
