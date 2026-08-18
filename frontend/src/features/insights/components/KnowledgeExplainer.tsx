import { useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { PROMPT_TOP_N } from '@/data/insights/knowledge'

/** A `mezo.*` kulcs-idióma szerint: '1' = a felhasználó összecsukta a panelt. */
export const EXPLAINER_STORAGE_KEY = 'mezo.knowledge.explainer.collapsed'

const PARAGRAPHS = [
  ['Mi az a tény?', 'Egy rólad szóló mondat, amit a társ megjegyzett. Vagy a beszélgetéseitekből szűrte ki, vagy egy megerősített mintából tanulta, vagy te vetted fel kézzel.'],
  ['Mit csinál a kapcsoló?', 'Bekapcsolva a tény versenyben van azért, hogy bekerüljön minden beszélgetés elé. Kikapcsolva a társ soha nem látja — sem a válaszaiban, sem a felismeréseiben.'],
  ['Mit jelent a visszaigazolás?', 'Hányszor jött vissza ugyanez magától: vagy újra elmondtad a chatben, vagy a minta-motor újra kimérte. Minél többször, annál előrébb sorolódik.'],
  ['Miért marad ki néhány?', `Csak a ${PROMPT_TOP_N} legerősebb bekapcsolt tény fér be egy beszélgetésbe. A többi bekapcsolva marad és várakozik — ha megerősödik, bekerül.`],
  ['Mi vár jóváhagyásra?', 'A beszélgetésből kiszűrt javaslatok. Amíg nem fogadod el őket, semmi nem történik velük — a társ nem használja őket.'],
] as const

/** „Hogyan működik a tudástár?" — a felület egyszeri, hosszú magyarázata (mezo-9ryh). */
export function KnowledgeExplainer() {
  const [open, setOpen] = useState(() => localStorage.getItem(EXPLAINER_STORAGE_KEY) !== '1')

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      localStorage.setItem(EXPLAINER_STORAGE_KEY, next ? '0' : '1')
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
