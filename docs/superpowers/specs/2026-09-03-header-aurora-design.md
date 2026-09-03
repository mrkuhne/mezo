# AppHeader vizuális újratervezés — aurora sáv, sticky, oldalcím + clay spot

- **bd:** mezo-8az6
- **Dátum:** 2026-09-03
- **Prototípus:** [`docs/design_2.0/prototypes/header-aurora.html`](../../design_2.0/prototypes/header-aurora.html) (jóváhagyva)
- **Érintett feature-doc:** `docs/features/_platform-design-system.md`, `docs/features/today.md`

## 1. A probléma

A shell fejléce (`AppHeader`) funkcionálisan kész, de vizuálisan „oda van biggyentve": egy
dátum-eyebrow és négy kerek gomb egy üres sávon. Nincs benne szín, grafika, se hierarchia, és
görgetéskor egyszerűen eltűnik — az értesítés és az üzenetek csak visszagörgetéssel érhető el.

## 2. Amit építünk

Egysoros, kitapadó fejléc, amely alatt egy napszak-követő **aurora** háttérréteg ül finom
grafikával, alul kifakulva a tartalomba. Bal oldalon az aktuális szekció neve egy clay spot
ikonnal, jobb oldalon a jelenlegi hat elem változatlan sorrendben és viselkedéssel.

### 2.1 Elrendezés

```
[spot] Edzés            (?)  (napszak)  (üzenetek²)  (értesítések³)  (orb)
└─ aurora háttér: wash + 2 fényfolt + napszak-grafika, alul maszkkal kifakulva ─┘
```

- A jobb oldali gombsor **változatlan**: sorrend, ikonok, popoverek, a11y-szerződés, `?dp=`
  szemantika — mind marad. Ez a redesign nem nyúl a viselkedéshez.
- A dátum-eyebrow **kikerül**: a felhasználó a dátumot a telefon státuszsávján látja. A helyét
  a szekciónév veszi át.
- Egysoros marad: nincs köszöntés, nincs második sor.

### 2.2 A szekciónév és a spot

115 route van; route→cím tábla karbantarthatatlan lenne. A címke ezért **szekció-szintű**, a
path első szegmenséből:

| Path-prefix | Címke | Spot |
|---|---|---|
| `/nap` | Nap | `s-reggel` |
| `/train` | Edzés | `s-edzes` |
| `/fuel` | Fuel | `s-fuel` ⟵ **új** |
| `/mezo` | Mezo | `s-orb-figyel` |
| `/me` | Én | `s-en` ⟵ **új** |

A spot 30px, a címke 19px/800 súly, a kettő között 8px rés; a bal blokk `flex: 1`, a címke
elipszissel csonkol, ha kevés a hely.

Ismeretlen prefix (`/ritual`, `/auth`, jövőbeli szekció) esetén a fejléc a bal oldalt üresen
hagyja — a gombsor a helyén marad. Nincs találgatás, nincs crash.

A mélyoldalak pontos címét továbbra is a saját `PageHead`/`PageHero`-juk adja; a fejléc a
szekciót jelöli („hol vagyok"), nem az oldalt. Így egy új route sem igényel táblabővítést.

**A `s-orb-figyel` választás oka:** a Mezo szekcióhoz kézenfekvő `s-orb` betűre ugyanaz, mint a
jobb szélső profil-avatar — két azonos korall golyó egy sorban. A „figyelő" változat (arany
hullámokkal) megkülönböztethető, és a Mezo-hoz jelentésben is illik.

### 2.3 Aurora háttér

A fejléc mögé kerülő `.app-head-bg` réteg (`pointer-events: none`), három rétegben:

1. **Wash** — napszak-tónusú lineáris gradiens (`--mzh-wash-{reggel,nap,este}`).
2. **Két elmosott fényfolt** — a sáv látható részébe pozicionálva, `filter: blur(30px)`.
3. **Napszak-grafika** — dekoratív inline SVG: reggel lapos napív + korong, napközben
   koncentrikus körök + felhő-ellipszisek, este ív + csillagok + hold.

A réteg magassága 92px, és `mask-image: linear-gradient(to bottom, black 0%, black 58%,
transparent 100%)` — így az alja **belefolyik a tartalomba**, nincs éles vágás.

**Full-bleed:** a `.screen-content` 12px `--screen-gutter` padding-inline-t ad; az aurora ezt
`margin-inline: calc(-1 * var(--screen-gutter))`-rel lépi át, hogy a telefon széléig érjen. A
fejléc *tartalma* a gutteren belül marad.

**Napszak-forrás:** a meglévő `useDayFace()` (`face`), ugyanaz, amit a napszakváltó ikon
használ — nem forkoljuk. A `?dp=` override így az aurorán is látszik.

### 2.4 Sticky + kompakt üvegmód

- A fejléc `position: sticky; top: 0` a `.screen-content` scrollerben. A `top: 0` helyes: a
  scroller `padding-top: 54px`-je már a fake státuszsáv alá offsetel (lásd `.sticky-top`).
- Görgetéskor (`scrollTop > 14`) a fejléc `.is-cond` osztályt kap: az aurora kifakul, helyette
  áttetsző, `backdrop-filter: blur(18px)`-es üvegsáv + hajszálvékony alsó vonal, és a
  függőleges padding összehúzódik. Az ikonok **végig elérhetők** — ez a redesign fő funkcionális
  nyeresége.
- A scroll-figyelés a meglévő `screenScroller()` helperre épül, passzív listenerrel; a
  DOM-írás `requestAnimationFrame`-ben, az osztály csak változáskor.

### 2.5 Két új clay spot

A készletből hiányzik a Fuel és az Én szekció spotja. Mindkettő a meglévő spot-recept szerint
készül (100×100 viewBox, tompított árnyék-ellipszis alul, radiális gradiens, bal-felső fehér
highlight):

- **`s-fuel`** — az `i-fuel` tál-motívuma zöld `sg-bowl` gradienssel + gőzpára.
- **`s-en`** — az `i-emberek` alakja egy személyre sűrítve, korall `sg-person` gradienssel.

Bekerülnek a `frontend/src/shared/ui/clay/clay-spots.svg`-be, a `ClaySpotName` unióba, és a
`docs/design_2.0/assets/clay-spots.svg` másolatba (a kettő szinkronban tartandó).

## 3. Amit NEM csinálunk (YAGNI)

- Nincs köszöntés, dátum, ring/progress-vizuál, streak a fejlécben.
- Nincs animált gradiens: az aurora statikus, csak a kompakt-váltás animál (transition). Így
  nincs új végtelen animáció, amit `prefers-reduced-motion` mögé kellene tenni.
- Nem nyúlunk a popoverekhez, a `?dp=` navigációhoz, a fókuszkezelés halasztott tételéhez.
- Nem vezetünk be route→cím táblát.

## 4. Kockázatok és csapdák

| Kockázat | Kezelés |
|---|---|
| `prototype.css` a repó legtörékenyebb merge-fájlja | a változás egy összefüggő blokkban; utána `prototypeCssStructure.test.ts` **és** `pnpm build` |
| Sticky + scroll-lock (`:has(.sheet-backdrop)`) | sheet nyitva a scroller `overflow: hidden` — a sticky fejléc a helyén marad, regresszió-ellenőrzés a Playwright layout-tesztben |
| A `.sky` canvas-band ugyanígy napszak-tintás | az aurora fölé kerül; ha együtt túl sok, a `.sky` marad, az aurora wash-t halványítjuk — élőben döntjük el |
| `backdrop-filter` teljesítmény | csak a kompakt (alacsony) sávra, nem a teljes hero-ra |
| Sprite-gradiensek `display:none` alatt nem oldódnak fel | a `ClaySprites` már a `width=0/height=0 + position:absolute` receptet használja — **nem** szabad `display:none`-ra váltani (a prototípusban ez élesben elő is jött) |
| PWA chrome-color | a fejléc a státuszsáv alatt kezdődik, a legfelső pixel marad `--canvas` → `index.html` / `theme.ts` / `vite.config.ts` **nem** változik |
| 23 meglévő `AppHeader` teszt | a viselkedés nem változik; a dátum-eyebrow eltűnése miatt a rá hivatkozó assertion frissül |

## 5. Tesztelés

- **Egység (Vitest+RTL, colocated):** szekciónév és spot minden path-prefixre; ismeretlen prefix
  → nincs cím, nincs crash; a kompakt osztály scroll-küszöbre vált; a meglévő 23 teszt zöld.
- **CSS-struktúra:** `prototypeCssStructure.test.ts`, `mozaikCssTokens.test.ts` (az új
  `--mzh-*` tokenek light+dark párral).
- **Vizuális:** Playwright `layout.spec.ts` — a fejléc kitapadása valós telefonmagasságon.
- **Mindkét mód:** `VITE_USE_MOCK` mock és real — a bare `pnpm test` mock-ot futtat kétszer.
- **CI a hiteles kapu:** self-PR → zöld CI → lokális `--no-ff` merge.

## 6. Prior art

A recon (researcher) öt forrást hozott; ebből három épült be:

- **Huawei EMUI „Project Faraday" — container-less, dinamikus színű fejléc**
  ([welovenoise.com](https://www.welovenoise.com/work/huawei/)) — **átvéve**: a fejléc nem sáv a
  tartalom felett, hanem színes felület, amin a cím és az ikonok ülnek. A dinamikus
  kontraszt-algoritmust elvetettük: fix, tesztelt light/dark tónuspárok elegendők.
- **Apple large-title collapse + scroll-edge blur**
  ([learnui.design](https://www.learnui.design/blog/ios-design-guidelines-templates.html)) —
  **részben átvéve**: a kompakt üvegsáv igen, a nagy cím összehúzódása nem (egysoros a fejléc).
- **PWA CSS-eszköztár: safe-area, animált gradiensek költsége**
  ([gradients.design](https://gradients.design/guides/animated-gradient-css),
  [MDN `env()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)) —
  **átvéve** a tanács, hogy az állandóan animáló gradiens fitnesz-PWA-n fölösleges
  akkumulátorköltség: az auroránk statikus.
- **Huawei Health activity-rings hero** ([consumer.huawei.com](https://consumer.huawei.com/en/mobileservices/health/))
  — **elvetve**: gyűrű valós „mai" metrika nélkül dísz; a Today Mozaikja már hordozza ezt.
- **Fitnesz-home-screen jó gyakorlatok** ([madappgang.com](https://madappgang.com/blog/the-best-fitness-app-design-examples-and-typical-mistakes/))
  — **átvéve** fegyelemként: egy hangos elem van (az aurora), minden más csendes marad.

## 7. Codebase terrain

Az investigator jelentése alapján (kulcs-horgonyokkal):

- **`frontend/src/app/AppHeader.tsx`** — az app EGYETLEN fejléce (mezo-atry). A sorrend
  kommentált szerződés; a `FACE_ICON` tábla a 25. sorban. Nem szabad per-hub másolatot csinálni
  (`hubHeaders.test.tsx` őrzi).
- **`frontend/src/app/AppLayout.tsx:57`** — a fejléc a `ScreenContent` első gyereke; három
  chrome-mentes route-on rejtve (`:31`). A `MezoThreadProvider` (`:53`) közös ős kell maradjon.
- **`frontend/src/styles/prototype.css:4525-4564`** — a teljes fejléc-CSS (`.nap-head`,
  `.app-head`, `.nap-roundbtn`, `.nap-badge`, popoverek, `.nap-avatar`, `.nap-q`).
  A `:4528-4533` komment a 13px-es függőleges ritmust indokolja — az új padding ezt tiszteli.
- **`prototype.css:884-908`** — `.screen-content` (padding-top 54px, `--screen-gutter`),
  `.sticky-top` (`top: 0` és miért nem 54px).
- **`prototype.css:159-191` / `:478-504`** — a Mozaik token-blokk light/dark párjai; az új
  `--mzh-*` tokenek ide, mindkét blokkba.
- **`frontend/src/features/today/logic/useDayFace.ts`** — az EGY napszak-feloldó; nem forkoljuk.
- **`frontend/src/shared/lib/screenScroll.ts`** — `screenScroller()` adja a scrollert.
- **`frontend/src/shared/ui/clay/index.tsx:28`** — `ClaySpotName` unió (ide a két új név);
  `clay-spots.svg` a sprite, `docs/design_2.0/assets/` a másolat.
- **Tesztek:** `AppHeader.test.tsx` (23 teszt), `hubHeaders.test.tsx`,
  `mozaik/prototypeCssStructure.test.ts`, `mozaikCssTokens.test.ts`,
  `frontend/tests/visual/layout.spec.ts`.
