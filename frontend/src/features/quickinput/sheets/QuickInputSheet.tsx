// ============================================================
// Mezo · QuickInputSheet — a Design 2.0 quick-log launcher (mezo-7lst)
// A floating coral FAB mögött, minden tabon. Anatómia:
//   · Chat sor legfelül — a Mezónak mondott logolás a felfedezendő út,
//     ezért kap vizuális elsőbbséget (a rutin-logolás a rács alsó
//     kétharmadában marad, hüvelykujj-közelben).
//   · 9 egyenrangú csempe 3×3-ban, élő sublinekkal.
//   · Étkezés DINAMIKUS: aktív ablakkal a `/fuel/log/uj?w=<tileKey>` logolóba
//     visz, ablak nélkül a szabad tétel ágra. A hely/ikon/címke fix — csak az
//     alszöveg és a cél változik.
//   · Víz / Sport / Súly / Alvás / Napló / Check-in helyben cserélik a sheetet
//     (phase-csere, sosem Sheet a Sheetben); a többi navigál.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon, type ClayIconName } from '@/shared/ui/clay'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { JournalSheet } from '@/features/me/sheets/JournalSheet'
import { QuickSleepSheet } from '@/features/quickinput/sheets/QuickSleepSheet'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { WeightLogSheet } from '@/features/me/sheets/WeightLogSheet'
import { WaterLogSheet } from '@/features/fuel/sheets/WaterLogSheet'
import { SportLogSheet } from '@/features/train/sheets/SportLogSheet'
import { SPORT_LABELS, sportOf, type SportKind } from '@/features/train/logic/sportKinds'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { localDateString } from '@/shared/lib/dates'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { tileKey } from '@/features/fuel/logic/fuelSwimlane'
import { useCheckins, useFuelPreview, useFuelDay, useWaterActions, useWeight, useToday, useTrain } from '@/data/hooks'

/** Which surface the sheet shows: the launcher grid, an in-place two-option picker, or a log
 * sheet opened in its place (mezo-b3pp.1 / mezo-d20.1.6 — Súly joined the in-place set). */
type Phase = 'menu' | 'sleep' | 'naplo-pick' | 'aktivitas' | 'journal' | 'gratitude' | 'checkin' | 'weight' | 'water' | 'sport'

const HU = new Intl.NumberFormat('hu-HU')

function Tile({ icon, label, sub, subDone, tone, onClick, disabled }: {
  icon: ClayIconName; label: string; sub?: string; subDone?: boolean
  tone?: 'sky' | 'lav' | 'sage' | 'coral' | 'gold' | 'rose'
  onClick?: () => void; disabled?: boolean
}) {
  return (
    <button type="button" className={tone ? `quicklog-tile tone-${tone} np-press` : 'quicklog-tile np-press'} onClick={onClick} disabled={disabled}>
      <ClayIcon name={icon} size={26} />
      <span className="quicklog-label">{label}</span>
      {sub && <span className={subDone ? 'quicklog-sub-line done' : 'quicklog-sub-line'}>{sub}</span>}
    </button>
  )
}

export function QuickInputSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('menu')

  // ── live context for the head + sublines ─────────────────────────────
  // The MOST head mirrors the Fuel swimlane: the user-scheduled eating window
  // whose state is 'now' (slotKey present = meal/snack window, not a block slot).
  const { plan } = useFuelPreview()
  const nowWindow = plan.slots.find(s => s.slotKey !== undefined && s.state === 'now')
  // A dinamikus Étkezés csempe: a hely, az ikon és a címke FIX — csak az alszöveg és a cél
  // változik (CHI 2008, Gajos: az adaptáció akkor nem dezorientál, ha leíró és nem jósló).
  // Az ablak azonosítója a swimlane exportált `tileKey`-e, a `/fuel/log/uj?w=` másik végének
  // szerződése; ismeretlen/hiányzó kulcs ott a becsületes „Ablakon kívül" ág.
  const foodTarget = nowWindow ? `/fuel/log/uj?w=${encodeURIComponent(tileKey(nowWindow))}` : '/fuel/log/uj'
  const foodSub = nowWindow ? `MOST · ${nowWindow.label}` : 'ablakon kívül is'
  const { fuel } = useFuelDay()
  const { logWater } = useWaterActions()
  const { weightLog, logWeight } = useWeight()
  const latestWeight = weightLog.length > 0 ? weightLog[weightLog.length - 1] : null
  const { today, workoutDone } = useToday()
  const { sport, logSportSession } = useTrain()
  const { showLevelUp } = useLevelUp()
  // A mai UTOLSÓ sport-session az alszöveghez — múltbeli session sosem szólal meg itt.
  // `sport.sessions` mindkét adatforrásban legújabb-elöl sorrendű (backend:
  // OrderByDateDesc; mock: a log a lista elejére fűz), így egy sima `.find()`
  // a mai nap UTOLSÓNAK logolt sessionjét adja — reverse NÉLKÜL.
  const todaysSport = (sport.sessions ?? []).find(s => s.isoDate === localDateString())
  const sportSub = todaysSport ? `${SPORT_LABELS[sportOf({ sport: todaysSport.sport as SportKind })]} · ${HU.format(todaysSport.duration)}p` : undefined

  const { checkins, saveCheckIn } = useCheckins()
  // Pinned at click time (see the tile below), NOT recomputed here — see mezo-967c finding 1.
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)
  const nextCheckInIdx = checkins.findIndex(isFillableSlot)

  const goBack = () => setPhase('naplo-pick')

  if (phase === 'sleep') return <QuickSleepSheet onClose={onClose} />
  if (phase === 'weight') {
    return <WeightLogSheet onClose={onClose} onSave={logWeight} currentWeight={latestWeight?.value ?? 0} />
  }
  if (phase === 'water') {
    return (
      <WaterLogSheet
        currentMl={fuel.consumed.water}
        targetMl={fuel.targets.water}
        onLog={logWater}
        onClose={onClose}
      />
    )
  }
  if (phase === 'sport') {
    return (
      <SportLogSheet
        onClose={onClose}
        onSave={(body, done) =>
          logSportSession(body, { onSuccess: r => showLevelUp(r?.levelUp), onSettled: done })}
      />
    )
  }
  if (phase === 'aktivitas') return <ActivityLogSheet onClose={onClose} onBack={goBack} />
  if (phase === 'journal') return <JournalSheet onClose={onClose} onBack={goBack} />
  if (phase === 'gratitude') return <JournalSheet onClose={onClose} initialMode="gratitude" onBack={goBack} />
  if (phase === 'checkin' && checkInIdx !== null) {
    return (
      <CheckInSheet
        slot={checkins[checkInIdx]}
        slotIdx={checkInIdx}
        onClose={onClose}
        onSave={data => saveCheckIn(checkInIdx, data)}
      />
    )
  }

  const trainSub = workoutDone
    ? 'ma ✓'
    : today.workoutType
      ? `ma ${today.workoutTime} · ${today.workoutType}`
      : undefined

  return (
    <Sheet onClose={onClose} labelledBy="quicklog-title">
      {(close) => (
        <div className="quicklog">
          {phase === 'naplo-pick' ? (
            <>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <button type="button" className="cta-ghost" onClick={() => setPhase('menu')}
                  style={{ padding: '4px 8px', fontSize: 14 }}>
                  ← Vissza
                </button>
              </div>
              <h2 id="quicklog-title">Mit naplózol?</h2>
              <div className="quicklog-grid mt-lg">
                <Tile icon="i-lang" label="Aktivitás" onClick={() => setPhase('aktivitas')} />
                <Tile icon="i-naplo" label="Napló" onClick={() => setPhase('journal')} />
                <Tile icon="i-growth" label="Hála" onClick={() => setPhase('gratitude')} />
              </div>
            </>
          ) : (
            <>
              <h2 id="quicklog-title">Gyors logolás</h2>
              <p className="quicklog-sub">bármikor, két koppintás</p>

              <button
                type="button"
                className="quicklog-chat np-press"
                onClick={() => { close(); navigate('/mezo/chat') }}
              >
                <ClayIcon name="i-mezo" size={26} />
                <span className="quicklog-chat-text">
                  <span className="quicklog-chat-label">Mondd el Mezónak</span>
                  <span className="quicklog-chat-hint">kérdezz, mesélj — vagy logolj szóban</span>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>

              <div className="quicklog-grid">
                <Tile icon="i-fuel" label="Étkezés" tone="coral" sub={foodSub}
                  onClick={() => { close(); navigate(foodTarget) }} />
                <Tile icon="i-viz" label="Víz" tone="sky" sub={`${HU.format(fuel.consumed.water)} ml`}
                  onClick={() => setPhase('water')} />
                <Tile icon="i-stack" label="Stack" tone="gold"
                  onClick={() => { close(); navigate('/fuel/stack') }} />
                <Tile icon="i-edzes" label="Edzés" tone="coral" sub={trainSub} subDone={workoutDone}
                  onClick={() => { close(); navigate('/train') }} />
                <Tile icon="i-sport" label="Sport" tone="rose" sub={sportSub}
                  onClick={() => setPhase('sport')} />
                <Tile icon="i-suly" label="Súly" tone="sky"
                  sub={latestWeight ? `${HU.format(latestWeight.value)} kg` : undefined}
                  onClick={() => setPhase('weight')} />
                <Tile icon="i-checkin" label="Check-in" tone="rose"
                  sub={nextCheckInIdx >= 0 ? `köv. ${checkins[nextCheckInIdx].time}` : 'ma kész ✓'}
                  subDone={nextCheckInIdx < 0}
                  onClick={() => {
                    if (nextCheckInIdx >= 0) { setCheckInIdx(nextCheckInIdx); setPhase('checkin') }
                    else { close(); navigate('/nap') }
                  }} />
                <Tile icon="i-naplo" label="Napló" tone="sage" sub="3 mód" onClick={() => setPhase('naplo-pick')} />
                <Tile icon="i-alvas" label="Alvás" tone="lav" onClick={() => setPhase('sleep')} />
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
