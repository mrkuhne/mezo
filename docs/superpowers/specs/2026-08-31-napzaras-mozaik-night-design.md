# Napzárás · Mozaik 2.0 éjszakai nyelv (F7.1)

- **bd:** `mezo-d20.8.1` (design kör) → `mezo-d20.8.1.1` (dev)
- **Prototípus:** [`docs/design_2.0/prototypes/napzaras.html`](../../design_2.0/prototypes/napzaras.html)
  ([artifact](https://claude.ai/code/artifact/0e4e02ba-d5c8-49ce-a738-b924f1583cf6))
- **Érintett feature-doc:** [`docs/features/ritual.md`](../../features/ritual.md)
- **Vonatkozó ADR-ek:** [0033](../../decisions/0033-mozaik-2-tile-language.md) (Mozaik 2.0),
  [0010](../../decisions/0010-gamified-growth-xp-feedback-not-payment.md) (XP = visszajelzés)

## 1. Mit oldunk meg

A Napzárás a Design 2.0 utolsó olyan first-class felülete, amely még a redesign előtti
vizuális nyelven szólal meg. Három konkrét panasz vezette a kört:

1. **Emoji-k és lapos elemek** — 🌙 / 🔥 / 🪙 / 🛟 / ✍️ / 💓 / ✦ és lapos `.rz-ev` sorok ott,
   ahol az app többi része már clay 3D ikont és mosott csempét beszél.
2. **A Termés nem elég ünnepi** — a peak-end szabály szerint ez a rituálé csúcsa, de
   vizuálisan szolidabb, mint a szerepe.
3. **Törés a Nap tabbal** — az este-panel lavender világából belépve a rituálé hirtelen egy
   másik alkalmazásnak hat.

## 2. A döntés: „a Mozaik éjszakai üzemmódja"

A rituálé **megtartja az éjszakai takeover-jellegét** — nem lesz belőle világos mosott
csempe-mozaik. A Mozaik 2.0-ból az *anyagszerűséget* veszi át: clay ikonokat, csempe-anatómiát,
tokenizált sarkokat/árnyékokat, egy-lövetű koreográfiát — sötét üvegre alkalmazva.

**A dramaturgia a fény.** A színpad nem statikus éjszakai ég, hanem hat állapotú **sötétedő ív**:

| Felvonás | Ég | Szerep |
|---|---|---|
| 1 · Megérkezés | mély-lavender alkony | „ugyanaz a világ, leszáll az este" |
| 2 · A napod íve | kékes szürkület | a nap története még dereng |
| 3 · Ma milyen volt | mélyebb szürkület | befelé fordulás |
| 4 · Nyitott hurkok | mély éjkék | rendrakás sötétben |
| 5 · **Termés** | **arany fénytörés** a sötét alapon | a csúcs — fénnyel elmesélve |
| 6 · Elengedés | legmélyebb éj, sűrű csillagok | a kör bezárul, csend |

A három panasz így egyszerre kap választ: a **belépési törést** az alkonyi első kép oldja
(az este-panel lavenderének telített rokona), az **ünnepiséget** a fény-kontraszt adja
(nem több chip, hanem áttörő világosság), a **lapos elemeket** pedig clay + night-wash váltja.

## 3. Építőelemek

### 3.1 Égbolt-tokenek (`--rz-sky-*`)

A sötétedő ív hat gradiense **nem** vezethető le a DS ramp-ből — bespoke éjszakai paletta.
A Mozaik precedensét követi: `--rz-sky-1..6` (mindegyik `linear-gradient` felső/alsó stop-párja)
a `prototype.css` **mindkét** `:root` blokkjában deklarálva, majd
`.rz-screen[data-act="N"]` választja ki. A rituálé `setForceTheme('dark')`-ot használ, tehát a
két blokk értéke azonos — a duplikáció a Mozaik-szabály betartása, nem redundancia.

Átmenet: `background 0.9s ease` a `.rz-screen`-en. Reduced motion alatt `transition: none`.

### 3.2 Csillagmező

`.rz-stars` a `.rz-screen` gyermeke, 16 determinisztikusan szórt pötty (index-alapú
pozíció, nincs `Math.random` — a vizuális goldenek stabilitása miatt). Sűrűsége/opacitása
felvonásonként nő (`--rz-star-op`, a `data-act` szabályokból). Minden 4. csillag lassan
pislog; reduced motion alatt az animáció leáll, a mező statikusan látszik.

### 3.3 Clay ikonok — két új szimbólum

| Név | Forma | Hol |
|---|---|---|
| `i-hold` | kráteres telihold, lavender clay ramp | act 1 (lélegzik), act 6 (a bezáruló kör közepén) |
| `i-termes` | arany csillag-szikra + két kísérő szemcse | act 5 hero |

Mindkettő a `docs/design_2.0/assets/clay-icons.svg`-be kerül **először** (az 1:1 asset-kontraktus),
onnan másolódik a `frontend/src/shared/ui/clay/clay-icons.svg`-be, és felkerül a
`clay-csomag.html` katalógusba.

**A lecserélt emoji-k:**

| Régi | Új | Hol |
|---|---|---|
| 🌙 (`Kezdjük 🌙`, `.rz-end` záró sor) | `i-hold` a színpadon | act 1, 6 |
| 🏋️ 🏐 🍽 ⚖️ 😴 ✍️ ✦ (recap sorok) | `i-edzes` `i-sport` `i-fuel` `i-suly` `i-alvas` `i-naplo` `i-cel` | act 2 |
| 💓 ✦ ✍️ (hurok sorok) | `i-checkin` `i-cel` `i-naplo` | act 4 |
| 🪙 🔥 🛟 + `CHIP_ICON_BY_SOURCE` | `i-erme` `i-lang` `i-eletjel` + forrás-clay | act 5 |
| 🌌 🛏 (handoff) | `i-alvas` | act 6 |

A `RecapEvent.icon` típusa `string` → `ClayIconName`. Ez adatréteg-változás, és szándékos:
az emoji megválasztása prezentáció, nem adat — a hook eddig is UI-döntést hordozott.

### 3.4 Night-washed csempe (`.rz-nw`)

Egyetlen új primitív, a Mozaik csempe-anatómia sötét megfelelője: áttetsző fehér wash
(11%→5% gradiens), 0.5px világos szegély, belső top-highlight, mély árnyék, `--r-lg` sarok.
A benne ülő clay spot `.rz-nw-spot` (30×30, lekerekített négyzet, halvány wash).

Ebből épül: a recap-sor (act 2), a hurok-sor (act 4), a Termés-chip és a skill-sor (act 5),
a handoff-panel (act 6).

**Nyitott hurok jelzése:** `.rz-nw.is-open` — lélegző **lavender** glow. Sosem piros, sosem
terrakotta; a nyitott hurok nem hiba, csak „él" (ADR 0010).

### 3.5 A Termés fénycsúcsa

- `.rz-glow` — alulról-középről induló arany radiális fényfolt, 1.4s alatt beúszik.
- A hero-szám arany (`--rz-gold-hi`), finom text-shadow glow-val; a `CountUp` marad.
- A forrás-chipek 2 oszlopos rácsba rendeződnek (a lapos wrap-sor helyett), mindegyik
  `.rz-nw` arccal, clay spottal és jobbra igazított XP-vel.
- Konfetti: 14 részecske (10 helyett), a meglévő `xpTotal > 0` kapu és a `harvestStages`
  ütemezés változatlan.

### 3.6 Clay gyöngy progress

A `.rz-dots` hat pöttye clay gyönggyé válik: a megtett felvonások lavender clay-t kapnak,
az aktuális arany clay-t + skálázást. **Nem interaktív** — a rituálé előre halad; a
prototípus kattintható gyöngyei kizárólag demó-affordanciák.

### 3.7 A belépő átmenet

A Nap tab este-panel „Zárjuk le a napot" CTA-ja után a `/ritual` **act 1** háttere az
este-panel lavenderének telített rokona, tehát az átmenet folytonos. Nincs új útvonal-animáció
és nincs shared-element átmenet — a folytonosságot a szín adja, nem mozgás.

## 4. Ami szándékosan NEM változik

- **A 6 felvonás, a sorrend és minden magyar szöveg** — kivéve a `Kezdjük 🌙` → `Kezdjük` és a
  `A nap le van zárva. Elengedheted. 🌙` → `…Elengedheted.` sorokat, ahol az emoji szerepét a
  színpadon álló clay hold veszi át. Az „A nap véget ért." / „Zárjuk le együtt." sorok
  továbbra is byte-pontosak.
- **Minden írási invariáns** — az act 3 advance-only reflexió- és hálamentés, az act 5
  egyszeri `close()` a `closedRef` őrrel, a következmény nélküli ✕.
- **Az őszinteség-szabályok** — nincs kitalált adat, a hiányzó forrás nem renderel semmit,
  a megszakadt sorozat halványan és „— megszakadt" szöveggel jelenik meg, a skill „N XP a
  következő szintig" tipp továbbra sem létezik.
- **A `setForceTheme('dark')`** — a portálozott sheet-ek konzisztenciája miatt marad.

## 5. Tesztelés

- **Meglévő tesztek**: az emoji-t assertáló sorok clay-`<use href="#i-…">` ellenőrzésre
  váltanak (`DayStoryStep`, `LoopsStep`, `HarvestStep`).
- **Új guard** (`ritualCssTokens.test.ts`): az `--rz-sky-1..6` mind a hat token
  **mindkét** `:root` blokkban deklarálva van — ez a Mozaik-tokenek bevált mintája, és pontosan
  azt a hibaosztályt fogja meg (az egyik blokkból kimarad egy token), amit a panel-ritmus
  esete tanított.
- **Reduced-motion guard**: a meglévő `reducedMotionGuard.test.ts` **nem szorul bővítésre** —
  automatikus parser, amely magától megtalálja az összes `.rz-*` szelektort aktív animációval,
  és megköveteli hozzá a `prefers-reduced-motion: reduce` blokkban az `animation: none`-t.
  A dolgunk tehát csak annyi, hogy a három új animációt (`rz-twinkle`, `rz-loopbreath`,
  `rz-glowin`) ott semlegesítsük — a guard ezt magától számonkéri.
- **Vizuális goldenek**: a meglévő `/ritual` Arrival + Harvest készletek újragenerálódnak;
  a sötétedő ív miatt érdemes egy harmadik felvételt is felvenni az **Elengedésről** (act 6),
  mert az ív két végpontja a lényeg.

## 6. Nyitott, a következő körre

- A **`?day=rough`** melt és a Napzárás viszonya: a nehéz nap jelenleg nem befolyásolja a
  rituálé színpadát. Elképzelhető egy halkabb ív (kevesebb csillag, tompább arany), de ez
  önálló döntés — most nem valósul meg.
- **Az act 3 életterület-chipjei** (🧘 Tudatosság, 🌱 Egészség, …) emojik maradnak. Ezek a
  `levelUpMeta.ts` `LIFE_SKILLS` listájából jönnek, amit a Growth, a SkillBandCard, a
  LevelUpScreen és a JournalSheet is fogyaszt — egyiknek sem volt tervezői köre. Ugyanaz a
  „egyszerre egy felület" szabály, ami a `CHIP_ICON_BY_SOURCE`-ot is érintetlenül hagyta;
  ráadásul a clay készletben a nyolc életterület többségének (pénzügy, tanulás, kapcsolatok)
  nincs megfelelője, és egy fél-clay sorozat rosszabb lenne a következetes emojinál.
  Ez a Napzárásban maradt egyetlen látható emoji-csoport — az F7.4 Én-kör hozza el a
  megoldását, mert ott dől el az életterület-ikonográfia egésze.
- **Act 3 diktálás**: a `useVoiceInput` chip a DS `Icon` `mic`/`voice-wave` jelét használja,
  nem clay-t — nincs clay mikrofon-állapotpár (felvétel/leállítás), és egy fél-clay pár
  rosszabb lenne, mint a következetes DS ikon. A `i-mikrofon` clay létezik, de statikus.
