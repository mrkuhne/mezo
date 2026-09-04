import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function GoalPlansPage() {
  const navigate = useNavigate()
  return <MozaikPage tone="sky"><PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" /><EntranceGroup><PageHero icon="i-meso" name="Tervkapcsolatok" /><PageBody><div className="goal-detail-shell rise">Mesociklus, futóblokk és sportterv egy helyen.</div></PageBody></EntranceGroup></MozaikPage>
}
