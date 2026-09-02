// ============================================================
// Mezo · StepProgram — a varázsló 03 lépése: a kész blokk (#page-wizard
// [data-step="2"]). NEM hosszú görgetés: kompakt hero (név + a hét számai +
// Mezo egy mondata + Hossz-sáv), nap-mozaik (csempe → saját nap-oldal), heti
// szett-sávok, összecsukott csúcshét-strip, és a mentés-lábléc. Generálás
// közben a pulzáló orb áll a helyén, hiba esetén újrapróbálás — sosem üres test.
// A hiba KÉT arca: ha még nincs javaslat, egész testes újrapróbálás; ha már van,
// a program marad, a hiba pedig egy csík a hero fölött (egy sikertelen ÚJRA-
// generálás nem dobhatja el a kézzel szerkesztett vázlatot).
// ============================================================
import type { CSSProperties, Dispatch } from 'react'
import type { MesoDay } from '@/data/types'
import { isOffDay } from '@/features/train/logic/offDay'
import { peakWeekFit } from '@/features/train/logic/peakWeekFit'
import { SESSION_MUSCLE_CAP } from '@/features/train/logic/setBudget'
import { weekTotals } from '@/features/train/logic/mesoPlan'
import { weeklyBands } from '@/features/train/logic/weeklyBands'
import { WeeklyBandsCard } from '@/features/train/components/WeeklyBandsCard'
import { DayTile } from '@/features/train/wizard/DayTile'
import { dayTileData } from '@/features/train/wizard/dayTiles'
import { inputChanged, type WizardAction, type WizardState } from '@/features/train/wizard/wizardState'
import { CtaGhost, CtaPrimary } from '@/shared/ui/Cta'
import { CollapsibleStrip, Mosaic, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { huMonthDay } from '@/shared/lib/dates'

const WEEK_CHOICES = [4, 5, 6, 7, 8]
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

interface StepProgramProps {
  state: WizardState
  dispatch: Dispatch<WizardAction>
  generating: boolean
  failed: boolean
  today: string
  onRegenerate: () => void
  onSave: (alsoStart: boolean) => void
  saving: boolean
  /** the regenerate confirm strip is open (a manual edit would be overwritten) */
  confirming: boolean
  onConfirmChange: (open: boolean) => void
  /** Dismisses a failed RE-generation's inline strip (the standing program stays). */
  onDismissError: () => void
}

export function StepProgram({
  state, dispatch, generating, failed, today, onRegenerate, onSave, saving, confirming, onConfirmChange,
  onDismissError,
}: StepProgramProps) {
  if (generating) {
    return (
      <div className="mz-genwait" role="status">
        <div className="mz-genwait-orb" aria-hidden="true" />
        <b>Mezo összerakja a blokkod…</b>
        <small>determinisztikus váz + a célod szerinti gyakorlatok</small>
      </div>
    )
  }

  // Full-screen retry ONLY when nothing was ever generated. A failed RE-generation must not
  // swallow the standing (possibly hand-edited) draft — it gets an inline strip instead
  // (mezo-d20.14 review, I4).
  if (!state.proposal) {
    return (
      <div className="mz-edhero">
        <span className="mz-eyebrow mz-eb-coral">A te blokkod</span>
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: '8px 0 0' }}>
          Nem sikerült a generálás — próbáld újra.
        </p>
        <div className="mz-wfoot">
          <CtaPrimary onClick={onRegenerate}>↺ Újrapróbálom</CtaPrimary>
        </div>
      </div>
    )
  }

  const { proposal, program, priorities } = state
  const trainingDays: MesoDay[] = program.filter((d) => !isOffDay(d) && d.type !== 'Rest')
  const { weekOne, peak } = weekTotals(priorities)
  const landmarks = proposal.template.volumePerMuscle ?? undefined
  const bands = weeklyBands(program, priorities, landmarks)
  const fits = peakWeekFit(program, priorities, landmarks)

  const regenerate = () => {
    if (state.dirty) onConfirmChange(true)
    else onRegenerate()
  }

  return (
    <EntranceGroup>
      {failed && (
        <div className="mz-confirm">
          Nem sikerült az újragenerálás — a korábbi program megmaradt.
          <div className="mz-confirm-acts">
            <button type="button" className="mz-minighost" onClick={onRegenerate}>Újra</button>
            <button type="button" className="mz-minighost" onClick={onDismissError}>Mégse</button>
          </div>
        </div>
      )}
      <div className="mz-edhero rise" style={delay(30)}>
        <div className="mz-edhero-top">
          <span className="mz-eyebrow mz-eb-coral mz-grow">A te blokkod</span>
          <button type="button" className="mz-minighost" onClick={regenerate}>↺ Újragenerálás</button>
        </div>
        <input
          aria-label="Mesociklus neve"
          value={state.name}
          onChange={(e) => dispatch({ type: 'setName', name: e.target.value })}
        />
        <div style={{ marginTop: 7 }}>
          <StatStrip>
            <StatCell value={state.weeks} label="hét" />
            <StatCell value={`${trainingDays.length}×`} label="nap/hét" />
            <StatCell value={weekOne} label="szett · W1" />
            <StatCell value={peak} label="szett · csúcs" />
          </StatStrip>
        </div>
        <div className="mz-coach">
          <span className="dot" aria-hidden="true" />
          <span>{proposal.rationale}</span>
        </div>
        <div className="mz-coachsub">
          {proposal.llmUsed
            ? 'Gemini · a determinisztikus kereteken belül'
            : 'alap gyakorlat-kiosztás — újragenerálhatod'}
        </div>
        {inputChanged(state) && (
          <div className="mz-coachsub">
            A bemenetek változtak a generálás óta — az újragenerálás a friss napokra/fókuszra rakja össze a programot.
          </div>
        )}

        {confirming && (
          <div className="mz-confirm">
            Kézzel szerkesztett napjaid vannak — az újragenerálás felülírja őket.
            <div className="mz-confirm-acts">
              <button type="button" className="mz-minighost" onClick={() => { onConfirmChange(false); onRegenerate() }}>
                Újragenerálás
              </button>
              <button type="button" className="mz-minighost" onClick={() => onConfirmChange(false)}>Mégse</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 9 }}>
          <CollapsibleStrip eyebrow="Hossz" summary={`${state.weeks} hét = ${state.weeks - 1} rámpa + 1 deload`}>
            <div className="segtabs">
              {WEEK_CHOICES.map((w) => (
                <button
                  key={w}
                  type="button"
                  className="segtab"
                  aria-pressed={state.weeks === w}
                  onClick={() => dispatch({ type: 'setWeeks', weeks: w })}
                >
                  {w}
                </button>
              ))}
            </div>
          </CollapsibleStrip>
        </div>
      </div>

      <div className="mz-eyebrow" style={{ padding: '11px 2px 6px' }}>
        A heted · koppints egy napra a gyakorlatokért
      </div>
      <Mosaic>
        {trainingDays.map((d, i) => {
          const tile = dayTileData(d)
          return (
            <div className="rise" key={d.day} style={delay(60 + i * 50)}>
              <DayTile
                day={d.day}
                type={d.type}
                sets={tile.sets}
                minutes={tile.minutes}
                muscles={tile.muscles}
                tone={tile.tone}
                cap={SESSION_MUSCLE_CAP}
                onOpen={() => dispatch({ type: 'openDay', day: d.day })}
              />
            </div>
          )
        })}
      </Mosaic>

      <div style={{ marginTop: 11 }}>
        <WeeklyBandsCard rows={bands} note="1. hét → plafon. Az Emphasize izmok kapják a legtöbbet." />
      </div>

      <div style={{ marginTop: 11 }}>
        <CollapsibleStrip
          eyebrow="Csúcshét · terhelés-ellenőrzés"
          summary={fits.length ? `${fits.length} észrevétel` : 'minden nap belefér'}
        >
          {fits.length ? (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--mz-ink-soft)', lineHeight: 1.6 }}>
              {fits.map((f) => (
                <li key={f.day}>
                  {f.day} · ~{f.minutes} perc a csúcshéten — {f.direction === 'over' ? 'hosszabb a sávnál' : 'rövidebb a sávnál'}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--mz-ink-soft)', lineHeight: 1.6 }}>
              A csúcshéten minden edzésnap a szokásos hosszban marad — nem kell tenned semmit.
            </p>
          )}
        </CollapsibleStrip>
      </div>

      <div className="mz-wfoot">
        <CtaPrimary disabled={saving} onClick={() => onSave(true)}>
          ✓ Mentés + indítás · {huMonthDay(today)}
        </CtaPrimary>
        <CtaGhost disabled={saving} onClick={() => onSave(false)}>Mentés sablonként</CtaGhost>
      </div>
    </EntranceGroup>
  )
}
