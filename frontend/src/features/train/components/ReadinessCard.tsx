import type { ReadinessTodayResponse } from '@/data/train/readinessApi'
import { useTodayReadiness } from '@/data/hooks'
import type { Icon3DName } from '@/shared/ui/clay'
import { Box, Btn, Bub, Hero, Lk, Note, Tubes } from '@/shared/ui/folyadek'
import { useToast } from '@/shared/ui/ToastProvider'

// ============================================================
// Check-in 2.0 · „Mai állapot" (mezo-ck2, spec 2026-09-27 §3.3) — the Edzés today card.
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `readyCard()`): this morning's check-in says a
// lighter day would be wiser. The offer is the amber (warn) hero: the reasons the server gives
// (GET /api/train/readiness/today, 0–3 of them) as test tubes filled to their 1–10 value, one box
// per pain-loaded exercise, the „Csak javaslat" note, and on the liquid row „Könnyítsük" +
// „Maradjon a terv". After „Könnyítsük" a calm hero with the green tick and the undo link.
// „Maradjon a terv" hides it for the day. Never automatic — nothing changes without a tap.
// ============================================================

const REASON: Record<ReadinessTodayResponse['reasons'][number]['item'], { icon: Icon3DName; label: string }> = {
  rested: { icon: 't-rested', label: 'Kipihentség' },
  soreness: { icon: 't-soreness', label: 'Izomláz' },
  motivation: { icon: 't-motivation', label: 'Kedv' },
}

/** The tube's colour is the value's state: soreness reads high = bad, the other two low = warn. */
function reasonColor(item: keyof typeof REASON, value: number): string {
  if (item === 'soreness') return value >= 7 ? 'var(--fo-bad)' : 'var(--fo-warn)'
  return value <= 4 ? 'var(--fo-warn)' : 'var(--fo-ok)'
}

const TOAST = {
  lighten: 'Könnyítve — ma egy fokkal lejjebb',
  keep: 'Rendben, marad a terv',
  undo: 'Visszaállítva az eredeti terv',
} as const

/** Hungarian definite article: „az" before a vowel sound, else „a" (capitalised, sentence-initial). */
function article(word: string): string {
  return /^[aáeéiíoóöőuúüű]/i.test(word) ? 'Az' : 'A'
}

/** „X", „X és Y", „X, Y és Z". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} és ${names[names.length - 1]}`
}

/** Presentational card — the readiness in, the three taps out. Renders nothing for NONE / KEPT. */
export function ReadinessCard({ readiness, onLighten, onKeep, onUndo, busy = false }: {
  readiness: ReadinessTodayResponse
  onLighten: () => void
  onKeep: () => void
  onUndo: () => void
  busy?: boolean
}) {
  const { state, reasons, care } = readiness
  if (state === 'LIGHTENED') {
    const names = care.map((c) => c.exerciseName)
    return (
      <Hero className="em-ready is-lightened" aria-label="Mai állapot"
        label="Mai állapot · könnyítve" verdict="Ma egy fokkal lejjebb"
        sub={`Minden gyakorlatnál a múlt heti súly marad, nem emelünk.${names.length > 0 ? ` ${article(names[0])} ${joinNames(names)} nehéz szettjei kimaradnak.` : ''}`}
        left={<Bub icon="t-tick" size={56} color="var(--fo-ok)" />}
        actions={<Lk onClick={onUndo} disabled={busy}>Visszaállítom a tervet</Lk>} />
    )
  }
  if (state !== 'OFFER') return null
  return (
    <Hero warn className="em-ready" aria-label="Mai állapot"
      label="Mai állapot · a reggeli check-inből" verdict="Könnyebb nap javasolt"
      actions={(
        <>
          <Btn sm onClick={onLighten} disabled={busy}>Könnyítsük</Btn>
          <Btn sm ghost onClick={onKeep} disabled={busy}>Maradjon a terv</Btn>
        </>
      )}>
      {reasons.length > 0 && (
        <Tubes className="em-rd" height={112} aria-label="A reggeli check-in értékei"
          items={reasons.map((r) => ({
            label: REASON[r.item].label, icon: REASON[r.item].icon, value: `${r.value}/10`,
            pct: r.value * 10, color: reasonColor(r.item, r.value), mark: '10',
          }))} />
      )}
      {care.map((c) => (
        <Box key={c.exerciseName} icon="t-pain" color="var(--fo-warn)" title={c.exerciseName} className="em-care">
          <p>Fáj a {c.regionLabel}{c.intensity != null && ` (${c.intensity}/10)`}. Ma óvatosan: könnyebb súly, vagy hagyd ki.</p>
        </Box>
      ))}
      <Note>Csak javaslat — magától nem változtat semmit.</Note>
    </Hero>
  )
}

/**
 * The wired card for the Edzés today page: reads today's readiness, stores the tap, confirms it
 * with the prototype's toast. Hidden once today's workout is done (`done`) and whenever there is
 * nothing to offer.
 */
export function TodayReadiness({ done }: { done: boolean }) {
  const { readiness, choose, undo, saving } = useTodayReadiness()
  const toast = useToast()
  if (done) return null
  if (readiness.state !== 'OFFER' && readiness.state !== 'LIGHTENED') return null
  return (
    <ReadinessCard
      readiness={readiness}
      busy={saving}
      onLighten={() => choose('LIGHTEN', () => toast.show({ kind: 'success', text: TOAST.lighten }))}
      onKeep={() => choose('KEEP', () => toast.show({ kind: 'info', text: TOAST.keep }))}
      onUndo={() => undo(() => toast.show({ kind: 'info', text: TOAST.undo }))}
    />
  )
}
