import type { CSSProperties } from 'react'
import { NOVA_META, type NovaGroup } from '@/data/nova'
import { useM } from '@/shared/i18n'
import { NOVA_COLOR } from '@/features/fuel/components/folyadek'

/** The NOVA group as a coloured dot + „NOVA n" (Folyadék, mezo-n4wf5.5); the group's short name is the hover title. */
export function NovaDot({ nova }: { nova: NovaGroup }) {
  const M = useM()
  return (
    <span className="fg-nova" title={M.fuelKozos.nova[`n${nova}`]} style={{ '--c': NOVA_COLOR[nova] } as CSSProperties}>
      <i aria-hidden="true" />
      <span>{NOVA_META[nova].label}</span>
    </span>
  )
}
