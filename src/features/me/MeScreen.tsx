import { PageTitle } from '@/components/ui/PageTitle'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { CtaGhost } from '@/components/ui/Cta'
import { useTheme } from '@/app/ThemeProvider'

export function MeScreen() {
  const { theme, toggle } = useTheme()
  return (
    <div className="col" style={{ padding: '0 24px' }}>
      <div className="page-header" style={{ padding: '14px 0 18px' }}>
        <div className="col gap-xs">
          <Eyebrow brand>PROFIL</Eyebrow>
          <PageTitle>Me</PageTitle>
        </div>
      </div>
      <CtaGhost onClick={toggle} aria-label={`Téma váltása (most: ${theme})`}>
        Téma: {theme}
      </CtaGhost>
    </div>
  )
}
