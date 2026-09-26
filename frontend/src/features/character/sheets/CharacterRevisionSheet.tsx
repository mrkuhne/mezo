import { useEffect, useRef, useState } from 'react'
import { useCharacterClaimRevisions, useCharacterOverview } from '@/data/hooks'
import { confidenceWord, type CharacterClaimRevisionDto } from '@/data/character/characterApi'
import { ApiError } from '@/data/_client/api'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'

export function CharacterRevisionSheet({ claimId, onClose }: { claimId: string; onClose: () => void }) {
  const { revisions, isLoading, isError, refetch, undo, pending } = useCharacterClaimRevisions(claimId)
  const { overview } = useCharacterOverview()
  const [error, setError] = useState('')
  const [undone, setUndone] = useState<string | null>(null)
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = content.current?.closest('[role="dialog"]') as HTMLElement | null
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])]
    const background = [...(dialog?.parentElement?.children ?? [])]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialog && !element.classList.contains('gl-backdrop'))
      .map(element => ({ element, inert: element.inert }))
    background.forEach(({ element }) => { element.inert = true })
    focusable()[0]?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = focusable(), first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    dialog?.addEventListener('keydown', trap)
    return () => { dialog?.removeEventListener('keydown', trap); background.forEach(({ element, inert }) => { element.inert = inert }); previous?.focus() }
  }, [])
  async function revert(id: string) {
    setError('')
    setUndone(null)
    try { await undo(id); setUndone(id) }
    catch (failure) {
      setError(failure instanceof ApiError && (failure.status === 409 || failure.messages.some(message => message.code === 'CHARACTER_REVISION_CONFLICT'))
        ? 'Időközben megváltozott ez a megállapítás. Az újabb változást nem írtuk felül; nézd meg a friss előzményeket.'
        : 'A visszavonást nem sikerült visszaigazolni. Frissítsd az előzményeket, mielőtt újrapróbálod.')
    }
  }
  return (
    <GlassBox open onClose={onClose} label="Mi változott?" eyebrow="A RÓLAD ALKOTOTT KÉP" tint="var(--dv-lav)" art={<PersonaOrb expertKey="mezo" size={40} />}>
      <div ref={content} className="kr-evidence-content kr-revisions">
        {isLoading && <p role="status">A változások betöltése…</p>}
        {isError && <p role="alert">A változások nem töltődtek be. <button type="button" onClick={refetch}>Újratöltés</button></p>}
        {!isLoading && !isError && revisions.length === 0 && <p>Ehhez a megállapításhoz még nincs rögzített változástörténet.</p>}
        {revisions.map(revision => (
          <section className="kr-revision" key={revision.id}>
            <small>{new Date(revision.createdAt).toLocaleString('hu-HU')}</small>
            <div className="kr-evidence-record"><b>Előtte</b><p>{revision.beforeText ?? 'Még nem szerepelt a rólad alkotott képben.'}</p></div>
            <div className="kr-evidence-record"><b>A változás után</b><p>{revision.afterText}</p></div>
            <RevisionChanges revision={revision} dimensionName={key => overview?.dimensions.find(dimension => dimension.key === key)?.title ?? key} />
            <p>{revision.reason}</p>
            {(revision.undoneAt || undone === revision.id) ? <p role="status">Ezt a változást visszavontuk.</p> : revision.canUndo && (
              <button className="cta" type="button" disabled={pending} onClick={() => void revert(revision.id)}>{pending ? 'Visszavonás…' : 'Visszavonom a változást'}</button>
            )}
            {!revision.undoneAt && undone !== revision.id && !revision.canUndo && <small>Ez az előzmény már nem vonható vissza közvetlenül.</small>}
          </section>
        ))}
        {error && <p role="alert">{error} <button type="button" onClick={refetch}>Előzmények frissítése</button></p>}
      </div>
    </GlassBox>
  )
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Aktív', RETIRED: 'Visszavont' }
const dateLabel = (value?: string | null) => value ? value.replaceAll('-', '. ') : 'nincs megadva'

function RevisionChanges({ revision: r, dimensionName }: { revision: CharacterClaimRevisionDto; dimensionName: (key: string) => string }) {
  const changes: { label: string; text: string }[] = []
  if (r.afterConfidence != null && r.beforeConfidence !== r.afterConfidence) {
    const before = r.beforeConfidence == null ? 'még nem értékeltük' : confidenceWord(r.beforeConfidence)
    const direction = r.beforeConfidence == null ? '' : r.afterConfidence > r.beforeConfidence ? ' · erősödött' : ' · gyengült'
    changes.push({ label: 'Bizonyosság', text: `${before} → ${confidenceWord(r.afterConfidence)}${direction}` })
  }
  if (r.afterStatus && r.beforeStatus !== r.afterStatus) changes.push({ label: 'Állapot', text: `${r.beforeStatus ? STATUS_LABEL[r.beforeStatus] ?? r.beforeStatus : 'Még nem szerepelt'} → ${STATUS_LABEL[r.afterStatus] ?? r.afterStatus}` })
  if (r.afterDimensionKey && r.beforeDimensionKey !== r.afterDimensionKey) changes.push({ label: 'Fejezet', text: `${r.beforeDimensionKey ? dimensionName(r.beforeDimensionKey) : 'Még nem volt besorolva'} → ${dimensionName(r.afterDimensionKey)}` })
  if (r.beforeObservedFrom !== r.afterObservedFrom || r.beforeObservedTo !== r.afterObservedTo) changes.push({ label: 'Megfigyelt időszak', text: `${dateLabel(r.beforeObservedFrom)} – ${dateLabel(r.beforeObservedTo)} → ${dateLabel(r.afterObservedFrom)} – ${dateLabel(r.afterObservedTo)}` })
  if (r.beforeValidFrom !== r.afterValidFrom || r.beforeValidTo !== r.afterValidTo) changes.push({ label: 'Érvényesség', text: `${dateLabel(r.beforeValidFrom)} – ${dateLabel(r.beforeValidTo)} → ${dateLabel(r.afterValidFrom)} – ${dateLabel(r.afterValidTo)}` })
  return <>{changes.map(change => <div className="kr-evidence-record" key={change.label}><b>{change.label}</b><p>{change.text}</p></div>)}</>
}
