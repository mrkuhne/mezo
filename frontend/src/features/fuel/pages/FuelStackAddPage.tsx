// ============================================================
// Mezo · FuelStackAddPage — az adag-beállító (Fuel Titanium S2, mezo-g2vl; manifeszt D3).
//
// Owner-döntés, szó szerint: „az új elem felvétele ÖNÁLLÓ OLDAL, nem felugró, ami drawerbe
// vált" — a korábbi flow azért lett elutasítva, mert „nincs padding, másrészt nem értem a
// flow-t, hogy van egy felugró ablak aztán átváltunk drawerbe". Ezért ez EGY oldal, három
// lépéssel, valódi paddinggal, és egyetlen lépésnél sem nyit modális réteget.
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `beallitasPage` (:354), `setupPick` (:360), `setupFacts` (:369), `setupAdvice` (:384), a
// fuel-pages.css `.sx-steps` / `.sx-pick` / `.sx-field` / `.sx-primary` / `.sx-advice` /
// `.sx-callout` blokkjaival.
//
// Lépések: 1. melyik termék (a Kamrádból · linkről · címkefotóról · kézzel) → 2. a termék tényei
// (beírva, vagy a linkről/fotóról kiolvasva ugyanazzal a beolvasó képességgel, amit a Kamra
// használ) → 3. a javaslat: napi mennyiség, ennyi darab, elhelyezés INDOKKAL, és meddig tart ki.
//
// A határvonal minden adag-felületen ott áll: tájékoztatás, nem orvosi tanács.
//
// ŐSZINTE-NULL a mentésnél: a protokoll-tétel a meglévő add-protocol-item úton megy (így az
// elhelyezés-motor teszi a helyére), ez viszont egy BIRTOKOLT Kamra-tételt kulcsol. A Kamra-
// import végpontja nem adja vissza a létrehozott tétel azonosítóját, ezért egy linkről/fotóról/
// kézzel megadott, a polcon még NEM szereplő terméket nem veszünk fel találgatott azonosítóval:
// megmondjuk, hogy előbb a Kamrába kell kerülnie, és odavisszük. A javaslat ilyenkor is teljes.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePantryActions, useProtocol, useProtocolActions, useStack } from '@/data/hooks'
import { STACK_ZONE_LABEL, STACK_ZONE_ORDER } from '@/data/fuel/stackZones'
import { doseAdvice } from '@/features/fuel/logic/doseAdvice'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import { Icon } from '@/shared/ui/Icon'
import { ClayIcon } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import type { StackZoneKey, SupplementStashItem } from '@/data/types'

const STEPS = ['Termék', 'Adatok', 'Javaslat'] as const
type Source = 'pantry' | 'link' | 'photo' | 'manual'

interface Facts {
  pantryItemId: string | null
  name: string
  perUnit: number | null
  unit: string
  unitForm: string
  container: number | null
}

const EMPTY_FACTS: Facts = {
  pantryItemId: null, name: '', perUnit: null, unit: '', unitForm: 'kapszula', container: null,
}

/** A Kamra-tétel adagjából kiolvassa a termékerősséget, ha a szöveg hordoz ilyet — különben
 *  őszinte-null (nem találunk ki erősséget). */
function strengthFromDose(dose: string | null | undefined): { perUnit: number | null; unit: string } {
  const hit = /([\d.,]+)\s*(NE|IU|mg|µg|mcg|g)\b/i.exec(dose ?? '')
  if (!hit) return { perUnit: null, unit: '' }
  const value = Number(hit[1].replace(',', '.'))
  return { perUnit: Number.isFinite(value) && value > 0 ? value : null, unit: hit[2] }
}

export function FuelStackAddPage() {
  const navigate = useNavigate()
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
  const [readError, setReadError] = useState<string | null>(null)
  const [dailyOverride, setDailyOverride] = useState<number | null>(null)
  const [zone, setZone] = useState<StackZoneKey | null>(null)
  const [manualDose, setManualDose] = useState('')

  const occupied = new Set(occurrences.map(occurrence => occurrence.pantryItemId))
  const free = stash.filter(item => `${item.name} ${item.brand ?? ''}`.toLocaleLowerCase('hu')
    .includes(query.toLocaleLowerCase('hu')))
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
      unitForm: item.form ?? 'kapszula',
      container: item.stock ?? null,
    })
    setManualDose(item.dose ?? '')
    setStep(2)
  }

  const startArm = (next: Source) => {
    setSource(next)
    setFacts(EMPTY_FACTS)
    setReadError(null)
    setStep(2)
  }

  /** Beolvasás a termék linkjéről — UGYANAZ a képesség, amit a Kamra beolvasása használ. */
  const readUrl = async () => {
    if (!url.trim().startsWith('http')) return
    setReading(true)
    setReadError(null)
    try {
      const draft = await scrapeItem(url.trim())
      if (!draft) {
        setReadError('Az oldalról nem tudtam kiolvasni a termék adatait — írd be kézzel.')
        return
      }
      // A beolvasott vázlat a NEVET és a kiszerelést hordozza; az egy egységben lévő hatóanyag-
      // mennyiséget nem — azt őszintén üresen hagyjuk, a mező alatt kérjük.
      setFacts(prev => ({ ...prev, name: draft.name, unit: draft.unit ?? prev.unit }))
    } catch {
      setReadError('Az oldal beolvasása nem sikerült — ellenőrizd a linket, vagy írd be kézzel.')
    } finally {
      setReading(false)
    }
  }

  const readPhoto = async (file: File | null) => {
    if (!file) return
    setReading(true)
    setReadError(null)
    try {
      const draft = await photoExtract(file)
      if (!draft) {
        setReadError('A címkéről nem tudtam kiolvasni a termék adatait — írd be kézzel.')
        return
      }
      setFacts(prev => ({ ...prev, name: draft.name, unit: draft.unit ?? prev.unit }))
    } catch {
      setReadError('A címkefotó beolvasása nem sikerült — írd be kézzel.')
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
      unitForm: String(data.get('unitForm') ?? '').trim() || 'kapszula',
      container: Number(data.get('container')) || null,
    }))
    setDailyOverride(null)
    setZone(null)
    setStep(3)
  }

  /** A mentés a meglévő add-protocol-item úton megy: zóna nélkül az elhelyezés-motor teszi a
   *  helyére, kézi zónával a saját döntés. */
  const save = async (dose: string) => {
    if (!facts.pantryItemId) return
    try {
      await addItem(facts.pantryItemId, { slotKey: zone ?? undefined, dose })
      show({ kind: 'success', text: `${facts.name} hozzáadva` })
      navigate('/fuel/stack/protocol')
    } catch {
      // A globális MutationCache hozza a hibajelzést.
    }
  }

  // S5 (mezo-qt5q): a 2–3. lépés visszaútja a Protokoll-lap (a Kezelés otthona), nem a
  // leváltott `/fuel/stack/manage`.
  const backLabel = step === 1 ? '‹ Stack' : '‹ Protokoll'

  return (
    <StackPageScaffold
      tone="lav"
      backTo={step === 1 ? '/fuel/stack' : '/fuel/stack/protocol'}
      backLabel={backLabel}
      icon="i-beallitas" name="Új elem beállítása"
      big={`${step}/3`} sub={STEPS[step - 1]}
    >
      <ol className="fsx-steps rise" aria-label="A beállítás lépései">
        {STEPS.map((label, index) => (
          <li key={label}
            className={index + 1 === step ? 'is-on' : index + 1 < step ? 'is-done' : undefined}
            aria-current={index + 1 === step ? 'step' : undefined}>
            {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="fsx-setup rise">
          <p className="fsx-lead">
            Melyik terméket állítsuk be? A címkéjéről kiolvasom, mennyi van benne, és megmondom,
            ez mennyi az ajánlott napi mennyiségből.
          </p>
          <label className="fsx-search">
            <Icon name="search" size={15} />
            <span className="sr-only">Keresés a Kamrában</span>
            <input type="search" aria-label="Keresés a Kamrában" value={query}
              onChange={event => setQuery(event.target.value)} placeholder="Név vagy márka…" />
          </label>
          <div className="fsx-picks">
            {free.map(item => (
              <button type="button" className="fsx-pick" key={item.id}
                onClick={() => pickPantry(item)}>
                <span className="fsx-pick-art" aria-hidden="true"><ClayIcon name="i-kiegeszito" size={34} /></span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.brand ? `${item.brand} · ` : ''}{item.dose}</small>
                </span>
                {occupied.has(item.id) && <em className="fsx-pick-flag">a stackben</em>}
                <b aria-hidden="true">›</b>
              </button>
            ))}
            {!pending && free.length === 0 && (
              <p className="fsx-lead is-quiet">Nincs ilyen tétel a Kamrában.</p>
            )}
          </div>
          <p className="fsx-section">Vagy</p>
          <button type="button" className="fsx-pick is-wide" onClick={() => startArm('link')}>
            <span className="fsx-pick-art" aria-hidden="true"><ClayIcon name="i-level" size={34} /></span>
            <span>
              <strong>Termék linkje</strong>
              <small>Bemásolod a webshop oldalát, kiolvasom a termék adatait</small>
            </span>
            <b aria-hidden="true">›</b>
          </button>
          <button type="button" className="fsx-pick is-wide" onClick={() => startArm('photo')}>
            <span className="fsx-pick-art" aria-hidden="true"><ClayIcon name="i-mikro" size={34} /></span>
            <span>
              <strong>Címkefotóról</strong>
              <small>Lefotózod a hátoldalt, kiolvasom, amit a címke mond</small>
            </span>
            <b aria-hidden="true">›</b>
          </button>
          <button type="button" className="fsx-pick is-wide" onClick={() => startArm('manual')}>
            <span className="fsx-pick-art" aria-hidden="true"><ClayIcon name="i-naplo" size={34} /></span>
            <span>
              <strong>Beírom kézzel</strong>
              <small>Ha nincs nálad a termék</small>
            </span>
            <b aria-hidden="true">›</b>
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="fsx-setup rise">
          {source === 'link' && (
            <div className="fsx-arm">
              <label className="fsx-field">
                Termék linkje
                <input name="url" type="url" value={url} placeholder="https://…"
                  onChange={event => setUrl(event.target.value)} />
              </label>
              <button type="button" className="fsx-primary" disabled={reading}
                onClick={() => { void readUrl() }}>
                <span aria-hidden="true"><Icon name="anchor" size={22} /></span>
                <span>{reading ? 'Beolvasom…' : 'Beolvasom'}</span>
                <b aria-hidden="true">✦</b>
              </button>
            </div>
          )}
          {source === 'photo' && (
            <div className="fsx-arm">
              <label className="fsx-field">
                Címkefotó
                <input type="file" accept="image/*" aria-label="Címkefotó"
                  onChange={event => { void readPhoto(event.target.files?.[0] ?? null) }} />
              </label>
              {reading && <p className="fsx-lead is-quiet">Olvasom a címkét…</p>}
            </div>
          )}
          {readError && <p className="fsx-callout is-warn">{readError}</p>}

          <p className="fsx-lead">
            Ezek a termék saját adatai. Ebből számolom ki, hány egység kell naponta — amit nem
            tudok, azt inkább megkérdezem, mint hogy kitaláljam.
          </p>
          <form className="fsx-form" onSubmit={submitFacts}>
            <label className="fsx-field">
              Termék neve
              <input name="name" defaultValue={facts.name} key={`name-${facts.name}`}
                placeholder="Pl. D3-vitamin" required />
            </label>
            <div className="fsx-form-row">
              <label className="fsx-field">
                Egy egységben
                <input name="perUnit" type="number" min="0" step="any"
                  defaultValue={facts.perUnit ?? ''} key={`perUnit-${facts.perUnit ?? ''}`}
                  placeholder="2000" />
              </label>
              <label className="fsx-field">
                Mértékegység
                <input name="unit" defaultValue={facts.unit} key={`unit-${facts.unit}`}
                  placeholder="NE" />
              </label>
            </div>
            <div className="fsx-form-row">
              <label className="fsx-field">
                Kiszerelés
                <input name="unitForm" defaultValue={facts.unitForm} placeholder="kapszula" />
              </label>
              <label className="fsx-field">
                Dobozban
                <input name="container" type="number" min="0" step="1"
                  defaultValue={facts.container ?? ''} key={`container-${facts.container ?? ''}`}
                  placeholder="90" />
              </label>
            </div>
            <button type="submit" className="fsx-primary">
              <span aria-hidden="true"><Icon name="sparkle" size={22} /></span>
              <span>Tovább a javaslathoz</span>
              <b aria-hidden="true">›</b>
            </button>
          </form>
          <button type="button" className="fsx-back-step" onClick={() => setStep(1)}>
            ‹ Másik terméket választok
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="fsx-setup rise">
          {!advice && (
            <>
              <div className="fsx-callout">
                <span aria-hidden="true"><ClayIcon name="i-kiegeszito" size={26} /></span>
                <p>
                  <small>ŐSZINTÉN</small>
                  Ezt a hatóanyagot még nem ismerem, ezért nem találok ki hozzá adagot. Írd be,
                  amit a termék címkéje javasol, és úgy veszem fel.
                </p>
              </div>
              <label className="fsx-field">
                Adag (ahogy szeded)
                <input value={manualDose} placeholder="Pl. 1 kapszula"
                  onChange={event => setManualDose(event.target.value)} />
              </label>
            </>
          )}

          {advice?.unknownProduct && (
            <div className="fsx-callout">
              <span aria-hidden="true"><ClayIcon name="i-kiegeszito" size={26} /></span>
              <p>
                <small>HIÁNYZIK EGY ADAT</small>
                {advice.substance}-ra ismerem az ajánlott napi {advice.range[0]}–{advice.range[1]}{' '}
                {advice.unit} sávot, de azt nem tudom, mennyi van egy egységben — ezért darabszámot
                nem mondok. Írd be, és megmondom, hány kell belőle.
              </p>
            </div>
          )}

          {advice && !advice.unknownProduct && (
            <>
              <div className="fsx-advice">
                <span className="fsx-advice-art" aria-hidden="true"><ClayIcon name="i-kiegeszito" size={56} /></span>
                <strong>{advice.units} {advice.unitForm}</strong>
                <em>naponta</em>
                <p>
                  {advice.daily} {advice.unit} · az ajánlott{' '}
                  <b>{advice.range[0]}–{advice.range[1]} {advice.unit}</b> sávban
                  {advice.matchesTarget ? '' : ' (a termék adagja miatt kerekítve)'}
                </p>
                {advice.days != null && (
                  <span className="fsx-advice-days">A doboz ~{advice.days} napra elég</span>
                )}
              </div>
              <div className="fsx-dose-why">
                <span aria-hidden="true"><ClayIcon name="i-lang" size={24} /></span>
                <p>{advice.reason}</p>
              </div>
              <div className="fsx-tune">
                <span className="fsx-overline">NAPI MENNYISÉG</span>
                <div className="fsx-stepper">
                  <button type="button" aria-label="Kevesebb"
                    onClick={() => setDailyOverride(Math.max(
                      facts.perUnit ?? 1, (advice.daily ?? 0) - (facts.perUnit ?? 1),
                    ))}>−</button>
                  <span><strong>{advice.daily}</strong><small>{advice.unit}</small></span>
                  <button type="button" aria-label="Több"
                    onClick={() => setDailyOverride((advice.daily ?? 0) + (facts.perUnit ?? 1))}>＋</button>
                </div>
              </div>
              <div className="fsx-tune">
                <span className="fsx-overline">MIKOR</span>
                <div className="fsx-zones">
                  {STACK_ZONE_ORDER.map(key => (
                    <button type="button" key={key}
                      aria-pressed={(zone ?? advice.zone) === key}
                      onClick={() => setZone(key)}>{STACK_ZONE_LABEL[key]}</button>
                  ))}
                </div>
              </div>
              {advice.caution && (
                <div className="fsx-callout is-warn">
                  <span aria-hidden="true"><Icon name="warning" size={24} /></span>
                  <p><small>AMIRE FIGYELJ</small>{advice.caution}</p>
                </div>
              )}
            </>
          )}

          {facts.pantryItemId ? (
            <button type="button" className="fsx-primary is-save"
              onClick={() => {
                void save(advice && !advice.unknownProduct
                  ? `${advice.units} ${advice.unitForm} · ${advice.daily} ${advice.unit}`
                  : manualDose.trim())
              }}>
              <span aria-hidden="true"><ClayIcon name="i-stack" size={26} /></span>
              <span>
                Felveszem a protokollba ·{' '}
                {STACK_ZONE_LABEL[zone ?? advice?.zone ?? STACK_ZONE_ORDER[0]]}
              </span>
              <b aria-hidden="true">✓</b>
            </button>
          ) : (
            <div className="fsx-callout">
              <span aria-hidden="true"><ClayIcon name="i-kamra" size={26} /></span>
              <p>
                <small>EGY LÉPÉS MÉG</small>
                A protokoll a Kamrádban lévő termékeket követi, ez pedig még nincs a polcon. Vedd
                fel a Kamrába, és innen egy koppintással a protokollba tehetjük.
              </p>
            </div>
          )}
          {!facts.pantryItemId && (
            <button type="button" className="fsx-primary" onClick={() => navigate('/fuel/kamra')}>
              <span aria-hidden="true"><ClayIcon name="i-kamra" size={26} /></span>
              <span>Felveszem a Kamrába</span>
              <b aria-hidden="true">›</b>
            </button>
          )}
          <button type="button" className="fsx-back-step" onClick={() => setStep(2)}>
            ‹ Vissza az adatokhoz
          </button>
        </div>
      )}

      <p className="fsx-note">
        Tájékoztatás, nem orvosi tanács. Gyógyszer vagy krónikus betegség mellett kérdezd meg a
        kezelőorvosod.
      </p>
    </StackPageScaffold>
  )
}
