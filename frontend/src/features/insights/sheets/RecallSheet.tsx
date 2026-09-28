import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { SheetHead } from '@/shared/ui/SheetHead'
import { Icon3D } from '@/shared/ui/clay'
import type { ChatRecalledMemory } from '@/data/types'

const TITLE_ID = 'recall-sheet-title'

/** S8 (mezo-d6ivw.12): "Emlékszem" opened — the facts about each named person that went into
 *  the prompt (the `kind=person` recalled items; gist = one fact per line, joined with "\n" by
 *  the backend — split here so a newline never renders literally). The door goes to the
 *  Tudástár's people view, where each fact can be muted or forgotten. */
export function RecallSheet({ items, onClose }: { items: ChatRecalledMemory[]; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <Sheet glass onClose={onClose} labelledBy={TITLE_ID} className="mzc-memsheet">
      {(close) => (
        <div style={{ ['--c' as string]: 'var(--dv-lav)' }}>
          <SheetHead icon="t-people" eyebrow="EMLÉKSZEM" title="Ezt vettem elő a válaszhoz" titleId={TITLE_ID} onClose={close} />
          <div className="mzc-memwho">
            {items.map((p, n) => (
              <div key={`${n}-${p.label}`} className="mzc-memwho-p">
                <strong><Icon3D name="t-person" size={22} />{p.label}</strong>
                <ul>
                  {p.gist.split('\n').map((line) => line.trim()).filter(Boolean)
                    .map((line, k) => <li key={`${k}-${line}`}>{line}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <p className="mzc-memfoot">
            Csak azt veszem elő, amit a Tudástárban is látsz. Ha valamelyiket nem szeretnéd, ott elhallgattathatod vagy
            elfelejtheted.
          </p>
          <div className="mzc-memrow">
            <button type="button" className="mzc-mbtn" onClick={() => { close(); navigate('/mezo/knowledge?view=emberek') }}>
              Emberek a Tudástárban ›
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
