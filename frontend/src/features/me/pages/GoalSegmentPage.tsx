import { useNavigate } from 'react-router-dom'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

export function GoalSegmentPage() {
  const navigate = useNavigate()
  return <MozaikPage tone="gold"><PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" /><EntranceGroup><PageHero icon="i-retegek" name="Aktuális szakasz" /><PageBody><div className="goal-detail-shell rise">A cél szakaszai és a következő váltás.</div></PageBody></EntranceGroup></MozaikPage>
}
