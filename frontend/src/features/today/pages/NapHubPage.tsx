import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useActivities, useCheckInPlan, useCheckins, useDayEvaluation, useFuelDay, useJournalNotes, useMeWeek,
  normalizeDayEvaluation,
} from '@/data/hooks'
import { planSteps } from '@/data/today/checkinPlan'
import type { NormalizedDayEvaluation } from '@/data/me/dayEvaluation'
import { localDateString } from '@/shared/lib/dates'
import { huInt } from '@/shared/lib/huNum'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { useNeeds } from '@/features/today/logic/useNeeds'
import { needsAttentionLine, needsAverage } from '@/features/today/logic/needsAverage'
import { buildNapTimeline } from '@/features/today/logic/napTimeline'
import { NAPZARAS_CARD_FROM_HOUR, dayReading } from '@/features/today/logic/napom'
import { mondayOf } from '@/features/me/logic/weekDay'
import { remainingAfterSkips } from '@/features/fuel/logic/keretHero'
import { NapFuelSheet } from '@/features/today/components/NapFuelSheet'
import { NapPersonalInsight } from '@/features/today/components/NapPersonalInsight'
import { NapzarasCard, useNapzarasState } from '@/features/today/components/NapzarasCard'
import { KimeloEntry, KimeloSlot } from '@/features/today/components/KimeloCard'
import { useRecovery } from '@/data/train/recoveryHooks'
import { Sheet } from '@/shared/ui/Sheet'
import {
  Acts, Btn, Card, Empty, ErrorRow, FoSheetHead, Lk, Note, Page, Row, Section, Stream, Tank, Vials,
  type StreamItem, type VialItem,
} from '@/shared/ui/folyadek'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import { JournalSheet } from '@/features/me/sheets/JournalSheet'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { AskTeamRow } from '@/features/insights/components/AskTeamRow'

/** The four canonical check-in slots as the tank's button and the stream name them. */
const SLOT_ADJ = ['Reggeli', 'Délelőtti', 'Délutáni', 'Esti'] as const
const slotTitle = (i: number) => `${SLOT_ADJ[i] ?? 'Következő'} check-in`
const sleepText = (min: number) => `${Math.floor(min / 60)} ó ${String(Math.round(min % 60)).padStart(2, '0')}`
const pctOf = (value: number, goal: number) => goal > 0 && Number.isFinite(goal) ? Math.max(0, value) / goal * 100 : 0
const dimOf = (ev: NormalizedDayEvaluation | null, id: string) => ev?.dimensions.find((d) => d.id === id) ?? null

/** „Most következik" with the next check-in on top: the slot's plan tells how many taps it asks. */
function NextStream({ date, slotTime, title, onFill, rest }: { date: string; slotTime: string; title: string; onFill(): void; rest: StreamItem[] }) {
  const { plan } = useCheckInPlan(date, slotTime)
  const taps = plan ? planSteps(plan).length : null
  return <Stream items={[
    { time: slotTime, title, sub: taps != null ? `${taps} koppintás, kb. fél perc` : 'kb. fél perc', right: 'Kitöltöm', now: true, onClick: onFill },
    ...rest,
  ]} />
}

/** Mai — the Nap hub (Folyadék F2, mezo-n4wf5.2; prototype `vilagos/nap.js` `mai()`): the big vessel is the
 *  average of the six életjel with the day's one-line reading, then four levels, what comes next, Mezo's
 *  observation, the day's log and the rest behind rows. In the evening the vessel turns to napzárás. */
export function NapHubPage() {
  const navigate = useNavigate()
  const tick = useMinuteTick()
  const date = localDateString(tick)
  const needs = useNeeds(tick)
  const checkinDay = useCheckins()
  const { checkins, saveCheckIn } = checkinDay
  const nutrition = useFuelDay(date)
  const notes = useJournalNotes(date, date)
  const activities = useActivities(date)
  const evalQuery = useDayEvaluation(date)
  const { week } = useMeWeek(mondayOf(date))
  const evening = useNapzarasState(tick)
  const [sheet, setSheet] = useState<'journal' | 'activity' | 'fuel' | 'more' | number | null>(null)
  // Kímélő mód (mezo-q4xt2.2): an open period changes the tank's reading, the Mozgás level and the edzés step.
  const { recovery } = useRecovery()
  const kimelo = recovery.period && !recovery.period.endedOn ? recovery.period : null
  const kimeloOn = Boolean(kimelo)

  const evaluation = evalQuery.data ? normalizeDayEvaluation(evalQuery.data) : null
  const day = week?.days?.find((d) => d.date === date) ?? null
  const avg = needs.isPending ? null : needsAverage(needs.states)
  const level = { pct: avg ?? 0, num: avg ?? '…' }
  const attention = needsAttentionLine(needs.states)

  // Capture is offered only once the persisted slots are known (never over a pending / failed read).
  const slotsKnown = !checkinDay.isPending && !checkinDay.isError
  const nextIdx = checkins.findIndex(c => c.state === 'now')
  const fillIdx = slotsKnown ? (nextIdx >= 0 ? nextIdx : checkins.findIndex(c => c.state !== 'done')) : -1
  const openEletjel = () => navigate('/nap/eletjel')

  // ── Mai szintek ──
  const fuel = nutrition.fuel
  const guidance = fuel.fuelMode === 'GUIDANCE'
  const kcal = Math.max(0, fuel.consumed?.kcal ?? 0)
  const kcalGoal = fuel.targets?.kcal ?? 0
  const protein = Math.max(0, fuel.consumed?.p ?? 0)
  const proteinGoal = fuel.targets?.p ?? 0
  const fuelEmpty = kcal === 0 && protein === 0 && !(fuel.consumed?.c > 0) && !(fuel.consumed?.f > 0)
  const remaining = remainingAfterSkips(kcalGoal, kcal, fuel.skippedKcal ?? 0)
  const proteinGap = Math.round(proteinGoal - protein)
  const sleepDim = dimOf(evaluation, 'sleep')
  const training = dimOf(evaluation, 'training')
  const trainingFact = training?.facts.find((f) => f.label === 'edzés')?.value
  const trainingOpen = training != null && training.status !== 'DONE' && training.status !== 'NO_DATA'
  const levels: VialItem[] = [
    guidance
      ? { label: 'Kalória', icon: 't-flame', value: '–', pct: 0, note: 'ma nincs cél', onClick: () => navigate('/fuel') }
      : {
          label: 'Kalória', icon: 't-flame', value: fuelEmpty ? '–' : huInt(kcal), pct: pctOf(kcal, kcalGoal),
          mark: kcalGoal > 0 ? huInt(kcalGoal) : undefined,
          note: fuelEmpty ? 'még nincs adat' : !(kcalGoal > 0) ? 'nincs keret'
            : remaining >= 0 ? `${huInt(remaining)} van még` : fuel.fuelMode === 'ESTIMATE' ? 'a keret körül' : `${huInt(-remaining)} felett`,
          onClick: () => navigate('/fuel'),
        },
    guidance
      ? { label: 'Fehérje', icon: 't-meat', color: 'var(--macro-protein)', value: '–', pct: 0, note: 'ma nincs cél', onClick: () => navigate('/fuel') }
      : {
          label: 'Fehérje', icon: 't-meat', color: 'var(--macro-protein)', value: fuelEmpty ? '–' : `${huInt(protein)} g`, pct: pctOf(protein, proteinGoal),
          mark: proteinGoal > 0 ? huInt(proteinGoal) : undefined,
          note: fuelEmpty ? 'még nincs adat' : !(proteinGoal > 0) ? 'nincs cél' : proteinGap > 0 ? `${huInt(proteinGap)} g hiányzik` : 'megvan',
          onClick: () => navigate('/fuel'),
        },
    {
      label: 'Alvás', icon: 't-sleep', color: 'var(--fo-ok)', value: day?.sleepMin != null ? sleepText(day.sleepMin) : '–',
      pct: day?.sleepMin != null ? sleepDim?.score ?? 0 : 0, note: day?.sleepMin != null ? undefined : 'még nincs adat',
      onClick: () => navigate('/me/sleep'),
    },
    kimeloOn
      ? { label: 'Mozgás', icon: 't-dumbbell', color: 'var(--fo-warn)', value: '–', pct: 0, mark: 'szünet', note: 'kímélő · kimarad', onClick: () => navigate('/train/mai') }
      : {
          label: 'Mozgás', icon: 't-dumbbell', color: training?.status === 'DONE' ? 'var(--fo-ok)' : 'var(--fo-warn)', value: trainingFact ?? '–', pct: training?.score ?? 0,
          note: training?.status === 'DONE' ? 'megvolt' : trainingOpen ? 'még hátravan' : undefined,
          onClick: () => navigate('/train/mai'),
        },
  ]

  // ── Most következik ──
  const next: StreamItem[] = []
  if (evening !== 'none') {
    const closed = evening === 'closed'
    next.push(
      {
        time: `${NAPZARAS_CARD_FROM_HOUR}:00`, title: 'Napzárás', sub: closed ? 'Megvolt · a nap le van téve' : 'Hat rövid lépés, kb. 3 perc',
        right: closed ? 'Kész ✓' : 'Indítom', now: fillIdx < 0 && !closed, onClick: () => navigate(closed ? '/nap/napom' : '/ritual'),
      },
      { time: 'este', title: 'Esti rutin', right: 'Megnézem', onClick: () => navigate('/nap/rutin?dp=este') },
    )
  } else if (trainingOpen) {
    next.push(kimeloOn
      ? { time: 'ma', title: 'Edzés', sub: 'kímélő mód · nem számít mulasztásnak', right: 'Kimarad' }
      : { time: 'ma', title: 'Edzés', sub: 'a mai edzés még hátravan', right: 'Megnézem', onClick: () => navigate('/train/mai') })
  }
  const nextCount = next.length + (fillIdx >= 0 ? 1 : 0)

  // ── Mai napló ──
  const moments = buildNapTimeline(date, checkins, fuel.meals, notes.data, activities.data)
  const timelinePending = checkinDay.isPending || nutrition.isPending || notes.isPending || activities.isPending
  const timelineError = checkinDay.isError || nutrition.isError || notes.isError || activities.isError
  const log: StreamItem[] = moments.slice(0, 8).map(m => ({
    time: m.time ? new Date(m.time).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : 'Ma',
    title: m.label, sub: m.text, right: '↗', onClick: () => navigate(m.to),
  }))

  return (
    <Page className="nm-page">
      <KimeloSlot />
      <div className="nm-hero" data-kalauz-anchor="nap-hero">
        {evening !== 'none'
          ? <NapzarasCard now={tick} kimelo={kimeloOn} level={level} onAir={openEletjel} airLabel="Életjelek" />
          : <Tank pct={level.pct} num={level.num} height={kimelo ? 420 : undefined} label="Mai állapot" marks={[75, 50, 25]}
              cap={kimelo ? `a 100-ból · kímélő mód · ${kimelo.dayIndex}. nap` : 'a 100-ból · hat életjel átlaga'}
              verdict={kimelo ? 'Ma a pihenés a dolgod.' : evaluation ? dayReading(evaluation, day) : undefined}
              air={kimelo ? 'Az edzés magától kimarad, és nem számít mulasztásnak.' : undefined}
              cta={fillIdx >= 0 ? slotTitle(fillIdx) : 'Gyors logolás'}
              onCta={() => fillIdx >= 0 ? setSheet(fillIdx) : navigate('/nap/gyors')}
              onAir={openEletjel} airLabel="Életjelek" />}
      </div>

      <Section title="Mai szintek" link="hol tartasz a célhoz" />
      {nutrition.isError
        ? <Card><ErrorRow message="Az üzemanyagot most nem sikerült betölteni." onRetry={() => { void nutrition.refetch() }} /></Card>
        : nutrition.isPending ? <Note role="status">Szintek betöltése…</Note>
          : <>
            <Vials className="nm-levels" items={levels} />
            {guidance && <Note>Kímélő mód · ma nincs kalóriacél — folyadék, könnyű étel</Note>}
          </>}

      {(nextCount > 0 || checkinDay.isError) && <>
        <Section title="Most következik" link={nextCount > 0 ? `${nextCount} teendő` : undefined} />
        {checkinDay.isError && <Card><ErrorRow message="A check-ineket most nem sikerült betölteni." onRetry={() => { void checkinDay.refetch() }} retryLabel="Check-in újratöltése" /></Card>}
        {fillIdx >= 0
          ? <NextStream date={date} slotTime={checkins[fillIdx].time} title={slotTitle(fillIdx)} onFill={() => setSheet(fillIdx)} rest={next} />
          : next.length > 0 && <Stream items={next} />}
      </>}

      <NapPersonalInsight date={date} />

      <Section title="Mai napló" link={<Lk onClick={() => navigate('/nap/gyors')}>+ Új bejegyzés</Lk>} />
      {timelinePending && <Note role="status">Pillanatok betöltése…</Note>}
      {!timelinePending && !timelineError && moments.length === 0 && <Card><Empty icon="t-journal">Az első mai bejegyzésed itt kap helyet.</Empty></Card>}
      {log.length > 0 && <div className="nm-log"><Stream items={log} /></div>}
      {timelineError && <Note role="status">Néhány pillanatot most nem sikerült betölteni.</Note>}

      <Section title="Továbbiak" link="ami még a naphoz tartozik" />
      <Card className="nm-more">
        <Row icon="t-macro" title="A napod üzemanyaga" sub="kalória és a három makró" onClick={() => setSheet('fuel')} />
        <Row icon="t-heart" title="Életjelek" sub={attention ? `hat jel · ${attention}` : 'hat jel'} value={avg ?? undefined} onClick={openEletjel} />
        <Row icon="t-pattern" title="Összes észrevétel" onClick={() => navigate('/nap/uzenetek?tab=eszrevetelek')} />
        {/* Kérdezd a csapatot (mezo-u3712, owner-döntés 2026-09-26): a Nap alján, ha valami nem stimmel. */}
        <div className="nm-askteam">
          <AskTeamRow origin={{ from: '/nap', label: 'Mai' }} sub="Valami nem stimmel ma? A csapat utánanéz." />
        </div>
        <Acts>
          <Btn sm onClick={() => navigate('/nap/gyors')}>+ Új bejegyzés</Btn>
          <Btn sm ghost onClick={() => setSheet('journal')}>Napló</Btn>
          <Lk onClick={() => setSheet('more')}>Több</Lk>
        </Acts>
        <KimeloEntry />
      </Card>

      {typeof sheet === 'number' && <CheckInSheet slot={checkins[sheet]} slotIdx={sheet} onClose={() => setSheet(null)} onSave={data => saveCheckIn(sheet, { ...data, savedAt: new Date().toISOString() })} />}
      {sheet === 'journal' && <JournalSheet onClose={() => setSheet(null)} />}
      {sheet === 'activity' && <ActivityLogSheet onClose={() => setSheet(null)} />}
      {sheet === 'fuel' && <NapFuelSheet onClose={() => setSheet(null)} guidance={guidance} skippedKcal={fuel.skippedKcal} fuelMode={fuel.fuelMode}
        consumed={fuel.consumed} targets={fuel.targets} isPending={nutrition.isPending} isError={nutrition.isError} onRetry={nutrition.refetch} />}
      {sheet === 'more' && (
        <Sheet onClose={() => setSheet(null)} labelledBy="nm-more-title" className="fo-sheet">
          {(close) => <>
            <FoSheetHead title="Több" titleId="nm-more-title" sub="Mai · ami még ide tartozik" onClose={close} />
            <div className="nm-sheetrows">
              <Row icon="t-steps" title="Aktivitás" sub="amit ma tettél" onClick={() => setSheet('activity')} />
              <Row icon="t-chat" title="Chat" sub="beszéljük át" onClick={() => navigate('/mezo/chat')} />
              <Row icon="t-heart" title="Életjelek" sub="a hat jel" onClick={openEletjel} />
              <Row icon="t-quest" title="Napi küldetések" sub="ajánlatok a mai napra" onClick={() => navigate('/nap/kuldetesek')} />
            </div>
          </>}
        </Sheet>
      )}
    </Page>
  )
}
