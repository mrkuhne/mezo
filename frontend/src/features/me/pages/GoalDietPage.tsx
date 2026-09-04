import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function GoalDietPage() {
  const navigate = useNavigate()
  return <MozaikPage tone="sage"><PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" /><EntranceGroup><PageHero icon="i-fuel" name="Mai étrendi keret" /><PageBody><div className="goal-detail-shell rise">A mai és a heti keret részletei.</div></PageBody></EntranceGroup></MozaikPage>
}
