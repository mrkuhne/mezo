# Mezo — felismerésből használható közös tudás

Driver: `mezo-88jw.3`. A prototípus a [CODEMAP](../CODEMAP.md) Mezo, insight, character és companion részei, majd a kapcsolódó feature-dokumentumok működési és fájltérkép szakaszai alapján készült. Az új felület a jelenlegi funkciók értelmezhető útját vizsgálja; nem production átvezetés.

## Megőrzött különbségek

A Minták megfigyelései nem automatikusan igaz állítások. A bemutató megkülönbözteti a döntésre váró, figyelt, megerősített, adatgyűjtés alatt álló, kapcsolatot nem mutató és elvetett megfigyeléseket. A részlet jelentés/bizonyíték/előzmény hármasra bomlik. Megerősítéskor visszakereshető tudástári tény keletkezik; ismételt megerősítés nem készít másolatot. A tény külön javítható és kikapcsolható.

Az Előrejelzésekben a még nyitott jóslat nem kerül bele az eredményességi arányba. A felhasználó a bemutatóban kimenetelt és megjegyzést adhat; a lista és a lezárt darabszám frissül. A valódi automatikus kiértékelést ez nem reprodukálja.

A Karakter a felhasználó dossziéja. Hét életterület mellé önellenőrzés és életszakasz meta-dimenzió kerül. Egy dimenzióból a konkrét állításokig, azok eredetéig és visszajelzéséig lehet lemenni. A csapat, egy teljes szeptember 8-i mintakonzílium és a feldolgozási nézet kiegészítő magyarázatként nyílik; nem foglalják el a Mezo napi központját. Az elvetett állítás megőrzi a történetet, az aktív portréban már nem szerepel.

A Tudástár kereshető tényeket, jelölteket és kikapcsolt elemeket mutat. A kategóriák kapcsolatai egyszerű, bejárható térképet kapnak. A kommunikációs rész a hangot, részletességet és bejelentkezési preferenciát őrzi; a chat a részletességet és a bekapcsolt tudás állapotát használja.

## Részletesebb történet

A Heti felületen külön történet, napok és területi mutatók vannak. A korábbi hét saját dátumokat és befagyasztott példákat használ; a részletek megőrzik az archív periódust. Az aktuális héten a naplózott mérések és mozgások jelennek meg. A hiányzó történeti háttéradatok szemléltető adatok, nem AI által pótolt mérések.

A kísérletek a mintákhoz kapcsolódó, elfogadható javaslatból indulnak, majd naponta követhetők és lezárhatók. A memoár olvasható fejezet és saját naplóhoz vezető út. A memóriaoldal a forrás, a tartós tény és a változó értelmezés külön szerepét magyarázza.

## A karakteres irány működése

A `Mezo veled` főoldal közérzetválasza megváltoztatja a javasolt következő eszközt. A fáradtság nem írja felül észrevétlenül az edzéstervet: külön választható a regeneráció hangsúlya. Mezo helyi megjegyzései az egyes domainoldalakon folytatják ezt a személyes hangot, miközben a rögzítőeszközök közvetlenül is elérhetők.

A globális chat előre megírt, állapotot olvasó válaszokkal működik. Az akciók konkrét útvonalat és azonosítót visznek tovább. A kérdés és a válasz helyben megmarad. A Clay színe és animációs állapota a közös rendererben egységes; a Karakter dosszié ettől külön funkció marad.

## Megvalósítás és korlát

`prototypes/src/flows/InsightFlow.jsx` a nézetek és az exportált útvonaltérkép; `insight-state.mjs` az állapotátmenetek és a heti pillanatkép; `lab-app.jsx` a kezdőélmény és navigáció; `exploration-model.mjs` a chat/értesítés és más keresztfunkciós kapcsolat. A tesztek az állítás/tény életciklust, az eredményesség nevezőjét, archív izolációt és a naplóváltozások hatását vizsgálják.

A minták és a szakértői szövegek kézzel szerkesztett példák. Az adatforrás- és detektornézet néhány jellemző feldolgozási lépést mutat, nem teljes production futásvizsgálót. A Tudástár kapcsolattérképe egyszerű kategóriabejárás; nincs gráfelrendező motor. A prototípus elegendő az információs hierarchia és az útvonalak kipróbálására, a következtetések valódiságának megítélésére nem szolgál.
