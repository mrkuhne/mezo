# Mobile UX/UI Reference (CLAUDE.md import)

> **Cél:** Ezt a doksit Claude-nak kell követnie minden mobil UI feladatnál (React Native, Flutter, mobil-first web). A doksi szándékosan **direktív**: szabályokat, számokat és anti-pattern listákat ad, nem narratívát. Ha egy szabály ütközik egy felhasználói kéréssel, **kérdezz vissza**, ne találgass.
>
> **Forrás-bázis:** Apple HIG, Google Material 3, Nielsen Norman Group heurisztikák, WCAG 2.2 mobile, AlignUI / PrototypeFlow / NN AI-prototyping kutatások (2024–2025), valamint kognitív pszichológia (Sweller — cognitive load theory) és Gestalt elvek.

---

## 0. Mikor és hogyan használd

Aktiváld ezt a referenciát, ha a feladat tartalmaz **bármit** az alábbiakból:

- mobile screen, mobile app, mobile UI, mobile-first
- React Native, Expo, Flutter komponens vagy screen
- bottom tab, drawer, sheet, mobile form, mobile list
- tervezésről szóló kérdés (layout, spacing, hierarchia)
- meglévő mobil UI review-ja, refaktora, "make it look professional"

**Sorrendi szabály:** Először a **3. szekciót** (5 sarokkő szabály) alkalmazd, utána a többit. A többi szekció a "miért" és a "hogyan", a 3. szekció a "mit".

---

## 1. Alapfilozófia: jel-zaj arány és kognitív terhelés

### 1.1 A 3 másodperces szabály
A mobil képernyő nem attól lesz professzionális, hogy sok kártyát, gradient-et, ikont és árnyékot tartalmaz, hanem attól, hogy **3 másodperc alatt** közli: *(1) hol van a felhasználó, (2) mi a legfontosabb információ, (3) mi a következő lépés*. Minden szabály ezt a 3 célt szolgálja. Ha egy döntés nem javítja a 3 célból legalább egyet, **töröld a döntést**.

### 1.2 Signal-to-Noise Ratio (SNR)
Minden képernyőn maximalizáld a **jel** (a felhasználó céljához szükséges info) és minimalizáld a **zaj** (figyelemelterelő, redundáns vagy felesleges vizuális elem) arányt.

| Jel (signal) | Zaj (noise) |
|---|---|
| Primary CTA | Másodlagos dekoratív gradient |
| Lényeges adat (KPI, user info) | Felesleges divider vonal |
| Aktív állapot jelzése | Ikon minden cím mellett |
| Affordancia (kattinthatóság) | Versengő badge-ek és címkék |

**Belső kérdés minden elem hozzáadása előtt:** *"Ez jel vagy zaj?"* — ha nem egyértelműen jel, **töröld**.

### 1.3 Kognitív terhelés taxonómia (Sweller-féle)

| Típus | Mi okozza | Cél |
|---|---|---|
| **Intrinsic** (belső) | A feladat **lényegéből** fakadó mentális erőfeszítés | Bontsd kisebb lépésekre (staged disclosure, többlépcsős form) |
| **Extraneous** (külső) | **Rossz design döntések** miatt felesleges munka | **Nullára** csökkentsd (vizuális zaj, redundancia, inkonzisztens minták kivágása) |
| **Germane** (releváns) | Az alkalmazás megtanulását segítő gondolkodás | **Támogasd** (konzisztens platform-konvenciók, ismerős minták) |

**Az AI-generált felületek 90%-ban extraneous load-ot termelnek**: felesleges elválasztó vonalak, redundáns ikonográfia, túlhangsúlyos konténerek. A te dolgod (Claude) ezeket szisztematikusan kivágni.

---

## 2. AI-generált UI tipikus problémái (amit el kell kerülnöd)

Te (Claude) is ezekre vagy hajlamos. Olvasd el minden válasz előtt:

| Anti-pattern | Mit csinál az AI alapból | Mit kell tenned helyette |
|---|---|---|
| **"Minden egyenlő súlyú"** | Több azonos méretű kártyát rak egymás mellé/alá | Pontosan **1** domináns elem, többi vizuálisan visszafogott |
| **Gradient + shadow + badge mindenen** | Dekoráció helyettesíti a hierarchiát | Dekoráció csak ott, ahol funkcionális (status, brand) |
| **6+ ikon a tab bar-ban címke nélkül** | "Modern" minimalista ikongyűjtemény | Max 5 tab, **mindig címkével** |
| **3+ primary CTA / képernyő** | Több gomb azonos vizuális súllyal | **1 primary** + másodlagos action-ök (text button, sheet) |
| **"Social profile hero" minden user-screen-en** | Nagy avatar + cover photo, akkor is, ha admin/util feladat | Kontextushoz illő header (lehet 1 soros app bar) |
| **Inkonzisztens spacing (12, 14, 18, 22 px keverve)** | Random pixel értékek | **4 / 8 / 16 / 24 / 32 / 48** spacing tokenek, semmi más |
| **Card minden listaelem körül** | Minden listához card-ot generál | Card csak ha **egyetlen entitás** köré rendezett tartalom |
| **Quick action grid 6+ ikonnal** | "Discover" jellegű ikongrid akkor is, ha listára van szükség | Listával váltsd ki, ha lineáris feladat |
| **Above-the-fold zsúfolás** | Hero + 4 stat + 3 quick action egyben | Csak 1 fő blokk látsszon első képernyőn |
| **Túl korai részletmegjelenítés** | Lista-elemen 4-5 metaadat sor | Listában cím + 1 segédsor; részlet detail view-ba |
| **Divider-mánia** | Minden listaelem közé vízszintes vonal | Whitespace-szel csoportosíts; vonal csak ott, ahol tényleg szükséges |
| **Generikus spinner üres képernyőn** | Pörgő loader minden adatfetch-nél | Skeleton screen, ami a tényleges layout struktúráját mutatja |

**Belső checklista válasz előtt:** "A fenti 12-ből hányat csinálok éppen most?" Ha bármelyiket → javítsd ki, mielőtt küldesz.

---

## 3. Az 5 sarokkő szabály (kötelező)

Ezeket **mindig** alkalmazd, akár tervezel, akár kódolsz. Sorrendben prioritás szerint:

### 🔹 Rule 1 — Egy domináns fókuszpont képernyőnként
Minden képernyőnek pontosan **egy** olyan eleme van, amelyiket a felhasználó szeme **először** megtalálja. Ezt méret, kontraszt, vagy elhelyezés adja — soha nem több párhuzamosan.

❌ **DON'T:** 3 azonos méretű card a hero alatt, mindegyik primary színnel.
✅ **DO:** 1 hero blokk + összegző sor, alatta listák/másodlagos blokkok visszafogottabb stílussal.

### 🔹 Rule 2 — Spacing tartalmi kapcsolatot jelez (proximity)
Két elem közelsége **szemantikus**: ami közelebb van, azt összetartozónak látja a felhasználó (Gestalt proximity elve). A whitespace nem dekoráció, hanem **strukturális jelölés**.

- Címke ↔ input mező: **4-8px**
- Egy szekción belüli sorok: **8-12px**
- Szekciók között: **24-32px**
- Képernyő szélső margó: **16px** (compact) / **20px** (regular)

### 🔹 Rule 3 — Egy szekcióban legfeljebb egy primary CTA
Ha két gomb ugyanakkora hangsúlyt kap, a felhasználó megáll dönteni. **Egy** szekcióban / view-ban **egy** elsődleges akció (filled button, brand color). A többi: text button, outline button, vagy sheet-be vándorolt action.

```
✅ [Submit] (primary)  +  Cancel (text button)
❌ [Submit] (primary)  +  [Save Draft] (primary)
```

### 🔹 Rule 4 — Affordancia explicit, dekoráció funkcionális
Kattintható elem **láthatóan** kattintható: gomb-szerű forma, ikon + label, vagy chevron. Lapos, dekorációs elem **nem nézhet ki úgy**, mint a kattintható.

- Touch target minimum: **48×48 dp** (Android) / **44×44 pt** (iOS) / **24×24 CSS px** (WCAG 2.5.8 abszolút minimum)
- Csak ikon → **mindig** legyen `accessibilityLabel` / `Semantics` label
- Hover/press state legyen látható (opacity, ripple, scale)

### 🔹 Rule 5 — Minden képernyőhöz 4 állapot
Soha ne tervezz csak "happy path" képernyőt. Minden adatfüggő view-nak van:

| Állapot | Mit kell mutatnia |
|---|---|
| **Loading** | Skeleton vagy progress indicator (ha >2s lehet) |
| **Empty** | Magyarázó szöveg + 1 elsődleges akció ("Add your first X") |
| **Error** | Mi történt + retry akció + fallback útvonal |
| **Success** | Az adat helyes megjelenítése (a "happy path") |

Kódban: használj diszkriminált union-t / sealed class-t a state-ekre, ne csak `loading: bool`-t.

---

## 4. Spacing & Layout System

### 4.1 Token rendszer (kötelező)
Sose használj "magic number"-t. Definiálj tokent és használd:

```ts
// React Native — theme.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Használat:
<View style={{ padding: spacing.md, gap: spacing.sm }} />
```

```dart
// Flutter — theme.dart
class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double xl = 32;
  static const double xxl = 48;
}

// Használat:
Padding(padding: EdgeInsets.all(AppSpacing.md), child: ...)
```

**Szabály:** ha 4-gyel nem osztható spacing-et használsz (pl. 13, 17, 22), **valamit elrontasz**.

**Specialty token kiegészítések (engedélyezett):** a fenti 6 token a kanonikus core. Három további értéket lehet definiálni a token-rendszerben **konkrét, dokumentált használati esetekkel** — nem általánosan:

| Specialty token | Használat | Példa |
|---|---|---|
| **12** | ikon ↔ szöveg gap, kompakt list-item belső gap, micro-grid macros között | MealCard macro grid column-gap, ListItem leading-to-body gap |
| **40** | nagy szekció gap (ha 32 < kell < 48), card grid wide gutter | dashboard section-to-section, hero alatti levegő |
| **64** | hero min-height contribution, full-page state padding | empty-state min-height, hero block alsó margó |

Bármely más érték (13, 17, 20, 22, 28, 36, 56) **továbbra is tiltott** — ez a 6+3-as scale a teljes engedélyezett halmaz.

### 4.2 Miért 8pt grid? (a matematikai indoklás)

A 8pt grid nem önkényes konvenció — **technikai oka van**:

- A modern mobil képernyők **integer pixelekkel** renderelnek; a tört értékek (pl. 13.5px) **élhomályosodást** (subpixel fuzziness) okoznak
- A 8 egész számmal **skálázódik** a különböző pixelsűrűségeken: @1x = 8, @2x = 16, @3x = 24, @4x = 32 — mindegyik tiszta pixel
- A legtöbb mobilfelbontás (320, 375, 390, 414, 768, 1024) **osztható 8-cal**, ami egyszerűsíti a layout matematikát
- A 4dp-s "fél-grid" (xs token) az **ikon-szintű** finom igazításhoz használható (pl. ikon és szöveg közötti rés)

### 4.3 Micro vs macro whitespace

A whitespace nem egységes — **két szinten** működik, és mindkettőre figyelni kell:

| Szint | Megnyilvánulás | Funkció |
|---|---|---|
| **Micro-whitespace** | Sorköz (line height), karaktertávolság, ikon ↔ szöveg kis rés, gomb belső padding | **Olvashatóság** és finom megkülönböztetés |
| **Macro-whitespace** | Szekciók közötti távolság, screen edge padding, card-ok közötti rés, hero block alatti levegő | **Vizuális ritmus** és a hierarchia nagy egységei |

**Tipikus AI hiba:** csak macro-whitespace-szel foglalkozik (margók), és figyelmen kívül hagyja a micro-t (sorköz, padding) → a felület tagolt, de a részletek "összeragadnak".

### 4.4 Internal ≤ external szabály (kritikus!)

**Aranyszabály:** egy elemen **belüli** spacing **soha** ne legyen nagyobb, mint az adott elem és a következő közötti **külső** távolság.

```
✅ JÓ:
[ Card belső padding: 16px ]
                    ↕ 24px (külső margó)
[ Következő card belső padding: 16px ]

❌ ROSSZ:
[ Card belső padding: 24px ]
                    ↕ 16px (külső margó — KISEBB mint a belső!)
[ Következő card belső padding: 24px ]
```

**Miért fontos:** ha a belső padding nagyobb, mint a külső margin, a felhasználó nem érzékeli, hogy hol végződik egy elem és hol kezdődik a másik → vizuális "összemosódás", csoportosítás összeomlik. Ez a leggyakoribb oka annak, hogy egy layout szakszerűtlennek tűnik akkor is, ha minden token rendszerből van.

### 4.5 Screen margók
- **Compact width** (mobil portrait, <600dp): **16dp** horizontális margó
- **Regular width** (tablet, foldable expanded): **20-24dp**
- **Safe area** mindig kezelve, **soha** ne keverd a margóval

```tsx
// React Native
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();
<View style={{
  paddingTop: insets.top,
  paddingHorizontal: spacing.md,  // ez a layout margin, nem a safe area
}} />
```

```dart
// Flutter
SafeArea(
  child: Padding(
    padding: EdgeInsets.symmetric(horizontal: AppSpacing.md),
    child: ...,
  ),
)
```

### 4.6 Divider-szabály

**Default:** ne használj divider vonalat. Whitespace + tipográfiai hierarchia + halvány surface variant háttér **majdnem mindig elég** a csoportosításhoz.

Divider **csak** akkor indokolt, ha:
- A whitespace nem tudja egyértelműen megkülönböztetni két különböző tartalomtípus határát (pl. settings groups)
- Sűrű tartalom esetén (pl. táblázat-szerű listák), ahol a sorok könnyen összemosódnának
- Platform-konvenció kifejezetten elvárja (pl. iOS settings list)

Ha divider-t használsz: **legyen halvány** (1px, ~10% opacity outline color), soha ne dominánsabb, mint a tartalom.

---

## 5. Ergonómia: Thumb Zone

A mobil képernyőt **egy kézzel** használja a felhasználók többsége. A hüvelykujj természetes ívet ír le — nem minden képernyőterület érhető el egyformán könnyen.

### 5.1 A három zóna

```
┌───────────────────────┐
│  🔴 Red zone          │  ← ritkán használt
│  (status bar, top)    │     destruktív műveletek
├───────────────────────┤
│  🟡 Yellow zone       │  ← másodlagos funkciók
│  (oldalak, közép-felső)│     stretch elérésű
│  🟢 Green zone        │
│  (alsó harmad, közép) │  ← ELSŐDLEGES INTERAKCIÓ
│                       │     fő nav, primary CTA, search
└───────────────────────┘
```

| Zóna | Hely | Mit tegyél ide |
|---|---|---|
| 🟢 **Green** (easy reach) | Alsó harmad + középső régió | Bottom tab bar, primary CTA, search bar, leggyakoribb actionök |
| 🟡 **Yellow** (stretch) | Oldalsó régiók, közép-felső | Másodlagos actionök, navigation rail elemek, kevésbé gyakori funkciók |
| 🔴 **Red** (hard reach) | Felső sarkak, top status régió | Beállítások, profil, ritkán használt menük, **destruktív műveletek szándékosan** (pl. Delete) |

### 5.2 Mit jelent a gyakorlatban

✅ **DO:**
- **Primary CTA** mindig a green zone-ban (alsó harmad). Sticky bottom button, nem felül.
- **Bottom tab bar** ergonómiai szempontból verhetetlen — top tab navigation csak ha kötelező a platform-konvenció
- **Search bar** lehet alul (Apple egyre több app-ban így teszi)
- **Hamburger menü** ha szükséges, fontolj meg **alsó** drawer trigger-t felső helyett
- **Destruktív műveleteket** (Delete, Sign out) szándékosan vidd a red zone-ba — szándékosan nehezebb elérés = kevesebb véletlen tap

❌ **DON'T:**
- Primary CTA a képernyő tetején (kivéve specifikus platform-konvenció)
- Floating Action Button a left-top sarokban
- Gyakori action a status bar mellett
- Két gomb egymás mellett < 8px-re a green zone-ban (téves tap)

### 5.3 Kódban

```tsx
// React Native — sticky bottom CTA
<View style={{ flex: 1 }}>
  <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
    {/* content */}
  </ScrollView>
  <View style={{
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: spacing.md,
    paddingBottom: spacing.md + insets.bottom,
    backgroundColor: colors.surface,
  }}>
    <PrimaryButton onPress={onSubmit} />
  </View>
</View>
```

```dart
// Flutter — Scaffold bottomNavigationBar / persistentFooterButtons
Scaffold(
  body: ListView(...),
  bottomNavigationBar: SafeArea(
    child: Padding(
      padding: EdgeInsets.all(AppSpacing.md),
      child: PrimaryButton(onPressed: onSubmit),
    ),
  ),
)
```

---

## 6. Typography

### 6.1 Hierarchia szerepkörök (cross-platform, M3 + HIG egyensúly)

Maximum **5 szerepkör** egy app-ban — több zaj, kevesebb hierarchia:

| Role | Méret (dp/pt) | Súly | Mire való |
|---|---|---|---|
| **Display** | 32-57 | Regular/Medium | Ritka hero számok (pl. nagy KPI) |
| **Headline** | 24-32 | Medium/SemiBold | Screen címek, fő szekciók |
| **Title** | 16-22 | Medium | Card címek, list section header |
| **Body** | **16 default**, 18 content-heavy | Regular | Fő szövegtartalom, leírás |
| **Label / Caption** | **14 (csak itt!)** | Medium | Gombok feliratai, captionök, segédszöveg, metaadat |

**Kritikus szabály a body méretről:**
- Body alapértelmezett: **16px / 16pt** — ez a modern accessibility standard
- Content-heavy oldalakon (cikk, blog, hosszú olvasás): **18px**
- **14px csak label, caption, metadata** — body szövegre **soha** ne menj 14 alá

**12px engedélyezett kivételek (csak ezek, semmi más):** három dokumentált használati eset, ahol a 12px iparági standard és nem kerülhető el a felület tönkretétele nélkül:

| Kivétel | Követelmény | Miért engedélyezett |
|---|---|---|
| **Overline / Eyebrow** | uppercase + ≥0.18em letter-spacing + weight 700 | a tracking + caps **vizuálisan nagyobbra** húzza, mint a 12px sugallná |
| **Form helper text** input alatt | sentence-case OK, weight 400, muted color, mindig label-lel együtt | Apple HIG Footnote 13pt, Material 3 Body Small 12sp — univerzális forma-konvenció |
| **Bottom nav / tab bar label** | uppercase, weight 700, ≥4 ikon mellett | Apple HIG (10–11pt) és Material 3 Label Medium (12sp) — minden mobil app így csinálja, az ennél nagyobb label tördeli a tab bar layout-ot |

Sentence-case body szövegre, list item title-re, vagy bármi másra **továbbra is 14px az alsó határ**.

**Egy képernyőn:** legfeljebb **3-4 különböző méret** látszódjon egyszerre.

### 6.2 Sorhossz (line length)

A szem nehezen követi a túl hosszú vagy túl rövid sorokat:

| Tartalom | Cél karakter / sor |
|---|---|
| **Optimum** | 35-50 karakter |
| **Maximum** | 70 karakter |
| **Mobile portrait** | természetesen ~30-40 karakter 16px body-val 16dp margóval |

**Tablet / foldable expanded** módban a body szövegnek **max-width**-et kell adni — ne nyúljon a teljes szélességig.

```tsx
// React Native — content max width
<Text style={{
  fontSize: 16,
  lineHeight: 24,
  maxWidth: 600,  // ~70 char limit
}}>
```

### 6.3 Cross-platform font scaling

```tsx
// React Native — kötelező a system text scaling tiszteletben tartása
import { PixelRatio } from 'react-native';

<Text
  allowFontScaling={true}  // alapértelmezett, NE kapcsold ki
  maxFontSizeMultiplier={1.5}  // accessibility extra-large szöveg cap
  style={{ fontSize: 16, lineHeight: 24 }}
/>
```

```dart
// Flutter — MediaQuery alapú scaling
final textScaler = MediaQuery.textScalerOf(context);
Text(
  'Body text',
  style: TextStyle(fontSize: 16, height: 1.5),
  // ne állíts textScaleFactor: 1.0-t — az accessibility-t öli meg
)
```

### 6.4 Line height
- **Body:** 1.4–1.6× font size (16px-hez 22–26px line height)
- **Heading:** 1.2–1.3× font size
- **Sosem** kisebb mint 1.2× — olvashatatlan

### 6.5 Letter spacing
- Display/Headline: -0.02em (kissé szorosabb)
- Body: 0 (alapértelmezett)
- Label/Button: +0.01–0.05em (ha all-caps)

### 6.6 Off-white text on white (halation szabály)

**Probléma:** tiszta fekete (`#000000`) szöveg fehér (`#FFFFFF`) háttéren erős vibrálást (halation) okoz, főleg OLED kijelzőn és sötétben olvasáskor → szemfáradás.

**Megoldás:** használj **off-white / off-black** kombinációt:

| Háttér | Szöveg primary | Szöveg secondary |
|---|---|---|
| `#FFFFFF` (light) | `#1A1A1A` vagy `#212121` | `#666666` |
| `#000000` (dark) | `#F5F5F5` vagy `#E0E0E0` | `#A0A0A0` |

**Plusz előny:** könnyebb a kontraszt-arányt 4.5:1 fölött tartani, miközben a szöveg "lágyabb".

---

## 7. Color & Theming

### 7.1 Paletta diszciplína
Egy app-ban **maximum**:
- 1 primary
- 1 secondary (opcionális)
- 1 accent / tertiary (opcionális)
- 4 semantic: success, warning, error, info
- 1 surface skála (5-7 árnyalat)

**Több szín = kevesebb hierarchia.** A NN/g visszatérő finding: a túl sok szín szétveri a vizuális rangsorolást.

**Kapcsolódó alapszabály:** a brand színt (primary) **a primary CTA-ra tartogasd**. Ha minden szín, semmi sem tűnik ki.

### 7.2 Token struktúra (cross-platform)

```ts
// React Native — themed colors
export const colors = {
  light: {
    primary: '#0066FF',
    onPrimary: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceVariant: '#F5F5F7',
    onSurface: '#1A1A1A',         // off-black, NEM tiszta fekete
    onSurfaceVariant: '#666666',
    outline: '#E0E0E0',
    error: '#D32F2F',
    success: '#2E7D32',
    warning: '#ED6C02',
  },
  dark: { /* mirror */ },
};
```

```dart
// Flutter — ColorScheme alapú
final lightScheme = ColorScheme.fromSeed(
  seedColor: const Color(0xFF0066FF),
  brightness: Brightness.light,
);
// használd: Theme.of(context).colorScheme.primary
```

### 7.3 Kontraszt minimum (WCAG AA, kötelező)

| Tartalom | Minimum kontraszt arány |
|---|---|
| Normál szöveg (<18pt regular / <14pt bold) | **4.5:1** |
| Nagy szöveg (≥18pt regular / ≥14pt bold) | **3:1** |
| UI komponens / ikon (gomb határ, focus ring, ikon) | **3:1** |
| Disabled állapot | nincs minimum, de **legyen vizuálisan disabled** |

**Tesztelés:** használj contrast checker-t (WebAIM, Stark, Figma plugin). **Ne** "szemre" döntsd el.

### 7.4 Szín ≠ egyetlen jelző
Hibajelzés **soha** ne csak piros szín legyen. Mindig + ikon, label vagy szöveg. (WCAG 1.4.1)

```tsx
// ❌ Rossz
<Text style={{ color: 'red' }}>Email is invalid</Text>

// ✅ Jó
<View style={{ flexDirection: 'row', gap: 6 }}>
  <Icon name="alert-circle" color={colors.error} />
  <Text style={{ color: colors.error }}>Email is invalid</Text>
</View>
```

---

## 8. Navigációs minták

### 8.1 Top-level navigáció

**Szabály:** **3-5** azonos hierarchiaszintű destination, **címkékkel**, **perzisztens**.

| Komponens | Mikor | Cross-platform implementáció |
|---|---|---|
| **Bottom tab bar** | 3-5 fő destination, mobile portrait | RN: `@react-navigation/bottom-tabs`; Flutter: `BottomNavigationBar` / `NavigationBar` (M3) |
| **Navigation rail** | Tablet, foldable expanded, ≥600dp width | RN: custom side rail; Flutter: `NavigationRail` |
| **Drawer** | 6+ destination, vagy másodlagos navigáció | RN: `@react-navigation/drawer`; Flutter: `Drawer` widget |

❌ **DON'T:**
- Tab bar elrejtése aloldalakon (orientációvesztés)
- 6+ tab
- Csak ikon, címke nélkül
- Tab + Drawer együtt ugyanazokra a destination-ökre

✅ **DO:**
- Tab címke max **2 szó**, lehetőleg **1**
- Aktív tab vizuálisan **világosan** elkülönüljön (nem csak alpha különbség)
- Tab váltás **azonnali** feedback (ne loading 1s+ másik tabra)
- Bottom tab bar = green zone elemei → ergonómiailag optimális

### 8.2 Within-screen navigáció

| Minta | Mikor használd |
|---|---|
| **List → Detail** | Hierarchikus tartalom, "browse and drill" |
| **Tabs (in-screen)** | Azonos hierarchiaszintű, rokon **tartalmak** (NEM funkciók!) |
| **Stepper / wizard** | Lineáris, többlépéses folyamat (>3 lépés) |
| **Bottom sheet** | Kontextuális akciók, másodlagos info, picker-ek |
| **Modal** | Kötelező döntés, megszakítás (ritkán) |

### 8.3 Back navigáció
- **iOS:** swipe back gesture **ne legyen** letiltva (kivéve speciális esetben)
- **Android:** rendszer back gesture / button **mindig** működjön
- **RN:** `react-navigation` automatikusan kezeli, ne írd felül indok nélkül
- **Flutter:** `WillPopScope` / `PopScope` óvatosan, csak ha szükséges (pl. unsaved changes warning)

---

## 9. Komponens minták

### 9.1 Mikor használj card-ot?

✅ **HASZNÁLJ** card-ot, ha:
- A tartalom **egyetlen entitás** köré rendezett (1 termék, 1 user, 1 esemény)
- Több párhuzamos akció van **ugyanahhoz** az entitáshoz
- A tartalom **vizuálisan elválasztandó** a környezetétől

❌ **NE HASZNÁLJ** card-ot, ha:
- Egyszerű listaelem (use `ListItem` instead)
- Csak egy szöveg + ikon van
- A card csak "díszítés"

**Card de-emphasis:** kerüld a vastag border-t. **Lágy árnyék** (1-2px elevation) **vagy** enyhén eltérő háttérszín (`surfaceVariant`) modernebb és kevésbé zsúfolt.

### 9.2 List item anatómia

Standard mobil listaelem maximum:
- **Vezető elem** (avatar / ikon / kép) — opcionális
- **Cím** (1 sor, ellipsis ha túl hosszú)
- **Segédszöveg** (1 sor, opcionális)
- **Záró elem** (chevron / státusz / metaadat) — opcionális

**Magasság:** 56-72dp single line, 72-88dp two lines.

```tsx
// React Native — clean list item
<Pressable
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    gap: spacing.md,
  }}
  onPress={onPress}
  accessibilityRole="button"
  accessibilityLabel={`${title}, ${subtitle}`}
>
  {leadingIcon && <Icon name={leadingIcon} size={24} />}
  <View style={{ flex: 1 }}>
    <Text style={typography.title} numberOfLines={1}>{title}</Text>
    {subtitle && (
      <Text style={typography.body} numberOfLines={1}>{subtitle}</Text>
    )}
  </View>
  {trailing && <Text style={typography.label}>{trailing}</Text>}
</Pressable>
```

```dart
// Flutter — clean ListTile
ListTile(
  leading: leadingIcon != null ? Icon(leadingIcon) : null,
  title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
  subtitle: subtitle != null
    ? Text(subtitle!, maxLines: 1, overflow: TextOverflow.ellipsis)
    : null,
  trailing: trailing,
  onTap: onTap,
  minVerticalPadding: AppSpacing.md / 2,
)
```

### 9.3 App bar
- **1 cím** (screen név)
- **0-1** leading akció (back / menu / close)
- **Max 2** trailing akció (a többi overflow menübe)

❌ **DON'T:** hero blokk + app bar + tab bar együtt felhasználva valós helyett

### 9.4 Bottom sheet
- **Modális** sheet: kötelező döntés (delete confirmation, picker)
- **Standard** sheet: másodlagos tartalom (filter, share options)
- **Drag handle** mindig látható, ha drag-elhető
- Kezdő magasság: tartalom + 24dp bottom padding (safe area felett)

### 9.5 Form mezők

| Komponens | Anatómia |
|---|---|
| **Label** | Mező felett, **mindig látható** (NE float-only) |
| **Input** | Min 48dp magas, focus ring látható (3:1 kontraszt) |
| **Helper text** | Mező alatt, label típusa |
| **Error text** | Mező alatt, ikonnal + színnel + szöveggel |
| **Required marker** | `*` a label után, vagy explicit "(required)" |

```tsx
// React Native form field — accessibility-correct
<View style={{ gap: spacing.xs }}>
  <Text style={typography.label}>
    Email <Text style={{ color: colors.error }}>*</Text>
  </Text>
  <TextInput
    value={email}
    onChangeText={setEmail}
    keyboardType="email-address"
    autoCapitalize="none"
    autoComplete="email"
    accessibilityLabel="Email address, required"
    style={{
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: error ? colors.error : colors.outline,
      borderRadius: 8,
    }}
  />
  {error && (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      <Icon name="alert-circle" size={14} color={colors.error} />
      <Text style={[typography.label, { color: colors.error }]}>{error}</Text>
    </View>
  )}
</View>
```

---

## 10. Layout patterns: szimmetria-megtörés

A merev, egyforma rács (uniform grid) az egyik fő oka annak, hogy egy AI-generált screen "rácsosnak" és személytelennek hat. **Aszimmetrikus, hierarchikus elrendezések** szakszerűbb érzetet keltenek.

### 10.1 Bento Grid (hierarchikus dashboard)

**Mikor használd:** dashboard, analytics screen, info-rich kezdőképernyő, ahol egyetlen monoton lista vagy uniform card grid túl unalmas lenne.

**Lényege:** különböző méretű cellák hierarchikus kompozíciója — mint egy bento doboz:
- **1 nagy cella** (2x2 vagy 2x1) → fő KPI / hero info
- **Több kisebb cella** (1x1, 2x1) → kiegészítő adatok körülötte
- **Konzisztens gutter** (8-16dp) tartja össze
- **Lekerekítés** (8-16dp radius) lágyítja

**Mobil reszponzivitás:** vertikális stackbe omlik le portrait módban — a fő cella felül, kisebbek alatta.

```tsx
// React Native — egyszerű 2x2 bento layout
<View style={{ gap: spacing.sm }}>
  {/* Hero cell — 2x */}
  <View style={[card, { padding: spacing.lg, minHeight: 160 }]}>
    <Text style={typography.label}>Total Revenue</Text>
    <Text style={typography.display}>$24,580</Text>
  </View>

  {/* Side-by-side smaller cells */}
  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
    <View style={[card, { flex: 1, padding: spacing.md }]}>
      <Text style={typography.label}>Active users</Text>
      <Text style={typography.headline}>1,234</Text>
    </View>
    <View style={[card, { flex: 1, padding: spacing.md }]}>
      <Text style={typography.label}>Conversion</Text>
      <Text style={typography.headline}>4.2%</Text>
    </View>
  </View>
</View>
```

❌ **DON'T:** Bento minden screen-en. Ez egy **dashboard / overview** minta. List screen, form, detail view-n NE használd.

### 10.2 Aszimmetrikus list-detail

Tablet / foldable expanded módban:
- Bal panel: **30-40%** width (lista)
- Jobb panel: **60-70%** width (detail)
- **Soha** ne 50/50 — az unalmas és vizuálisan kiegyensúlyozatlan érzetet kelt

### 10.3 Túltöltés tilos

A merev grid másik oka: az AI minden cellát **kitölt** ugyanannyi tartalommal. Hagyj **üres cellát** vagy nagyobb whitespace-blokkokat — ez a "lélegző" hatás kulcsa.

---

## 11. Progressive Disclosure (80/20 elv)

### 11.1 Az alapelv

A felhasználók **80%-a** az **idő 80%-ában** a funkciók **20%-át** használja. A maradék **80% komplexitást rejtsd el** rétegek mögé, hogy ne zavarja a fő flow-t.

**Kérdés minden elem hozzáadása előtt:** *"Erre tényleg most kell, hogy lássa a felhasználó, vagy elérhetjük egy tap-pal mélyebbről is?"*

### 11.2 Disclosure minták

| Minta | Mechanizmus | Mikor használd |
|---|---|---|
| **Expandable cards / accordion** | Cím látszik, részletek tap-ra nyílnak | FAQ, settings groups, optional info |
| **Staged disclosure** | Folyamat több screen-re bontva (1 kérdés / screen) | Onboarding, registration, complex form (>5 mező) |
| **Conditional logic** | Csak akkor jelennek meg mezők, ha az előző válasz indokolja | Form-ok ahol 50%+ user-nek nem kell minden mező |
| **Contextual help** | Tooltip / long-press / "?" ikon | Jargon, advanced opció magyarázata |
| **"Show more" / "See all"** | Lista első N eleme + expand | Hosszú listák, hosszú szöveg |
| **Master-detail navigation** | Lista → részlet külön screen-en | Bármilyen drill-down hierarchia |

### 11.3 Példa: form simplification

```
❌ ROSSZ — "minden látható" form:
[ First name ]
[ Last name ]
[ Email ]
[ Phone ]
[ Company ]
[ Job title ]
[ Address line 1 ]
[ Address line 2 ]
[ City ]
[ State ]
[ Zip ]
[ Country ]
[ Marketing opt-in ]
[ Newsletter opt-in ]
[ Submit ]

✅ JÓ — staged + conditional:
Step 1: [ Email ] → Continue
Step 2: [ Name ] → Continue
Step 3: [ "Sign up for company?" toggle ]
        ↓ Ha "yes":
        [ Company ] [ Job title ]
Step 4: [ "Want updates?" toggle ]
        ↓ Ha "yes":
        [ Marketing ] [ Newsletter ]
[ Submit ]
```

A user kognitív szempontból **kisebb** szakaszokat dolgoz fel egyszerre → kisebb intrinsic load, magasabb completion rate.

### 11.4 Anti-pattern: túl mély rejtés

❌ **NE rejtsd el** a primary akciót 3+ tap mélyen. Progressive disclosure ≠ funkció elrejtése.

**Heurisztika:** ha egy funkciót a user-ek **>50%-a** használja, **látszódjon** az első screen-en.

---

## 12. Állapottervezés (Loading / Empty / Error / Success)

### 12.1 Loading

**Szabály:** ha betöltés > **1 másodperc** lehet, mutass feedback-et.

| Időtartam | Mit mutass |
|---|---|
| <1s | Semmit (instant) |
| 1-3s | Spinner / progress indicator |
| 3-10s | **Skeleton screen** + progress |
| >10s | Részletes progress + cancel opció |

### 12.2 Skeleton vs spinner

**Default választás: skeleton screen.**

A generikus pörgő spinner (loading indicator) **gyengébb** UX, mint a skeleton, mert:
- Üres screen + spinner → "halott", nincs értelmes várakozás
- A user nem tudja, **mit** kap, csak hogy **valami** jön
- Hosszabbnak érződik az időtartam

A **skeleton** a tényleges layout struktúráját mutatja szürke blokkokkal:
- A user már a betöltés alatt **érzékeli a tartalom alakját**
- Csökkenti a perceived loading time-ot
- Folytonosabb az átmenet a betöltött állapotba

```tsx
// React Native — skeleton egy listaelemhez
{isLoading ? (
  <View style={{ padding: spacing.md, gap: spacing.sm }}>
    {[1, 2, 3].map(i => (
      <View key={i} style={{ flexDirection: 'row', gap: spacing.md }}>
        <SkeletonBox width={48} height={48} radius={24} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <SkeletonBox width="80%" height={16} />
          <SkeletonBox width="60%" height={12} />
        </View>
      </View>
    ))}
  </View>
) : (
  <Content data={data} />
)}
```

**Spinner csak akkor jó:**
- Nagyon rövid (<2s) ismeretlen időtartamú művelet
- Inline action (gomb belül loading)
- Olyan művelet, ahol nincs várható tartalom-struktúra (pl. fájl upload progress jobb)

### 12.3 Streaming output

Ha LLM válasz vagy hosszabb adatfetch eredménye **fokozatosan érkezik**: streameld be (token-by-token vagy chunk-by-chunk). A user azonnal látja, hogy "elkezdődött" — sokkal jobb perceived performance, mint 5s teljes várakozás után egyben megjelent szöveg.

### 12.4 Empty state — kötelező elemek
1. **Ikon vagy illusztráció** (lehet egyszerű, ne legyen mock-up érzet)
2. **Magyarázat** (mit lát/nem lát a user, miért)
3. **1 primary akció** ("Add your first task")
4. **Opcionális:** segédlink (help, tutorial)

❌ **DON'T:** üres lista esetén csak fehér képernyő.

### 12.5 Error state
- **Mi történt:** röviden, érthetően, **NEM technikai** szöveg
- **Mit tehet:** retry button vagy alternatíva
- **Fallback navigáció:** "Go back" / "Go to home"

```
❌ "Error 500: Internal server error (uuid: 8a9f...)"
✅ "Couldn't load your messages.  [Retry]  [Go back]"
```

### 12.6 Success
A "happy path" — mutasd az adatot a tervezett hierarchiában. Ha kritikus művelet sikerült (pl. submit), adj **rövid visszajelzést** (snackbar/toast 3-4s) **és/vagy** vidd a következő logikus képernyőre.

---

## 13. Affordancia & feedback

### 13.1 Touch target minimumok

| Platform / standard | Minimum |
|---|---|
| WCAG 2.5.8 (abszolút min) | **24×24 CSS px** |
| Apple HIG | **44×44 pt** |
| Material / Android | **48×48 dp** |
| **Általunk használt:** | **48×48 dp** (legbiztosabb) |

Ikon-only gombnál: ikon legyen ~24dp, körülötte 12dp padding mindenhol → 48dp target.

### 13.2 Visszajelzés szintjei

| Esemény | Visszajelzés |
|---|---|
| **Tap on button** | Ripple (Android) / opacity (iOS) — azonnal |
| **Toggle / switch** | Animált state change, opcionális haptic |
| **Form submit** | Loading state on button + disabled |
| **Submit success** | Snackbar + esetleg navigáció |
| **Async error** | Snackbar / inline error / toast |
| **Destructive action** | Confirmation sheet/dialog **mindig** |

### 13.3 Haptic feedback (mobil-specific)
- Sikerült submit: **light impact**
- Toggle / switch: **selection feedback**
- Error: **error notification haptic**
- **Ne** használd minden tap-ra — irritáló.

```tsx
// React Native
import * as Haptics from 'expo-haptics';
await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

```dart
// Flutter
import 'package:flutter/services.dart';
HapticFeedback.lightImpact();
```

---

## 14. Akadálymentesség (kötelező minimumok)

### 14.1 WCAG 2.2 AA mobile checklista

| Kritérium | Hogyan teljesítsd |
|---|---|
| **1.4.3 Contrast (Min)** | Szöveg 4.5:1, nagy szöveg 3:1 |
| **1.4.11 Non-text Contrast** | UI komponensek 3:1 |
| **1.4.1 Use of Color** | Szín + ikon/szöveg együtt |
| **1.4.4 Resize Text** | 200% scale-ig olvasható (allowFontScaling stb.) |
| **1.4.10 Reflow** | 320 CSS px szélességen 2D scroll nélkül |
| **2.5.5 / 2.5.8 Target Size** | Min 24px (WCAG) / preferált 48dp |
| **2.4.7 Focus Visible** | Focus ring **látható**, 3:1 kontraszt |
| **3.3.2 Labels or Instructions** | Minden input mezőnek **látható label** |
| **4.1.2 Name, Role, Value** | Minden interaktív elemnek `accessibilityLabel` / `Semantics` |

### 14.2 Screen reader támogatás

```tsx
// React Native — minden interaktív elemnek
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Delete message"
  accessibilityHint="Removes this message permanently"
  accessibilityState={{ disabled: isDisabled }}
/>
```

```dart
// Flutter
Semantics(
  label: 'Delete message',
  hint: 'Removes this message permanently',
  button: true,
  enabled: !isDisabled,
  child: IconButton(...),
)
```

### 14.3 Reduced motion
- Tisztelve a rendszerbeállítást: ne legyenek nagy parallax/scale animációk, ha a user `prefers-reduced-motion` jelzett.

```tsx
// React Native
import { AccessibilityInfo } from 'react-native';
const reduced = await AccessibilityInfo.isReduceMotionEnabled();
```

```dart
// Flutter
final reduced = MediaQuery.disableAnimationsOf(context);
```

---

## 15. Performance budget

| Metrika | Cél | Miért |
|---|---|---|
| **App cold start** | <2s onscreen feedback nélkül; >2s → spinner |
| **Frame rate** | 60 fps (16ms/frame), 90/120 ahol elérhető |
| **Tap → visual response** | <100ms |
| **Page transition** | <300ms |
| **Adat fetch UI feedback** | <1s után spinner / skeleton |
| **List rendering** | virtualizáció kötelező 50+ elemnél |

### 15.1 React Native specifikus
- `FlatList` / `FlashList` (Shopify) használata `ScrollView` helyett listáknál
- `keyExtractor` mindig stabil ID (NE index)
- `getItemLayout` ha fix méret, jelentős perf gain
- `React.memo` + `useCallback` a re-render kontrollra

### 15.2 Flutter specifikus
- `ListView.builder` / `SliverList` helyett `ListView`
- `const` constructorok mindenhol, ahol lehet
- `RepaintBoundary` nehéz / animált widget-ek köré
- `cached_network_image` képekhez

---

## 16. Cross-platform implementációs jegyzetek

### 16.1 Platform-filozófiák: Apple HIG vs Material 3

A "professzionális érzet" platform-függő. Ne keverj iOS-féle Material-look-ot, és Androidon ne erőltess Cupertino-t — a felhasználói platform-konvenciók tanult viselkedés, ezeket nem ingyen rúghatod fel.

| Szempont | **Apple HIG** | **Material 3** |
|---|---|---|
| **Filozófia** | Tartalom-központú, minimalista, finom mélység | Strukturális, mozgás-gazdag, rétegezett ("anyag" alapú) |
| **Vizuális elemek** | Lágy rádiuszok, sok whitespace, áttetsző (glassmorphism) hatások | Merész színek, határozott árnyékok, lebegő FAB |
| **Interakció** | Fluid animáció, természetes gesztusok (swipe-back) | Adaptív színpaletták (Material You), feedback-központú mozgás |
| **Hierarchia** | Tipográfia + whitespace dominálja | Elevation (z-index réteg) + szín |
| **Brand expression** | Visszafogott, márka kontextusban | Erőteljesebb, branded color-driven |

**Döntési heurisztika:**
- iOS-only app vagy iOS-first → HIG filozófia
- Android-first vagy cross-platform → Material 3
- Cross-platform RN/Flutter, **egységes look kívánatos** → válassz egyet és **maradj következetes**, ne keverd

### 16.2 React Native — preferred stack
- **Navigation:** `@react-navigation/native` + bottom-tabs + native-stack
- **Theming:** `react-native-paper` (Material 3) VAGY custom theme provider
- **Lists:** `@shopify/flash-list`
- **Safe area:** `react-native-safe-area-context`
- **Icons:** `lucide-react-native` vagy `react-native-vector-icons`
- **Forms:** `react-hook-form` + `zod`
- **Haptics:** `expo-haptics`
- **Gestures:** `react-native-gesture-handler` + `react-native-reanimated`

### 16.3 Flutter — preferred stack
- **Navigation:** `go_router` (declarative, deep link friendly)
- **Theming:** `Material 3` (`useMaterial3: true`) + `ColorScheme.fromSeed`
- **State:** `riverpod` vagy `bloc` (kerüld a setState-t összetett logikára)
- **Forms:** `flutter_form_builder` + `form_builder_validators`
- **Icons:** `Icons.*` (Material) vagy `cupertino_icons`
- **Animations:** `flutter_animate` egyszerű animációkhoz

### 16.4 Platform-aware komponensek
Mobil app-on **NE** próbálj iOS-en is Material-look-ot, vagy Androidon Cupertino-t — a felhasználó elvesztett platform-konvenciói tanult viselkedés. Használd:

- **RN:** `Platform.OS` alapján különbözőség (pl. switch komponens, date picker)
- **Flutter:** `Platform.isIOS` / `Cupertino*` widget-ek vs `Material` widget-ek **kontextusban**

### 16.5 Reszponzív breakpointok

| Breakpoint | Szélesség | Layout |
|---|---|---|
| Compact | <600dp | Single pane, bottom nav |
| Medium | 600-840dp | Single/dual pane, navigation rail |
| Expanded | >840dp | Dual pane (list-detail), nav rail |

---

## 17. Workflow: rough draft → polished screen

A 8 lépéses iterációs folyamat. **Soha ne ugorj át lépést.**

```
1. BRIEF
   └─ Mi a felhasználó célja? (1 mondatban)
   └─ Mi a primary action? Mi a secondary?
   └─ Mi a screen "main object"-je?

2. CONTENT INVENTORY
   └─ Mit kell megjelenítenem? (lista)
   └─ Mit lehet detail view-ba tolni? (progressive disclosure)
   └─ Mit lehet törölni? (80/20)

3. LOW-FI WIREFRAME
   └─ Szekciók sorrendje, nem stílusok
   └─ Min 1 fókuszpont kijelölve
   └─ Állapotok azonosítva (4 db: loading/empty/error/success)
   └─ Thumb zone ellenőrizve (primary action zöld zónában?)

4. FIRST PASS (kód vagy AI generálás)
   └─ Csak struktúra, nincs polish
   └─ Spacing tokenek használata kötelező
   └─ Internal ≤ external szabály ellenőrizve

5. AUDIT (a 3. szekció 5 sarokkő szabálya alapján)
   └─ Hány domináns elem van? (cél: 1)
   └─ Spacing tokenek konzisztensek?
   └─ Hány primary CTA? (cél: 1/szekció)
   └─ Affordancia explicit?
   └─ 4 állapot megvan?

6. CUT (radikális vágás)
   └─ Töröld a "minden szépen elférne" elemeket
   └─ Vond össze a duplikált akciókat
   └─ Mozgasd detail-be a túl korai részleteket
   └─ Cseréld a divider-eket whitespace-re

7. CLEANUP PASS (zaj-tisztítás)
   └─ Ikonográfia ritkítása: ikon csak ha nem nyilvánvaló a szöveg
   └─ Vonalak helyett térköz csoportosít
   └─ Színek korlátozása: brand szín csak primary CTA-ra
   └─ Konténerek de-emphasizálása: vastag border → soft shadow / surface variant
   └─ Off-white text on white (halation csökkentése)

8. ACCESSIBILITY PASS
   └─ Kontraszt ellenőrizve (4.5:1 / 3:1)
   └─ Touch target ≥48dp
   └─ Screen reader label minden interaktív elemen
   └─ Reduced motion respect
   └─ Reflow 320px-en
```

---

## 18. Pre-flight checklista (használd minden válasz előtt)

Mielőtt mobil UI-t generálnál vagy reviewnál, gyorsan futtasd át:

**Hierarchia és fókusz:**
- [ ] **Egy** domináns fókuszpontom van a képernyőn?
- [ ] Csak **1 primary CTA / szekció**?
- [ ] Card csak ott, ahol egyetlen entitás van?

**Spacing és layout:**
- [ ] Spacing csak a 4/8/16/24/32/48 token-ekből?
- [ ] **Internal ≤ external** szabály teljesül?
- [ ] Vannak whitespace-en alapuló csoportok divider helyett?

**Tipográfia:**
- [ ] Body min **16px** (csak label/caption 14)?
- [ ] Csak **3-4** font méret látható?
- [ ] Sorhossz max ~70 karakter?
- [ ] Off-white text on white (NEM tiszta fekete)?

**Ergonómia:**
- [ ] Primary CTA a **green zone-ban** (alsó harmad)?
- [ ] Bottom tab bar címkékkel, max 5 tab?
- [ ] Destruktív akció szándékosan **nem** könnyen elérhető?

**Affordancia és állapotok:**
- [ ] Minden interaktív elem ≥48dp target?
- [ ] Minden ikon-only gomb mellett `accessibilityLabel`?
- [ ] **4 állapot** specifikálva (loading, empty, error, success)?
- [ ] Skeleton (NEM csak spinner) a >1s műveletekhez?

**Akadálymentesség:**
- [ ] Színkontraszt 4.5:1 / 3:1 megvan?
- [ ] Szín + ikon/szöveg együtt jelez (NEM csak szín)?
- [ ] Form: minden mezőnek látható label?

**Kognitív terhelés:**
- [ ] Progressive disclosure használva, ha >5 mező / opció?
- [ ] Extraneus zaj (felesleges divider, redundáns ikon, túl sok szín) kivágva?

**Reszponzivitás:**
- [ ] A képernyő reszponzívan adaptálódik szélességre, nem csak nyúlik?

Ha **bármelyik** "nem" → javítsd ki, mielőtt válaszolsz.

---

## 19. Gyors döntési táblázatok

### 19.1 Card vagy ListItem?

| Tartalom | Komponens |
|---|---|
| Egy entitás (1 termék, 1 user) + több akció | Card |
| Egyenrangú elemek listája | ListItem |
| Termékkártyák browse view-ban | Card grid |
| Beállítások | List with section headers |
| Üzenetek | ListItem (avatar + cím + segédsor) |

### 19.2 Modal, Sheet vagy új screen?

| Cél | Komponens |
|---|---|
| Gyors választás (filter, picker) | Bottom sheet |
| Megerősítés (delete) | Modal alert |
| Kontextuális akciók | Bottom sheet |
| Komplex form (>5 mező) | Új screen (staged disclosure) |
| Részlet (drill down) | Új screen |
| Inline szerkesztés (1 érték) | Inline / sheet |

### 19.3 Tab vagy Drawer?

| Helyzet | Választás |
|---|---|
| 3-5 fő destination, gyakran váltogatott | Bottom tab |
| 6+ destination | Drawer |
| Másodlagos navigáció (settings, help) | Drawer / overflow menu |
| Tablet / large screen | Navigation rail |

### 19.4 Spinner vagy Skeleton?

| Helyzet | Választás |
|---|---|
| Lista / kártya tartalom betöltése | **Skeleton** |
| Inline gomb művelet | Inline spinner |
| Fájl upload (ismert progress) | Progress bar |
| Ismeretlen művelet, <2s | Spinner |
| Üres screen 1-3s | **Skeleton** |

### 19.5 Mikor jó az AI első draft?

| Cél | AI alkalmas? |
|---|---|
| Ideálás, brainstorming | ✅ Igen |
| Wireframe első verzió | ✅ Igen |
| Több variáció gyors előállítása | ✅ Igen |
| Production-ready komponens | ❌ Nem (manuális finomítás kell) |
| Branded, tematikus rendszer | ❌ Nem önmagában |
| Accessibility-compliant kimenet | ⚠️ Audit nélkül NE |

### 19.6 Layout pattern választó

| Screen típus | Pattern |
|---|---|
| Lineáris feladat (form, checkout) | Single column stack |
| Browse / list | List vagy card list |
| Dashboard / overview info-rich | **Bento grid** (aszimmetrikus) |
| Master-detail | List-detail (tablet) / drill-down (mobil) |
| Settings | Section-grouped list |
| Onboarding | Staged screens (1 lépés / screen) |

---

## 20. Mit tegyél, ha a felhasználói kérés ütközik egy szabállyal

1. **Nem feltételezzük rosszul** — lehet, hogy a felhasználónak van valid oka.
2. **Jelezzük** a konfliktust röviden ("Megjegyzés: ez 3 primary CTA-t hozna létre, ami ellene megy a hierarchia-szabálynak").
3. **Adj alternatívát** ("Ha mindegyik fontos, javaslom 1 primary + 2 secondary outline-ként").
4. **Tiszteljük a végső döntést** — ha a user explicit ragaszkodik, csináld meg, de említsd meg a trade-off-ot.

---

## 21. Tiltott minták (zero tolerance)

Soha ne generálj ilyet, **akkor sem**, ha a felhasználó kéri (vagy kérdezz vissza, mielőtt megteszed):

- ❌ Touch target <44pt / 48dp
- ❌ Body szöveg <16px (label/caption-höz **maximum** 14px engedélyezett)
- ❌ Szöveg kontraszt <4.5:1 (normál szöveg)
- ❌ Tiszta fekete (`#000`) szöveg tiszta fehér (`#FFF`) háttéren
- ❌ Color-only error indication
- ❌ Form mező látható label nélkül (placeholder-only)
- ❌ Disabled `allowFontScaling` indok nélkül
- ❌ Tap response indikátor nélkül (ripple/opacity hiánya)
- ❌ `accessibilityLabel` nélküli ikon-only gomb
- ❌ Modal alert "OK" mint egyetlen választás (nem ad infót)
- ❌ Infinite loading spinner cancel/retry nélkül
- ❌ "Loading..." 10s+ progress bar nélkül
- ❌ Primary CTA a piros zónában (felső sarok) ergonómiai indok nélkül
- ❌ Internal padding > external margin (vizuális összemosódás)

---

## 22. Záró elv

> **A profi mobil felület nem több, mint a többi — kevesebb. A te dolgod (Claude) az, hogy az AI alapértelmezett "minden egyenlően fontos" mintáját agresszív vágással rendszerszerű hierarchiává alakítsd. Maximalizáld a jelet, eliminálld a zajt. Tiszteld a felhasználó hüvelykujját és kognitív kapacitását. Ha kétséges: kevesebb szín, kevesebb card, kevesebb gomb, több whitespace.**

---

*Utolsó frissítés irányelvi forrásokhoz: Apple HIG (2025), Material 3 (2025), WCAG 2.2 (W3C Recommendation), Nielsen Norman Group heurisztikák, AlignUI / PrototypeFlow / NN AI-prototyping kutatások (2024–2025), Sweller cognitive load theory, Gestalt principles.*
