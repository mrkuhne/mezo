import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLifeGoalMutations, useLifeGoalPropose } from '@/data/hooks'
import type { IfThenPlan, LifeGoalDimension, LifeGoalFrame, LifeGoalPillarInput, LifeGoalProposeResponse, SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'
import { DIMENSIONS, DIMENSION_ORDER, KIND_LABEL } from '@/features/me/logic/lifegoalLabels'
import { PillarCatalogSheet } from '@/features/me/sheets/PillarCatalogSheet'
import { pillarFromCatalog } from '@/features/me/logic/pillarFromCatalog'

// Five-step goal-creation wizard (Task 11, mezo-iizd.1, prototype celok.html #page-wiz):
// Cél → Keret → Pillérek → Ha–akkor → Összegzés (D8/D9). Step 1→2 fires `propose` ONCE
// (title + why); every later step only edits its result (`WizardDraft`). The Összegzés
// preview is honest-state: it describes what WILL be measured in words, never a computed
// number/arrow/percentage (the scorer lands in the next slice).
const STEPS = ['Cél', 'Keret', 'Pillérek', 'Ha–akkor', 'Összegzés'] as const
const TITLES = ['Mit építünk?', 'Miért fontos?', 'Miből mérjük?', 'Mi jön közbe?', 'Így indul'] as const
const TRIGGER_LABEL: Record<string, string> = {
  sport_session_logged: 'sport-napló · másnap szólok', checkin_energy_lte: 'check-in · rögtön utána szólok', ritual_missed: 'napzárás · másnap reggel szólok',
}

interface WizardDraft {
  title: string; whyText: string; targetDate: string
  dimension: LifeGoalDimension; secondaryDimension?: LifeGoalDimension; frame: LifeGoalFrame
  frameNote?: string; reframedWhy?: string; useReframe: boolean
  pillars: (LifeGoalPillarInput & { on: boolean })[]
  obstacle: string; obstacles: string[]; plans: (IfThenPlan & { own: boolean })[]
  source: 'ai' | 'template' | null
}

export function CelWizardPage() {
  const navigate = useNavigate()
  const { propose, pending: proposing } = useLifeGoalPropose()
  const { create, changeStatus, pending: saving } = useLifeGoalMutations()
  const [step, setStep] = useState(0)
  const [catalogOpen, setCatalogOpen] = useState(false)
  // A rejected `propose` used to leave `d.source` null forever: the step-2 spinner ran for good
  // and „Tovább" stayed disabled, stranding the wizard. This flag swaps the spinner for a
  // terminal error card whose retry re-runs `goToFrame` (house loading/empty/error triad).
  const [proposeFailed, setProposeFailed] = useState(false)
  const [d, setD] = useState<WizardDraft>({
    title: '', whyText: '', targetDate: '', dimension: 'health', frame: 'unset', useReframe: false,
    pillars: [], obstacle: '', obstacles: [], plans: [], source: null,
  })
  const patch = (p: Partial<WizardDraft>) => setD((cur) => ({ ...cur, ...p }))

  // Step 1 → 2 runs the proposal ONCE (title + why); later steps only edit its result.
  const goToFrame = async () => {
    setStep(1)
    if (d.source) return
    setProposeFailed(false)
    try {
      const res: LifeGoalProposeResponse = await propose({ title: d.title, whyText: d.whyText || undefined, targetDate: d.targetDate || undefined })
      patch({
        dimension: res.dimension, secondaryDimension: res.secondaryDimension, frame: res.frame, frameNote: res.frameNote, reframedWhy: res.reframedWhy,
        pillars: res.pillars.map((p) => ({ ...p, on: true })), obstacles: res.obstacles, obstacle: res.obstacles[0] ?? '',
        plans: res.ifThenPlans.map((p) => ({ ...p, own: false })), source: res.source,
      })
    } catch {
      // The global mutation-cache toast (QueryProvider) already reports the failure; this only
      // needs to unstick the step so the user can retry instead of watching a dead spinner.
      setProposeFailed(true)
    }
  }

  const activePillars = d.pillars.filter((p) => p.on).map(({ on: _on, ...rest }) => rest)
  const canNext = [d.title.trim().length > 0, true, activePillars.length > 0, true, true][step]

  const save = (activate: boolean) => {
    create({
      title: d.title, whyText: d.useReframe && d.reframedWhy ? d.reframedWhy : d.whyText || undefined, frame: d.useReframe ? 'intrinsic' : d.frame,
      dimension: d.dimension, secondaryDimension: d.secondaryDimension, startDate: new Date().toISOString().slice(0, 10),
      targetDate: d.targetDate || undefined, obstacleText: d.obstacle || undefined,
      ifThenPlans: d.plans.filter((p) => p.ha.trim() && p.akkor.trim()).map(({ own: _o, ...rest }) => rest), pillars: activePillars,
    }, { onSuccess: (g) => { if (activate) { changeStatus(g.id, 'active'); navigate(`/me/goals/${g.id}`) } else navigate('/me/goals') } })
  }

  const addFromCatalog = (e: SignalCatalogEntry) => {
    patch({ pillars: [...d.pillars, { ...pillarFromCatalog(e), on: true }] })
    setCatalogOpen(false)
  }

  return (
    <MozaikPage tone="coral">
      <PageHead onBack={() => (step > 0 ? setStep(step - 1) : navigate('/me/goals'))} label={step === 0 ? '‹ Célok' : `‹ ${STEPS[step - 1]}`} />
      <PageBody>
        <EntranceGroup replayKey={step}>
          <div className="rise" style={{ '--d': '0ms', padding: '6px 24px 0' } as React.CSSProperties}>
            <div className="lg-wprog">{STEPS.map((_, i) => <i key={i} className={i <= step ? 'f' : ''} />)}</div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="eyebrow">{String(step + 1).padStart(2, '0')} / 05</span><span className="eyebrow" style={{ color: 'var(--coral-deep)' }}>{STEPS[step]}</span>
            </div>
          </div>
          <div className="rise" style={{ '--d': '40ms', padding: '6px 24px 4px' } as React.CSSProperties}>
            <span className="mz-eyebrow">Én · Új cél</span>
            <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 600, margin: '4px 0 0' }}>{TITLES[step]}</h1>
          </div>

          <div className="rise" style={{ '--d': '80ms', padding: '8px 24px' } as React.CSSProperties}>
            {step === 0 && (<>
              <div className="lg-fcard"><label className="lg-flabel" htmlFor="lg-title">A cél, a te szavaiddal</label>
                <textarea id="lg-title" className="lg-fin" rows={2} value={d.title} onChange={(e) => patch({ title: e.target.value })} placeholder="pl. Félmaraton tavasszal" /></div>
              <div className="lg-fcard"><label className="lg-flabel" htmlFor="lg-why">Miért fontos? · egy mondat</label>
                <textarea id="lg-why" className="lg-fin" rows={2} value={d.whyText} onChange={(e) => patch({ whyText: e.target.value })} /></div>
              <div className="lg-fcard"><label className="lg-flabel" htmlFor="lg-date">Határidő · opcionális</label>
                <input id="lg-date" className="lg-fin" type="date" value={d.targetDate} onChange={(e) => patch({ targetDate: e.target.value })} /></div>
            </>)}

            {step === 1 && (proposeFailed ? (
              <div className="lg-fcard">
                <span className="lg-flabel">Nem sikerült</span>
                <div style={{ fontSize: 12.5, fontWeight: 300 }}>Mezo most nem tudta elolvasni a célt.</div>
                <button type="button" className="cta-primary" style={{ marginTop: 10 }} onClick={() => void goToFrame()}>Újra</button>
              </div>
            ) : proposing || !d.source ? <div className="lg-aiwait">Mezo olvassa a célt…</div> : (<>
              <div className="lg-fcard"><span className="lg-flabel">Mezo olvasata</span><div style={{ fontSize: 12.5, fontWeight: 300 }}>{d.frameNote}</div></div>
              {d.frame === 'extrinsic' && d.reframedWhy && (
                <div className={`lg-frame ${d.useReframe ? 'ok' : ''}`}>
                  <div className="lb">{d.useReframe ? '✓ Belső keret · egészség + képesség' : '⚠ Külső keret'}</div>
                  <p>{d.useReframe ? 'A célod mondata: ' : 'Javaslat: '}<b>„{d.reframedWhy}”</b></p>
                  <div className="row gap-xs" style={{ marginTop: 8 }}>
                    <button type="button" className="chip" aria-pressed={d.useReframe} onClick={() => patch({ useReframe: true })}>Egészség-keret · elfogadom</button>
                    <button type="button" className="chip" aria-pressed={!d.useReframe} onClick={() => patch({ useReframe: false })}>Maradjon</button>
                  </div>
                </div>
              )}
              <div className="lg-fcard"><span className="lg-flabel">Életterület · Mezo javaslata, átírhatod</span>
                <div className="lg-dimband">{DIMENSION_ORDER.map((dim) => (
                  <button key={dim} type="button" className={`lg-dimchip ${DIMENSIONS[dim].cls} ${d.dimension === dim || d.secondaryDimension === dim ? '' : 'empty'}`}
                    aria-pressed={d.dimension === dim} onClick={() => patch({ dimension: dim, secondaryDimension: d.secondaryDimension === dim ? undefined : d.secondaryDimension })}>
                    <i />{DIMENSIONS[dim].label}{d.secondaryDimension === dim ? <b> 2.</b> : null}
                  </button>))}</div>
              </div>
            </>))}

            {step === 2 && (<>
              {d.pillars.map((p, i) => (
                <div key={i} className={`lg-pilcard ${p.on ? 'on' : 'off'}`}>
                  <ClayIcon name={DIMENSIONS[d.dimension].icon} size={26} />
                  <div style={{ flex: 1 }}><b>{p.label}</b><small>{KIND_LABEL[p.kind]} · skill: {p.skillKey}</small></div>
                  <button type="button" className={`lg-togg ${p.on ? 'on' : ''}`} aria-label={`${p.label} ${p.on ? 'ki' : 'be'}`}
                    onClick={() => patch({ pillars: d.pillars.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })} />
                </div>))}
              <button type="button" className="lg-addrow" onClick={() => setCatalogOpen(true)} disabled={d.pillars.length >= 5}>＋ Pillér a katalógusból</button>
              <p className="mz-eyebrow" style={{ marginTop: 8 }}>Az AI csak a zárt jel-katalógusból választhat · 5 pillér a felső határ.</p>
            </>)}

            {step === 3 && (<>
              <div className="lg-fcard"><span className="lg-flabel">Akadály · Mezo javaslatai vagy a sajátod</span>
                <div className="row gap-xs" style={{ flexWrap: 'wrap' }}>{d.obstacles.map((o) => (
                  <button key={o} type="button" className="chip" aria-pressed={d.obstacle === o} onClick={() => patch({ obstacle: o })}>{o}</button>))}</div>
                <input className="lg-fin" style={{ marginTop: 8 }} value={d.obstacle} onChange={(e) => patch({ obstacle: e.target.value })} placeholder="Mi fog közbejönni?" aria-label="Akadály" />
              </div>
              {d.plans.map((p, i) => (
                <div key={i} className={`lg-plan ${p.own ? 'own' : 'on'}`}>
                  <div className="lg-prow"><span className="lg-ifthen ha" style={{ width: 46 }}>HA</span>
                    <textarea className="lg-ptxt" rows={2} value={p.ha} aria-label={`Ha ${i + 1}`} onChange={(e) => patch({ plans: d.plans.map((x, j) => (j === i ? { ...x, ha: e.target.value } : x)) })} /></div>
                  <div className="lg-prow"><span className="lg-ifthen ha akkor" style={{ width: 46 }}>AKKOR</span>
                    <textarea className="lg-ptxt" rows={2} value={p.akkor} aria-label={`Akkor ${i + 1}`} onChange={(e) => patch({ plans: d.plans.map((x, j) => (j === i ? { ...x, akkor: e.target.value } : x)) })} /></div>
                  <div className="lg-pfoot">{p.trigger ? TRIGGER_LABEL[p.trigger.source] ?? p.trigger.source : 'nincs hozzá jelem · ezt te tartod'}<span style={{ marginLeft: 'auto' }}>{p.own ? 'saját' : 'Mezo javaslata'}</span></div>
                </div>))}
              <button type="button" className="lg-addrow" onClick={() => patch({ plans: [...d.plans, { ha: '', akkor: '', own: true }] })} disabled={d.plans.length >= 5}>＋ Még egy ha–akkor</button>
            </>)}

            {step === 4 && (<>
              <div className={`lg-fcard ${DIMENSIONS[d.dimension].cls}`} style={{ background: 'linear-gradient(140deg, var(--dw), #FFFFFF 72%)' }}>
                <div className="row gap-md" style={{ alignItems: 'flex-start' }}>
                  <ClayIcon name={DIMENSIONS[d.dimension].icon} size={34} />
                  <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>{d.title}</b>
                    <div className="lg-dimband" style={{ marginTop: 4 }}><span className={`lg-dimchip ${DIMENSIONS[d.dimension].cls}`}><i />{DIMENSIONS[d.dimension].label}</span>
                      {d.secondaryDimension && <span className={`lg-dimchip ${DIMENSIONS[d.secondaryDimension].cls}`}><i />{DIMENSIONS[d.secondaryDimension].label}</span>}</div></div>
                </div>
                {(d.useReframe ? d.reframedWhy : d.whyText) && <div className="lg-why q" style={{ margin: '8px 0 0', padding: 0, background: 'none', boxShadow: 'none', border: 'none' }}>„{d.useReframe ? d.reframedWhy : d.whyText}”</div>}
                <div className="mz-eyebrow" style={{ marginTop: 8 }}>{d.targetDate ? `határidő ${d.targetDate}` : 'nincs határidő'} · {activePillars.length} pillér</div>
              </div>
              <div className="mz-eyebrow" style={{ padding: '6px 2px' }}>Így mérjük · a cél-oldalad így fog kinézni</div>
              {activePillars.map((p, i) => <div key={i} className="lg-sumpil"><ClayIcon name="i-cel" size={22} /><div><b>{p.label}</b><small>{KIND_LABEL[p.kind]} · skill {p.skillKey}</small></div></div>)}
              <div className="mz-eyebrow" style={{ padding: '6px 2px' }}>Amire Mezo figyel · {d.plans.filter((p) => p.ha && p.akkor).length} szabály</div>
              {d.plans.filter((p) => p.ha && p.akkor).map((p, i) => <div key={i} className="lg-sumpil"><div><b>HA {p.ha}</b><small>AKKOR {p.akkor}{p.trigger ? ` · ${TRIGGER_LABEL[p.trigger.source] ?? p.trigger.source}` : ' · nincs hozzá jel'}</small></div></div>)}
              <div className="lg-fcard" style={{ marginTop: 8 }}><span className="lg-flabel">Aktiválás után</span>
                <div style={{ fontSize: 11.5, fontWeight: 300 }}>Holnaptól a Nap „Célok · ma” csempéjén számol · hétfőnként a Hetiben nyíl + egy mondat · teljesült pillér-nap → XP a skillre. Nincs felső korlát az aktív célokra — ha kettő ugyanazt a pihenőt kéri, Mezo szól.</div></div>
            </>)}
          </div>

          <div className="rise row gap-sm" style={{ '--d': '120ms', padding: '8px 24px 16px' } as React.CSSProperties}>
            {step < 4 && <button type="button" className="cta-primary" style={{ flex: 1 }} disabled={!canNext || (step === 1 && !d.source)} onClick={() => (step === 0 ? void goToFrame() : setStep(step + 1))}>{step === 0 ? 'Tovább →' : `${STEPS[step + 1]} →`}</button>}
            {step === 4 && (<>
              <button type="button" className="cta-ghost" style={{ flex: 1 }} disabled={saving} onClick={() => save(false)}>Mentés tervezettként</button>
              <button type="button" className="cta-primary" style={{ flex: 1 }} disabled={saving} onClick={() => save(true)}>Aktiválás</button>
            </>)}
          </div>
        </EntranceGroup>
      </PageBody>
      {catalogOpen && <PillarCatalogSheet onClose={() => setCatalogOpen(false)} onPick={addFromCatalog} />}
    </MozaikPage>
  )
}
