# Tudástár ↔ Tudásgráf szerep-tisztázás — design

**Driver:** mezo-0ap9 · **Dátum:** 2026-08-27 · **Hatókör:** frontend-only (backend, API, adatmodell változatlan)

## 1. A probléma

Két felület kezeli ugyanazt a memóriaréteget, kimondatlan munkamegosztással:

| | **Insights → Tudástár** (`/insights/knowledge`) | **Me → Tudás** (`/me/knowledge`) |
|---|---|---|
| Ma | jelölt-inbox (tény **és** életesemény), tény-lista prompt-vödrökkel, be/ki kapcsoló | összegző sáv, **tények újra listázva kategóriánként**, Profil, Kapcsolatok (gráf-node-ok) + Archivál |

Ebből két konkrét felhasználói törés fakad, mindkettőt élesben produkálta a tulajdonos:

1. **A duplikált ténylista hiányos másolatnak olvas.** A Tudás oldal `Kategóriánként` szekciója
   ugyanazokat a tényeket mutatja, mint a Tudástár, de más kártyával: `×N` visszaigazolás-számláló
   van rajta, kapcsoló nincs. Alatta a Kapcsolatok szekció gráf-node-jai viszont **számláló nélkül,
   Archivál gombbal** jelennek meg — a felhasználó ugyanazon az oldalon két, egymásnak ellentmondó
   kártya-nyelvet lát, és azt a következtetést vonja le, hogy „a megerősített tényekhez elveszett a
   számláló".
2. **Az életesemény-elfogadás némán eltűnik.** Az életesemény-jelöltet a **Tudástárban** hagyod jóvá,
   de az eredmény a **Tudás oldalon** landol, minden visszajelzés és átvezetés nélkül. A kártya
   egyszerűen lekerül a listáról (`useLifeEventActions` → query-invalidálás), a Tudástár tény-száma
   nem nő — a felhasználó élménye: „négyet fogadtam el, egy jelent meg, a többi eltűnt".

**Adatvesztés nincs** — a live DB-ben mind a négy elfogadott tény-jelölt `promoted_fact_id`-t kapott,
és mind az öt aktív `LIFE_EVENT` node megvan. A hiba tisztán információ-architektúra.

## 2. A döntés

**A tényeknek egy gazdája van (Tudástár), a gráfnak egy gazdája van (Tudás oldal), és a kettő
láthatóan össze van kötve.** A két oldalt nem gyúrjuk össze: más kérdésre válaszolnak — a Tudástár
prompt-vödrös listája azt, hogy *„mit kap most a társ"*, a Tudásgráf azt, hogy *„hogyan függ össze,
amit rólam tud"*.

## 3. Változások

### 3.1 A Tudás oldal tisztán a gráfé (`features/me/pages/KnowledgePage.tsx`)

- A `Kategóriánként` szekció **törlődik** — vele a `KnowledgeFactCard` egyetlen használati helye is.
  A `KnowledgeFactCard`-nak ez az **egyetlen** használati helye (ellenőrizve), ezért a komponens
  fájlja is törlendő. A `CategoryHeader` marad — azt a Kapcsolatok szekció is használja.
- Az összegző sáv **marad** (`X tudás · Y kapcsolat`, `N aktív a prompt kontextusban`): ez gráf-szintű
  állapot, nem tény-lista. A `useKnowledge()` hívás emiatt megmarad az oldalon.
- Az összegző sáv alá kerül egy link-sor a Tudástárra: **„Tények kezelése → Tudástár"** (`/insights/knowledge`).
- Változatlan: Profil szekció, Kapcsolatok szekció (Preferenciák / Célok / Életesemények) az
  Archivál gombokkal.

### 3.2 Elfogadás-visszajelzés a Tudástárban (`features/insights/pages/KnowledgeListPage.tsx`)

Az életesemény-jelölt elfogadásakor a kártya **helyén** megerősítő kártya marad:

> **Bekerült a gráfba** · N kapcsolattal
> Megnézed? → **Tudásgráf**

- Az elfogadott jelölt adatai page-szintű lokális state-be kerülnek (`acceptedEvents: Map<id, {title, edgeCount}>`),
  mert a query-invalidálás után a jelölt eltűnik a szerver-listáról. A megerősítés az oldal
  elhagyásáig látható.
- **Mindkét módban azonos** (mock és real): a mock ág is ugyanezt a lokális state-et tölti, így a
  mock-módú vizuális ellenőrzés a valós élményt mutatja.
- **Elvetésnél nincs változás** — a jelölt némán eltűnik, ahogy ma.
- A tény-jelöltek (`FactCandidateCard`) viselkedése **nem változik**: azok eredménye ugyanezen az
  oldalon, a tény-listában jelenik meg, tehát a visszajelzés már ma is megvan.

### 3.3 Kereszt-link a Tudástár tetején

A `KnowledgeExplainer` alá egy halk sor:

> A kapcsolatok és életesemények a **Tudásgráfon** élnek → megnézem

Link a `/me/knowledge`-re. Ez zárja a kört: a felhasználó a jóváhagyás helyéről mindig eljut oda,
ahova a döntése hatott.

## 4. Amit szándékosan NEM csinálunk (YAGNI)

- Nem vezetünk be új API-t, node-típust vagy státuszt.
- Nem visszük át az életesemény-inboxot a Tudás oldalra: a jóváhagyás egy helyen (Tudástár) marad,
  hogy ne kelljen két inboxot pásztázni.
- Nem adunk `×N` számlálót a gráf-node-oknak: egy megtörtént esemény nem erősíthető újra (ezt a
  meglévő `docs/features/me.md` és `insights.md` is így írja le).
- Nem toast/snackbar: az elmúló értesítés pont azt a némaságot hagyná meg, ami a panaszt okozta.

## 5. Tesztelés

- `features/me/pages/KnowledgePage.test.tsx`: a `Kategóriánként` szekcióra vonatkozó assertion
  törlődik/megfordul (nincs többé tény-lista); új teszt a Tudástár-linkre. A Kapcsolatok- és
  Profil-tesztek változatlanul futnak.
- `features/insights/pages/KnowledgeListPage.test.tsx`: új teszt — életesemény-jelölt elfogadása
  után megerősítő kártya jelenik meg a Tudásgráf-linkkel; új teszt a fejléc kereszt-linkjére.
- Gate: FE tesztek **mindkét módban** (`VITE_USE_MOCK=false` is, l. `vite-use-mock-unset-means-mock`
  memória) + `pnpm build`. Backend nem érintett.

## 6. Dokumentáció

- `docs/features/insights.md` és `docs/features/me.md` érintett szakaszai frissülnek: a két felület
  szerep-elhatárolása és az elfogadás → gráf átvezetés kimondva.
