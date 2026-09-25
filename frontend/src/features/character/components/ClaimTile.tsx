import { CharacterReplyThread } from '@/features/character/components/CharacterReplyThread'
import { CharacterEvidenceSheet } from '@/features/character/sheets/CharacterEvidenceSheet'
import { CharacterRevisionSheet } from '@/features/character/sheets/CharacterRevisionSheet'
import { useState, type CSSProperties } from 'react'
import { useClaimFeedback } from '@/data/hooks'
import { useToast } from '@/shared/ui/ToastProvider'
import { confidenceWord, type CharacterClaimDto } from '@/data/character/characterApi'
import { Icon3D } from '@/shared/ui/clay'

// Üvegesítés U9 (mezo-me75u.9): a claim is a glass case (`glass tf-case`) whose accent is its
// confidence — biztos sage, valószínű sky, figyeljük lav — worn by the `tf-st` word chip too.
const CONF_ACCENT: Record<ReturnType<typeof confidenceWord>, string> = {
  biztos: 'sage',
  valószínű: 'sky',
  figyeljük: 'lav',
}

type LocalStatus = 'idle' | 'talal' | 'retired'

export function ClaimTile({ claim, delayMs, withdrawn = false }: { claim: CharacterClaimDto; delayMs?: number; withdrawn?: boolean }) {
  const { submit, pending } = useClaimFeedback()
  const { show } = useToast()
  const [status, setStatus] = useState<LocalStatus>('idle')
  const [pontOpen, setPontOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [revisionsOpen, setRevisionsOpen] = useState(false)

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
  const accent = CONF_ACCENT[word]
  const chip = (
    <span className="tf-crow"><span className={`tf-st tf-s-${accent}`}>{word}</span></span>
  )
  const text = (
    <span className="tf-cmain"><span className="tf-ctxt"><span className="tf-ctitle kr9-ctext">{claim.text}</span></span></span>
  )
  if (status === 'retired' || withdrawn) {
    return (
      <div className={`tf-case tf-flatc tf-c-${accent} kr9-claim kr9-retired rise`} style={style} data-claim={claim.id}>
        {chip}
        {text}
        <span className="kr9-foot">nyugdíjazva — a csapat nem viszi tovább</span>
        <div className="kr9-links">
          <button type="button" onClick={() => setRevisionsOpen(true)}>Mi változott?</button>
        </div>
        {revisionsOpen && <CharacterRevisionSheet claimId={claim.id} onClose={() => setRevisionsOpen(false)} />}
        {pontOpen && <CharacterReplyThread source={{ sourceType: 'CLAIM', sourceId: claim.id, sourceIndex: 0 }} initialOpen />}
      </div>
    )
  }

  return (
    <div className={`glass tf-case tf-c-${accent} kr9-claim rise${claim.sensitive ? ' kr9-sensitive' : ''}`} style={style} data-claim={claim.id}>
      {chip}
      {text}
      {status === 'talal' ? (
        <span className="tf-after kr9-thanks"><Icon3D name="t-tick" size={15} />Köszönöm — jegyzem.</span>
      ) : (
        <div className="kr9-chips">
          <button type="button" className="kr9-chip is-main tf-c-sage" onClick={handleTalal} disabled={pending}><Icon3D name="t-tick" size={17} />Talál</button>
          <button type="button" className="kr9-chip tf-c-slate" onClick={handleNemIgaz} disabled={pending}><Icon3D name="t-skip" size={17} />Nem igaz</button>
          <button type="button" className="kr9-chip tf-c-gold" onClick={() => setPontOpen((o) => !o)} disabled={pending}><Icon3D name="t-pencil" size={17} />Pontosítom</button>
        </div>
      )}
      <div className="kr9-links">
        <button type="button" onClick={() => setEvidenceOpen(true)}>Miből látszik?</button>
        <button type="button" onClick={() => setRevisionsOpen(true)}>Mi változott?</button>
      </div>
      {revisionsOpen && <CharacterRevisionSheet claimId={claim.id} onClose={() => setRevisionsOpen(false)} />}
      {pontOpen && <CharacterReplyThread source={{ sourceType: 'CLAIM', sourceId: claim.id, sourceIndex: 0 }} initialOpen />}
      {evidenceOpen && <CharacterEvidenceSheet text={claim.text} expertKey={claim.proposedBy} evidence={claim.evidence.map(item => ({ sourceKind: item.kind, snippet: item.label }))} onClose={() => setEvidenceOpen(false)} onReply={() => { setEvidenceOpen(false); setPontOpen(true) }} />}
    </div>
  )
}
