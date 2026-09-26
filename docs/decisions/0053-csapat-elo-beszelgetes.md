# 0053 — Csapat élő beszélgetése: a napi tanács hazaköltözik a chatbe

- **Status:** Accepted
- **Date:** 2026-09-26
- **Driver:** mezo-a9bo7.20 (Act III, spec `docs/superpowers/specs/2026-09-26-csapat-elo-beszelgetes-design.md`)

## Context

A proaktív motor eddig naponta egy `advice` kártyát adott a Nap → Beszélgetés fülre
(`AdviceCardService.deliver`, W5.2/S4 — lásd [`docs/features/companion.md`](../features/companion.md)
§W5.2 és [`docs/features/proactive.md`](../features/proactive.md) „One card per day"): egy csapódás (raise) átfut a súlyozott könyvtár-választón, `AdvicePriority.outranks`
eldönti, hogy felülírja-e a napi rangidőst, és a szöveg egy LLM-hívással (`AdviceProseGenerator`)
készül. A csapat-üzenőfal II. felvonása (`ADR 0052`) a napi kiadást a falra hozta, de a
napközbeni tanácsadás egyetlen kártyán maradt — így egy csapódás és a hozzá tartozó rendeződés
között a user semmit sem lát, és két, egymást átfedő tanács közül csak az egyik él tovább
(„first raise wins”). Az owner 2026-09-26-i brainstormja (D1–D8, spec §2) ezt a modellt elvetette:
a napi kártya helyett a csapat öt tagja **egész nap beszéljen**, minden csapódásra és annak
rendeződésére külön-külön, egy önálló szobában (`/mezo/elo`), amit a fal egy élő sávval jelez.

## Decision

A `companion` réteg **ügy-eseményekkel** (nem közvetlen hívással) beszél a karakter réteghez:
`FlagRaisedEvent` nyit egy ügyet (`TeamChatCast.ownerOf` gazdával, 16 szabály mindegyike
lefedve, tesztelve), az új **`FlagClearedEvent`** (a `FlagTraceWriter` publikálja, amikor egy
szabály nyoma `clear`-re vált) zárja RESOLVED-del; 7 nap nyitva tartás után EXPIRED. Egy sorért
(`TeamChatVoiceWriter`, saját `team_chat` LLM-szegmens, 1 USD/30 nap felhasználói sapka) egy
őrzött LLM-hívás felel — a keret felett vagy hiba esetén sablon-szöveg, `voiced=false`, soha nem
dob kivételt. Kereszt-beszélgetés csak a spec §5.2 gazdatérképén szereplő vendégekre fut (max 1
vendégsor eseményenként), a Szkeptikus csak becsült/hiányzó bemenetnél szólal meg, sosem
rendeződésnél. Push: legfeljebb 2/nap felhasználónként, a második csak akkor, ha az ügy priorása
(`AdvicePriority.outranks`) mindent felülmúl, amit aznap már kiküldtünk; rendeződés soha nem
pusholhat; napi 12 soros biztonsági sapka minden ügyön át. A fal egy élő sávot kap (`LiveStrip`,
`#fal`), a szoba a dedikált `/mezo/elo` route (`TeamChatPage`), a Nap → Beszélgetés fülön a régi
kártya helyén egy sor marad: „A csapat most erről beszél →”. Az esti kiadás egy `team_chat_day`
jelöltet kap (host Mezo, csak ha a napnak volt legalább egy ügye): ügy-szám, rendeződött-szám,
áthúzódó-szám és a napi témák egy sorban, linkkel a napi chatre.

A régi napi kártya útja (`AdviceCardService.deliver` + a hozzá tartozó `InterventionEventListener`)
**megmarad kikapcsolható ágnak**: a `mezo.proactive.advice-card.enabled` kapcsoló (alapból `true`,
élesben most `false`-ra áll a csapat-chat bekapcsolásával együtt, `mezo.feature.team-chat.enabled`
mellett, ugyanabban az `application.yml`-ben — nincs külön k8s env). A könyvtár, a hatásfok-
számítás, az akció-katalógus és az alkalmazó szolgáltatás nem duplikálódik: a chat ugyanazt az
`InterventionService`/`AdviceActionCatalog`/`AdviceApplyService` hármast hívja, amit a kártya is
hívott.

Ez a döntés **felülírja a W5.2 „egy kártya naponta, az első csapódás nyer” részét**
(`AdviceCardService.deliver`'s day-gate + `AdvicePriority.outranks` szupresszió): amíg a csapat-chat
be van kapcsolva, ez a szabály többé nem a felhasználó felé megjelenő tanács kapuja, csak a régi,
kikapcsolt ág belső logikája marad ilyen, ha valaki visszaállítja a kapcsolót.

## Consequences

Minden csapódás és rendeződés saját sorban látszik, a felhasználó a chatben reagál (a trió + a
kártya régi „Alkalmazom” akciói), és a napi push-terhelés kordában marad a 2/nap sapkával. A
`character → companion`/`character → proactive` függőségi irány nem sérül: a chat a `character`
csomagban él, a companion/proactive csak eseményeken és portokon (`TeamChatKnowledgePort`,
`TeamChatInterventionKeySource`) keresztül éri el. A régi kártya rollback-út egy switch-távolságra
marad, de él vele senki sem tesztelt hosszabb távon — ha a csapat-chat éles hibát mutat, a
visszaállás `mezo.feature.team-chat.enabled=false` + `mezo.proactive.advice-card.enabled=true`.

**Rollback-kar (final review M8, `mezo-a9bo7.25`).** Mindkét kulcs az `application.yml`-ben él
(nincs k8s env-felülírás), ezért a visszaállás két környezeti változó a Deploymenten — Spring
relaxed binding, a kötőjel kiesik: `MEZO_FEATURE_TEAMCHAT_ENABLED=false` és
`MEZO_PROACTIVE_ADVICECARD_ENABLED=true`. **A kettő csak együtt billenhet:** csak a chat
kikapcsolása = semmi nem szól egy csapódásra (se ügy, se kártya); csak a kártya visszakapcsolása =
minden csapódás kétszer szól (ügy + kártya). Visszaút a két env törlése. A beépítő teszt
(`TeamChatProductionSwitchIT`) az éles kombinációt (chat be, kártya ki) tartja: pontosan egy
csapódás-figyelő bean létezik.

**Csendes órák és push-kapu (final review C1/I3).** A chat pushja a spec D3 szerint tiszteli a
22:00–07:00 ablakot: az ablak esti részében nyílt ügy nem pushol (és nem fogyaszt a napi keretből),
az éjfél utáni ügy pushol, de a csengetés a csend végéig (legkorábban ébredésig) vár. A `feed`
csatornás könyvtár-bejegyzés soha nem pushol; a `quietHoursExempt` bejegyzés este is szólhat.

## Alternatives considered

**A kártya megtartása, csak a szöveg gazdagítása.** Elvetve az owner D1 döntése szerint: a napi
egy kártya modellje nem tudja megjeleníteni, hogy egy ügy még nyitva van-e vagy már rendeződött,
és nem enged több, egymástól független csapódást egyszerre látni — a súlyozott elemzés (A 3,85 vs
B 3,15, spec §2 D1) a chatet választotta.

**A régi kártya-út azonnali törlése.** Elvetve: a könyvtár, a hatásfok-tanulás és az akció-katalógus
kód szintjén megosztott a két úttal, és a kapcsolóval visszaállítható rollback biztonságosabb, mint
egy külön ág fenntartása — ezért a `mezo.proactive.advice-card.enabled` kapcsoló marad, nem a kód
törlődik.
