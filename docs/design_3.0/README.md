# Mezo — három bejárható UX irány

2026. szeptember 8. · `mezo-88jw.2` · első vizuális iteráció, döntés előtt.

A cél három eltérő élmény kipróbálása azonos feladatokon. A kiinduló [kutatás](../research/queries/mezo-ux-direction.md) és a [jóváhagyott prototípus-scope](../superpowers/specs/2026-09-08-three-ux-prototypes-design.md) rögzíti az indokokat. A production design iránya még nincs kiválasztva.

## Kipróbálás

```sh
cd docs/design_3.0/prototypes
npm ci
npm run dev
```

Összehasonlító oldal: **http://127.0.0.1:5193/**. A felső választó ugyanazt a felületet nyitja meg mindhárom beágyazott, interaktív példányban. A „Kipróbálom” önálló nézetet ad, nagy képernyőn gyors útvonalválasztóval, mobilon teljes szélességben.

| Irány | URL | Saját formanyelv |
| --- | --- | --- |
| Mérték | http://127.0.0.1:5193/?v=measure#home | Papír, műszerjelzések, szerkesztett tipográfia, lapos elválasztók, technikai edzésfelület |
| Ritmus | http://127.0.0.1:5193/?v=rhythm#home | Meleg tónusok, karakteres antikva, személyes következő lépés, napi idővonal |
| Liget | http://127.0.0.1:5193/?v=grove#home | Mély zöld tér, saját SVG-táj és pályák, fényes pontok, hangsúlyos Clay társ |

A cím helyi: azon a gépen működik, ahol a fejlesztői szerver fut. A port nem publikus deployment.

## Mit lehet végigjárni?

Mindhárom irány öt külön megkomponált főfelületet kapott: **Nap, Edzés, Fuel, Mezo, Chat**. További kilenc részletes nézet közös folyamatot használ, az adott irány színeivel, betűivel és felületeivel: edzésnapló, ételkereső/adagválasztó, AI-megfigyelés, heti összkép, napi rutin, karakterbemutató, alvás, napló és célok.

- Edzés: négy gyakorlat, tizenkét sorozat; súly és ismétlés szerkesztése, kész/visszavonás, pihenőszámláló, lezárás és összesítés.
- Étkezés: öt mintaétel, szöveges keresés, szűrés, fél–három adag, naplózás. A napi kcal és makrók frissülnek.
- Folyadék: 250 ml-es gyors naplózás a napi felületekről.
- Mezo: a megfigyelés indoklása és forrásai, megerősítés, heti történet, napló és célok.
- Chat: gépelt üzenetek, három javasolt téma, írásjelzés, a naplózott állapotot felhasználó **előre megírt** válaszok. A mikrofon gomb mintaátiratot tesz a szerkesztőbe; nem rögzít hangot.
- Clay: öt kipróbálható állapot, három méret; az alkalmazásban gondolkodás és siker visszajelzése.

Az állapot irányonként külön, a böngésző localStorage tárolójában marad meg. A „Mock nap visszaállítása” újraindítja az adott variánst. A fejléc visszagombja valódi böngészőelőzményt használ; egy részlet közvetlen megnyitásakor a szülőnézetre visz. Navigáción belül a görgetési helyet is megőrzi, teljes újratöltésen át a görgetési pozíció nincs mentve. Nincs egyedi, rendszer-gesztust elfogó swipe implementáció.

## Karakter és saját grafika

A Clay logó színét, anyagérzetét és egyszerű gömbformáját továbbvivő új karakterdefiníció készült. A szemek, kifejezések és állapotátmenetek a valódi **Bible Strong Avatar Lab** runtime-ban mozognak: `@bible-strong/avatar-react` és `@bible-strong/avatar-core`, rögzített `0.1.0` verzióval. A bőr SVG sugárirányú színátmenetet kap; az alak és a tekintet a rendereré.

Állapotok: `idle`, `listening`, `thinking`, `happy`, `sleeping`. A [letölthető definíció](prototypes/public/mezo-clay.avatar.json) a runtime formátuma; **nem a Studio projektmentése**. A [betöltött definíció](prototypes/src/avatar-definition.json) ugyanazt az adatot tartalmazza.

Az ételillusztrációk, a súlyzó, a műszerjelzések és a Liget táj/pálya SVG-i a prototípus saját grafikái. A kezelőikonok Lucide ikonok. A saját CSS mozgás csökkentett mozgás beállítás mellett kikapcsol; az Avatar Lab szintén figyeli ezt a rendszerbeállítást.

A runtime eredete és licence: [THIRD_PARTY.md](prototypes/THIRD_PARTY.md). A runtime használata ebben a különálló laborban nem döntés a production alkalmazás függőségeiről.

## Technikai határ és folytatás

Önálló React/Vite alkalmazás, külön package-lockkal; nincs import a production frontendből, nincs API-hívás vagy backend. A betűk Google Fonts-ról töltődnek, rendszerbetűs fallbackkel. A teljes alkalmazás forrása a `prototypes/src/` alatt van; `main.jsx` az összehasonlító és közös navigáció, `model.mjs` a mock működés, `shared.jsx` a karakter/chat/grafika, `variants/` a három art direction. Az [integrációs szerződés](prototypes/CONTRACT.md) segít egy új részfolyamat vagy vizuális iteráció hozzáadásában.

Ez funkcionális design-prototípus: nem reprodukálja az összes éles modult, a valódi AI eszközeit, az ételkatalógust, a teljes edzéstervezést vagy az egészségadatok szinkronját. Néhány másodlagos interakció rövid demo-visszajelzést vagy közös részletnézetet nyit. A részletes nézetek most közös kompozíciót használnak, hogy a fő irányok és az alapfolyamatok összevethetők legyenek.

A következő vizuális körben oldalanként érdemes megjelölni, melyik hierarchia, sűrűség, karakterjelenlét és forma működik. A keverés is lehetséges: például Ritmus napi vezetés, Mérték edzésnapló és Liget karaktervilág. A production átvezetés külön döntés és munka a szülő `mezo-88jw` feladatban.

## Ellenőrzés

2026-09-08, Codex böngészőben:

- Mind a 15 főoldal/irány kombináció betöltött, öt navigációs ponttal, 390 × 844 nézetben, dokumentumszintű vízszintes túlcsordulás nélkül.
- A kilenc részletnézet 360 × 800 méretben betöltött, dokumentumszintű vízszintes túlcsordulás nélkül.
- Vizuálisan ellenőrizve: három főoldal összehasonlítva 1440 × 1080 méretben, Ritmus főoldal és Mezo, Mérték edzés, Liget főoldal/Fuel/chat, Clay állapotválasztó.
- Valódi kattintásokkal: 12 sorozat rögzítése és edzés lezárása → 12 sorozat/4 gyakorlat és négy edzéses heti összesítés; 1,5 adag lazac → 2070 kcal/146 g fehérje, visszatérés Fuelre; chat ezt követően 330 kcal fennmaradó keretet látott.
- Alvás → megfigyelés → oldal újratöltése → visszagomb helyesen az Alvásra vitt. A főnézetek közötti váltás és az összehasonlító oldal választója is működött.
- Rutin pipálása/lezárása és karakterállapot választása kipróbálva. A natív iOS PWA swipe gesztus külön készülékes ellenőrzést igényel; itt a browser-history mechanizmust ellenőriztük.

`npm test`: **8/8 pass** (állapot, naplózás, szerkesztés, chat kontextus és magyar témaválasztás). `npm run build`: **pass**. Az Avatar Lab core validátora elfogadta az öt animációs állapotot tartalmazó definíciót.

Repoellenőrzés: `node scripts/lint-docs.mjs --errors-only --quiet` — **0 error**, 3 figyelmeztetés, 14 korábban is fennálló stale jelzés. A teljes doc-lint ezért nem nevezhető zöldnek. `node scripts/gen-codemap.mjs --check` — naprakész. A production frontend és backend nem változott; azok teljes tesztcsomagját ez a prototípusmunka nem futtatja.
