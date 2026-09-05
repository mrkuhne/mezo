// ============================================================
// Mezo · NapRutinPage — the hub's habit tile → own page (mezo-d20.2.3)
// Source of truth: docs/design_2.0/prototypes/src/nap-body.html #page-hab
// (p-gold tone; hero = chain-group spot + done/total + name; stat strip;
// habrow list with tick buttons; quiet lánc-erő principle). ?dp=reggel|este
// preselects the chain group shown first; the other group follows below.
// Tick semantics are the Today feature's, verbatim (ADR 0010): MANUAL rows
// check/uncheck through useHabitActions, DERIVED rows open their log
// surface via logic/habitAction — nothing here self-completes a derivation.
// ============================================================
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ClayIcon, ClaySpot } from '@/shared/ui/clay'
import { EntranceGroup, useCountUpOnChange } from '@/shared/ui/mozaik/motion'
import { MozaikPage, PageBody, PageHead, PageHero, StatCell, StatStrip } from '@/shared/ui/mozaik'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'
import {
  useHabitActions, useHabitCatalog, useHabitDay, useHabitSummary,
  useIntentionActions, useIntentionDay, useSleep,
} from '@/data/hooks'
import { buildHabitRewardToast } from '@/features/progression/logic/rewardToast'
import { habitAction, habitHint } from '@/features/today/logic/habitAction'
import { celebrationFor } from '@/features/today/logic/habitCelebration'
import { daypartMilestone } from '@/features/today/logic/chainMilestone'
import { habitClayIcon, DAYPART_CLAY } from '@/features/today/logic/habitClayIcon'
import { IntentionSheet } from '@/features/today/sheets/IntentionSheet'
import { ReflectSheet } from '@/features/today/sheets/ReflectSheet'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import type { HabitDaypart, HabitItem } from '@/data/types'

// A DAY chain is user-created (the wizard and the chain editor both offer "Napközbeni"), so it
// gets its own face here — without one it was editable under Én and impossible to tick from the
// day, i.e. a habit you could create but never log (mezo-025v). It has no hub tile: the day's
// two faces (reggel/este) are the hub's own metaphor, and DAY carries no perfect-day counter.
type Face = 'reggel' | 'napkozben' | 'este'
const FACE_ORDER: Face[] = ['reggel', 'napkozben', 'este']
const FACE_DAYPART: Record<Face, HabitDaypart> = { reggel: 'MORNING', napkozben: 'DAY', este: 'EVENING' }
const FACE_SPOT: Record<Face, 's-reggel' | 's-energia' | 's-este'> = { reggel: 's-reggel', napkozben: 's-energia', este: 's-este' }
const FACE_TITLE: Record<Face, string> = { reggel: 'Reggeli rutin', napkozben: 'Napközbeni rutin', este: 'Esti rutin' }
// Only the two seeded dayparts have a 30-day perfect counter in the summary contract — the DAY
// face therefore shows no such cell at all rather than a fabricated zero (honesty rule).
const FACE_PERFECT: Partial<Record<Face, string>> = { reggel: 'tökéletes reggel', este: 'tökéletes este' }

interface Group {
  face: Face
  items: HabitItem[]
  done: number
}

/** A sor lánc-erő százaléka. A `.nr-str` csík a pipa után 380 ms-ig CSÚSZIK az új
 *  szélességre — a címke ugyanannyi idő alatt fut oda, hogy a kettő egy mozdulat legyen
 *  (mezo-apwd). Mountoláskor a szám a helyén ül: ott a csík a belépő fill-koreográfiát
 *  futja, nem a width-transitiont. */
function NrPct({ pct }: { pct: number }) {
  const shown = useCountUpOnChange(pct, 380)
  return <span className="nr-pct">{shown}%</span>
}

export function NapRutinPage() {
  const date = localDateString()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const { habits } = useHabitDay(date)
  const { catalog } = useHabitCatalog()
  const { check, uncheck, pending } = useHabitActions(date)
  const { data: summary } = useHabitSummary()
  const { data: intentionData } = useIntentionDay(date)
  const { addFocus, reflect } = useIntentionActions(date)
  const { logSleep } = useSleep()

  const [mealOpen, setMealOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [reflectOpen, setReflectOpen] = useState(false)

  // ?dp preselects the chain group shown first (the hub tile hands its face over).
  const dpParam = params.get('dp')
  const firstFace: Face = FACE_ORDER.find((f) => f === dpParam) ?? 'reggel'

  const groupFor = (face: Face): Group => {
    const keys = new Set(
      catalog.chains.filter((c) => c.daypart === FACE_DAYPART[face]).map((c) => c.chainKey),
    )
    const items = habits.filter((h) => keys.has(h.chain))
    return { face, items, done: items.filter((h) => h.status === 'done').length }
  }
  // Honest states: a group with no rows renders NOTHING (no placeholder theater).
  const groups = [firstFace, ...FACE_ORDER.filter((f) => f !== firstFace)]
    .map(groupFor)
    .filter((g) => g.items.length > 0)
  const hero = groups[0] ?? null

  // stat strip facts for the hero group (prototype: tökéletes N/30 · lánc-erő · XP ma)
  const strengths = hero ? hero.items.map((h) => h.strengthPct).filter((s): s is number => s != null) : []
  const chainStrength = strengths.length > 0
    ? Math.round(strengths.reduce((a, b) => a + b, 0) / strengths.length)
    : null
  // null for the DAY face — the contract has no perfect-day counter for it, so the cell goes.
  const perfectLabel = hero ? FACE_PERFECT[hero.face] : undefined
  const perfectDays = hero?.face === 'reggel' ? summary.perfectMorningDays30
    : hero?.face === 'este' ? summary.perfectEveningDays30
    : null
  const xpToday = hero ? hero.items.filter((h) => h.status === 'done').reduce((s, h) => s + h.xp, 0) : 0

  const chainProgress = (chainKey: string) => {
    const steps = habits.filter((h) => h.chain === chainKey)
    return { done: steps.filter((h) => h.status === 'done').length, total: steps.length }
  }

  // The Today dispatcher's habit branch, verbatim semantics (TodayPage `act()`).
  const tickAction = (h: HabitItem): (() => void) | null => {
    if (h.status === 'done') {
      // the prototype tick toggles both ways — only a MANUAL check can honestly untick
      return h.mode === 'MANUAL' ? () => { uncheck(h.key).catch(() => {}) } : null
    }
    if (h.status !== 'pending') return null
    const ha = habitAction(h)
    switch (ha.kind) {
      case 'check':
        return () => {
          const { done, total } = chainProgress(h.chain)
          // az ünneplés a katalógusból jön (a napi sor nem viszi) — hiányában a toast a régi
          const celebration = celebrationFor(catalog, h.key)
          // a mérföldkő a pipa ELŐTTI állapotból dől el: csak akkor szólal meg, ha ez a sor
          // az utolsó nyitott a napszakában (mezo-sqe3)
          const chainLabel = daypartMilestone(catalog, habits, h.chain)
          check(h.key)
            .then((lu) => emitToast(buildHabitRewardToast({
              title: h.title, chainDone: done, chainTotal: total, xp: h.xp, levelUp: lu?.[0],
              celebration, chainLabel,
            })))
            .catch(() => {})
        }
      case 'nav': return () => navigate(ha.to)
      case 'meal-sheet': return () => setMealOpen(true)
      case 'sleep-sheet': return () => setSleepOpen(true)
      case 'intention-sheet': return () => setFocusOpen(true)
      case 'intention-reflect': return () => setReflectOpen(true)
      case 'none': return null
    }
  }

  const intention = intentionData ?? { date, creed: null, foci: [], reflection: null }

  return (
    <MozaikPage tone="gold" className="nr-page">
      <PageHead onBack={() => navigate(-1)} label="‹ Ma" />
      <EntranceGroup>
        {hero && (
          <PageHero name={FACE_TITLE[hero.face]} big={`${hero.done}/${hero.items.length}`}
            sub={`${hero.items.length} elem · lánc`}>
            <div className="nr-herospot"><ClaySpot name={FACE_SPOT[hero.face]} size={71} /></div>
          </PageHero>
        )}
        <PageBody principle="A lánc-erő az elmúlt 28 nap konzisztenciája — egy kihagyás nem nullázza, csak halványítja.">
          {hero && (
            <StatStrip className="rise nr-stats">
              {perfectDays !== null && perfectLabel && <StatCell value={`${perfectDays}/30`} label={perfectLabel} />}
              {chainStrength !== null && <StatCell value={`${chainStrength}%`} label="lánc-erő · 28 nap" />}
              <StatCell value={`+${xpToday}`} label="XP ma" />
            </StatStrip>
          )}
          {groups.map((g, gi) => (
            <div key={g.face} className="rise" data-kalauz-anchor={gi === 0 ? 'rutin-lista' : undefined} style={{ '--d': `${100 + gi * 60}ms` } as React.CSSProperties}>
              {gi > 0 && (
                <div className="nr-group">
                  <span className="mz-eyebrow">{FACE_TITLE[g.face]}</span>
                  <span className="nr-groupcount">{g.done}/{g.items.length}</span>
                </div>
              )}
              <div className="nr-vcard">
                {g.items.map((h, ri) => {
                  const act = tickAction(h)
                  const done = h.status === 'done'
                  const hint = habitHint(h)
                  const chain = catalog.chains.find((c) => c.chainKey === h.chain)
                  const icon = chain
                    ? habitClayIcon(h.key, chain)
                    : DAYPART_CLAY[FACE_DAYPART[g.face]]
                  return (
                    <div key={h.key} className="nr-row">
                      {act ? (
                        <button type="button" className="nr-tickbtn" aria-label={h.title}
                          disabled={pending} onClick={act}>
                          <span className={cn('nr-tick', done && 'f')}>{done ? '✓' : ''}</span>
                        </button>
                      ) : (
                        <span className="nr-tickbtn" aria-hidden="true">
                          <span className={cn('nr-tick', done && 'f')}>{done ? '✓' : ''}</span>
                        </span>
                      )}
                      {/* prototype #page-hab habrow: tick · the habit's OWN clay icon · name+bar · % */}
                      <ClayIcon name={icon} size={28} />
                      <div className="nr-grow">
                        {/* a row carrying its own external content (linkUrl — e.g. `morning_video`)
                            renders the title as that link; the tick stays the separate control, so
                            the anchor never sits inside a button (mezo-d20.11 restore). */}
                        {h.linkUrl ? (
                          <a className={cn('nr-nm', done && 'done')} href={h.linkUrl}
                            target="_blank" rel="noopener noreferrer">{h.title} ↗</a>
                        ) : (
                          <div className={cn('nr-nm', done && 'done')}>{h.title}</div>
                        )}
                        <div className="nr-anchor">{hint ?? h.anchorCopy}</div>
                        {h.strengthPct != null && (
                          <div className="nr-str">
                            <div style={{ width: `${h.strengthPct}%`, '--d': `${350 + ri * 60}ms` } as React.CSSProperties} />
                          </div>
                        )}
                      </div>
                      {h.strengthPct != null && <NrPct pct={h.strengthPct} />}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </PageBody>
      </EntranceGroup>

      {mealOpen && <LogFlowPage initialSlot="breakfast" onClose={() => setMealOpen(false)} />}
      {sleepOpen && <SleepLogSheet onClose={() => setSleepOpen(false)} onSave={logSleep} />}
      {focusOpen && <IntentionSheet creed={intention.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
      {reflectOpen && <ReflectSheet onReflect={reflect} onClose={() => setReflectOpen(false)} />}
    </MozaikPage>
  )
}
