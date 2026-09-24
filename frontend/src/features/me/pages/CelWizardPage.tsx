import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ContentIcon, Icon3D } from '@/shared/ui/clay'
import { MozaikPage, PageHead, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { useLifeGoalMutations, useLifeGoalPropose } from '@/data/hooks'
import type { IfThenPlan, LifeGoalDimension, LifeGoalFrame, LifeGoalPillarInput, LifeGoalProposeResponse, SignalCatalogEntry } from '@/data/lifegoal/lifegoalApi'
import { DIMENSION_ACCENT, DIMENSIONS, DIMENSION_ORDER, KIND_LABEL } from '@/features/me/logic/lifegoalLabels'
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
  // A failed create used to navigate blindly (or leave the draft with no feedback beyond the
  // global toast) — this keeps the wizard on the summary step with a retry-safe error card.
  const [saveFailed, setSaveFailed] = useState(false)
  const [d, setD] = useState<WizardDraft>({
    title: '', whyText: '', targetDate: '', dimension: 'health', frame: 'unset', useReframe: false,
    pillars: [], obstacle: '', obstacles: [], plans: [], source: null,
  })
  const patch = (p: Partial<WizardDraft>) => setD((cur) => ({ ...cur, ...p }))

  // Step 1 → 2 runs the proposal ONCE (title + why); later steps only edit its result.
  const goToFrame = async () => {
    setStep(1)
    // Known limitation: this one-shot guard means editing (or clearing) the step-0 target date
    // AFTER the initial propose does not re-propose — a target pillar's rule.targetDate can then
    // go stale relative to d.targetDate. A follow-up issue will track re-propose invalidation.
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
    setSaveFailed(false)
    create({
      title: d.title, whyText: d.useReframe && d.reframedWhy ? d.reframedWhy : d.whyText || undefined, frame: d.useReframe ? 'intrinsic' : d.frame,
      dimension: d.dimension, secondaryDimension: d.secondaryDimension, startDate: new Date().toISOString().slice(0, 10),
      targetDate: d.targetDate || undefined, obstacleText: d.obstacle || undefined,
      ifThenPlans: d.plans.filter((p) => p.ha.trim() && p.akkor.trim()).map(({ own: _o, ...rest }) => rest), pillars: activePillars,
    }, {
      onSuccess: (g) => {
        if (!activate) { navigate('/me/goals'); return }
        // Aktiválás-bukás után is a cél-oldalra megyünk: a cél már létezik draftként, a
        // varázslóban maradva egy újrapróba DUPLIKÁLNÁ; a globális toast + a draft állapot mondja el.
        changeStatus(g.id, 'active', {
          onSuccess: () => navigate(`/me/goals/${g.id}`),
          onError: () => navigate(`/me/goals/${g.id}`),
        })
      },
      onError: () => setSaveFailed(true),
    })
  }

  const addFromCatalog = (e: SignalCatalogEntry) => {
    patch({ pillars: [...d.pillars, { ...pillarFromCatalog(e), on: true }] })
    setCatalogOpen(false)
  }

  return (
    <MozaikPage tone="coral" className="enc-page enc-wiz">
      <PageHead glass onBack={() => (step > 0 ? setStep(step - 1) : navigate('/me/goals'))} label={step === 0 ? 'Célok' : STEPS[step - 1]} />
      <PageBody>
        <EntranceGroup replayKey={step}>
          <div className="enc-wizhead rise" style={{ '--d': '0ms' } as React.CSSProperties}>
            <div className="lg-wprog">{STEPS.map((_, i) => <i key={i} className={i <= step ? 'f' : ''} />)}</div>
            <div className="enc-stepl">
              <span className="eyebrow">{String(step + 1).padStart(2, '0')} / 05</span><span className="eyebrow is-lit">{STEPS[step]}</span>
            </div>
          </div>
          <div className="enc-wiztitle rise" style={{ '--d': '40ms' } as React.CSSProperties}>
            <span className="mz-eyebrow">Én · Új cél</span>
            <h1>{TITLES[step]}</h1>
          </div>

          <div className="enc-wizbody rise" style={{ '--d': '80ms' } as React.CSSProperties}>
            {step === 0 && (<>
              <div className="lg-fcard glass"><label className="lg-flabel" htmlFor="lg-title">A cél, a te szavaiddal</label>
                <textarea id="lg-title" className="lg-fin" rows={2} value={d.title} onChange={(e) => patch({ title: e.target.value })} placeholder="pl. Félmaraton tavasszal" /></div>
              <div className="lg-fcard glass"><label className="lg-flabel" htmlFor="lg-why">Miért fontos? · egy mondat</label>
                <textarea id="lg-why" className="lg-fin" rows={2} value={d.whyText} onChange={(e) => patch({ whyText: e.target.value })} /></div>
              <div className="lg-fcard glass"><label className="lg-flabel" htmlFor="lg-date">Határidő · opcionális</label>
                <input id="lg-date" className="lg-fin" type="date" value={d.targetDate} onChange={(e) => patch({ targetDate: e.target.value })} /></div>
            </>)}

            {step === 1 && (proposeFailed ? (
              <div className="lg-fcard glass">
                <span className="lg-flabel">Nem sikerült</span>
                <div className="enc-fcopy">Mezo most nem tudta elolvasni a célt.</div>
                <button type="button" className="cta-primary enc-retry" onClick={() => void goToFrame()}>Újra</button>
              </div>
            ) : proposing || !d.source ? <div className="lg-aiwait">Mezo olvassa a célt…</div> : (<>
              <div className="lg-fcard glass is-lav"><span className="lg-flabel">Mezo olvasata</span><div className="enc-fcopy">{d.frameNote}</div></div>
              {d.frame === 'extrinsic' && d.reframedWhy && (
                <div className={`lg-frame glass ${d.useReframe ? 'ok' : ''}`}>
                  <div className="lb">
                    {d.useReframe
                      ? <span className="enc-mark" role="img" aria-label="rendben"><Icon3D name="t-tick" size={24} /></span>
                      : <span className="enc-mark" role="img" aria-label="figyelmeztetés"><Icon3D name="t-info" size={24} /></span>}
                    <span>{d.useReframe ? 'Belső keret · egészség + képesség' : 'Külső keret'}</span>
                  </div>
                  <p>{d.useReframe ? 'A célod mondata: ' : 'Javaslat: '}<b>„{d.reframedWhy}”</b></p>
                  <div className="enc-chips">
                    <button type="button" className="chip" aria-pressed={d.useReframe} onClick={() => patch({ useReframe: true })}>Egészség-keret · elfogadom</button>
                    <button type="button" className="chip" aria-pressed={!d.useReframe} onClick={() => patch({ useReframe: false })}>Maradjon</button>
                  </div>
                </div>
              )}
              <div className="lg-fcard glass"><span className="lg-flabel">Életterület · Mezo javaslata, átírhatod</span>
                <div className="lg-dimband">{DIMENSION_ORDER.map((dim) => (
                  <button key={dim} type="button" className={`lg-dimchip ${DIMENSIONS[dim].cls} ${d.dimension === dim || d.secondaryDimension === dim ? '' : 'empty'}`}
                    aria-pressed={d.dimension === dim} onClick={() => patch({ dimension: dim, secondaryDimension: d.secondaryDimension === dim ? undefined : d.secondaryDimension })}>
                    <ContentIcon name={DIMENSIONS[dim].icon} size={16} />{DIMENSIONS[dim].label}{d.secondaryDimension === dim ? <b> 2.</b> : null}
                  </button>))}</div>
              </div>
            </>))}

            {step === 2 && (<>
              {d.pillars.map((p, i) => (
                <div key={i} className={`lg-pilcard glass ${p.on ? 'on' : 'off'}`} style={{ '--c': DIMENSION_ACCENT[d.dimension] } as React.CSSProperties}>
                  <ContentIcon name={DIMENSIONS[d.dimension].icon} size={34} />
                  <div className="grow"><b>{p.label}</b><small>{KIND_LABEL[p.kind]} · skill: {p.skillKey}</small></div>
                  <button type="button" className={`lg-togg ${p.on ? 'on' : ''}`} aria-label={`${p.label} ${p.on ? 'ki' : 'be'}`}
                    onClick={() => patch({ pillars: d.pillars.map((x, j) => (j === i ? { ...x, on: !x.on } : x)) })} />
                </div>))}
              <button type="button" className="lg-addrow uv-empty" onClick={() => setCatalogOpen(true)} disabled={d.pillars.length >= 5}>＋ Pillér a katalógusból</button>
              <p className="enc-quiet">Az AI csak a zárt jel-katalógusból választhat · 5 pillér a felső határ.</p>
            </>)}

            {step === 3 && (<>
              <div className="lg-fcard glass"><span className="lg-flabel">Akadály · Mezo javaslatai vagy a sajátod</span>
                <div className="enc-chips">{d.obstacles.map((o) => (
                  <button key={o} type="button" className="chip" aria-pressed={d.obstacle === o} onClick={() => patch({ obstacle: o })}>{o}</button>))}</div>
                <input className="lg-fin enc-gap" value={d.obstacle} onChange={(e) => patch({ obstacle: e.target.value })} placeholder="Mi fog közbejönni?" aria-label="Akadály" />
              </div>
              {d.plans.map((p, i) => (
                <div key={i} className={`lg-plan glass ${p.own ? 'own' : 'on'}`}>
                  <div className="lg-prow"><span className="lg-ifthen ha">HA</span>
                    <textarea className="lg-ptxt" rows={2} value={p.ha} aria-label={`Ha ${i + 1}`} onChange={(e) => patch({ plans: d.plans.map((x, j) => (j === i ? { ...x, ha: e.target.value } : x)) })} /></div>
                  <div className="lg-prow"><span className="lg-ifthen ha akkor">AKKOR</span>
                    <textarea className="lg-ptxt" rows={2} value={p.akkor} aria-label={`Akkor ${i + 1}`} onChange={(e) => patch({ plans: d.plans.map((x, j) => (j === i ? { ...x, akkor: e.target.value } : x)) })} /></div>
                  <div className="lg-pfoot">{p.trigger ? TRIGGER_LABEL[p.trigger.source] ?? p.trigger.source : 'nincs hozzá jelem · ezt te tartod'}<span className="enc-own">{p.own ? 'saját' : 'Mezo javaslata'}</span></div>
                </div>))}
              <button type="button" className="lg-addrow uv-empty" onClick={() => patch({ plans: [...d.plans, { ha: '', akkor: '', own: true }] })} disabled={d.plans.length >= 5}>＋ Még egy ha–akkor</button>
            </>)}

            {step === 4 && (<>
              <div className={`lg-fcard glass enc-sumcard ${DIMENSIONS[d.dimension].cls}`} style={{ '--c': DIMENSION_ACCENT[d.dimension] } as React.CSSProperties}>
                <div className="enc-sumhead">
                  <ContentIcon name={DIMENSIONS[d.dimension].icon} size={40} />
                  <div className="grow"><b>{d.title}</b>
                    <div className="lg-dimband"><span className={`lg-dimchip ${DIMENSIONS[d.dimension].cls}`}><ContentIcon name={DIMENSIONS[d.dimension].icon} size={16} />{DIMENSIONS[d.dimension].label}</span>
                      {d.secondaryDimension && <span className={`lg-dimchip ${DIMENSIONS[d.secondaryDimension].cls}`}><ContentIcon name={DIMENSIONS[d.secondaryDimension].icon} size={16} />{DIMENSIONS[d.secondaryDimension].label}</span>}</div></div>
                </div>
                {(d.useReframe ? d.reframedWhy : d.whyText) && <div className="enc-quote">„{d.useReframe ? d.reframedWhy : d.whyText}”</div>}
                <div className="mz-eyebrow enc-gap">{d.targetDate ? `határidő ${d.targetDate}` : 'nincs határidő'} · {activePillars.length} pillér</div>
              </div>
              <div className="mz-eyebrow enc-sec">Így mérjük · a cél-oldalad így fog kinézni</div>
              {activePillars.map((p, i) => <div key={i} className="lg-sumpil"><Icon3D name="t-ring" size={26} /><div><b>{p.label}</b><small>{KIND_LABEL[p.kind]} · skill {p.skillKey}</small></div></div>)}
              <div className="mz-eyebrow enc-sec">Amire Mezo figyel · {d.plans.filter((p) => p.ha && p.akkor).length} szabály</div>
              {d.plans.filter((p) => p.ha && p.akkor).map((p, i) => <div key={i} className="lg-sumpil"><div><b>HA {p.ha}</b><small>AKKOR {p.akkor}{p.trigger ? ` · ${TRIGGER_LABEL[p.trigger.source] ?? p.trigger.source}` : ' · nincs hozzá jel'}</small></div></div>)}
              <div className="lg-fcard glass is-lav enc-gap"><span className="lg-flabel">Aktiválás után</span>
                <div className="enc-fcopy">Holnaptól a Nap „Célok · ma” csempéjén számol · hétfőnként a Hetiben nyíl + egy mondat · teljesült pillér-nap → XP a skillre. Nincs felső korlát az aktív célokra — ha kettő ugyanazt a pihenőt kéri, Mezo szól.</div></div>
            </>)}
          </div>

          {step === 4 && saveFailed && (
            <div className="enc-wizbody rise" style={{ '--d': '100ms' } as React.CSSProperties}>
              <div className="lg-fcard glass">
                <span className="lg-flabel">Nem sikerült elmenteni</span>
                <div className="enc-fcopy">A cél nem veszett el — próbáld újra, vagy nézd át a pilléreket.</div>
              </div>
            </div>
          )}

          <div className="enc-wizfoot rise" style={{ '--d': '120ms' } as React.CSSProperties}>
            {step < 4 && <button type="button" className="cta-primary" disabled={!canNext || (step === 1 && !d.source)} onClick={() => (step === 0 ? void goToFrame() : setStep(step + 1))}>{step === 0 ? 'Tovább →' : `${STEPS[step + 1]} →`}</button>}
            {step === 4 && (<>
              <button type="button" className="cta-ghost" disabled={saving} onClick={() => save(false)}>Mentés tervezettként</button>
              <button type="button" className="cta-primary" disabled={saving} onClick={() => save(true)}><Icon3D name="t-tick" size={20} />Aktiválás</button>
            </>)}
          </div>
        </EntranceGroup>
      </PageBody>
      {catalogOpen && <PillarCatalogSheet onClose={() => setCatalogOpen(false)} onPick={addFromCatalog} />}
    </MozaikPage>
  )
}
