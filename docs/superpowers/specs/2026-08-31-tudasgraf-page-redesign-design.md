# Tudásgráf oldal áttervezés — kind-rács + kategória-nézet + node-sheet (mezo-2243)

**Dátum:** 2026-08-31 · **Issue:** mezo-2243 · **Oldal:** `/me/knowledge` ([KnowledgePage.tsx](../../../frontend/src/features/me/pages/KnowledgePage.tsx))

## Probléma

A jelenlegi oldal a design_2.0 prototípus (`en-body.html #page-tudas`) hű mása: hero +
összegző + Profil kártya + 6 kind-csoport **flat, teljes kártyás** listában. Minden node
egy teljes `KnowledgeGraphNodeCard` (cím + summary + ≤3 él-sor + Archivál gomb), így
30–50 node-nál az oldal nagyon hosszú scroll — és a gráf növekedésével csak romlik.

## Cél

Áttekintés-először elrendezés: az alapnézet fix, ~1 képernyős, akárhány node van;
a részletek tap-re nyílnak. A Tudástár-határ (mezo-0ap9) érintetlen marad: tények a
Mezo → Tudástár oldalon élnek, itt csak a kapcsolatok.

## Design

### 1. Alapnézet (rács)

Felülről lefelé:

1. **Hero + összegző csík** — változatlan (`PageHero`, `.tud-summary`).
2. **Profil kártya** — változatlan, teljes szélességű `ProfileNodeCard` a rács fölött,
   „Profil" eyebrow-val; ez az egyetlen node, ami mindig közvetlenül látszik.
3. **Kind-rács** — a 6 kategória (`GRAPH_KIND_GROUPS` sorrendben) a Mozaik `Mosaic` +
   `Tile` rácsában (2 oszlop, 3 sor):
   - `wash`: `KIND_WASH[kind]`, `icon`: `KIND_ICON[kind]` — a meglévő
     `knowledgeNodeVisuals` forrásból.
   - `eyebrow`: a kategória magyar neve (Minták, Preferenciák, Célok, Életesemények,
     Szezonok, Belátások).
   - `badge`: a kategória node-száma.
   - `line`: az első node címe a hook-adta sorrendben (minta-cím, nem „legfrissebb" —
     a wire-modellben nincs timestamp); üres kategóriánál `—`.
   - **Üres kategória**: a csempe megjelenik, de halványítva (`opacity`, nem
     kattintható) — a rács stabil, nem rendeződik át új node-nál.
   - Tap → kategória-nézet (lásd 2.).
4. **Footnote** — a meglévő archiválás-footnote (`.ntf-foot`).

### 2. Kategória-nézet (`?kind=<GraphNodeKind>`)

Ugyanaz a route, `useSearchParams`-szal (minta: `WeekAnalysisPage`). Érvényes `kind`
param esetén a Profil kártya + rács HELYETT:

- **Szekció-fejléc**: „‹ Kategóriák" vissza-chip (param törlése), a kategória neve a
  kind-ink színnel + darabszám (a meglévő `CategoryHeader` vizuális nyelve).
- **Kompakt node-sorok**: soronként kind-ikon (clay disc) + cím + él-darabszám
  (`{n} kapcsolat`, 0-nál elmarad). NINCS summary, él-sor és Archivál gomb a sorban.
  Tap → node-sheet (lásd 3.).
- Érvénytelen/ismeretlen `kind` param → alapnézet (rács), nem hiba.
- A hero + összegző + footnote ebben a nézetben is látszik (az oldal kerete stabil).

### 3. Node-részlet sheet

A meglévő `Sheet` komponens (`@/shared/ui/Sheet`), state-ben tartott kiválasztott
node-dal:

- Tartalom: kind-ikon + cím, summary (ha van), a backend-renderelt `topEdges` sorok,
  **Archivál** gomb, alatta a heti-összegzés footnote.
- Archivál → `archive(node.id)` + a sheet animált zárása (a `Sheet` render-function
  `close()`-a). A kiválasztott node eltűnése (archiválás után a hook már nem adja
  vissza) esetén a sheet nem renderel törött állapotot: a selected id-hez tartozó
  node hiánya = sheet zárva.

### 4. Komponensbontás

- `KnowledgePage.tsx` — a nézetváltás (rács ⇄ kategória) + sheet-state gazdája.
- Új: `KindTileGrid` (vagy inline a page-ben, ha kicsi marad), `KindNodeList`
  (kompakt sorok), `NodeDetailSheet` — mind a `features/me/components/` alatt.
- `KnowledgeGraphNodeCard` teljes kártyás formája a rácsos alapnézetből kikerül;
  ha más nem használja, törölhető (a KnowledgeListPage a Tudástár — az NEM ez a
  komponens-készlet, ellenőrizendő implementációkor).
- `ProfileNodeCard`, `knowledgeNodeVisuals`, adatréteg (`useKnowledge`,
  `useKnowledgeGraphNodes`, `useKnowledgeGraphActions`) változatlan.

### 5. Motion

`EntranceGroup` + `.rise` stagger megmarad: alapnézeten a summary → profil → csempék
(csempénként +30ms) → footnote; kategória-nézeten fejléc → sorok. A nézetváltás
(param-változás) új entrance-t játszik.

### 6. Tesztek

`KnowledgePage.test.tsx` frissítése (mock-adatokon):

- Rács renderel: 6 csempe, darabszám-badge-ek, üres kategória halvány és nem nyit.
- Csempe tap → kategória-nézet a helyes node-sorokkal; URL-param beáll.
- `?kind=` közvetlen betöltés → kategória-nézet; érvénytelen param → rács.
- Node-sor tap → sheet a summary + él-sorokkal; Archivál → `archive` hívódik, sheet zár.
- Vissza-chip → rács, param törlődik.
- Profil kártya archiválása változatlanul működik.

## Nem-célok

- Nincs gráf-vizualizáció (mindmap-rajz) — külön feature lenne.
- Nincs keresés/szűrés a kategórián belül.
- Backend/wire változás nincs.
