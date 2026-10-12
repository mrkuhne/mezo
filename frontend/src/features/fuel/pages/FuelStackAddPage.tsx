// ============================================================
// Mezo · FuelStackAddPage — the dose setup (S2 manifest D3; Folyadék F5, mezo-n4wf5.5).
// Prototype: docs/design_2.0/prototypes/vilagos/fuel.js `stackUj()` (states: stack-uj.1 · .1-nincs · .2 · .2-kezi ·
// .2-link(-olvas -kesz -ures -hiba) · .2-foto(-olvas -ures -hiba) · .3 · .3-kerekitve · .3-ismeretlen · .3-hianyzik ·
// .3-nincspolcon).
//
// Owner decision: adding a new item is ONE PAGE with three local steps — no step opens a modal layer.
//   1. which product (from the pantry · a link · a label photo · by hand) →
//   2. the product's own facts (typed, or read from the link / photo with the same reader the pantry uses) →
//   3. the advice: the daily amount on the recommended band, how many units, where it goes and WHY, how long a box lasts.
// The title bar's back leaves the page on every step (steps 2–3: to Protokoll); the in-page link steps back.
//
// The boundary stands on every dose surface: information, not medical advice.
//
// HONEST NULL on saving: the protocol item goes through the existing add-protocol-item route (so the placement engine
// places it), which keys an OWNED pantry item. The pantry import does not return the created id, so a product that is
// not on the shelf yet is never saved with a guessed id: we say it has to reach the pantry first, and take the user there.
// Unknown ingredient → no dose is made up; known ingredient without the amount per unit → the band only, no count.
// ============================================================
import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePantryActions, useProtocol, useProtocolActions, useStack } from '@/data/hooks'
import { STACK_ZONE_LABEL, STACK_ZONE_ORDER } from '@/data/fuel/stackZones'
import { doseAdvice, fmtAmount } from '@/features/fuel/logic/doseAdvice'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import { Tip } from '@/features/fuel/components/folyadek'
import { useM } from '@/shared/i18n'
import { Acts, Btn, Bub, Card, Hero, Input, Lab, Lk, Note, Pill, Pills, Row, SearchField, Section, Stepper, Txt } from '@/shared/ui/folyadek'
import { useToast } from '@/shared/ui/ToastProvider'
import type { StackZoneKey, SupplementStashItem } from '@/data/types'

const STEP_KEYS = ['product', 'details', 'advice'] as const
type Source = 'pantry' | 'link' | 'photo' | 'manual'
type ReadError = 'errLinkEmpty' | 'errLink' | 'errPhotoEmpty' | 'errPhoto'

interface Facts {
  pantryItemId: string | null
  name: string
  perUnit: number | null
  unit: string
  unitForm: string
  container: number | null
}

// `kapszula` is the stored key of the default form (an enum word, printed through `common.form`).
const DEFAULT_FORM = 'kapszula'
const EMPTY_FACTS: Facts = {
  pantryItemId: null, name: '', perUnit: null, unit: '', unitForm: DEFAULT_FORM, container: null,
}

/** Reads the product strength out of a pantry item's dose text when it carries one — else an honest null. */
function strengthFromDose(dose: string | null | undefined): { perUnit: number | null; unit: string } {
  const hit = /([\d.,]+)\s*(NE|IU|mg|µg|mcg|g)\b/i.exec(dose ?? '')
  if (!hit) return { perUnit: null, unit: '' }
  const value = Number(hit[1].replace(',', '.'))
  return { perUnit: Number.isFinite(value) && value > 0 ? value : null, unit: hit[2] }
}

/** The recommended daily band on a scale from zero to twice its top, with the day's amount as a point on it (prototype
 *  `bandG`). Without `value` it is the band alone. The numbers at the band's ends hide where the point sits on them. */
function DoseBand({ lo, hi, value, valueLabel, label }: {
  lo: number; hi: number; value?: number | null; valueLabel?: string; label: string
}) {
  const id = useId()
  const max = hi * 2
  const x = (v: number) => 12 + (Math.min(Math.max(v, 0), max) / max) * 296
  return (
    <svg className="fk-band" viewBox="0 0 320 90" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--liq1)" /><stop offset="1" stopColor="var(--liq2)" />
        </linearGradient>
      </defs>
      <rect x="12" y="34" width="296" height="26" rx="13" fill="#fff" stroke="rgba(10,42,60,.12)" strokeWidth="1.5" />
      <rect x={x(lo)} y="34" width={x(hi) - x(lo)} height="26" rx="13" fill={`url(#${id})`} opacity=".5" />
      {value !== lo && <text x={x(lo)} y="27" textAnchor="middle">{fmtAmount(lo)}</text>}
      {value !== hi && <text x={x(hi)} y="27" textAnchor="middle">{fmtAmount(hi)}</text>}
      {value != null && (
        <>
          <circle cx={x(value)} cy="47" r="10" fill="#fff" stroke="var(--liq2)" strokeWidth="4.5" />
          <text x={x(value)} y="15" textAnchor="middle" className="big">{valueLabel}</text>
        </>
      )}
    </svg>
  )
}

export function FuelStackAddPage() {
  const navigate = useNavigate()
  const M = useM().fuelKieg
  const formId = useId()
  const fieldId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const { stash, pending } = useStack()
  const { occurrences } = useProtocol()
  const { addItem } = useProtocolActions()
  const { scrapeItem, photoExtract } = usePantryActions()
  const { show } = useToast()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [source, setSource] = useState<Source>('manual')
  const [facts, setFacts] = useState<Facts>(EMPTY_FACTS)
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState('')
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<ReadError | null>(null)
  const [scanned, setScanned] = useState(false)
  const [dailyOverride, setDailyOverride] = useState<number | null>(null)
  const [zone, setZone] = useState<StackZoneKey | null>(null)
  const [manualDose, setManualDose] = useState('')

  const occupied = new Set(occurrences.map(occurrence => occurrence.pantryItemId))
  const free = stash.filter(item => `${item.name} ${item.brand ?? ''}`.toLowerCase()
    .includes(query.toLowerCase()))
  const advice = step === 3
    ? doseAdvice({
      name: facts.name, perUnit: facts.perUnit, unitForm: facts.unitForm,
      container: facts.container, dailyOverride,
    })
    : null

  const pickPantry = (item: SupplementStashItem) => {
    const { perUnit, unit } = strengthFromDose(item.dose)
    setSource('pantry')
    setFacts({
      pantryItemId: item.id,
      name: item.name,
      perUnit,
      unit,
      unitForm: item.form ?? DEFAULT_FORM,
      container: item.stock ?? null,
    })
    setManualDose(item.dose ?? '')
    setStep(2)
  }

  const startArm = (next: Source) => {
    setSource(next)
    setFacts(EMPTY_FACTS)
    setReadError(null)
    setScanned(false)
    setStep(2)
  }

  /** Reading from the product's link — the SAME capability the pantry import uses. */
  const readUrl = async () => {
    if (!url.trim().startsWith('http')) return
    setReading(true)
    setReadError(null)
    setScanned(false)
    try {
      const draft = await scrapeItem(url.trim())
      if (!draft) {
        setReadError('errLinkEmpty')
        return
      }
      // The draft carries the NAME and the packaging; the amount of active ingredient per unit it does not —
      // that stays honestly empty and is asked for in its field.
      setFacts(prev => ({ ...prev, name: draft.name, unit: draft.unit ?? prev.unit }))
      setScanned(true)
    } catch {
      setReadError('errLink')
    } finally {
      setReading(false)
    }
  }

  const readPhoto = async (file: File | null) => {
    if (!file) return
    setReading(true)
    setReadError(null)
    setScanned(false)
    try {
      const draft = await photoExtract(file)
      if (!draft) {
        setReadError('errPhotoEmpty')
        return
      }
      setFacts(prev => ({ ...prev, name: draft.name, unit: draft.unit ?? prev.unit }))
      setScanned(true)
    } catch {
      setReadError('errPhoto')
    } finally {
      setReading(false)
    }
  }

  const submitFacts = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const perUnitRaw = Number(String(data.get('perUnit') ?? '').replace(',', '.'))
    setFacts(prev => ({
      ...prev,
      name: String(data.get('name') ?? '').trim(),
      perUnit: Number.isFinite(perUnitRaw) && perUnitRaw > 0 ? perUnitRaw : null,
      unit: String(data.get('unit') ?? '').trim(),
      unitForm: String(data.get('unitForm') ?? '').trim() || DEFAULT_FORM,
      container: Number(data.get('container')) || null,
    }))
    setDailyOverride(null)
    setZone(null)
    setStep(3)
  }

  /** Saving goes through the existing add-protocol-item route: without a zone the placement engine places it,
   *  with a picked zone it is the user's own decision. */
  const save = async (dose: string) => {
    if (!facts.pantryItemId) return
    try {
      await addItem(facts.pantryItemId, { slotKey: zone ?? undefined, dose })
      show({ kind: 'success', text: M.add.s3.toastAdded(facts.name) })
      navigate('/fuel/stack/protocol', { replace: true })
    } catch {
      // The global MutationCache brings the error message.
    }
  }

  const known = advice && !advice.unknownProduct ? advice : null
  const range = advice ? `${fmtAmount(advice.range[0])}–${fmtAmount(advice.range[1])} ${advice.unit}` : ''
  const dailyText = known ? `${fmtAmount(known.daily ?? 0)} ${known.unit}` : ''
  const saveZone = zone ?? advice?.zone ?? STACK_ZONE_ORDER[0]

  const foot = step === 2
    ? <Btn wide type="submit" form={formId}>{M.add.s2.next}</Btn>
    : step === 3
      ? facts.pantryItemId
        ? (
          <Btn wide onClick={() => {
            void save(known ? `${known.units} ${known.unitForm} · ${known.daily} ${known.unit}` : manualDose.trim())
          }}>{M.add.s3.addToProtocol(STACK_ZONE_LABEL[saveZone])}</Btn>
        )
        : <Btn wide onClick={() => navigate('/fuel/kamra')}>{M.add.s3.addToPantry}</Btn>
      : undefined

  const big = <Bub icon="t-supps" size={64} />
  const note = <Note>{M.common.noteChronic}</Note>
  const backToFacts = <Acts><Lk onClick={() => setStep(2)}>{M.add.s3.back}</Lk></Acts>
  const shelf = !facts.pantryItemId && <Card><Tip icon="t-stack" title={M.add.s3.oneMore}>{M.add.s3.oneMoreText}</Tip></Card>
  const armed = source === 'link' || source === 'photo'

  // S5 (mezo-qt5q): on steps 2–3 the way back is the Protokoll page (where managing lives).
  return (
    <StackPageScaffold
      backTo={step === 1 ? '/fuel/stack' : '/fuel/stack/protocol'}
      name={M.add.title} eyebrow={M.add.eyebrow(step, M.add.steps[STEP_KEYS[step - 1]])} foot={foot}
    >
      <ol className="fk-pb" aria-label={M.add.stepsAria}>
        {STEP_KEYS.map((key, index) => (
          <li key={key}
            className={index + 1 === step ? 'on' : index + 1 < step ? 'done' : undefined}
            aria-current={index + 1 === step ? 'step' : undefined}>
            <i /><small>{M.add.stepLabel(index + 1, M.add.steps[key])}</small>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <>
          <Hero left={big} label={M.add.s1.label} verdict={M.add.s1.verdict} sub={M.add.s1.sub}>
            <div className="fk-srch">
              <SearchField value={query} onChange={setQuery} aria-label={M.add.s1.search} placeholder={M.add.s1.searchPlaceholder} />
            </div>
          </Hero>
          <Section n={1} title={M.add.s1.fromPantry} />
          {(free.length > 0 || !pending) && (
            <Card>
              {free.map(item => (
                <Row key={item.id} icon="t-supps" title={item.name}
                  sub={<>
                    {item.brand ? `${item.brand} · ` : ''}{item.dose}
                    {occupied.has(item.id) && <><br />{M.add.s1.already}</>}
                  </>}
                  onClick={() => pickPantry(item)} />
              ))}
              {!pending && free.length === 0 && <Txt>{M.add.s1.none}</Txt>}
            </Card>
          )}
          <Section n={2} title={M.add.s1.orNew} />
          <Card>
            <Row icon="t-link" title={M.add.s1.link} sub={M.add.s1.linkSub} onClick={() => startArm('link')} />
            <Row icon="t-camera" title={M.add.s1.photo} sub={M.add.s1.photoSub} onClick={() => startArm('photo')} />
            <Row icon="t-journal" title={M.add.s1.manual} sub={M.add.s1.manualSub} onClick={() => startArm('manual')} />
            {note}
          </Card>
        </>
      )}

      {step === 2 && (
        <>
          <Hero left={big} label={M.add.s2.label} verdict={M.add.s2.verdict} sub={M.add.s2.sub} />
          {source === 'link' && (
            <>
              <Section n={1} title={M.add.s2.link} />
              <Card>
                <Input name="url" type="url" aria-label={M.add.s2.link} value={url} placeholder="https://…"
                  onChange={event => setUrl(event.target.value)} />
                <Acts>
                  <Btn sm ghost disabled={reading} onClick={() => { void readUrl() }}>
                    {reading ? M.add.s2.reading : M.add.s2.read}
                  </Btn>
                </Acts>
                {readError && <p className="fo-note fk-warn" role="alert">{M.add.s2[readError]}</p>}
                {scanned && <Note>{M.add.s2.nameRead}</Note>}
              </Card>
            </>
          )}
          {source === 'photo' && (
            <>
              <Section n={1} title={M.add.s2.photo} />
              <Card>
                <input ref={fileRef} className="fk-file" type="file" accept="image/*" aria-label={M.add.s2.photo} tabIndex={-1}
                  onChange={event => { void readPhoto(event.target.files?.[0] ?? null) }} />
                {reading
                  ? <Txt>{M.add.s2.readingLabel}</Txt>
                  : <Acts><Btn sm ghost onClick={() => fileRef.current?.click()}>{M.add.s2.choosePhoto}</Btn></Acts>}
                {readError && <p className="fo-note fk-warn" role="alert">{M.add.s2[readError]}</p>}
                {scanned && <Note>{M.add.s2.nameRead}</Note>}
              </Card>
            </>
          )}

          <Section n={armed ? 2 : 1} title={M.add.s2.product} />
          <Card>
            <form id={formId} onSubmit={submitFacts}>
              <Lab htmlFor={`${fieldId}-name`}>{M.add.s2.name}</Lab>
              <Input id={`${fieldId}-name`} name="name" defaultValue={facts.name} key={`name-${facts.name}`}
                placeholder={M.add.s2.namePlaceholder} required />
              <div className="fk-two">
                <div>
                  <Lab htmlFor={`${fieldId}-per`}>{M.add.s2.perUnit}</Lab>
                  <Input id={`${fieldId}-per`} name="perUnit" type="number" min="0" step="any"
                    defaultValue={facts.perUnit ?? ''} key={`perUnit-${facts.perUnit ?? ''}`} placeholder="2000" />
                </div>
                <div>
                  <Lab htmlFor={`${fieldId}-unit`}>{M.add.s2.unit}</Lab>
                  <Input id={`${fieldId}-unit`} name="unit" defaultValue={facts.unit} key={`unit-${facts.unit}`}
                    placeholder={M.add.s2.unitPlaceholder} />
                </div>
                <div>
                  <Lab htmlFor={`${fieldId}-form`}>{M.add.s2.form}</Lab>
                  <Input id={`${fieldId}-form`} name="unitForm" defaultValue={M.common.form(facts.unitForm, 1)}
                    placeholder={M.add.s2.formPlaceholder} />
                </div>
                <div>
                  <Lab htmlFor={`${fieldId}-box`}>{M.add.s2.box}</Lab>
                  <Input id={`${fieldId}-box`} name="container" type="number" min="0" step="1"
                    defaultValue={facts.container ?? ''} key={`container-${facts.container ?? ''}`} placeholder="90" />
                </div>
              </div>
            </form>
            <Acts><Lk onClick={() => setStep(1)}>{M.add.s2.another}</Lk></Acts>
          </Card>
        </>
      )}

      {step === 3 && !advice && (
        <>
          <Hero left={big} label={M.add.s3.label(facts.name)} verdict={M.add.s3.unknownVerdict} sub={M.add.s3.unknownSub} />
          {shelf}
          <Section n={1} title={M.add.s3.yourDose} />
          <Card>
            <Lab htmlFor={`${fieldId}-dose`}>{M.add.s3.doseField}</Lab>
            <Input id={`${fieldId}-dose`} value={manualDose} placeholder={M.add.s3.dosePlaceholder}
              onChange={event => setManualDose(event.target.value)} />
            {backToFacts}
            {note}
          </Card>
        </>
      )}

      {step === 3 && advice?.unknownProduct && (
        <>
          <Hero className="fk-ghero" label={M.add.s3.label(facts.name)} verdict={M.add.s3.missingVerdict}
            sub={M.add.s3.missingSub(advice.substance, range)}>
            <div className="fk-g"><DoseBand lo={advice.range[0]} hi={advice.range[1]} label={M.add.s3.bandRangeAria(range)} /></div>
          </Hero>
          {shelf}
          <Card>{backToFacts}{note}</Card>
        </>
      )}

      {step === 3 && known && (
        <>
          <Hero className="fk-ghero" label={M.add.s3.label(facts.name)}
            verdict={M.add.s3.verdict(known.units ?? 0, M.common.form(known.unitForm, known.units ?? 0), dailyText)}
            sub={<>
              {known.matchesTarget ? M.add.s3.inRange(range) : M.add.s3.inRangeRounded(range)}
              {known.days != null && <> {M.add.s3.boxLasts(known.days)}</>}
            </>}>
            <div className="fk-g">
              <DoseBand lo={known.range[0]} hi={known.range[1]} value={known.daily} valueLabel={dailyText}
                label={M.add.s3.bandAria(dailyText, range)} />
            </div>
          </Hero>
          {shelf}
          <Section n={1} title={M.add.s3.why} />
          <Card><Tip icon="t-bolt" title={STACK_ZONE_LABEL[known.zone]}>{known.reason}</Tip></Card>
          <Section n={2} title={M.add.s3.tune} />
          <Card>
            <Lab>{M.add.s3.daily}</Lab>
            <Stepper name={M.add.s3.daily} value={dailyText}
              onDec={() => setDailyOverride(Math.max(
                facts.perUnit ?? 1, (known.daily ?? 0) - (facts.perUnit ?? 1),
              ))}
              onInc={() => setDailyOverride((known.daily ?? 0) + (facts.perUnit ?? 1))} />
            <Lab>{M.add.s3.when}</Lab>
            <Pills role="group" aria-label={M.add.s3.when}>
              {STACK_ZONE_ORDER.map(key => (
                <Pill key={key} on={(zone ?? known.zone) === key} onClick={() => setZone(key)}>{STACK_ZONE_LABEL[key]}</Pill>
              ))}
            </Pills>
            {known.caution && <p className="fo-note fk-warn"><b>{M.add.s3.watch}</b> {known.caution}</p>}
            {backToFacts}
            {note}
          </Card>
        </>
      )}
    </StackPageScaffold>
  )
}
