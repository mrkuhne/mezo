// ============================================================
// Mezo · HowItWorksView (mezo-ms9a, task 7) — `?view=hogyan`: the retired
// KnowledgeExplainer's always-open explanation, moved into its own view
// instead of an inline collapsible panel (spec §3.5, "not perzisztál
// összecsukott állapotot — külön nézet, nem áll az útban"). The five
// original Q&A paragraphs are copied here verbatim (NOT imported —
// KnowledgeExplainer.tsx is deleted in task 9) plus a sixth block
// explaining the Kategóriák view.
// ============================================================
import type { CSSProperties } from 'react'
import { PATTERN_ACK_DAYS, PROMPT_TOP_N } from '@/data/insights/knowledge'

const PARAGRAPHS = [
  ['Mi az a tény?', 'Egy rólad szóló mondat, amit a társ megjegyzett. Vagy a beszélgetéseitekből szűrte ki, vagy egy megerősített mintából tanulta, vagy te vetted fel kézzel.'],
  ['Mit csinál a kapcsoló?', 'Bekapcsolva a tény versenyben van azért, hogy bekerüljön minden beszélgetés elé. Kikapcsolva a társ soha nem látja — sem a válaszaiban, sem a felismeréseiben.'],
  ['Mit jelent a visszaigazolás?', 'Hányszor jött vissza ugyanez magától: vagy újra elmondtad a chatben, vagy a minta-motor újra kimérte. Minél többször, annál előrébb sorolódik.'],
  ['Miért marad ki néhány?', `Csak a ${PROMPT_TOP_N} legerősebb bekapcsolt tény fér be egy beszélgetésbe. A többi bekapcsolva marad és várakozik — ha megerősödik, bekerül. Kivétel: egy frissen megerősített minta-tényt az első ${PATTERN_ACK_DAYS} napban a rangsortól függetlenül is megkapja a társ.`],
  ['Mi vár jóváhagyásra?', 'A beszélgetésből kiszűrt javaslatok. Amíg nem fogadod el őket, semmi nem történik velük — a társ nem használja őket.'],
  ['Mik a kategóriák?', 'Ugyanennek a tudásnak a térképe: minták, célok, életesemények és a köztük lévő kapcsolatok.'],
] as const

export function HowItWorksView() {
  return (
    <>
      {PARAGRAPHS.map(([title, body], i) => (
        <div key={title} className="card rise" style={{ '--d': `${i * 30}ms`, padding: 14 } as CSSProperties}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.55, margin: '4px 0 0' }}>{body}</p>
        </div>
      ))}
    </>
  )
}
