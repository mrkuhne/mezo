import { useEffect, useRef } from 'react'
import { GlassBox } from '@/shared/ui/mozaik/GlassBox'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'

const SOURCE_LABEL: Record<string, string> = { observation: 'Megfigyelés', user: 'Saját közlés', character_reply: 'Saját válaszod', daily_summary: 'Napi összegzés', claim: 'Korábbi megállapítás' }

export function CharacterEvidenceSheet({
  text,
  expertKey,
  at,
  evidence = [],
  onClose,
  onReply,
}: {
  text: string
  expertKey?: string | null
  at?: string
  evidence?: { snippet: string; sourceKind: string }[]
  onClose: () => void
  onReply?: () => void
}) {
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = content.current?.closest('[role="dialog"]') as HTMLElement | null
    const focusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>('button, textarea, a[href], [tabindex="0"]') ?? [])
    const background = Array.from(dialog?.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== dialog && !element.classList.contains('gl-backdrop'))
      .map(element => ({ element, inert: element.inert }))
    background.forEach(({ element }) => { element.inert = true })
    focusable()[0]?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    dialog?.addEventListener('keydown', trap)
    return () => {
      dialog?.removeEventListener('keydown', trap)
      background.forEach(({ element, inert }) => { element.inert = inert })
      previous?.focus()
    }
  }, [])
  return (
    <GlassBox
      open
      onClose={onClose}
      label="Miből látszik?"
      eyebrow="FORRÁS ÉS ÉRTELMEZÉS"
      tint="var(--dv-lav)"
      art={<PersonaOrb expertKey={expertKey ?? 'mezo'} size={40} />}
    >
      <div ref={content} className="kr-evidence-content">
        <p className="kr-social-eyebrow">
          {at ? new Date(at).toLocaleString('hu-HU') : 'A megállapítás forrásai'}
        </p>
        <blockquote>{text}</blockquote>
        {evidence.length > 0 ? (
          evidence.map((entry, i) => (
            <div className="kr-evidence-record" key={i}>
              <small>{SOURCE_LABEL[entry.sourceKind] ?? 'Rögzített forrás'}</small>
              <p>{entry.snippet}</p>
            </div>
          ))
        ) : (
          <p>
            A bejegyzés az itt látható megfigyelést rögzíti. További részletes forrás nincs hozzácsatolva.
          </p>
        )}
        <div className="kr-evidence-note">
          Ez egy értelmezés, amelyet a saját tapasztalatoddal pontosíthatsz. A hiányzó naplózás önmagában nem
          bizonyít kihagyást.
        </div>
        {onReply && (
          <button className="cta" type="button" onClick={onReply}>
            Hozzáteszem, amit tudok
          </button>
        )}
      </div>
    </GlassBox>
  )
}
