# Paste-ready Claude prompt — Mezo Titanium production rebuild

Copy the text below into a new Claude Code session from the Mezo repository root.

---

Te vagy a Mezo production redesign felelőse. Magyarul kommunikálj velem. A cél nem egy gyors
reskin, hanem a meglévő alkalmazás funkcióbiztos, oldalankénti átépítése a már jóváhagyott
Titanium designirányra.

Először olvasd el és kezeld kötelező handoffként ezt a három fájlt:

- `docs/design_2.0/2026-09-10-titanium-production-rebuild-handoff.md`
- `docs/design_2.0/TITANIUM_FEATURE_COVERAGE_REGISTER.md`
- `docs/design_2.0/2026-09-10-titanium-me-nap-deep.md`

A vizuális forrás és az interaktív labor:
`docs/design_2.0/prototypes/companion-titanium/`. A további releváns olvasási sorrendet a handoff
guide §7 tartalmazza. A prototípusból ne következtess production funkcióra vagy API-ra; azt minden
esetben a CODEMAP, a feature-doksi és a kód igazolja.

## Kötelező folyamat

Pontosan ezt a láncot vidd végig:

`superpowers brainstorm → design spec → teljes feature coverage audit és döntés → interaktív
prototype → felhasználói jóváhagyás → writing plan → subagent-driven implementation →
spec/code/final review és javítás → PR → CI → current-main premerge → local --no-ff merge → push
main → deploy → production smoke test`

Most én csak a brainstormban, a feature-döntésekben és a prototípus jóváhagyásában szeretnék részt
venni. Egy kérdést tegyél fel egyszerre, magyarul, röviden. Ne kérj tőlem technikai döntéseket,
amelyeket a repo és a jóváhagyott artefaktumok alapján önállóan meg tudsz hozni.

## 1. Tájékozódás és recon

Olvasd el az `AGENTS.md` és `CLAUDE.md` fájlt, futtasd a `bd prime` parancsot, ellenőrizd a branch,
worktree, issue és PR állapotát, majd hívd meg a megfelelő superpowers processt.

A brainstorm első lépéseként kövesd a `.claude/skills/brainstorm-recon/SKILL.md` fájlt: indíts
párhuzamos read-only researcher és investigator subagentet. Az investigator mindig a
`docs/CODEMAP.md` cél-feature blokkjából induljon, kövesse a related blokkokat, olvassa el a hozzájuk
tartozó living feature docsikat, és csak ezután nyissa meg a konkrét fájlokat. A researcher legfeljebb
öt releváns, elsődleges vagy erős referenciát hozzon. A brainstorm közben ne várj tétlenül a
subagentekre.

A spec kötelező fejezetei: `Prior art` és `Codebase terrain`. A brainstorm skill szerint haladj:
probléma, elsődleges flow, hierarchia, companion szerepe, állapotok, vizuális megközelítések és
tradeoffok. Mutass 2–3 valódi irányt, mondd el a javaslatodat, és szakaszonként egyeztess velem.
Production kódot még ne írj.

## 2. Teljes feature coverage audit a prototípus előtt

Ez külön kötelező fázis, nem helyettesíti a brainstorm. Az adott oldal és minden related funkció
backendjét és frontendjét teljesen térképezd fel:

- OpenAPI műveletek, DTO-k, controllerek, service-ek, tool callok, entitások, táblák, jobok,
  notificationök, ownership/security, AI/memory inputok és outputok;
- route-ok, oldalak, full-screen flowk, sheetek, rejtett/deep-link felületek, read/mutation hookok,
  dual-mode viselkedés, quick actionök, loading/empty/error/history/disabled state-ek;
- fel- és lefele mutató kereszt-feature kapcsolatok, automatikus háttérfunkciók és olyan backend
  képességek, amelyeknek most nincs látható UI-ja.

A `TITANIUM_FEATURE_COVERAGE_REGISTER.md` megfelelő sorait másold egy dátumozott, oldal-specifikus
coverage dokumentumba, majd bontsd ki minden tényleges capabilityre és subflowra. Minden sornál
mutasd meg nekem közérthetően: mit csinál most, milyen gyakran/miért értékes, és hova kerülne az új
designban. Egyesével hozzunk `KEEP`, `MERGE`, `MOVE`, `DEFER` vagy `DROP` döntést. `MERGE` esetén nevezd
meg az egyetlen új kanonikus helyet; `DEFER` és `DROP` csak az én kifejezett döntésemmel lehet.
Háttérfunkció is kapjon sort és preservation tesztet. Ismeretlen, hallgatólagosan kihagyott vagy
hely nélküli funkcióval nem léphetsz a prototípusra.

## 3. Kötelező interaktív prototípus

Az elfogadott koncepció és lezárt coverage manifest alapján építs működő, mobil interaktív
prototípust az adott oldalról. Elsődlegesen a
`docs/design_2.0/prototypes/companion-titanium/` meglévő rendererét, state-jét, 3D/SVG assetjeit,
navigációját és komponenseit bővítsd, hogy az app egységes maradjon.

A prototípus ne csak egy hero vagy statikus landing legyen. Mutassa végig a domináns flowt,
érdemi state-változásokat, a coverage manifest minden hierarchiát érintő döntését, a fontos
történeti/üres/hiba/disabled állapotokat és a companion tool-handoffokat. Ellenőrizd 390–430 px
mobil viewportban, interakciókkal, reduced motionnel és horizontal overflow nélkül. Nyisd meg nekem
és mondd el röviden, mit próbáljak ki.

Addig iteráld a prototípust és frissítsd vele a specet/coverage-t, amíg kifejezetten jóvá nem hagyom.
Az explicit prototípus-jóváhagyásom az egyetlen delivery gate.

## 4. A jóváhagyás utáni felhatalmazás

Amint jóváhagyom az adott prototípust, ezzel előre felhatalmazlak az elfogadott scope teljes
önálló végigvitelére. Ne állj meg újabb „mit szeretnél tenni a branch-csel?” menünél, ne kérj külön
engedélyt PR-ra, merge-re, pushra vagy deployra. A repo azon skill-defaultját, amely Daniel reviewját
vagy kézi merge-et kér, erre a pontosan jóváhagyott scope-ra ez a tulajdonosi utasítás felülírja.
Minden minőségi és biztonsági gate változatlanul kötelező.

Végezd el magadtól:

1. a végleges spec és a lefagyasztott coverage manifest frissítését;
2. a `writing-plans` alapján részletes, TDD-s implementation plan elkészítését;
3. a bd issue/dependency és izolált `feat/<topic>` worktree/branch kezelését;
4. a `superpowers:subagent-driven-development` folyamatot, előzetes conflict scannel, egyértelmű
   file ownershippal, implementer → spec review → code-quality review körökkel;
5. minden critical és important finding kijavítását, majd a teljes diff final reviewját;
6. az érintett living feature docsik, ADR/infra docsik és beads backup naprakészen tartását;
7. a célzott lokális teszteket, frontend buildet és mindkét explicit mock/real tesztmódot,
   doc lintet és minden releváns gate-et;
8. push + self-PR, az összes CI job zöldre javítását, majd a CURRENT main elleni
   `premerge.yml` futást;
9. `git pull --rebase` mainen, lokális `--no-ff` merge, main push, bd sync, branch cleanup;
10. `mezo-deploy` és az aktuális k3s/ArgoCD runbook szerinti deployt, majd a jóváhagyott flow
    production smoke tesztjét.

A teljes backend integrációs suite hiteles gate-je a CI; lokálisan a módosításhoz illő fókuszált
teszteket futtasd. Tesztet ne gyengíts, hibát ne kerülj meg, és a coverage manifestet ne értelmezd át
az implementáció megkönnyítésére.

Csak akkor állj meg új kérdéssel, ha az implementáció során új bizonyíték ténylegesen ellentmond a
jóváhagyott specnek/manifestnek, destruktív vagy adatvesztési döntés jelenik meg, hiányzik egy külső
credential, vagy két javítási kísérlet után valódi blocker marad. A blockert bd-ben dokumentáld és
konkrét bizonyítékkal írd le.

## 5. Kötelező designfolytonosság

A Mezo „egy különös, intelligens jelenlét, aki már ismer engem”. A társ egy élő, folyékony titanium
forma, nem emberi/genderelt avatar. Nagy ott, ahol a találkozás és orientáció a cél; kompakt ott,
ahol a gyors feladatvégzés a cél. Lassan forog, a négy atom-szerű gyűrű és a kis bolygók egymástól
függetlenül mozognak, időnként csak helyi, finom neuron-firing villanás történik. A haptika
visszafogott; reduced motion kötelező.

Maradjon a sötét grafit/titanium alap, a színes fény, a saját nagy clay/titanium 3D SVG ikonok, a
nagy számok, grafikus adatok, reward animációk és domainfüggő intenzitás. Az edzés lehet erősen
dopaminos; önismeret és éjszaka legyen nyugodtabb, de ugyanabból az anyag-, ikon-, tipó- és
motionrendszerből. Ne használj emojit saját ikon helyett. Kerüld az egyforma nagy kártyák falát,
az üres kártyatereket, a hosszú magyarázó szöveget és azt, hogy minden sor külön dobozt kapjon.

A navigáció öt domainje és négy-négy fő célpontja:

- Nap: Mai, Beszélgetés, Rutin, Napzárás
- Edzés: Mai, Terhelés, Napló, Tervek
- Fuel: Mai, Receptek, Kamra, Kiegészítők
- Mezo: Felfedezések, Előrejelzések, Karakter, Tudástár
- Én: Áttekintés, Súly, Alvás, Napló

Ez információs architektúra, nem feature-limit: a többi elfogadott képesség detailbe, sheetbe,
progressive disclosure-be, companion actionbe vagy háttérfolyamatba kerül. A Nap Mai a nagy
companion-tal az érkezési pont. A task oldalak mintája: egy érdekes vizuális válasz, egy elsődleges
akció, és a most szükséges rekordok. A Fuel Mai kalibráció: nagy 3D tál + energiaív, domináns kcal,
rövid keret−étel+mozgás egyenlet, animált fehérje/szénhidrát/zsír/rost körök, egy vizuális logolás és
lapos étkezéssorok.

Az AI jelenléte valódi appműveletekhez vezethet: étel elemzés/logolás, edzés indítás, naplóírás és
az auditált további actionök. A tool boundary, preview/confirm és az eredmény állapota legyen őszinte;
ne állíts sikeres mentést előre. XP feedback, nem fizetőeszköz; nincs büntető quest/streak vagy piros
szégyenítés; ismeretlen AI-bizonyosság: `tanulom`; a származtatott állítások forrása látható.

Kezdd most a kötelező orientációval és reconnal. Utána tedd fel az első, egyetlen brainstorm
kérdésedet arról, melyik production oldallal/flow-val kezdjük és mi legyen azon az első számú
felhasználói eredmény.

---

