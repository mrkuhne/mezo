---
cim: Natív edzéslejátszó
szint: Funkció
terulet: Edzés
allapot: Élesben
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B5]
osszefoglalo: Edzés közben a telefon sorozatról sorozatra vezet — előírt súly, ismétlés és tartalék, pihenő a sorozat értékelésével, három kérdés gyakorlatonként, a végén pedig egy lezáró kép a napodról.
---

## Mit csinál

**Így néz ki edzés közben (B5, 2026-11-17 — a Lágy irány lejátszója, a mostani stílusban):**

- **A lejátszó sötét**, egyetlen élénk színnel. Az arany **csak a rekordoké**.
- **Emelés közben:** a gyakorlat **fényképe**, fölötte az izomcsoport, a neve, **a jegyzeted végig a képernyőn**
  (nem egy gomb mögött), **súly és ismétlés egymás mellett, a tartalék közvetlenül alattuk** — mindhárom
  léptethető **és beírható** (62,5 kg-ot egy gombbal nem lehet) —, a tartalék egyetlen vékony soron —, alattuk a sorozatok **táblázata**: minden sorozatnak saját sora,
  külön oszlopban a súly, az ismétlés és a tartalék, jobb szélen pedig hogy **a tervhez képest** hogyan
  sikerült: **zöld, felfelé mutató nyíl**, ha megvolt a terv vagy több lett, **piros, lefelé mutató nyíl**, ha
  kevesebb, és **arany medál**, ha rekord. Legalul egy nagy gomb: amíg nem nyúlsz a
  számokhoz, az áll rajta „Kész · a terv szerint".
- **Minden más egyetlen „…" mögött van** a gyakorlat mellett — a képernyőn **csak egy ilyen gomb van**:
  jegyzet, **csere**, rekordok, technika, egy szettel több vagy kevesebb, **„Foglalt a gép — mást csinálok most"**,
  későbbre teszem, kihagyom, és az edzés befejezése.
- **Pihenő:** nagy visszaszámláló és egy **csík**, ami fogy (nem kör), fölötte pedig a legfontosabb: **az előbbi
  sorozat értékelése** — rekord · a terv fölött · pontosan a terv · a terv alatt —, mellé egy mondat. Alatta, hogy mi
  következik, és a „+30 mp" és a „Tovább".
- **A három kérdés** (Pumpa · érzed? / Ízületi fájdalom / Akarunk még?) **gyakorlatonként egyszer**, az utolsó
  sorozat után — **soha nem sorozatok között**. Két sorozat közt csak a pihenő van.
- **Edzés közben megteheted:** sorozatot hozzáadsz vagy elveszel, egy kész sorozatot javítasz, gyakorlatot kihagysz
  (az összegzés nem büntet érte), későbbre teszel, **másik gyakorlatra cserélsz**, jegyzetet írsz, vagy korábban befejezed.
- **A csere internetet kér.** Ez az egyetlen ilyen a lejátszóban: a cserélt gyakorlatnak a szerver ad azonosítót,
  és minden utána rögzített sorozat ahhoz tartozik. Ha nincs net, a lap ott helyben meg is mondja, miért nem ment,
  és addig marad nyitva.
- **Ha foglalt a gép:** a „…" menüből kiválasztod, melyik gyakorlatot csinálod most. Ez **nem rendezi át a
  tervet** — ha azzal megvagy, ott folytatod, ahol tartottál.
- **„Kis méretre":** a lejátszó becsukódik, de **az edzés tovább fut** — a menüben „Folytatom" áll.
- **Semmi nem vész el:** amit rögzítesz, az azonnal a telefonra kerül és sorban megy fel a szerverre. Ha a pince
  közepén vagy térerő nélkül, akkor is. Ha az app összeomlik vagy lezárod a telefont, az edzés ott folytatódik.

**A lezárás (B5, 2026-11-17):** egyetlen mozdulat visz végig mindenen — a gömb felkel, a számok nulláról felszámolnak,
a szakaszok sorban érkeznek. Egy mondat arról, milyen nap volt (ez **soha nem szid le**), a nap három száma, az új
rekordjaid aranyban, és a test azokkal az izmokkal, amiket ma megdolgoztattál. Ha kevesebb mozgást kértél a
telefonodon, az egész azonnal a kész állapotában jelenik meg.

**Ami szándékosan kimaradt a Lágy változatból:** az ötcsillagos pontozás, a pontok és a küldetések. A Boop nem
játékosít, és egy edzés itt nincs leosztályozva ötből.

**A régi leírás (ami ebből még nem él):**
1. **Sorozatonként:** a léptető előre kitöltve az előírt súllyal, ismétléssel és tartalékkal (RIR); súlytalan gyakorlatnál csak ismétlés.
2. **Pihenőidő-számláló** sorozatok között.
3. **Gyakorlat-hozzáadás** edzés közben, és a csere **az egész mezociklusra** (a mai napra szóló csere már él).
4. **Gyakorlat utáni visszajelzés:** pumpa (1–4), ízületi fájdalom (1–3), munka mennyisége (1–3) — kihagyható.
5. **Gyakorlat-megjegyzés**, amit legközelebb előre betölt.
6. **Befejezés** záró megjegyzéssel, majd összegzés.

## Hogyan működik
1. A telefon lekéri a mai edzést: a háttérrendszer kiszámolja minden gyakorlat előírt sorozatait (bemelegítés + munkasorozatok),
   az indoklást és a múlt heti viszonyítást (lásd [Progresszió-motor](04-progresszio-motor.md)).
2. **Indítás:** ha már van nyitott edzés, azt folytatja (sosem duplikál). Egyszerre csak egy nyitott edzés lehet, és egy
   mezociklus-nap hetente egyszer teljesíthető (a saját edzésre ez nem vonatkozik).
3. **Minden sorozat** mentésekor az előírás is eltárolódik a ténylegessel együtt — így később őszintén látszik, sikerült-e a terv.
   Közben a rendszer megtanulja, melyik gépen milyen súlyok hiányoznak.
4. A visszajelzés gyakorlatonként egyszer mentődik (felülírható). **Ma nem befolyásolja a következő heti terhelést** — csak az
   AI és a mintafelismerők kapják meg.
5. **Befejezés:** az edzés lezárul, a rendszer kiszámolja az aktív időt, és frissíti a megtanult időzítést (mennyi egy sorozat,
   egy pihenő, egy átállás).
6. A webes appban a sorozatállapot és a pihenőidő a böngészőben él; a Boop ezt Swiftben, saját modellel építi újra.

## Miért így
A háttér minden számot kiszámol, ezért a telefonos lejátszó egyszerű maradhat (kutatás 03 §5). A webes lejátszó oldal nem kerül
át egy az egyben, csak a funkciói.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.timing-profile.enabled` | Be/ki kapcsolja a megtanult időzítési profilt | be |
| `mezo.train.timing.gap-cap-seconds` | Két sorozat közti szünet felső határa az aktív idő számításánál | 300 mp |
| `mezo.train.timing.seed-set-cycle-compound/isolation` | Kezdő becslés egy sorozat+pihenő ciklusra | 180 / 125 mp |
| `mezo.feature.closing-block.enabled` | Rögzített záró gyakorlatpár minden edzés végén | ki |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `workout_session` | Az elvégzett edzés: állapot, kezdés, befejezés, aktív idő, záró megjegyzés, eredet (mezociklus / saját) |
| `exercise_set` | Sorozatok: súly, ismétlés, RIR, oldal, bemelegítő/munka, kihagyva, és az előírt súly/ismétlés pillanatképe |
| `exercise_feedback` | Gyakorlat utáni visszajelzés (pumpa, ízület, munka) |
| `exercise_weight_gap` | Gépenként hiányzó súlyok, amit a rögzítésből tanul |
| `workout_timing_profile` | Megtanult időzítés (sorozat, pihenő, átállás) |

## Mi jön még
- A csere **az egész mezociklusra** (a mai napra szóló már él), és gyakorlat hozzáadása edzés közben.
- B5: Élő tevékenység (lásd [Élő tevékenység](08-elo-tevekenyseg.md)); az óra (lásd [Apple Watch-app](07-apple-watch.md)).
- Nyitott kérdés a tulajdonosnak: a visszajelzés (például erős ízületi fájdalom) befolyásolja-e a terhelést.

## Mi marad ki
Az edzés végi XP-ceremónia és az érmek — lásd [Ami kimarad](12-ami-kimarad.md).
