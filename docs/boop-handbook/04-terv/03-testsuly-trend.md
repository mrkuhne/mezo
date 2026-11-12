---
cim: Testsúly és trend
szint: Funkció
terulet: Terv
allapot: Részben kész
hol: [iPhone app, Apple Health, Háttérrendszer]
szulo: 00-attekintes
szakasz: [S1, B1, B2, Test]
osszefoglalo: A mérlegelés automatikusan jön az Apple Health-ből, a rendszer kisimított trendet számol belőle, és minden új mérésre újraszámolja a tervet.
---

## Mit csinál
- **Mérlegelés:** az első súlyt a regisztrációkor adod meg; utána a mérleged (például Feelfit) az Apple Health-be ír, és a Boop
  onnan automatikusan átveszi. Kézzel a webes appban is rögzíthetsz.
- **Trend:** a napi ingadozást kisimító súlytrend, heti változás és egy jelzés, mennyire megbízható az adat.
- A Terv és a reggeli összefoglaló a „mért → trend” párt mutatja.

## Hogyan működik
1. A telefon a Health-ből olvassa a testsúlyt (60 napra visszamenőleg, utána csak az újakat). Minden mérés a háttérrendszerbe kerül
   „Apple Health” forrással és a Health azonosítójával, így nem duplikálódik.
2. Egy csomagban érkező mérésekre a súlycél **egyszer** számolódik újra, és Boop csak a mai vagy tegnapi friss mérésre reagál
   (a 60 napos visszatöltés nem áraszt el).
3. **Trend:** exponenciálisan simított átlag (10 napos „felezési idővel”), plusz a heti változás az egész időszakra és az utolsó 4 hétre.
   Az adat „teljes”, ha legalább 21 nap és hetente legalább 4 mérés van; különben „ideiglenes”.
4. Egy napon belüli több mérés átlagolódik.

## Miért így
Kézi beírás helyett a mérleg „magától” jön — ez a reggeli rutin része. A simított trend miatt egy sós vacsora utáni ugrás nem
borítja a tervet.

**Ismert hiányok:** a Health-ben törölt mérés nem számolja újra a célt; a súly tartomány-ellenőrzése hiányzik.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.goal.ewma.half-life-days` | A trend simításának „felezési ideje” | 10 nap |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `weight_log` | Mérlegelések: dátum, kg, megjegyzés, forrás (kézi / Apple Health), Health-azonosító |
| `health_sample` | Minden Health-minta, köztük a testsúly is |

## Mi jön még
- Testösszetétel: háttérben is frissül (nem csak az app megnyitásakor), és a Test kártya mutatja a mérési napokat.
- Mérés szerkesztése és törlése.

## Mi marad ki
Nincs.
