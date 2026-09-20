import { CharacterReplyThread } from '@/features/character/components/CharacterReplyThread'
import { CharacterEvidenceSheet } from '@/features/character/sheets/CharacterEvidenceSheet'
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

export function ClaimTile({ claim, delayMs, withdrawn = false }: { claim: CharacterClaimDto; delayMs?: number; withdrawn?: boolean }) {
  const { submit, pending } = useClaimFeedback()
  const { show } = useToast()
  const [status, setStatus] = useState<LocalStatus>('idle')
  const [pontOpen, setPontOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)

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
  if (status === 'retired' || withdrawn) {
    return (
      <div className="kr-claim retired rise" style={style} data-claim={claim.id}>
        <span className={`kr-confchip ${CONF_CLASS[word]}`}>{word}</span>
        <div className="kr-claim-text">{claim.text}</div>
        <div className="kr-retiredlbl">nyugdíjazva — a csapat nem viszi tovább</div>
        {pontOpen && <CharacterReplyThread source={{ sourceType: 'CLAIM', sourceId: claim.id, sourceIndex: 0 }} initialOpen />}
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
      <button type="button" className="kr-claim-evidence" onClick={() => setEvidenceOpen(true)}>Miből látszik?</button>
      {pontOpen && <CharacterReplyThread source={{ sourceType: 'CLAIM', sourceId: claim.id, sourceIndex: 0 }} initialOpen />}
      {evidenceOpen && <CharacterEvidenceSheet text={claim.text} expertKey={claim.proposedBy} evidence={claim.evidence.map(item => ({ sourceKind: item.kind, snippet: item.label }))} onClose={() => setEvidenceOpen(false)} onReply={() => { setEvidenceOpen(false); setPontOpen(true) }} />}
    </div>
  )
}
