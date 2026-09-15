import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ClayIconName } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MozaikPage, PageBody, PageHead, PageHero, type PageTone } from '@/shared/ui/mozaik'

interface StackPageScaffoldProps {
  tone: PageTone
  // S5 (mezo-qt5q): a `/fuel/stack/manage` négyes megszűnt — a Kezelés a Protokoll-lap
  // szekciója lett (D3), tehát a visszaút oda vezet, nem egy leváltott útvonalra.
  backTo: '/fuel/stack' | '/fuel/stack/protocol'
  backLabel: '‹ Stack' | '‹ Protokoll'
  icon: ClayIconName
  name: string
  big?: ReactNode
  sub?: string
  children: ReactNode
}

export function StackPageScaffold({
  tone, backTo, backLabel, icon, name, big, sub, children,
}: StackPageScaffoldProps) {
  const navigate = useNavigate()
  return (
    <MozaikPage tone={tone} className="stk-detail-page">
      <PageHead onBack={() => navigate(backTo)} label={backLabel} />
      <EntranceGroup>
        <div className="stk-page-hero"><PageHero icon={icon} name={name} big={big} sub={sub} /></div>
        <PageBody className="stk-detail-body">{children}</PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
