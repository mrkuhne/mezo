import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function GoalSettingsPage() {
  const navigate = useNavigate()
  return <MozaikPage tone="rose"><PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" /><EntranceGroup><PageHero icon="i-beallitas" name="Cél beállításai" /><PageBody><div className="goal-detail-shell rise">A cél iránya, súlya és időablaka.</div></PageBody></EntranceGroup></MozaikPage>
}
