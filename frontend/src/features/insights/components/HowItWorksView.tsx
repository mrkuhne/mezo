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
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

/** Üveg (U9 · mezo-me75u.9): one 3D icon per question, in order (prototype `hogyan`). */
const ICONS: Icon3DName[] = ['t-book', 't-key', 't-repeat', 't-layers', 't-bulb', 't-graph']

const PARAGRAPHS = [
  ['Mi az a tény?', 'Egy rólad szóló mondat, amit a társ megjegyzett. Vagy a beszélgetéseitekből szűrte ki, vagy egy megerősített mintából tanulta, vagy te vetted fel kézzel.'],
  ['Mit csinál a kapcsoló?', 'Bekapcsolva a tény ott van a társ fejében minden beszélgetésben és minden magától küldött üzenetben. Kikapcsolva a társ soha nem látja — sem a válaszaiban, sem a felismeréseiben.'],
  ['Mit jelent a visszaigazolás?', 'Hányszor jött vissza ugyanez magától: vagy újra elmondtad a chatben, vagy a minta-motor újra kimérte. Minél többször, annál előrébb sorolódik.'],
  ['Mindet tudja egyszerre?', 'Igen: ami be van kapcsolva, azt a társ mindig tudja — nem válogat közülük. Van egy magas biztonsági határ (200 tény), de az a mindennapokban elérhetetlen; ha egyszer közelítenéd, összevonjuk a hasonlókat.'],
  ['Hol döntök a javaslatokról?', 'A Rólad oldalon. Amíg nem fogadod el őket, semmi nem történik velük — a társ nem használja őket. A „Most ne” két hét múlva újra előhozza, a „Nem igaz” végleg elengedi.'],
  ['Mik a kategóriák?', 'Ugyanennek a tudásnak a térképe: minták, célok, életesemények és a köztük lévő kapcsolatok.'],
] as const

export function HowItWorksView() {
  return (
    <>
      {PARAGRAPHS.map(([title, body], i) => (
        <div key={title} className="tud9-qa rise" style={{ '--d': `${i * 30}ms` } as CSSProperties}>
          <div className="tud9-qh">
            <Icon3D name={ICONS[i]} size={30} />
            <h2>{title}</h2>
          </div>
          <p>{body}</p>
        </div>
      ))}
    </>
  )
}
