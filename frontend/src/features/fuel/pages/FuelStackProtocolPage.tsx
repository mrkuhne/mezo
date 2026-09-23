// ============================================================
// Mezo · FuelStackProtocolPage — a Protokoll SAJÁT oldala (Fuel Titanium S2, mezo-g2vl;
// fagyasztott manifeszt D2 protokoll-nézet · D3 protokoll-szerkesztés · D4 étkezési kötések).
//
// Owner-döntés: a Protokoll önálló oldal, mert egy 5–15 tételes stack a hubbal egy görgetésben
// „baromi sok scroll és hasznos info, de ebben a formában nem átlátható" volt. Itt tételenként
// olvasható: mit szedsz, miért, és ki tette a helyére.
//
// Jóváhagyott vizuális referencia: docs/design_2.0/prototypes/companion-titanium/fuel-pages.js
// `protokollPage` (:334) + a fuel-pages.css `.sx-summary` / `.sx-proto-*` blokkjai. Anatómia:
//   összegző sáv (elem · idősáv · kézi elhelyezés) → zónánkénti csoportok kompakt sorokkal →
//   étkezési kötések al-szekció (D4) → az Új elem ajtaja → határvonal.
//
// D3 (szerkesztés) IDE olvad be: egy sor koppintása a meglévő `StackItemSheet`-et nyitja, azaz
// az adag, a zóna-mozgatás, a „+ még egy bevétel", a kézi elhelyezés visszavonása (unpin) és az
// eltávolítás viselkedése VÁLTOZATLAN (mezo-vx9v) — a négy `manage/*` oldal ennek a lapnak a
// szekcióivá olvad, új szerkesztési utat nem írunk.
// D4 (étkezési kötések) a meglévő `matchMealsToStack` + `StackMealMatch` párral jön be.
//
// A protokoll ELŐÁLLÍTÁSÁHOZ nem nyúlunk: `getProtocol` lusta backfill-t ír olvasáskor, és a
// szolgálata tranzakciós marad — ez az oldal csak RENDERELI, amit a `useProtocol` hook ad.
// D7: a `ProtocolViewResponse.history[]` továbbra is állapotba kerül, de NINCS felülete — itt
// sem rendereljük, és a leképezést sem töröljük.
//
// Őszinte-null: ha egy elhelyezéshez a motor nem adott indokot, NEM írunk helyette kitaláltat.
// A betöltési hiba őszinte hibaállapot, nem üres lista.
//
// ÜVEG (mezo-me75u.2; prototypes/uveg-fuel-tobbi.html `protokoll()`): a hős keret nélküli arany
// halo a nagy 3D protokoll-ikonnal; alatta három lapos számcella; minden zóna egy üvegkártya a
// saját színében, benne lapos, hajszál-választott sorok (az indok Mezo hangján, serif dőlttel);
// az étkezési kötések lapos cellában; az Új elem egy lila üveg-sor. Ikonok: Titanium 3D.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFuelDay, useProtocol, useRecipes, useStackDay } from '@/data/hooks'
import { addDays, localDateString } from '@/shared/lib/dates'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { StackPageScaffold } from '@/features/fuel/components/StackPageScaffold'
import { StackMealMatch } from '@/features/fuel/components/StackMealMatch'
import { matchMealsToStack } from '@/features/fuel/logic/matchMealsToStack'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'
import type { StackZoneKey } from '@/data/types'

/** Zóna-arcok a ház tokenjeivel: 3D ikon + az üvegkártya `--c` színe. */
const ZONE_FACE: Partial<Record<StackZoneKey, { icon: Icon3DName; color: string }>> = {
  wake: { icon: 't-dawn', color: 'var(--dv-amber)' },
  breakfast: { icon: 't-sun', color: 'var(--dv-amber)' },
  pre_workout: { icon: 't-dumbbell', color: 'var(--dv-coral)' },
  post_workout: { icon: 't-dumbbell', color: 'var(--dv-coral)' },
  lunch: { icon: 't-bowl', color: 'var(--dv-sage)' },
  dinner: { icon: 't-moon', color: 'var(--dv-sky)' },
  evening: { icon: 't-moon', color: 'var(--dv-lav)' },
  bedtime: { icon: 't-sleep', color: 'var(--dv-lav)' },
}
const FALLBACK_FACE = { icon: 't-supps' as Icon3DName, color: 'var(--dv-sage)' }

export function FuelStackProtocolPage() {
  const navigate = useNavigate()
  const { protocol, pending, error } = useProtocol()
  const { slots } = useStackDay()
  const { recipes } = useRecipes()
  const today = localDateString()
  const { fuel: todayFuel } = useFuelDay(today)
  const { fuel: yesterdayFuel } = useFuelDay(addDays(today, -1))
  const [openEntry, setOpenEntry] = useState<StackDayEntry | null>(null)

  const ready = !pending && !error && protocol.status !== 'none'
  const rows = slots.flatMap(slot => slot.entries)
  const pinnedCount = rows.filter(entry => entry.pinned).length
  const mealMatch = matchMealsToStack(slots, recipes, todayFuel.meals, yesterdayFuel.meals)
  const mealMatchCount = mealMatch.suggestions.length + mealMatch.verdicts.length

  return (
    <StackPageScaffold
      tone="sage" backTo="/fuel/stack" backLabel="‹ Stack" icon="t-protocol"
      name="Protokoll" accent="var(--dv-amber)"
      big={ready ? `${protocol.itemCount} tétel` : undefined}
      sub={ready ? `v${protocol.version} · ${Math.round(protocol.confidence * 100)}% bizalom` : undefined}
    >
      {pending && <div className="stk-detail-state uv-empty">Protokoll betöltése…</div>}
      {error && <div className="stk-detail-state uv-empty">A protokoll most nem tölthető be.</div>}
      {!pending && !error && rows.length === 0 && (
        <div className="stk-detail-state uv-empty">Még nincs protokolltétel.</div>
      )}

      {!pending && !error && rows.length > 0 && (
        <>
          <div className="fsx-summary rise">
            <div><strong>{rows.length}</strong><small>elem</small></div>
            <div><strong>{slots.length}</strong><small>idősáv</small></div>
            <div><strong>{pinnedCount}</strong><small>kézzel elhelyezve</small></div>
          </div>

          {slots.map((slot, index) => {
            const face = ZONE_FACE[slot.zone] ?? FALLBACK_FACE
            return (
              <section
                className="fsx-proto-group glass rise"
                key={`${slot.zone}-${slot.time}`}
                style={{ '--fsx-zone-color': face.color, '--c': face.color, '--i': index + 1 } as React.CSSProperties}
                aria-label={`${slot.label} · ${slot.time}`}
              >
                <div className="fsx-proto-title">
                  <span aria-hidden="true"><Icon3D name={face.icon} size={34} /></span>
                  <strong>{slot.label}</strong>
                  <time>{slot.time}</time>
                  <b>{slot.entries.length}</b>
                </div>
                <ul className="fsx-proto-list">
                  {slot.entries.map(entry => (
                    <li key={entry.occurrenceId} aria-label={entry.name}>
                      <button type="button" className="fsx-proto-line"
                        aria-label={`${entry.name} beállítások`}
                        onClick={() => setOpenEntry(entry)}>
                        <span className="fsx-proto-line-art" aria-hidden="true">
                          <Icon3D name="t-supps" size={28} />
                        </span>
                        <span className="fsx-proto-line-copy">
                          <strong>{entry.name}</strong>
                          <small>{slot.label}{entry.dose ? ` · ${entry.dose}` : ''}</small>
                          {/* Az elhelyezés INDOKA a motorból jön — ha nincs, nem írunk helyette
                              kitaláltat (őszinte-null). */}
                          {entry.reason && <em>{entry.reason}</em>}
                        </span>
                        <span className="fsx-proto-line-end">
                          <b>{entry.dose ?? '—'}</b>
                          <small>{entry.pinned ? 'kézi' : 'auto'}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {/* D4: az étkezési kötések ennek a lapnak az AL-SZEKCIÓJA (a `manage/meals` +
              `/fuel/stack/meals` tartalma), nem külön oldal. */}
          <section className="fsx-proto-meals rise" aria-label="Étkezési kötések">
            <div className="fsx-proto-title">
              <strong>Étkezéshez</strong>
              <b>{mealMatchCount}</b>
            </div>
            {mealMatchCount > 0 ? <StackMealMatch result={mealMatch} /> : (
              <p className="fsx-proto-quiet uv-flat">
                Ha egy tétel zsíros vagy fehérjés étkezést kér, itt jelenik meg a hozzá illő fogás
                és a visszajelzés.
              </p>
            )}
          </section>
        </>
      )}

      <button type="button" className="fsx-poster glass is-setup is-row rise"
        onClick={() => navigate('/fuel/stack/manage/add')}>
        <span className="fsx-poster-art" aria-hidden="true"><Icon3D name="t-gear" size={40} /></span>
        <span className="fsx-poster-copy">
          <strong>Új elem beállítása</strong>
          <small>Megmondom, mennyit vegyél be belőle, mikor és miért.</small>
        </span>
        <b aria-hidden="true">↗</b>
      </button>

      <p className="fsx-note">
        Tájékoztatás, nem orvosi tanács. Gyógyszer mellé mindig kérdezd meg a kezelőorvosod.
      </p>

      {openEntry && <StackItemSheet entry={openEntry} onClose={() => setOpenEntry(null)} />}
    </StackPageScaffold>
  )
}
