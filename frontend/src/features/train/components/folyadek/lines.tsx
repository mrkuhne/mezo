// Edzés · the label–value line and the indented breakdown under a row (mezo-n4wf5.3; prototype vilagos/edzes.js
// `.vs-sjl` / `.vs-sjp` / `.vs-sw`). One recipe for the two plan editors (the running plan's day editor and the custom
// workout builder, the template editor's exercise card and load panel) and the catalogue sheet. CSS: `.ex-sjl`, `.ex-sjp`,
// `.ex-sw` in folyadek-edzes-kozos.css.
import { useState, type HTMLAttributes, type ReactNode } from 'react'
import type { Icon3DName } from '@/shared/ui/clay'
import { Row, Stepper } from '@/shared/ui/folyadek'

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export const kgText = (v: number) => String(v).replace('.', ',')

/** One line: what it is on the left (`label`), its control or value on the right (`children`). */
export function KnobLine({ label, className, children, ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { label?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cx('ex-sjl', className)} {...rest}>
      {label !== undefined && <span>{label}</span>}
      {children}
    </div>
  )
}

/** The indented block hanging under a row: its knobs, or what a number is made of. */
export function KnobPanel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('ex-sjp', className)} {...rest} />
}

/** One knob: its label on the left, − value + on the right. `name` scopes the buttons' names. */
export function StepLine({ label, name, value, auto, onDec, onInc, lo, hi, className }: {
  label: ReactNode; name: string; value: ReactNode; auto?: boolean; onDec: () => void; onInc: () => void; lo?: boolean; hi?: boolean; className?: string
}) {
  return (
    <KnobLine label={label} className={className}>
      <Stepper name={name} value={value} auto={auto} onDec={onDec} onInc={onInc} decDisabled={lo} incDisabled={hi} />
    </KnobLine>
  )
}

/** The nullable starting weight: 2.5 kg steps from 20, „auto" when unset (below 2.5 it falls back to auto). */
export function AnchorLine({ name, value, onChange }: { name: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  const STEP = 2.5
  const START = 20
  const round = (n: number) => Math.round(n * 100) / 100
  const isAuto = value == null
  const dec = () => {
    if (isAuto) return
    const next = round(value - STEP)
    onChange(next < STEP ? null : next)
  }
  const inc = () => onChange(isAuto ? START : Math.min(999, round(value + STEP)))
  return <StepLine label="Kiinduló kg" name={name} value={isAuto ? 'auto' : kgText(value)} auto={isAuto} onDec={dec} onInc={inc} lo={isAuto} />
}

/** „Számít a volumenbe" — a switch on its own line. */
export function VolumeSwitch({ name, label, on, onChange }: { name: string; label: ReactNode; on: boolean; onChange: (next: boolean) => void }) {
  return (
    <KnobLine label={label}>
      <button type="button" role="switch" aria-checked={on} aria-label={`${name} · számít a volumenbe`}
        className={on ? 'ex-sw on' : 'ex-sw'} onClick={() => onChange(!on)} />
    </KnobLine>
  )
}

/** A check that opens in place (prototype `.vs-cv` + `.vs-in.col`): a row with its verdict stamp and a ▲/▼ mark; the
 *  findings hang under it as quiet indented lines. Closed by default. */
export function CheckRow({ icon, title, stamp, children }: { icon: Icon3DName; title: ReactNode; stamp: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Row className="ex-chk" icon={icon} title={title} onClick={() => setOpen((v) => !v)} aria-expanded={open}
        right={<>{stamp}<span className="ex-cv" aria-hidden="true">{open ? '▲' : '▼'}</span></>} />
      {open && <div className="fo-under col">{children}</div>}
    </>
  )
}
