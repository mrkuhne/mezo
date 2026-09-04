import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGoal, useGoalSuggestionPreview, useSuggestionActions } from '@/data/hooks'
import { ApiError } from '@/data/_client/api'
import { GoalSuggestionDiffGrid } from '@/features/me/components/GoalSuggestionDiffGrid'
import { toSuggestionDiffRows } from '@/features/me/logic/goalSuggestionDiff'
import { MozaikPage, PageBody, PageHead, PageHero } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useToast } from '@/shared/ui/ToastProvider'

const REASON: Record<string, string> = {
  phase_change: 'A terhelési szakaszhoz igazított étrendi váltás',
  weekly_correction: 'Heti korrekció a mért trend alapján',
  deload_maintenance: 'Regenerációt támogató deload hét',
}
const HISTORY: Record<string, string> = {
  accepted: 'Alkalmazva', dismissed: 'Elvetve', superseded: 'Elavult',
}
const blockerCopy = (code: string) => code === 'GOAL_DIRECTION_TARGET_CONFLICT'
  ? 'A célsúly nem egyezik a választott céliránnyal. Előbb javítsd a cél beállításait.'
  : 'Ez a javaslat jelenleg nem alkalmazható.'

export function GoalSuggestionPage() {
  const navigate = useNavigate()
  const { suggestionId = null } = useParams<{ suggestionId: string }>()
  const { goalId, pending: goalPending } = useGoal()
  const { preview, pending, refetch } = useGoalSuggestionPreview(goalId, suggestionId)
  const { accept, dismiss, pending: writePending } = useSuggestionActions()
  const { show } = useToast()
  const [stale, setStale] = useState(false)
  const [confirmDismiss, setConfirmDismiss] = useState(false)
  const rows = useMemo(() => preview ? toSuggestionDiffRows(preview) : [], [preview])
  const historical = preview?.status !== 'proposed'
  const canApply = !!preview && preview.status === 'proposed' && preview.canApply
    && !!preview.previewFingerprint && !writePending && !stale
  const range = preview
    ? `W${preview.affectedFromWeek}${preview.affectedToWeek !== preview.affectedFromWeek ? `–${preview.affectedToWeek}` : ''}`
    : ''

  async function apply() {
    if (!goalId || !suggestionId || !preview?.previewFingerprint || !canApply) return
    try {
      await accept(goalId, suggestionId, preview.previewFingerprint)
      show({ kind: 'success', text: 'A cél módosításai alkalmazva.' })
      navigate('/me/goals/weight')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setStale(true)
    }
  }

  async function discard() {
    if (!goalId || !suggestionId) return
    await dismiss(goalId, suggestionId)
    navigate('/me/goals/weight')
  }

  async function refresh() {
    setStale(false)
    await refetch()
  }

  return <MozaikPage tone="coral" className="goal-suggestion-page">
    <PageHead onBack={() => navigate('/me/goals/weight')} label="‹ Cél" />
    {goalPending || pending ? <div className="goal-detail-loading" role="status" aria-label="Betöltés…"><span /><span /><span /></div>
      : !preview ? <EntranceGroup>
        <PageHero icon="i-cel" name="Javaslat" big="Nem található" />
        <PageBody><div className="goal-detail-notice rise">Ez a javaslat már nem érhető el.</div></PageBody>
      </EntranceGroup> : <EntranceGroup replayKey={`${preview.status}-${stale}`}>
        <PageHero icon="i-cel" iconSize={58} name="Javasolt célhangolás" big={REASON[preview.reasonCode] ?? 'Célhangolási javaslat'} sub={`Érintett időszak · ${range}`}>
          <span className={`gs-status gs-status-${preview.status}`}>{preview.status === 'proposed' ? 'Átnézésre vár' : HISTORY[preview.status]}</span>
        </PageHero>
        <PageBody principle="Te döntesz: alkalmazás előtt minden változás ugyanazon a nézeten ellenőrizhető.">
          <div className="gs-section-head rise"><span>Mi változik?</span><b>{range}</b></div>
          <GoalSuggestionDiffGrid rows={rows} />

          {preview.warnings.length > 0 && <section className="gs-message gs-warning rise">
            <strong>Érdemes tudnod</strong>
            {preview.warnings.map(warning => <p key={warning}>{warning}</p>)}
          </section>}
          {preview.blockers.length > 0 && <section className="gs-message gs-blocker rise" role="alert">
            <strong>Előbb ezt rendezd</strong>
            {preview.blockers.map(blocker => <p key={blocker}>{blockerCopy(blocker)}</p>)}
          </section>}
          {stale && <section className="gs-message gs-stale rise" role="alert">
            <strong>Közben változott a célod</strong>
            <p>Frissítsd az előnézetet, hogy ismét a legújabb számokról dönthess.</p>
            <button type="button" className="gs-refresh np-press" onClick={() => void refresh()}>Előnézet frissítése</button>
          </section>}
          {historical ? <section className="gs-history rise">
            <span>{HISTORY[preview.status]}</span>
            <strong>Történeti nézet</strong>
            <p>A javaslat „előtte–utána” hatását látod; innen már nem indítható új alkalmazás.</p>
          </section> : <div className="gs-actions rise">
            <button type="button" className="gs-apply np-press" disabled={!canApply} onClick={() => void apply()}>
              {writePending ? 'Alkalmazás…' : 'Módosítások alkalmazása'}
            </button>
            <button type="button" className="gs-later" disabled={writePending} onClick={() => navigate('/me/goals/weight')}>Most nem</button>
            {!confirmDismiss ? <button type="button" className="gs-dismiss" disabled={writePending} onClick={() => setConfirmDismiss(true)}>Javaslat elvetése</button>
              : <div className="gs-dismiss-confirm" role="group" aria-label="Elvetés megerősítése">
                <span>Biztosan elveted?</span>
                <button type="button" onClick={() => void discard()}>Igen, elvetem</button>
                <button type="button" onClick={() => setConfirmDismiss(false)}>Mégsem</button>
              </div>}
          </div>}
        </PageBody>
      </EntranceGroup>}
  </MozaikPage>
}
