import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, FoSheetHead, Lk, Row, Tubes } from '@/shared/ui/folyadek'
import type { RecoveryReturn } from '@/data/train/recoveryApi'
import { returnCopy } from '@/features/train/logic/recovery'
import { KIMELO } from '@/features/train/logic/skipCopy'

/**
 * „Üdv újra!" (Kímélő mód S2, mezo-q4xt2.2; Folyadék mezo-n4wf5.3 — prototype vilagos/edzes.js
 * `udvSheet()`): after „Jobban vagyok" the server has ended the period and applied its return rule;
 * this says what happens next, from the server's own `return`. Three tubes draw the ramp (the first
 * session at two thirds with ~10% less weight, the second lightened only when the server ramps two
 * sessions — `rampSessions` —, then the full plan), three rows say it in words: the calendar line,
 * how the first session(s) are lightened, the first run's half length. „Rendben" closes; the quiet
 * „Mégsem vagyok jól" reopens the period. Also opened from the Nap hub's kímélő card.
 */
export function WelcomeBackSheet({ ret, week, showRun = true, busy, onClose, onOk, onUndo }: {
  ret: RecoveryReturn
  /** The meso week the user continues with (the active meso's current week after the shift). */
  week?: number | null
  /** The run line — only when a running plan exists. */
  showRun?: boolean
  busy?: boolean
  onClose(): void
  /** „Rendben" — the sheet closes itself afterwards. */
  onOk(): void
  /** „Mégsem vagyok jól" — the caller closes the sheet once the undo succeeds. */
  onUndo(): void
}) {
  const c = returnCopy(ret, { week })
  const two = ret.rampSessions > 1
  return (
    <Sheet onClose={onClose} labelledBy="udv-title" className="fo-sheet em-udv">
      {(close) => (
        <>
          <FoSheetHead eyebrow="Kímélő mód vége" title="Üdv újra!" titleId="udv-title"
            sub="Így folytatjuk — a terv magától igazodik." onClose={close} />
          <Tubes className="em-ramp" height={104} aria-label="A könnyített visszatérés"
            items={[
              { label: '1. edzés', value: '⅔', note: 'kb. −10% súly', pct: 60 },
              { label: '2. edzés', value: two ? '⅔' : 'teljes', note: two ? 'a régi súly' : 'a terv szerint', pct: two ? 66 : 92 },
              { label: 'utána', value: 'teljes', note: 'a terv szerint', pct: 92 },
            ]} />
          <div className="em-udvl">
            <Row icon="t-calendar" title={c.headline} sub={c.program} />
            <Row icon="t-dumbbell" title="Könnyített kezdés" sub={c.ramp} />
            {showRun && <Row icon="t-run" title="Rövidebb első futás" sub={KIMELO.welcomeRun} />}
          </div>
          <Acts>
            <Btn grow disabled={busy} onClick={() => { onOk(); close() }}>Rendben</Btn>
            <Lk disabled={busy} onClick={onUndo}>Mégsem vagyok jól</Lk>
          </Acts>
        </>
      )}
    </Sheet>
  )
}
