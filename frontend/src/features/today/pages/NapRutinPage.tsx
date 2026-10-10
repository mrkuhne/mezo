// ============================================================
// Mezo · NapRutinPage — the day's routine (mezo-d20.2.3). ?dp=reggel|napkozben|este picks the
// chain group shown first (the lead); the other groups follow below.
// Tick semantics are the Today feature's, verbatim (ADR 0010): MANUAL rows
// check/uncheck through useHabitActions, DERIVED rows open their log
// surface via logic/habitAction — nothing here self-completes a derivation.
// FOLYADÉK (mezo-n4wf5.2, prototypes/vilagos/nap.js `rutin()`): the chain is a row of linked
// drops that fill as you tick. Hero = the lead group (verdict „Most jön: …", one drop per habit,
// the primary button acts on the next habit, the day links on the liquid row); then one numbered
// card per group (tick · the habit's own icon · anchor line · the 28-day strength as a level),
// „A lánc ereje" facts, and the door to routine building.
// ============================================================
import { Fragment, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ContentIcon } from '@/shared/ui/clay'
import { useCountUpOnChange } from '@/shared/ui/mozaik/motion'
import { addDays, localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'
import {
  useHabitActions, useHabitCatalog, useHabitDay, useHabitSummary,
  useIntentionActions, useIntentionDay, useSleep,
} from '@/data/hooks'
import { buildHabitRewardToast } from '@/features/progression/logic/rewardToast'
import { habitAction, habitHint } from '@/features/today/logic/habitAction'
import { celebrationFor } from '@/features/today/logic/habitCelebration'
import { daypartMilestone } from '@/features/today/logic/chainMilestone'
import { nextInChain } from '@/features/today/logic/chainPrompt'
import { habitContentIcon } from '@/features/today/logic/habitClayIcon'
import { NR_GLIDE_MS } from '@/features/today/nrGlide'
import { IntentionSheet } from '@/features/today/sheets/IntentionSheet'
import { ReflectSheet } from '@/features/today/sheets/ReflectSheet'
import { LogFlowPage } from '@/features/fuel/pages/LogFlowPage'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import type { HabitDaypart, HabitItem } from '@/data/types'
import {
  Btn, Card, DropChain, Facts, FrameBack, Hero, Level, Lk, Mark, Note, Page, Row, Section, Tick,
  type DropChainItem,
} from '@/shared/ui/folyadek'

// A DAY chain is user-created (the wizard and the chain editor both offer "Napközbeni"), so it
// gets its own face here — without one it was editable under Én and impossible to tick from the
// day, i.e. a habit you could create but never log (mezo-025v). It has no hub tile: the day's
// two faces (reggel/este) are the hub's own metaphor, and DAY carries no perfect-day counter.
type Face = 'reggel' | 'napkozben' | 'este'
const FACE_ORDER: Face[] = ['reggel', 'napkozben', 'este']
const FACE_DAYPART: Record<Face, HabitDaypart> = { reggel: 'MORNING', napkozben: 'DAY', este: 'EVENING' }
const FACE_TITLE: Record<Face, string> = { reggel: 'Reggeli rutin', napkozben: 'Napközbeni rutin', este: 'Esti rutin' }
// Only the two seeded dayparts have a 30-day perfect counter in the summary contract — the DAY
// face therefore shows no such cell at all rather than a fabricated zero (honesty rule).
const FACE_PERFECT: Partial<Record<Face, string>> = { reggel: 'tökéletes reggel', este: 'tökéletes este' }

interface Group {
  face: Face
  items: HabitItem[]
  done: number
}

/** A sor lánc-erő százaléka. A szint a pipa után NR_GLIDE_MS-ig CSÚSZIK az új szélességre — a
 *  szám ugyanannyi idő alatt fut oda, hogy a kettő egy mozdulat legyen (mezo-apwd). */
function NrPct({ pct }: { pct: number }) {
  const shown = useCountUpOnChange(pct, NR_GLIDE_MS)
  return <>{shown}<small>%</small></>
}

/** The primary button's label for the next habit: what tapping it will do. */
function nextLabel(h: HabitItem): string {
  if (h.mode === 'MANUAL') return 'Megvan, pipálom'
  const ha = habitAction(h)
  if (ha.kind === 'intention-reflect') return 'Válaszolok'
  if (ha.kind === 'intention-sheet') return 'Leírom'
  if (ha.kind === 'nav' && ha.to === '/ritual') return 'Napzárás indítása'
  return 'Megnyitom'
}

export function NapRutinPage() {
  // Tegnapra visszalapozható logoló felület (mezo-x9c2, Streaks-minta): a navigátor a
  // backfill-ablakra szorít — ma és tegnap, semmi több.
  const today = localDateString()
  const yesterday = addDays(today, -1)
  const [date, setDate] = useState(today)
  const isToday = date === today
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
  // mezo-3zue.6: a horgony pipálásának KÖVETKEZMÉNYE — a rá kötött szokás kulcsa. Tartós
  // (nem toast), de nincs saját takarító effektje: a render deriválja, lásd `promptRow`.
  const [promptKey, setPromptKey] = useState<string | null>(null)

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

  // Tegnapi backfill: nincs lánc-prompt (a promptolt sor a MA-nézeten él, mezo-3zue.6 nem
  // nyúlt ehhez az ösvényhez — a backfill mezo-x9c2 ezután érkezett).
  const runCheck = (h: HabitItem) => () => {
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

  /** A napi sor tick-viselkedése: a pipa, illetve a sor saját felületére vivő CTA. */
  const tickAction = (h: HabitItem): (() => void) | null => {
    if (h.status === 'done') {
      // the prototype tick toggles both ways — only a MANUAL check can honestly untick
      return h.mode === 'MANUAL' ? () => { uncheck(h.key).catch(() => {}) } : null
    }
    if (!isToday) {
      // Tegnap (mezo-x9c2): csak a MANUAL sor pipálható vissza — a DERIVED sorok logoló
      // felületei a mai naphoz kötnek, ott a sor csendes történelem (ADR 0010 hangnem).
      return h.mode === 'MANUAL' && (h.status === 'pending' || h.status === 'missed')
        ? runCheck(h)
        : null
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
          // ugyanabból a pipa előtti állapotból: mi van erre a horgonyra kötve (mezo-3zue.6)
          const chained = nextInChain(catalog, habits, h.key)
          check(h.key)
            .then((lu) => {
              emitToast(buildHabitRewardToast({
                title: h.title, chainDone: done, chainTotal: total, xp: h.xp, levelUp: lu?.[0],
                celebration, chainLabel,
              }))
              // csak sikeres írás után — egy elhasalt pipa nem ígérhet folytatást
              setPromptKey(chained?.key ?? null)
            })
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

  // A kiemelés DERIVÁLT, nem külön állapotgép: amint a promptolt sor kész lesz vagy eltűnik
  // a napból (a szerver `releaseAnchors`-e menet közben is oldhatja a kötést), magától
  // elmúlik — nincs mit takarítani.
  const promptRow = promptKey
    ? habits.find((h) => h.key === promptKey && h.status === 'pending') ?? null
    : null

  // The lead group's next habit: the one a just-ticked anchor prompts, else the first open row.
  const next = hero
    ? hero.items.find((h) => h.key === promptRow?.key) ?? hero.items.find((h) => h.status !== 'done') ?? null
    : null
  const nextAct = next ? tickAction(next) : null
  const drops: DropChainItem[] = hero
    ? hero.items.map((h) => ({
        state: h.status === 'done' ? 'done' : h.key === next?.key ? 'now' : h.status === 'missed' ? 'missed' : 'empty',
        ariaLabel: h.title,
        onClick: (!pending && tickAction(h)) || undefined,
      }))
    : []
  // Tegnapra visszalapozás (mezo-x9c2): ma ↔ tegnap, semmi több — a két link a régi nap-léptető
  // két nyila, ugyanazokkal a nevekkel.
  const dayLinks = (
    <>
      <Lk className="nr2-day" aria-label="Előző nap" disabled={!isToday} onClick={() => setDate(yesterday)}>‹ Tegnap</Lk>
      <Lk className="nr2-day" aria-label="Következő nap" disabled={isToday} onClick={() => setDate(today)}>
        {isToday ? 'Holnap ›' : 'Ma ›'}
      </Lk>
    </>
  )
  const dayWord = isToday ? '' : 'Tegnap · '

  return (
    <Page className="nr2-page">
      <FrameBack history className="fo-ib fo-back nr2-back" onBack={() => navigate(-1)}>‹</FrameBack>
      {hero ? (
        <Hero
          label={`${dayWord}${FACE_TITLE[hero.face]} · ${hero.done}/${hero.items.length} kész`}
          verdict={next ? `${isToday ? 'Most jön' : 'Tegnap kimaradt'}: ${next.title}.` : 'Mind megvan. Szép munka.'}
          sub={next
            ? `${hero.items.length} elem · lánc · ${habitHint(next) ?? next.anchorCopy}`
            : isToday ? 'Holnap ugyanitt folytatódik.' : undefined}
          actions={<>
            {next && nextAct && <Btn disabled={pending} onClick={nextAct}>{nextLabel(next)}</Btn>}
            {dayLinks}
          </>}
        >
          <DropChain big items={drops} aria-label={`${FACE_TITLE[hero.face]}: ${hero.done} / ${hero.items.length} kész`} />
        </Hero>
      ) : (
        // Honest empty day: no routine rows, so no chain to draw — the day links and the door to
        // routine building (below) stay reachable.
        <Hero
          label={`${dayWord}Rutin`}
          verdict={isToday ? 'Mára nincs rutinod.' : 'Tegnapra nem volt rutinod.'}
          sub="Lent, a Szerkesztésnél építhetsz egyet."
          actions={dayLinks}
        />
      )}

      {groups.map((g, gi) => (
        <Fragment key={g.face}>
          <Section n={gi + 1} title={`${FACE_TITLE[g.face]} · ${g.done}/${g.items.length}`} />
          <Card data-kalauz-anchor={gi === 0 ? 'rutin-lista' : undefined}>
            {g.items.map((h) => {
              const act = tickAction(h)
              const done = h.status === 'done'
              const hint = habitHint(h)
              const chain = catalog.chains.find((c) => c.chainKey === h.chain)
              const icon = habitContentIcon(h.key, chain, FACE_DAYPART[g.face])
              const isNow = promptRow?.key === h.key
              return (
                <Row key={h.key} as="div" state={isNow ? 'now' : done ? 'done' : undefined}
                  left={<>
                    {act
                      ? <Tick on={done} label={h.title} disabled={pending} onClick={act} />
                      : <Mark size="tick" state={done ? 'done' : 'empty'} />}
                    {/* the habit's OWN icon in the row's chip (a clay name goes through ContentIcon) */}
                    <span className="si" aria-hidden="true"><ContentIcon name={icon} size={26} /></span>
                  </>}
                  // a row carrying its own external content (linkUrl — e.g. `morning_video`) renders
                  // the title as that link; the tick stays the separate control, so the anchor never
                  // sits inside a button (mezo-d20.11 restore).
                  title={h.linkUrl
                    ? <a className="nr2-tl" href={h.linkUrl} target="_blank" rel="noopener noreferrer">{h.title} ↗</a>
                    : h.title}
                  sub={<>{isNow && <><b className="nr2-now">Most jön</b>{' · '}</>}{hint ?? h.anchorCopy}</>}
                  value={h.strengthPct != null ? <NrPct pct={h.strengthPct} /> : undefined}
                  more={h.strengthPct != null ? <Level pct={h.strengthPct} height={8} /> : undefined}
                />
              )
            })}
            {gi === 0 && <Note>A sor végén a szám a szokás 28 napos ereje.</Note>}
          </Card>
        </Fragment>
      ))}

      {hero && (
        <>
          <Section n={groups.length + 1} title="A lánc ereje" />
          <Card>
            <Facts items={[
              ...(perfectDays !== null && perfectLabel ? [[`${perfectDays}/30`, perfectLabel] as [string, string]] : []),
              ...(chainStrength !== null ? [[`${chainStrength}%`, 'lánc-erő · 28 nap'] as [string, string]] : []),
              [`+${xpToday}`, isToday ? 'XP ma' : 'XP tegnap'],
            ]} />
            <Note>A lánc-erő az elmúlt 28 nap következetessége: egy kihagyás nem nulláz, csak halványít.</Note>
          </Card>
        </>
      )}

      {/* the door to routine building (mezo-lhqw7): outside every "has habits" branch, so a
          brand-new user with an empty day can still reach the builder */}
      <Section n={groups.length + (hero ? 2 : 1)} title="Szerkesztés" />
      <Card>
        <Row to="/nap/rutin/epites" icon="t-chain" title="Rutinok szerkesztése" sub="láncok, szokások, új szokás" />
      </Card>

      {mealOpen && <LogFlowPage initialSlot="breakfast" onClose={() => setMealOpen(false)} />}
      {sleepOpen && <SleepLogSheet onClose={() => setSleepOpen(false)} onSave={logSleep} />}
      {focusOpen && <IntentionSheet creed={intention.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
      {reflectOpen && (
        <ReflectSheet foci={intention.foci.map((f) => f.text)} onReflect={reflect} onClose={() => setReflectOpen(false)} />
      )}
    </Page>
  )
}
