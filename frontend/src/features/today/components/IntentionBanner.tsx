// ============================================================
// Mezo · IntentionBanner — the daily intention, split into the two shapes the
// daypart faces need (mezo-j7u4):
//   • variant="chip"    → the morning/day one-line creed chip (✦ + creed + one CTA)
//   • variant="reflect" → the evening reflection block (question + options, or ✓ done)
// The daypart decision moved OUT of this component into the caller (the face that
// mounts it); both variants ghost honestly when their data isn't there.
// The sheets (IntentionSheet / CreedSheet) are unchanged.
// ============================================================
import { useState } from 'react'
import { useIntentionDay, useIntentionActions } from '@/data/hooks'
import type { Reflection } from '@/data/types'
import { IntentionSheet } from '@/features/today/sheets/IntentionSheet'
import { CreedSheet } from '@/features/today/sheets/CreedSheet'
import { localDateString } from '@/shared/lib/dates'

const REFLECT_LABEL: Record<Reflection, string> = { yes: 'Igen', partial: 'Részben', no: 'Nem' }

export function IntentionBanner({ variant }: { variant: 'chip' | 'reflect' }) {
  const date = localDateString()
  const { data, isPending } = useIntentionDay(date)
  const { setCreed, addFocus, reflect } = useIntentionActions(date)
  const [focusOpen, setFocusOpen] = useState(false)
  const [creedOpen, setCreedOpen] = useState(false)

  if (isPending && data.foci.length === 0 && !data.creed) {
    return null // honest ghost: real mode before data / switch off
  }

  if (variant === 'reflect') {
    // Nothing to reflect on without a creed and at least one focus.
    if (!data.creed || data.foci.length === 0) return null
    return (
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
    )
  }

  return (
    <>
      <div className="creedchip">
        <div className="creedchip-hd">
          <span className="creedchip-st" aria-hidden="true">✦</span>
          {data.creed ? (
            // The creed itself is the edit affordance — CreedSheet has no other entry point,
            // so the retired `szerkeszt` button's job (and its label) moved onto the text.
            <button type="button" className="creedchip-tx" aria-label="Vezérelv szerkesztése"
              onClick={() => setCreedOpen(true)}>
              „{data.creed}"
            </button>
          ) : (
            // empty-state subtitle voice: Fraunces italic (DS text-meta-sm) — no override
            <span className="creedchip-tx">
              Fogalmazd meg az irányt, ami a döntéseidet vezeti — egy mondat, amire minden nap ránézel.
            </span>
          )}
          {data.foci.length > 0 && (
            <span className="creedchip-cnt">{data.foci.length} / {data.focusCap}</span>
          )}
          {!data.creed ? (
            <button type="button" className="creedchip-go" onClick={() => setCreedOpen(true)}>
              + Vezérelv megírása
            </button>
          ) : data.foci.length < data.focusCap ? (
            <button type="button" className="creedchip-go" aria-label="Fókusz hozzáadása"
              onClick={() => setFocusOpen(true)}>
              + Mai fókusz
            </button>
          ) : null /* at the daily cap — no dead control (the ItemRow doctrine) */}
        </div>

        {/* The day's stated intentions — WITHOUT this the add-a-focus path is write-only
            (mezo-j7u4 fix round 2). Rendered whenever foci exist, even creed-less ones
            (RoutineCard's IntentionSheet can produce those), so no focus is ever invisible. */}
        {data.foci.length > 0 && (
          <div className="creedchip-foci">
            {data.foci.map((f) => (
              <div key={f.id} className="creedchip-fx">
                <span className="creedchip-fx-mark" aria-hidden="true">◆</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {focusOpen && <IntentionSheet creed={data.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
      {creedOpen && <CreedSheet initial={data.creed ?? ''} onSave={setCreed} onClose={() => setCreedOpen(false)} />}
    </>
  )
}
