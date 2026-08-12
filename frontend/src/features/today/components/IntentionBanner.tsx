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
import { TodayList } from '@/features/today/components/TodayList'
import { TodayRow } from '@/features/today/components/TodayRow'
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
      <TodayList
        label={data.foci.length > 0 ? `Fókusz · ${data.foci.length} / ${data.focusCap}` : 'Fókusz'}
        action={
          !data.creed ? (
            <button type="button" onClick={() => setCreedOpen(true)}>+ Vezérelv megírása</button>
          ) : data.foci.length < data.focusCap ? (
            <button type="button" aria-label="Fókusz hozzáadása" onClick={() => setFocusOpen(true)}>
              + Mai fókusz
            </button>
          ) : undefined /* a napi sapkán — nincs halott kontroll (az ItemRow doktrína) */
        }
      >
        <div className="td-creed">
          {data.creed ? (
            // A vezérelv maga a szerkesztő affordancia — a CreedSheet-nek nincs más belépője.
            <button type="button" className="td-creed-q" aria-label="Vezérelv szerkesztése"
              onClick={() => setCreedOpen(true)}>
              „{data.creed}"
            </button>
          ) : (
            <span className="td-creed-q">
              Fogalmazd meg az irányt, ami a döntéseidet vezeti — egy mondat, amire minden nap ránézel.
            </span>
          )}
        </div>
        {data.foci.map((f) => (
          <TodayRow key={f.id} tone="plain" icon="✦" title={f.text} accessory="none" />
        ))}
      </TodayList>

      {focusOpen && <IntentionSheet creed={data.creed} onSave={addFocus} onClose={() => setFocusOpen(false)} />}
      {creedOpen && <CreedSheet initial={data.creed ?? ''} onSave={setCreed} onClose={() => setCreedOpen(false)} />}
    </>
  )
}
