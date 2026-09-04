import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ClayIconName } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MozaikPage, PageBody, PageHead, PageHero, type PageTone } from '@/shared/ui/mozaik'

interface StackPageScaffoldProps {
  tone: PageTone
  backTo: '/fuel/stack' | '/fuel/stack/manage'
  backLabel: '‹ Stack' | '‹ Kezelés'
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
        <PageHero icon={icon} name={name} big={big} sub={sub} />
        <PageBody className="stk-detail-body">{children}</PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
