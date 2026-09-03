// ============================================================
// Mezo · Karakter — ClaimTile (mezo-1gim.13, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `renderDim()`'s claim markup +
// the `#dimClaims` click handlers (talál/nemigaz/pont). One claim = a confidence-word chip
// (sage/amber/lav) + text (+ ÉRZÉKENY frame for `sensitive`) + the three feedback pills.
//
// Binding rulings (ledger, this task's brief):
//  · TALÁL -> thanks microcopy, pills disabled. The confidence word is NEVER bumped locally —
//    only a genuine refetch (mock: the patched cache; real: the invalidation) can move the
//    word, and that only shows up on this claim's NEXT render from fresh data, never here.
//  · NEM IGAZ -> the API serves ACTIVE claims only, and the mock mirrors that by REMOVING the
//    claim from the query cache. The dashed "nyugdíjazva" face is therefore a TRANSIENT LOCAL
//    state, not a fabricated status field: THIS tile flips to the retired face on its own local
//    `status` state (independent of the cache), plus a toast. The caller (DimensionPage) is the
//    one that keeps rendering this tile at all past the cache removal — see its claim snapshot.
//  · PONTOSÍTOM -> inline textarea + Küldés -> submit + toast; the claim's own displayed fields
//    (text/confidence) never change locally — the correction is logged server/mock-side only.
// No mirror line: CharacterClaimDto carries no separate mirror/reflection field — the
// prototype's `.cmirror` is design-only content this API doesn't serve; deliberately omitted
// rather than inventing one (Global Constraints: honest states, no theater).
//
// Fix round 1 (honest failure, reviewer finding #2): every success face/toast used to fire
// BEFORE the mutation resolved, so a failed POST still showed "✓ Köszönöm", the retired face,
// or the success toast — never no crash, but a LIE about what happened. Every handler below now
// awaits `submit(...)` first; the UI only commits its success state in the `then` branch. A
// rejection leaves the pills/textarea exactly as they were and surfaces the app's existing
// terracotta error-toast idiom (`kind: 'error'`, the useChatHandoff.ts precedent) — never red,
// per the Global Constraints, but never silently swallowed either.
// ============================================================
import { useState, type CSSProperties } from 'react'
import { useClaimFeedback } from '@/data/hooks'
import { useToast } from '@/shared/ui/ToastProvider'
import { confidenceWord, type CharacterClaimDto } from '@/data/character/characterApi'

const CONF_CLASS: Record<ReturnType<typeof confidenceWord>, string> = {
  biztos: 'kr-conf-biztos',
  valószínű: 'kr-conf-valoszinu',
  figyeljük: 'kr-conf-figyeljuk',
}

type LocalStatus = 'idle' | 'talal' | 'retired'

export function ClaimTile({ claim, delayMs }: { claim: CharacterClaimDto; delayMs?: number }) {
  const { submit, pending } = useClaimFeedback()
  const { show } = useToast()
  const [status, setStatus] = useState<LocalStatus>('idle')
  const [pontOpen, setPontOpen] = useState(false)
  const [pontText, setPontText] = useState('')

  const word = confidenceWord(claim.confidence)
  const style = delayMs != null ? ({ '--d': `${delayMs}ms` } as CSSProperties) : undefined

  const FEEDBACK_ERROR = 'Nem sikerült elküldeni a visszajelzést — próbáld újra'

  async function handleTalal() {
    try {
      await submit(claim.id, 'TALAL')
      setStatus('talal')
    } catch {
      show({ kind: 'error', text: FEEDBACK_ERROR })
    }
  }
  async function handleNemIgaz() {
    try {
      await submit(claim.id, 'NEM_IGAZ')
      setStatus('retired')
      show({ kind: 'info', text: 'Rendben — a csapat nem viszi tovább' })
    } catch {
      show({ kind: 'error', text: FEEDBACK_ERROR })
    }
  }
  async function handleSend() {
    try {
      await submit(claim.id, 'PONTOSITOM', pontText)
      setPontOpen(false)
      setPontText('')
      show({ kind: 'info', text: 'Elküldve — a következő konzíliumon foglalkozik vele a csapat' })
    } catch {
      show({ kind: 'error', text: FEEDBACK_ERROR })
    }
  }

  if (status === 'retired') {
    return (
      <div className="kr-claim retired rise" style={style} data-claim={claim.id}>
        <span className={`kr-confchip ${CONF_CLASS[word]}`}>{word}</span>
        <div className="kr-claim-text">{claim.text}</div>
        <div className="kr-retiredlbl">nyugdíjazva — a csapat nem viszi tovább</div>
      </div>
    )
  }

  return (
    <div className={`kr-claim rise${claim.sensitive ? ' sensitive' : ''}`} style={style} data-claim={claim.id}>
      <span className={`kr-confchip ${CONF_CLASS[word]}`}>{word}</span>
      <div className="kr-claim-text">{claim.text}</div>
      {status === 'talal' ? (
        <div className="kr-fbthanks">✓ Köszönöm — jegyzem.</div>
      ) : (
        <div className="kr-fbpills">
          <button type="button" className="kr-fbp talal" onClick={handleTalal} disabled={pending}>Talál</button>
          <button type="button" className="kr-fbp nemigaz" onClick={handleNemIgaz} disabled={pending}>Nem igaz</button>
          <button type="button" className="kr-fbp pont" onClick={() => setPontOpen((o) => !o)} disabled={pending}>Pontosítom</button>
        </div>
      )}
      {pontOpen && (
        <div className="kr-fbtext open">
          <textarea
            aria-label="Mit pontosítanál?"
            placeholder="Mit pontosítanál?"
            value={pontText}
            onChange={(e) => setPontText(e.target.value)}
          />
          <button type="button" className="cta kr-send" onClick={handleSend} disabled={pending}>Küldés</button>
        </div>
      )}
    </div>
  )
}
