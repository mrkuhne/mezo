// ============================================================
// Mezo · QuickLogSurface — the quick-log grid + phase logic (mezo-mhum)
// Extracted verbatim from QuickInputSheet (mezo-7lst) so the SAME grid can host
// two shells: a modal `Sheet` (the FAB launcher, everywhere) and a full-page
// picker at /nap/gyors (`variant='page'`, mezo-mhum). Anatómia:
//   · Chat sor legfelül — a Mezónak mondott logolás a felfedezendő út,
//     ezért kap vizuális elsőbbséget.
//   · 9 egyenrangú csempe 3×3-ban, CSAK címmel (tulajdonosi döntés, 2026-09-21,
//     mezo-reocc: a korábbi élő alszövegek kikerültek).
//   · Étkezés DINAMIKUS: aktív ablakkal a `/fuel/log/uj?w=<tileKey>` logolóba
//     visz, ablak nélkül a szabad tétel ágra. A hely/ikon/címke fix — csak a cél
//     változik.
//   · Víz / Sport / Súly / Alvás / Napló / Check-in helyben cserélik a sheetet
//     (phase-csere, sosem Sheet a Sheetben); a többi navigál.
// Folyadék (mezo-n4wf5.2, prototype `vilagos/nap.js` `gyors()` / `SHEETS.naplopick`):
//   · oldal: EGY edény — fent a „levegő" (a kérdés, a mondat, a chat sor), lent a hullámzó
//     folyadék a kilenc fehér buborékkal;
//   · sheet: világos lap (`fo-sheet`) a közös fejjel, a chat sorral és a kilenc csempével
//     3 oszlopban — edény nincs a lapon belül;
//   · „Mit naplózol?": a közös fej vissza gombbal + három csempe; az oldalon az edény
//     HELYÉN, egy kártyában.
// `onDone` áll a régi `close()`/`onClose` helyén (ld. lent): a `sheet` variánsban
// a menü-rács SAJÁT `<Sheet>`-je kapja `onClose`-ként, a rács tapjai a Sheet
// render-propból kapott ANIMÁLT `close()`-t hívják; az al-sheetek (víz/alvás/súly/…)
// mindig a nyers `onDone`-t kapják `onClose`-ként. A `page` variánsban nincs külső
// Sheet: a rács simán `onDone`-t hívja, az al-sheetek pedig ugyanúgy modális
// `Sheet`-ként úsznak az oldal fölött.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import type { Icon3DName } from '@/shared/ui/clay'
import { Badge, Bub, Card, FoSheetHead, Note, Wave } from '@/shared/ui/folyadek'
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

/** One quick-log door: the icon in its chip + the label, nothing else (the accessible name is exactly the label). */
interface Door { icon: Icon3DName; label: string; onClick: () => void }

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

  const onPage = variant === 'page'
  const doors = (close: () => void): Door[] => [
    { icon: 't-bowl', label: 'Étkezés', onClick: () => { close(); navigate(foodTarget) } },
    { icon: 't-water', label: 'Víz', onClick: () => setPhase('water') },
    { icon: 't-supps', label: 'Stack', onClick: () => { close(); navigate('/fuel/stack') } },
    { icon: 't-dumbbell', label: 'Edzés', onClick: () => { close(); navigate('/train') } },
    { icon: 't-volley', label: 'Sport', onClick: () => setPhase('sport') },
    { icon: 't-weight', label: 'Súly', onClick: () => setPhase('weight') },
    {
      icon: 't-checkin', label: 'Check-in',
      onClick: () => {
        if (nextCheckInIdx >= 0) { setCheckInIdx(nextCheckInIdx); setPhase('checkin') }
        else { close(); navigate('/nap') }
      },
    },
    { icon: 't-journal', label: 'Napló', onClick: () => setPhase('naplo-pick') },
    { icon: 't-sleep', label: 'Alvás', onClick: () => setPhase('sleep') },
  ]
  const picks: Door[] = [
    { icon: 't-steps', label: 'Aktivitás', onClick: () => setPhase('aktivitas') },
    { icon: 't-journal', label: 'Napló', onClick: () => setPhase('journal') },
    { icon: 't-sprout', label: 'Hála', onClick: () => setPhase('gratitude') },
  ]
  /** White tiles in three columns: the sheet's nine doors and the „Mit naplózol?" picker. */
  const tiles = (list: Door[]) => (
    <div className="nqk-g">
      {list.map(d => (
        <button key={d.label} type="button" onClick={d.onClick}>
          <Bub icon={d.icon} size={52} />
          <span className="nqk-label">{d.label}</span>
        </button>
      ))}
    </div>
  )
  const chatRow = (close: () => void) => (
    <button type="button" className="nqk-chat" onClick={() => { close(); navigate('/mezo/chat') }}>
      <Badge member="mezo" size={40} />
      <span className="g">
        <strong>Mondd el Mezónak</strong>
        <small>kérdezz, mesélj — vagy logolj szóban</small>
      </span>
      <Icon name="chevron-right" size={18} />
    </button>
  )
  const pickHead = (close?: () => void) => (
    <FoSheetHead title="Mit naplózol?" titleId="quicklog-title" sub="Napló" icon="t-journal"
      onBack={() => setPhase('menu')} onClose={close} />
  )

  // `.quicklog` + `data-variant` are the surface's stable hooks (tests/layout/quicklog.spec.ts).
  if (onPage) {
    // A page variánsban a `close` a rács navigáló csempéinek szól (Étkezés/Stack/Edzés/
    // Check-in-kész), NEM az oldal bezárásának — maga a navigate() hagyja el az oldalt.
    // `onDone` itt a `navigate(-1)` (NapGyorsPage.tsx), és a böngésző `history.go(-1)`-je
    // ASZINKRON: ha a csempe `close()`-ként hívná, a sorban álló vissza-lépés a push UTÁN
    // sül el és visszavonja azt (futásidőben reprodukálva: a csempe felvillan, majd
    // visszaugrik /nap-ra). A no-op close ezt zárja ki; az al-sheetek onClose-a marad a
    // valódi `onDone` (egyetlen navigate(-1) egy befejezett logolás UTÁN helyes).
    const close = () => {}
    if (phase === 'naplo-pick') {
      return (
        <Card className="quicklog nqk nqk-pick" data-variant="page">
          {pickHead()}
          {tiles(picks)}
        </Card>
      )
    }
    return (
      <>
        <section className="quicklog nqk nqk-tank" data-variant="page">
          <div className="nqk-air">
            <h2 id="quicklog-title" className="nqk-lbl">Mi érkezett?</h2>
            <p className="nqk-say">Egy pillanat, és a napod része.</p>
            {chatRow(close)}
          </div>
          <div className="nqk-liq">
            <Wave color="var(--liq1)" opacity={0.55} className="b" />
            <Wave color="var(--liq1)" />
            <span className="nqk-liq-lb">vagy válassz</span>
            <div className="nqk-bubs">
              {doors(close).map(d => (
                <button key={d.label} type="button" onClick={d.onClick}>
                  <Bub icon={d.icon} size={62} color="var(--liq2)" />
                  <span className="nqk-label">{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
        <Note>Kilenc buborék, kilenc bejegyzés-fajta. Amit Mezónak elmondasz, azt ő írja be helyetted.</Note>
      </>
    )
  }

  return (
    <Sheet onClose={onDone} labelledBy="quicklog-title" className="fo-sheet">
      {(close) => (
        <div className="quicklog nqk" data-variant="sheet">
          {phase === 'naplo-pick' ? (
            <>
              {pickHead(close)}
              {tiles(picks)}
            </>
          ) : (
            <>
              <FoSheetHead title="Gyors logolás" titleId="quicklog-title" sub="Gyors rögzítés" icon="t-pencil" onClose={close} />
              {chatRow(close)}
              {tiles(doors(close))}
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
