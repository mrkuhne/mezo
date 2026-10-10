import type { CSSProperties, ReactNode } from 'react'
import type { Icon3DName } from '@/shared/ui/clay'
import { Acts } from './Btn'
import { Bub } from './Bub'
import { clamp, cx } from './util'

export interface LevelMark { at: number; dashed?: boolean; label?: ReactNode }

/** A horizontal vessel with waterlines standing in it (a limit, last week's value): the marks overhang the vessel,
 *  an optional label sits under each (prototype `wlv`). */
export function LevelMarks(p: { pct: number; color?: string; height?: number; marks?: LevelMark[]; className?: string }) {
  return (
    <span className={cx('fo-wlv', p.className)} style={{ '--c': p.color ?? 'var(--dom)', '--h': `${p.height ?? 14}px` } as CSSProperties}>
      <i style={{ width: `${clamp(p.pct)}%` }} />
      {p.marks?.map((m, i) => <u key={i} className={m.dashed ? 'd' : undefined} style={{ left: `${clamp(m.at)}%` }}>{m.label != null && <em>{m.label}</em>}</u>)}
    </span>
  )
}

/** One vessel, two liquids: what is already in (deep, `a` %) and what still comes (hatched, `b` %). `big` = under a big numeral. */
export function Split(p: { a: number; b: number; color?: string; big?: boolean; className?: string }) {
  const a = clamp(p.a)
  return (
    <span className={cx('fo-split', p.big && 'big', p.className)} style={{ '--c': p.color ?? 'var(--dom)' } as CSSProperties}>
      <i style={{ width: `${a}%` }} />
      <u style={{ left: `${a}%`, width: `${clamp(p.b, 0, 100 - a)}%` }} />
    </span>
  )
}

export interface PourPart { n: number; color: string; label?: ReactNode }

/** Amounts poured into one vessel as layers side by side, each in its own colour with its number. `sm` = a thin strip without
 *  numbers; with no parts it is the dashed empty vessel holding `empty`. */
export function Pour(p: { parts: PourPart[]; sm?: boolean; empty?: ReactNode; className?: string; 'aria-label'?: string }) {
  const none = p.parts.length === 0
  return (
    <div className={cx('fo-pour', p.sm && 'sm', none && 'e', p.className)} role={p['aria-label'] ? 'img' : undefined} aria-label={p['aria-label']}>
      {none
        ? <i style={{ flex: 1 }}>{p.empty != null && <b>{p.empty}</b>}</i>
        : p.parts.map((x, i) => <i key={i} style={{ flex: Math.max(x.n, 0.0001), '--c': x.color } as CSSProperties}>{!p.sm && <b>{x.label ?? x.n}</b>}</i>)}
    </div>
  )
}

export interface LegendItem { label: ReactNode; color?: string
  /** drop = a liquid (default), hatch = a liquid still to come, line / dash = a waterline, vessel = the rim of the vessel. */
  kind?: 'drop' | 'hatch' | 'line' | 'dash' | 'vessel' }

/** The key under a graphic: what each liquid, waterline or rim means. */
export function Legend(p: { items: LegendItem[]; center?: boolean; className?: string }) {
  return (
    <div className={cx('fo-lg', p.center && 'c', p.className)}>
      {p.items.map((it, i) => (
        <span key={i}><i className={it.kind && it.kind !== 'drop' ? it.kind : undefined} style={it.color ? ({ '--c': it.color } as CSSProperties) : undefined} />{it.label}</span>
      ))}
    </div>
  )
}

/** Intensity as drops: `n` of `of` (default 3) are full. */
export function DropsMeter(p: { n: number; of?: number; color?: string; label?: string; className?: string }) {
  const of = p.of ?? 3
  return (
    <span className={cx('fo-dm', p.className)} style={{ '--c': p.color ?? 'var(--dom)' } as CSSProperties} role="img" aria-label={p.label ?? `${p.n} / ${of}`}>
      {Array.from({ length: of }, (_, i) => <i key={i} className={i < p.n ? 'f' : undefined} />)}
    </span>
  )
}

/** The empty vessel of a "nothing here yet" state: a bubble icon, a sentence, optional actions, a thin rest of liquid at the bottom. */
export function EmptyTank(p: { icon?: Icon3DName; actions?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cx('fo-ev', p.className)}>
      {p.icon && <Bub icon={p.icon} size={52} />}
      <p>{p.children}</p>
      {p.actions != null && <Acts center>{p.actions}</Acts>}
      <i />
    </div>
  )
}

/** The loading face in the shape of the page: one block per px height (hero, cards). */
export function Skel(p: { blocks?: number[]; label?: string; className?: string }) {
  return (
    <div className={cx('fo-sk', p.className)} role="status" aria-label={p.label ?? 'Betöltés…'}>
      {(p.blocks ?? [320, 130, 190]).map((h, i) => <i key={i} style={{ height: h }} />)}
    </div>
  )
}

/** A callout box: bubble icon (or `left`), a bold title, a body under it. */
export function Box(p: { icon?: Icon3DName; color?: string; left?: ReactNode; title: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={cx('fo-box', p.className)}>
      {p.left ?? (p.icon && <Bub icon={p.icon} size={36} color={p.color} />)}
      <div><b>{p.title}</b>{p.children}</div>
    </div>
  )
}

export interface TagItem { label: ReactNode; icon?: Icon3DName; left?: ReactNode }

/** Fact tags without the leading drop of `Chips`: plain text, or a small bubble icon / custom node (a muscle chip) in front. */
export function Tags(p: { items: (TagItem | string)[]; className?: string }) {
  return (
    <div className={cx('fo-tags', p.className)}>
      {p.items.map((x, i) => {
        const it: TagItem = typeof x === 'string' ? { label: x } : x
        const lead = it.left ?? (it.icon && <Bub icon={it.icon} size={28} />)
        return <span key={i} className={it.left != null ? undefined : lead ? 'ic' : 'tx'}>{lead}{it.label}</span>
      })}
    </div>
  )
}
