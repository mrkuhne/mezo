# Alvás-reakció: kizárólag esemény-vezérelt (mezo-qn3z)

**Dátum:** 2026-09-02
**bd:** `mezo-qn3z`
**Státusz:** elfogadott

## 1. A probléma

Mezo minden hajnalban 05:45-kor `Mezo · alvás` push-t küld, ami az **előző** éjszakát
narrálja *mai* éjszakaként. Reggel az előző éjszakai alvás visszanézése értéktelen — alvásról
csak akkor kell üzenet, amikor a felhasználó ténylegesen logolt egy alvást.

### Gyökérok

Három, önmagában védhető döntés együtt termeli a hibát:

1. `CompanionMessageJob.runMorning()` (05:45, `mezo.proactive.feed.morning-cron`) a reggeli
   üzenet után **feltétel nélkül** meghívja `generateSleepReaction`-t minden usernek. Az eredeti
   indok (`docs/features/proactive.md` §"Crons", a companion-feed spec §5) az volt, hogy lefedje a
   *„cron előtt logolt alvás"* esetét.
2. `CompanionMessageGenerator.generateSleepReaction` frissesség-kapuja
   `sleep.getDate().isAfter(date.minusDays(2))`, azaz a **tegnapi** dátumú alvás-log is „friss".
   05:45-kor a mai éjszaka még nincs rögzítve, tehát a tegnapi rekord megy be a promptba.
3. A prompt (`SLEEP_PROMPT`) kimondja: *„Daniel most rögzítette a ma éjszakai alvását"* — az LLM-nek
   nincs esélye észrevenni, hogy a payload egy 24 órával korábbi éjszakáról szól.

A push oldalán `AnchorResolver.sleepReactionAnchor` a sor **saját generálási percére** horgonyoz
(event-kind: nincs fix napi slotja), ami a cron-ág miatt pontosan 05:45 lesz. Ez különbözteti meg
a reggeli eligazítástól, ami az ébredésre (~06:00) horgonyzódik és `renderWithoutBiometrics`-szel
gyűjt, tehát alvás-adatot nem is lát.

## 2. A megoldás

**Az alvás-reakció event-kind — kizárólag az marad.** A `generateSleepReaction` cron-hívása
törlődik a `runMorning()`-ból. Az üzenet ezután egyetlen úton születik:
`CompanionMessageEventListener.onSleepLogged` — `@Async`, `@TransactionalEventListener(AFTER_COMMIT)`
a `SleepLogSavedEvent`-en, azaz pontosan akkor és csak akkor, amikor egy alvás-log valóban
perzisztálódott.

A cron-ág eltávolítása nem hagy lyukat: a „cron előtt logolt alvás" esetben (pl. 05:30-as logolás)
az event listener már 05:30-kor lefutott és a sort létrehozta; a cron ilyenkor úgyis csak a
`findByCreatedByAndMessageDateAndKind` idempotencia-ágra futott be. A cron-hívás tehát vagy
felesleges volt, vagy éppen a hibás üzenetet gyártotta.

### Amit szándékosan NEM változtatunk

- **`generateSleepReaction` `>= today - 1` kapuja marad.** Egy héttel később pótolt éjszaka
  továbbra sem szül üzenetet. A listener saját guardja (`event.date().isBefore(today.minusDays(1))`)
  ezt tükrözi; a generátoré védelmi mélységként marad, minden más hívó ellen.
- **A prompt, a ref-jelöltek, a `render` (nem `renderWithoutBiometrics`) használata** — az alvás
  a téma, ez helyes.
- **`AnchorResolver.sleepReactionAnchor`** — a generálási perc marad az őszinte horgony; a fix után
  az a perc a tényleges logolás perce lesz, nem 05:45.
- **A reggeli / midday / evening kron-ágak** és a lusta `ensureTodayCronKinds` miss-recovery
  (ami event-kindet eleve sosem generál).

## 3. Változások

| Fájl | Változás |
|---|---|
| `CompanionMessageJob.java` | A `generateSleepReaction` try/catch blokk törlése a `runMorning()`-ból; az osztály-javadocból a „+ the sleep reaction right after… cron előtt logolt alvás" mondat kivezetése, helyette explicit indoklás, **miért nincs** ott (különben szükségszerűen az előző éjszakát narrálná mai éjszakaként). |
| `CompanionMessageJobIT.java` | `testRunMorning_shouldAlsoGenerateSleepReaction_whenFreshSleepLogAlreadyExists` megfordul → `testRunMorning_shouldNotGenerateSleepReaction_evenWhenFreshSleepLogExists`: friss alvás-log mellett is üres marad `KIND_SLEEP`, miközben `KIND_MORNING` létrejön. |
| `docs/features/proactive.md` | A `generateSleepReaction`, a `CompanionMessageJob` és a képesség-tábla `Crons` sorának átírása: az alvás-reakció kizárólag esemény-vezérelt, a hozzá tartozó okkal. |

`CompanionMessageGenerator`, `CompanionMessageEventListener`, `AnchorResolver`, a konfiguráció és a
frontend érintetlen.

## 4. Tesztelés

- **Fordított IT** (fent) — ez a regressziós horgony: bizonyítja, hogy a hajnali cron nem szül
  alvás-üzenetet.
- **Változatlanul zöld:** `CompanionMessageGeneratorIT` négy `generateSleepReaction` tesztje
  (a generátor nem változik), a listener tesztjei, a `CompanionMessageJobIT` többi esete
  (morning/midday/evening/idempotencia).
- Fókuszált futtatás lokálban Testcontainers módban; a teljes suite a CI self-PR kapuja.

## 5. Kockázat

Alacsony. Egy hívás törlése egy cron-ágból; a helyettesítő út (event listener) már éles és tesztelt.
A legrosszabb eset: ha az `@Async` listener elbukik egy logolásnál, aznap nem lesz alvás-üzenet —
korábban ezt a hajnali cron *másnap* pótolta volna, de éppen rossz tartalommal. A néma hiányzás
őszintébb, mint a téves narratíva.
