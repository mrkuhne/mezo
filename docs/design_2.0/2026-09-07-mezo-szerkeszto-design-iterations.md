# Mezo-szerkesztő · design-iterációk

**Prototípus:** `prototypes/mezo-szerkeszto.html` (forrás: `prototypes/src/mezo-szerkeszto-{head,body}.html`)
**Spec:** `docs/superpowers/specs/2026-09-07-mezo-szerkeszto-redesign-design.md` · **Issue:** mezo-yty6

## 1. kör — alapváltozat (2026-09-07)

A spec szerinti első építés: két belépő (interjú → generálás → szerkesztő; sablon →
ugyanaz a szerkesztő), horizontális nap-csempesor, Mai+Heti kompakt csempék + alsó
drawerek, inline inputos gyakorlat-kártyák, élő lint (H–K Váll-ütközés), zóna-sávok
irány-nyíllal, snackbar-visszavonás, pointer-drag átrendezés.

## 2. kör — visszajelzések és döntések (2026-09-07)

| Visszajelzés | Döntés / megoldás |
|---|---|
| A Napi terhelés csempe a szerkesztő fő nézetén értelmetlen („honnan tudom, melyik nap?") | A szerkesztőn csak a **Heti terhelés** csempe maradt (teljes szélességben); a **Napi terhelés** csempe a nap-szerkesztő tetejére költözött, a gyakorlat-lista fölé. |
| A terhelés-nézetek drawerben szűkösek | Drawer helyett **teljes Huawei-oldalak**: `page-week` (arany tónus) és `page-daily` (a nap típusa szerinti wash) — poszter-hero clay spottal + count-up nagy számmal, statstrip, izom-washed poszter-kártyák. |
| Heti oldal tartalma | Kártyánként: izom-pill + tier-chip + frekvencia, nagy „13,5 ▲ 22 cél" számsor, zóna-sáv (MV→MEV→MAV→MRV) pulzáló markerrel + cél-vonallal, **W1→deload rámpa-spark** (arany = most, csíkos = deload), státusz-sor, koppintásra gyakorlat-szintű lebontás naponként. Lintek + csúcshét-ellenőrzés az alján. |
| Napi oldal tartalma | Session-cap (~8) elleni sávok izmonként felfutó töltéssel, „közel a plafonhoz" borostyán chip, gyakorlat-hozzájárulás chipek, coach-megjegyzés. |
| Drag&drop nem működött | A pointer-eseményfigyelők a fogantyú helyett a `document`-re kerültek (pointercancel is kezelve) — így a húzás már megbízható. |
| A rep-mezők számai levágódtak | A number-input spinner eltávolítva (`appearance: textfield`), kisebb padding + `min-width: 0` a grid-cellákon, oszloparányok igazítva. |
| Kevés az animáció / élő elem | Count-up hero- és csempeszámok, felfutó izom-sávok (nap-csempe rail stagger + gauge/capbar width-transition), staggerelt `rise` belépés minden új oldalon, lélegző hero-spot (`orb`), pulzáló zóna-marker, rámpa-spark oszlop-animáció. |

Nyitott: további körök a felhasználó vizuális visszajelzései szerint; megállapodás után
a spec frissül és jön a writing-plans.

## 3. kör (2026-09-07)

| Visszajelzés | Döntés / megoldás |
|---|---|
| Nincs térköz a Napi terhelés csempe és a gyakorlat-kártyák között | `.loadtile.day` 10px alsó margót kapott. |
| Drag&drop helyett fel/le nyilak | A ☰ fogantyú és a pointer-drag kikerült; a kártya fejlécében ▲▼ gombpár rendez (a szélső irány letiltva). Ez az app meglévő `SortableList`-viselkedéséhez is közelebb áll. |
| Átrendezéskor az egész oldal „flashelt" és újratöltött | A nap-oldal már nem renderelődik újra szerkesztéskor: csak a kártyalista frissül, animáció nélkül (`renderCards(anim=false)`); a `rise` belépő-choreográfia csak a nap első megnyitásakor fut. A Napi terhelés csempe helyben, élőben frissül. |
