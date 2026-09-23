// ============================================================
// Mezo · QuickLogSurface — the quick-log grid + phase logic (mezo-mhum)
// Extracted verbatim from QuickInputSheet (mezo-7lst) so the SAME grid can host
// two shells: a modal `Sheet` (the FAB launcher, everywhere) and a full-page
// picker at /nap/gyors (`variant='page'`, mezo-mhum). Anatómia:
//   · Chat sor legfelül — a Mezónak mondott logolás a felfedezendő út,
//     ezért kap vizuális elsőbbséget (a rutin-logolás a rács alsó
//     kétharmadában marad, hüvelykujj-közelben).
//   · 9 egyenrangú csempe 3×3-ban, CSAK címmel (tulajdonosi döntés, 2026-09-21,
//     mezo-reocc: a korábbi élő alszövegek kikerültek). Üveg (mezo-me75u.3): 3D ikon, az
//     oldalon a csempe saját színű üveglapka, a sheetben lapos, megvilágított cella.
//   · Étkezés DINAMIKUS: aktív ablakkal a `/fuel/log/uj?w=<tileKey>` logolóba
//     visz, ablak nélkül a szabad tétel ágra. A hely/ikon/címke fix — csak a cél
//     változik.
//   · Víz / Sport / Súly / Alvás / Napló / Check-in helyben cserélik a sheetet
//     (phase-csere, sosem Sheet a Sheetben); a többi navigál.
// `onDone` áll a régi `close()`/`onClose` helyén (ld. lent): a `sheet` variánsban
// a menü-rács SAJÁT `<Sheet>`-je kapja `onClose`-ként, a rács tapjai a Sheet
// render-propból kapott ANIMÁLT `close()`-t hívják (byte-for-byte ugyanaz, mint a
// régi QuickInputSheet); az al-sheetek (víz/alvás/súly/…) mindig a nyers `onDone`-t
// kapják `onClose`-ként — ugyanaz, mint a régi kód nyers `onClose` propja. A `page`
// variánsban nincs külső Sheet: a rács simán `onDone`-t hívja, az al-sheetek pedig
// ugyanúgy modális `Sheet`-ként úsznak az oldal fölött (a brief elfogadja ezt).
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Boop, Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { CAPTURE_ART, CaptureArt } from '@/shared/ui/CaptureArt'
import { cn } from '@/shared/lib/cn'
import '@/features/quickinput/QuickLogSurface.css'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { JournalSheet } from '@/features/me/sheets/JournalSheet'
import { QuickSleepSheet } from '@/features/quickinput/sheets/QuickSleepSheet'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { WeightLogSheet } from '@/features/me/sheets/WeightLogSheet'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { tileKey } from '@/features/fuel/logic/fuelSwimlane'
import { useCheckins, useFuelPreview, useFuelDay, useWaterActions, useWeight, useQuickLogSport } from '@/data/hooks'

/** Which surface the grid shows: the launcher grid, an in-place two-option picker, or a log
 * sheet opened in its place (mezo-b3pp.1 / mezo-d20.1.6 — Súly joined the in-place set;
 * mezo-7lst — 'water' and 'sport' joined it too, for the Víz/Sport tiles). */
type Phase = 'menu' | 'sleep' | 'naplo-pick' | 'aktivitas' | 'journal' | 'gratitude' | 'checkin' | 'weight' | 'water' | 'sport'

type Tone = 'sky' | 'lav' | 'sage' | 'coral' | 'gold' | 'rose'

/** One quick-log door. Üveg (mezo-me75u.3, bible §3.4 rank 2): on the page a `.glass` tile in its
 *  OWN hue (`--c` from the tone class, set on the tile itself — U1 rule 4); inside the glass sheet a
 *  flat-lit tile, never glass in glass (U1 rule 5). The art is the capture family's 3D mark, (`CAPTURE_ART`), so
 *  the tile and the sheet it opens show one and the same symbol (restored bible rule 28). */
function Tile({ icon, label, tone, glass, index, onClick, disabled }: {
  icon: Icon3DName; label: string; tone: Tone; glass: boolean; index: number
  onClick?: () => void; disabled?: boolean
}) {
  return (
    <button type="button"
      className={cn('quicklog-tile', `tone-${tone}`, 'np-press', glass && 'glass rise')}
      style={{ '--i': index } as CSSProperties}
      onClick={onClick} disabled={disabled}>
      <Icon3D name={icon} size={54} className="quicklog-art" />
      <span className="quicklog-label">{label}</span>
    </button>
  )
}

export function QuickLogSurface({ variant, onDone }: { variant: 'sheet' | 'page'; onDone: () => void }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('menu')

  // ── live context for the Étkezés tile's target ────────────
  // The Étkezés tile's target mirrors the Fuel swimlane: the user-scheduled eating
  // window whose state is 'now' (slotKey present = meal/snack window, not a block slot).
  const { plan } = useFuelPreview()
  const nowWindow = plan.slots.find(s => s.slotKey !== undefined && s.state === 'now')
  // A dinamikus Étkezés csempe: a hely, az ikon és a címke FIX — csak a cél
  // változik (CHI 2008, Gajos: az adaptáció akkor nem dezorientál, ha leíró és nem jósló).
  // Az ablak azonosítója a swimlane exportált `tileKey`-e, a `/fuel/log/uj?w=` másik végének
  // szerződése; ismeretlen/hiányzó kulcs ott a becsületes „Ablakon kívül" ág.
  const foodTarget = nowWindow ? `/fuel/log/uj?w=${encodeURIComponent(tileKey(nowWindow))}` : '/fuel/log/uj'
  const { fuel } = useFuelDay()
  const { logWater } = useWaterActions()
  const { weightLog, logWeight } = useWeight()
  const latestWeight = weightLog.length > 0 ? weightLog[weightLog.length - 1] : null
  // Narrow read (mezo-7lst, whole-branch-review finding 1): the FAB used to mount the whole
  // `useTrain()` — 8 ungated queries — for one mutation. `useQuickLogSport` shares
  // `useTrain`'s param-less `['train','sportSessions']` key and mutation instead.
  const { logSportSession } = useQuickLogSport()
  const { showLevelUp } = useLevelUp()

  const { checkins, saveCheckIn } = useCheckins()
  // Pinned at click time (see the tile below), NOT recomputed here — see mezo-967c finding 1.
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)
  const nextCheckInIdx = checkins.findIndex(isFillableSlot)

  const goBack = () => setPhase('naplo-pick')

  if (phase === 'sleep') return <QuickSleepSheet onClose={onDone} />
  if (phase === 'weight') {
    return <WeightLogSheet onClose={onDone} onSave={logWeight} currentWeight={latestWeight?.value ?? 0} />
  }
  if (phase === 'water') {
    return (
      <WaterLogSheet
        currentMl={fuel.consumed.water}
        targetMl={fuel.targets.water}
        onLog={logWater}
        onClose={onDone}
      />
    )
  }
  if (phase === 'sport') {
    return (
      <SportLogSheet
        onClose={onDone}
        onSave={(body, done) =>
          logSportSession(body, { onSuccess: r => showLevelUp(r?.levelUp), onSettled: done })}
      />
    )
  }
  if (phase === 'aktivitas') return <ActivityLogSheet onClose={onDone} onBack={goBack} />
  if (phase === 'journal') return <JournalSheet onClose={onDone} onBack={goBack} />
  if (phase === 'gratitude') return <JournalSheet onClose={onDone} initialMode="gratitude" onBack={goBack} />
  if (phase === 'checkin' && checkInIdx !== null) {
    return (
      <CheckInSheet
        slot={checkins[checkInIdx]}
        slotIdx={checkInIdx}
        onClose={onDone}
        onSave={data => saveCheckIn(checkInIdx, data)}
      />
    )
  }

  // Üveg (mezo-me75u.3, prototypes/src/uveg-nap-body.html `gyors()` / `qsurface()` / `SH.quick` /
  // `SH.naplopick`): the page wears glass (the chat row lavender, the tiles each in its hue); the
  // sheet is ONE glass surface already, so its rows and tiles are flat-lit (`data-variant`).
  const onPage = variant === 'page'
  const grid = (close: () => void) => (
    <div className="quicklog" data-variant={variant}>
      {phase === 'naplo-pick' ? (
        <>
          <div className="quicklog-tool">
            <button type="button" className="quicklog-back" onClick={() => setPhase('menu')} aria-label="Vissza">
              <Icon name="chevron-left" size={18} />
            </button>
            <span className="quicklog-eyebrow">Naplózás</span>
            <span aria-hidden="true" />
          </div>
          <div className="quicklog-head">
            <CaptureArt kind="journal" className="quicklog-head-art" />
            <h2 id="quicklog-title">Mit naplózol?</h2>
          </div>
          <div className="quicklog-grid quicklog-pick">
            <Tile icon={CAPTURE_ART.activity} label="Aktivitás" tone="sage" glass={onPage} index={0} onClick={() => setPhase('aktivitas')} />
            <Tile icon={CAPTURE_ART.journal} label="Napló" tone="sage" glass={onPage} index={1} onClick={() => setPhase('journal')} />
            <Tile icon="t-sprout" label="Hála" tone="sage" glass={onPage} index={2} onClick={() => setPhase('gratitude')} />
          </div>
        </>
      ) : (
        <>
          {onPage ? (
            <div className="quicklog-page-head">
              <h2 id="quicklog-title">Mi érkezett?</h2>
              <p className="quicklog-sub">Egy pillanat. És a napod része.</p>
            </div>
          ) : (
            <>
              <span className="quicklog-eyebrow">Gyors rögzítés</span>
              <div className="quicklog-head">
                <CaptureArt kind="quick" className="quicklog-head-art" />
                <div>
                  <h2 id="quicklog-title">Gyors logolás</h2>
                  <p className="quicklog-sub">Egy pillanat. És a napod része.</p>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            className={cn('quicklog-chat np-press', onPage && 'glass rise')}
            onClick={() => { close(); navigate('/mezo/chat') }}
          >
            <span className="quicklog-chat-mark" aria-hidden="true"><Boop domain="mezo" size={42} /></span>
            <span className="quicklog-chat-text">
              <span className="quicklog-chat-label">Mondd el Mezónak</span>
              <span className="quicklog-chat-hint">kérdezz, mesélj — vagy logolj szóban</span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>

          <div className="quicklog-grid">
            <Tile icon={CAPTURE_ART.food} label="Étkezés" tone="coral" glass={onPage} index={2}
              onClick={() => { close(); navigate(foodTarget) }} />
            <Tile icon={CAPTURE_ART.water} label="Víz" tone="sky" glass={onPage} index={3}
              onClick={() => setPhase('water')} />
            <Tile icon={CAPTURE_ART.stack} label="Stack" tone="gold" glass={onPage} index={4}
              onClick={() => { close(); navigate('/fuel/stack') }} />
            <Tile icon={CAPTURE_ART.training} label="Edzés" tone="coral" glass={onPage} index={5}
              onClick={() => { close(); navigate('/train') }} />
            <Tile icon={CAPTURE_ART.sport} label="Sport" tone="rose" glass={onPage} index={6}
              onClick={() => setPhase('sport')} />
            <Tile icon={CAPTURE_ART.weight} label="Súly" tone="sky" glass={onPage} index={7}
              onClick={() => setPhase('weight')} />
            <Tile icon={CAPTURE_ART.checkin} label="Check-in" tone="rose" glass={onPage} index={8}
              onClick={() => {
                if (nextCheckInIdx >= 0) { setCheckInIdx(nextCheckInIdx); setPhase('checkin') }
                else { close(); navigate('/nap') }
              }} />
            <Tile icon={CAPTURE_ART.journal} label="Napló" tone="sage" glass={onPage} index={9} onClick={() => setPhase('naplo-pick')} />
            <Tile icon={CAPTURE_ART.sleep} label="Alvás" tone="lav" glass={onPage} index={10} onClick={() => setPhase('sleep')} />
          </div>
        </>
      )}
    </div>
  )

  // A page variánsban a `close` a rács navigáló csempéinek szól (Étkezés/Stack/Edzés/
  // Check-in-kész), NEM az oldal bezárásának — maga a navigate() hagyja el az oldalt.
  // `onDone` itt a `navigate(-1)` (NapGyorsPage.tsx), és a böngésző `history.go(-1)`-je
  // ASZINKRON: ha a csempe `close()`-ként hívná, a sorban álló vissza-lépés a push UTÁN
  // sül el és visszavonja azt (futásidőben reprodukálva: a csempe felvillan, majd
  // visszaugrik /nap-ra). A no-op close ezt zárja ki; az al-sheetek onClose-a marad a
  // valódi `onDone` (egyetlen navigate(-1) egy befejezett logolás UTÁN helyes).
  if (variant === 'page') return grid(() => {})

  return (
    <Sheet onClose={onDone} labelledBy="quicklog-title" className="capture-sheet capture-tone-quick glass">
      {(close) => grid(close)}
    </Sheet>
  )
}
