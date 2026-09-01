# Fuel · a logolás saját oldala (mezo-bq2t)

**Státusz:** jóváhagyva (2026-09-01) · **Prototípus:** `docs/design_2.0/prototypes/fuel-log-oldal.html`

## 1. Miért

A `/fuel/log` ablak-blokkjain a **Logold / Pótold / ✨ AI** CTA ma *helyben* nyitja ki a
`MealComposer`-t (`grid-template-rows: 0fr → 1fr` well a blokkon belül). Ez akkor volt jó, amikor
egy tételt akartál gyorsan bedobni. Mióta a composer három forrást (Kamra · Recept · ✨ AI),
tétel-kártyákat makró- és tápanyag-cellákkal, recept-finomhangolást és egy összesítő kártyát
hordoz, ez már nem legördülő, hanem egy oldalnyi tartalom egy blokkba gyömöszölve: **kétszintes
görgetés** (az oldal görget, a blokk nő), és a mentés-CTA a tételek alá csúszik.

Emellett egy valódi elrendezési bug is él a logolási úton: a **Kamra- és Recept-picker sorai
összelapulnak** (lásd §4).

## 2. Mit építünk

### 2.1 Új oldal — `/fuel/log/uj`

A blokk CTA-i **navigálnak**, nem nyitnak. Az új oldal ugyanazt a `MealComposer`-t rendereli,
teljes képernyőn.

**URL-szerződés:**

| paraméter | jelentés | hiányzik / érvénytelen |
|---|---|---|
| `d=YYYY-MM-DD` | melyik napra könyvelődik | ma |
| `w=<ablak-kulcs>` | az ablak `tile.key`-e (`"16:30-Uzsonna"`), URL-kódolva | „ablakon kívül" logolás |
| `ai=1` | az ✨ AI panel nyitva indul | zárva |

A `d` ugyanúgy a **[ma−7 .. ma]** ablakra clampel, mint a `/fuel/log` (`MAX_BACK = 7`); ezen kívüli
vagy értelmezhetetlen érték → ma. Egy `w`, amit az adott nap terve nem ismer, **nem hiba**: az oldal
ablakon kívüli logolásra esik vissza (látható MIKOR szegmens), nem fabrikál ablakot.

**Anatómia (prototípus szerint):**

- `PageHead` — „‹ Vissza", a `/fuel/log?d=…`-ra visz, ugyanarra a napra.
- **Fejléc-sáv (`.flognew-head`)** — az ablak ikonja (clay), eyebrow *Logolás* (korall) vagy
  *Pótlás* (arany), cím = az ablak neve (`Uzsonna`) vagy „Ablakon kívül", alcím = `16:30 · ablak`
  vagy „szabad tétel · te választod a mikort", jobbra **nap-chip** (`szep 1. / ma`, múltbeli napon
  aranyban).
- Múltbeli napon **`.flognew-pastnote`**: „Amit itt logolsz, **aug 31.** napra könyvelődik —
  pontszámot is kap."
- **Törzs** — a `MealComposer` változatlanul (`fixedSlot` ablak-indításnál, prefill a terv-recepttel,
  `logDate`/`logTime`/`saveLabel` a múltbeli napra).
- **Ragadós mentés-sáv** — a composer saját akció-sora (`Mégse` / `✓ Logolás · +10 XP`, múltban
  `✓ Pótlás · aug 31.`) az oldal aljára tapad, nem görög a tételek alá.

**Mentés / Mégse** → vissza a `/fuel/log?d=…`-ra ugyanarra a napra (`navigate(..., { replace: true })`,
hogy a böngésző-vissza ne dobjon vissza a már elmentett composerbe).

### 2.2 A ragadós mentés-sáv mechanikája

Nem új API a composeren: a `MealComposer` akció-sora kap egy stabil `logflow-actions` osztályt
(kizárólag horgony, semmi stílus-változás máshol), és **az oldal CSS-e** teszi ragadóssá a saját
görgetőjén belül (`position: sticky; bottom: 0`). A `LogFlowPage` overlay és minden más hívó
pixel-azonos marad — ott az osztály nem kap sticky szabályt.

### 2.3 A `/fuel/log` egyszerűsödése

- A CTA-k `navigate('/fuel/log/uj?…')`-t hívnak; az `aria-expanded` lekerül róluk (már nem nyitnak).
- A helyben nyíló well és állapota törlődik: `openKey` / `aiOnMount` / `openComposer` / `closeComposer`,
  a `WindowBlock` `open` + `children` propja, a `.flog-composer` / `.flog-cin` / `.flog-cbody` markup és
  a hozzá tartozó CSS (a `.flog-blk.is-open` szabályokkal együtt).
- Ami **marad**: nap-léptető, `asPastDayLane`, Pótlás-hangulat, üres-nap ajtó, „Ablakon kívül" blokk,
  `MealScoreSheet`, a `?d=` deep link.

## 3. Amit a változás NEM érint

- `MealComposer` mentési logikája: `loggedAt = offsetIso(logDate, logTime ?? SLOT_DEFAULT_TIME[slot])`
  múltbeli napon, `nowOffsetIso()` ma — bájtazonos.
- `LogFlowPage` overlay és hívói (Kamra-tétel, Recept, Életjel, NapRutin).
- Backend: nincs változás.
- A hub Logolás-csempéje és a tegnapi pótlás-chip (`?d=` továbbra is a listára visz).

## 4. Bug: a picker-sorok összelapulnak

**Tünet:** a Kamra-/Recept-választóban a sorok ~20 px-esre lapulnak, a nevek és a kcal-cellák
levágódnak (a felhasználó képernyőképe); kevés találatnál (szűkített keresés) hibátlan.

**Gyökérok (élőben mérve):** a `.fkp-item` `overflow: hidden`-t visel, a lista pedig egy
`max-height: 400px`-es flex-oszlop. Az `overflow: hidden` nullázza a flex-elem automatikus
`min-height`-jét, így ha a tartalom nem fér a 400 px-be, a flexbox **minden sort összenyom**.
Ellenőrzés: `flex-shrink: 0`-val a sor visszaáll a natív 114 px-re.

**Javítás:** `.fkp-item { flex: none; }` a `prototype.css`-ben — mindkét pickert gyógyítja.

**Regressziós védelem:** a `frontend/tests/visual/layout.spec.ts` (valódi böngésző, mert a jsdom
egyáltalán nem számol layoutot) kap egy esetet: nyisd meg a Kamra-pickert egy telített kamrával, és
minden `.fkp-item` renderelt magassága legyen ≥ 60 px.

## 5. Tesztelés

- **`FuelLogNewPage.test.tsx`** (új): fejléc az ablakból; ismeretlen/hiányzó `w` → ablakon kívüli
  mód (látszik a MIKOR szegmens); `d` clamp (érvényes múlt / jövő / értelmezhetetlen);
  `ai=1` → nyitott AI panel; múltbeli mentés `loggedAt`-je az ablak idejével; mentés/mégse után a
  `/fuel/log?d=…` úticél.
- **`FuelLogPage.test.tsx`** (frissítés): a CTA-k navigálnak a helyes URL-re (ablak-kulcs, `ai=1`,
  `d`); a composer-hez kötött esetek átkerülnek az új oldal tesztjébe; a többi (léptető-határok,
  Pótlás-hangulat, `?d=` clamp, lezárt nap) változatlan.
- **`layout.spec.ts`**: a picker-sor magasság-guard.
- Vizuális goldenek: az új oldal nem kerül be a golden-listába (a meglévő `fuel` képernyők
  változatlanok); ha a `/fuel/log` pixelei mégis mozdulnak a well-markup törlésétől, a goldenek
  mindkét platformon újragenerálódnak.

## 6. Dokumentáció

`docs/features/fuel.md`: a „logolás helyben nyílik" leírás lecserélése az új oldalra (útvonal,
URL-szerződés, ragadós mentés-sáv), plusz a picker-bug rövid nyoma. `docs/CODEMAP.md` újragenerálva.
