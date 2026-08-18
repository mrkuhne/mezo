import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { PATTERN_ACK_DAYS, PROMPT_TOP_N } from '@/data/insights/knowledge'

/** A `mezo.*` kulcs-idióma szerint: '1' = a felhasználó összecsukta a panelt. */
export const EXPLAINER_STORAGE_KEY = 'mezo.knowledge.explainer.collapsed'

const PARAGRAPHS = [
  ['Mi az a tény?', 'Egy rólad szóló mondat, amit a társ megjegyzett. Vagy a beszélgetéseitekből szűrte ki, vagy egy megerősített mintából tanulta, vagy te vetted fel kézzel.'],
  ['Mit csinál a kapcsoló?', 'Bekapcsolva a tény versenyben van azért, hogy bekerüljön minden beszélgetés elé. Kikapcsolva a társ soha nem látja — sem a válaszaiban, sem a felismeréseiben.'],
  ['Mit jelent a visszaigazolás?', 'Hányszor jött vissza ugyanez magától: vagy újra elmondtad a chatben, vagy a minta-motor újra kimérte. Minél többször, annál előrébb sorolódik.'],
  ['Miért marad ki néhány?', `Csak a ${PROMPT_TOP_N} legerősebb bekapcsolt tény fér be egy beszélgetésbe. A többi bekapcsolva marad és várakozik — ha megerősödik, bekerül. Kivétel: egy frissen megerősített minta-tényt az első ${PATTERN_ACK_DAYS} napban a rangsortól függetlenül is megkapja a társ.`],
  ['Mi vár jóváhagyásra?', 'A beszélgetésből kiszűrt javaslatok. Amíg nem fogadod el őket, semmi nem történik velük — a társ nem használja őket.'],
] as const

/** Best-effort `localStorage` olvasás/írás — Safari privát módban vagy letiltott
 *  site-storage-nál a natív hívás `SecurityError`-t dob, ami render közben az EGÉSZ
 *  route-ot elvinné egy try/catch nélküli hívás esetén (l. `morningWindow.ts`/`nightTrace.ts`). */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(EXPLAINER_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(EXPLAINER_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    /* storage unavailable — best effort, a panel akkor is nyitva/csukva marad a munkameneten belül */
  }
}

/** „Hogyan működik a tudástár?" — a felület egyszeri, hosszú magyarázata (mezo-9ryh). */
export function KnowledgeExplainer() {
  const [open, setOpen] = useState(() => !readCollapsed())

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      writeCollapsed(!next)
      return next
    })
  }

  return (
    <div className="card">
      <button
        type="button"
        onClick={toggle}
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '13px 16px' }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lav-deep)' }}>Hogyan működik a tudástár?</span>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={11} color="var(--text-tertiary)" />
      </button>
      {open && (
        <div className="col gap-sm" style={{ padding: '0 16px 14px' }}>
          {PARAGRAPHS.map(([title, body]) => (
            <div key={title}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
              <p className="text-secondary" style={{ fontSize: 12, lineHeight: 1.55, margin: '2px 0 0' }}>{body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
