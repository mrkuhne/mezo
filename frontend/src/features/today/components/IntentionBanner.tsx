import { useState } from 'react'
import { useIntentionDay, useIntentionActions } from '@/data/hooks'
import type { Reflection } from '@/data/types'
import { IntentionSheet } from '@/features/today/sheets/IntentionSheet'
import { CreedSheet } from '@/features/today/sheets/CreedSheet'
import { daypartNow } from '@/shared/lib/daypart'
import { localDateString } from '@/shared/lib/dates'

const REFLECT_LABEL: Record<Reflection, string> = { yes: 'Igen', partial: 'Részben', no: 'Nem' }

export function IntentionBanner() {
  const date = localDateString()
  const { data, isPending } = useIntentionDay(date)
  const { setCreed, addFocus, reflect } = useIntentionActions(date)
  const [focusOpen, setFocusOpen] = useState(false)
  const [creedOpen, setCreedOpen] = useState(false)
  const evening = daypartNow() === 'este'

  if (isPending && data.foci.length === 0 && !data.creed) {
    return null // honest ghost: real mode before data / switch off
  }

  const head = (
    <div className="intent-head">
      <span className="intent-star" aria-hidden="true">✦</span>
      <span className="intent-eye">Vezérelv</span>
      {data.creed && (
        <button className="intent-edit" aria-label="Vezérelv szerkesztése" onClick={() => setCreedOpen(true)}>
          szerkeszt
        </button>
      )}
    </div>
  )

  return (
    <div className="intent">
      {head}
      {data.creed ? (
        <div className="intent-creed">„{data.creed}"</div>
      ) : (
        <>
          <div className="intent-creed" style={{ fontStyle: 'normal', color: 'var(--sub)' }}>
            Fogalmazd meg az irányt, ami a döntéseidet vezeti — egy mondat, amire minden nap ránézel.
          </div>
          <div className="intent-row" style={{ marginTop: 12 }}>
            <button className="intent-cta" onClick={() => setCreedOpen(true)}>+ Vezérelv megírása</button>
          </div>
        </>
      )}

      {data.creed && (
        <>
          <div className="intent-div" />
          {data.foci.length === 0 ? (
            <div className="intent-row">
              <span className="intent-prompt">Mi ma a fókuszod?</span>
              <button className="intent-cta" aria-label="Fókusz hozzáadása" onClick={() => setFocusOpen(true)}>
                + Mai fókusz
              </button>
            </div>
          ) : (
            <>
              <div className="intent-focus-eye">
                <span>{evening ? 'Ma szándékaim voltak' : 'Ma szándékaim'}</span>
                <span className="cnt">{data.foci.length} / {data.focusCap}</span>
              </div>
              <div className="intent-foci">
                {data.foci.map((f) => (
                  <div key={f.id} className="fx">
                    <span className="fx-mark" aria-hidden="true">◆</span>
                    <span className="fx-text">{f.text}</span>
                  </div>
                ))}
              </div>
              {data.foci.length < data.focusCap ? (
                <button className="intent-add" aria-label="Fókusz hozzáadása" onClick={() => setFocusOpen(true)}>
                  + Fókusz
                </button>
              ) : (
                <div className="intent-cap">Elérted a napi {data.focusCap} fókuszt — a kevesebb néha több.</div>
              )}
            </>
          )}

          {evening && data.foci.length > 0 && (
            <div className="reflect">
              {data.reflection ? (
                <div className="reflect-done">✓ {REFLECT_LABEL[data.reflection]} — a mai szándékodra reflektáltál.</div>
              ) : (
                <>
                  <div className="reflect-q">Szándékkal élted a napot?</div>
                  <div className="reflect-opts">
                    {(['yes', 'partial', 'no'] as Reflection[]).map((v) => (
                      <button key={v} className="reflect-opt" onClick={() => reflect(v)}>{REFLECT_LABEL[v]}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {focusOpen && <IntentionSheet creed={data.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
      {creedOpen && <CreedSheet initial={data.creed ?? ''} onSave={setCreed} onClose={() => setCreedOpen(false)} />}
    </div>
  )
}
