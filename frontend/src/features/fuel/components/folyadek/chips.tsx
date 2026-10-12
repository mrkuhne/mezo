// Fuel · Folyadék chips and tags (mezo-n4wf5.5). Prototype: fuel.js `scoreChip`, `gluChip`, `gMini`, `gband`, `.fu-tags`.
import type { ReactNode } from 'react'
import { useM } from '@/shared/i18n'
import { fmtFixed } from '@/shared/lib/format'
import { Bub } from '@/shared/ui/folyadek'
import type { GlycemicLevel } from '@/features/fuel/logic/glycemicBand'

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/** The three response shapes (`GCV`, 1:1 with the live `CURVE`): never a number on an axis. */
export const GLY_CURVE: Record<GlycemicLevel, { d: string; peak: [number, number] }> = {
  low: { d: 'M8 78C56 76 92 62 128 60 166 60 200 72 232 78', peak: [128, 60] },
  mid: { d: 'M8 78C50 76 76 42 116 40 158 40 190 68 232 78', peak: [116, 40] },
  high: { d: 'M8 78C46 76 62 14 90 12 112 11 122 52 142 82 160 106 208 90 232 84', peak: [90, 12] },
}
/** The band's colour: ok · warn · lilac. */
export const GLY_COLOR: Record<GlycemicLevel, string> = { low: 'var(--fo-ok)', mid: 'var(--fo-warn)', high: 'var(--fx-lilac)' }

/** The mini response curve (`gMini`), drawn in `currentColor`; `late` adds the dashed, taller ghost of a late meal. */
export function GlyMini({ level, late }: { level: GlycemicLevel; late?: boolean }) {
  const d = GLY_CURVE[level].d
  return (
    <svg className="fx-gmini" viewBox="0 0 240 108" aria-hidden="true">
      <path d="M8 78H232" stroke="currentColor" strokeWidth="3" strokeDasharray="6 10" opacity=".35" />
      {late && <path className="late" d={d} transform="translate(8 78) scale(1.12 1.13) translate(-8 -78)" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="8 9" opacity=".5" />}
      <path d={`${d} L232 108 8 108Z`} fill="currentColor" opacity=".22" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
    </svg>
  )
}

/** The blood sugar chip of a meal row (`gluChip`): the mini curve + the band's word, in the band's colour; opens the sheet. */
export function GlyChip({ level, onOpen, late }: { level: GlycemicLevel; onOpen?: () => void; late?: boolean }) {
  const M = useM()
  const G = M.fuelKozos.gly
  const inner = <><GlyMini level={level} late={late} />{G.levelCap[level]}</>
  return onOpen
    ? <button type="button" className={cx('fx-chip', level)} onClick={onOpen} aria-label={G.chipAria(G.level[level])}>{inner}</button>
    : <span className={cx('fx-chip', level)}>{inner}</span>
}

/** The three-band strip (`gband`): the active band filled in its colour. */
export function GlyBand({ level }: { level: GlycemicLevel }) {
  const M = useM()
  const G = M.fuelKozos.gly
  const all: GlycemicLevel[] = ['low', 'mid', 'high']
  return (
    <div className="fx-gb" role="img" aria-label={G.bandAria(G.level[level])}>
      {all.map((l) => <span key={l} className={cx(l, l === level && 'on')}>{G.levelCap[l]}</span>)}
    </div>
  )
}

/** Mezo's rating as a chip (`scoreChip`): the score on the ten scale (one decimal), a button that opens the rating page;
 *  `score: null` = the rating is still being written („folyamatban", passive). `big` = the header size of a detail page. */
export function ScoreChip({ score, onOpen, big }: { score: number | null; onOpen?: () => void; big?: boolean }) {
  const M = useM()
  const S = M.fuelKozos.score
  if (score == null) return <span className={cx('fx-chip sc pend', big && 'big')}><Bub icon="t-other" size={big ? 30 : 24} />{S.pending}</span>
  const value = fmtFixed(score, 1)
  const inner = <><Bub icon="t-score" size={big ? 30 : 24} />{value}</>
  return onOpen
    ? <button type="button" className={cx('fx-chip sc', big && 'big')} onClick={onOpen} aria-label={S.aria(value)}>{inner}</button>
    : <span className={cx('fx-chip sc', big && 'big')} role="img" aria-label={S.aria(value)}>{inner}</span>
}

export type LineSource = 'pantry' | 'recipe' | 'estimate'
/** NOVA group → its colour (`NOVA`). */
export const NOVA_COLOR: Record<1 | 2 | 3 | 4, string> = { 1: 'var(--fo-ok)', 2: 'var(--fx-water)', 3: 'var(--fo-warn)', 4: 'var(--fx-lilac)' }

/** The small tags under a line's name (`.fu-tags`): where the line comes from (+ „· AI" when the analysis put it there), the
 *  „nézd át" mark, the NOVA short name with its dot, and any extra tag (a kind, a brand — stored text, never translated). */
export function LineTags({ source, ai, review, nova, extra, warnSource }: {
  source?: LineSource | null; ai?: boolean; review?: boolean; nova?: number | null; extra?: ReactNode[]; warnSource?: boolean
}) {
  const M = useM()
  const K = M.fuelKozos
  const n = nova === 1 || nova === 2 || nova === 3 || nova === 4 ? nova : null
  return (
    <span className="fx-tags">
      {source && <em className={warnSource ? 'w' : undefined}>{K.source[source]}{ai ? ` · ${K.source.ai}` : ''}</em>}
      {review && <em className="w">{K.source.review}</em>}
      {n && <em style={{ ['--c' as string]: NOVA_COLOR[n] }}><i />{K.nova[`n${n}`]}</em>}
      {extra?.map((x, i) => (x == null || x === '' || x === false ? null : <em key={i}>{x}</em>))}
    </span>
  )
}
