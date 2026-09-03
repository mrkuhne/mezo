# „Összes értesítés" feed-oldal — design

- **bd:** `mezo-nol0` (lezárja: `mezo-61w0`, `mezo-h682`)
- **Dátum:** 2026-08-31
- **Érintett felület:** frontend PWA — Én-spine aloldalak + a shell fejléc értesítés-dropdownja

## Probléma

Az értesítés-feednek **nincs felülete**. Ami van:

- a shell fejléc csengője egy 3 soros peek-menüt nyit (`AppHeader.tsx`), aminek a lábléce
  „Összes értesítés ›" — és a `/me/ertesitesek`-re visz;
- `/me/ertesitesek` viszont a `NotificationsPage`: az értesítés-**beállítások** oldala
  (push-feliratkozás, kategória-kapcsolók, forecast). A feedet nem rendereli.

Tehát a „mutasd az összeset" gesztus egy zsákutcába vezet, és a feed 3 elemnél többet sosem mutat.

Ebből következik a második baj: `markAllRead` (`data/notification/feedHooks.ts`) egyetlen hívója a
holt `NotificationBell.tsx`, amit csak a saját tesztje példányosít. A fában **nincs elérhető
útvonal, ami olvasottá tenne egy értesítést**, tehát a fejléc olvasatlan-badge-e minden képernyőn
véglegesen ég (`mezo-61w0`).

## Célállapot

Egy valódi feed-oldal a Mozaik/Huawei csempe→saját-teljes-oldal mintában, amely egyben a hiányzó
`markAllRead` hívó.

## Döntések

| # | Kérdés | Döntés |
|---|---|---|
| D1 | Ki viszi a `/me/ertesitesek` nevet? | A **feed**; a beállítások `/me/ertesitesek/beallitasok`-ra költözik |
| D2 | Mitől lesz olvasott egy értesítés? | Az oldal megnyitása mindent olvasottá tesz, nyitáskori pillanatképpel a kiemeléshez |
| D3 | Lista-tagolás | Nap szerinti csoportok (`Ma` / `Tegnap` / dátum) |
| D4 | Család-ikonok | **Clay** ikonok, nem emoji |

D1 következménye: a fejléc dropdown lábléce **változtatás nélkül** a helyes helyre visz.

## Útvonalak

| Út | Ma | Ezután |
|---|---|---|
| `/me/ertesitesek` | `NotificationsPage` (beállítások) | **`NotificationFeedPage`** (új) |
| `/me/ertesitesek/beallitasok` | — | `NotificationsPage`, tartalmilag változatlan |

Együtt mozog vele:

- `EnHubPage.tsx` `Értesítés` csempéje → `/me/ertesitesek/beallitasok`
  (`aria-label` marad `Értesítések beállításai`).
- `NotificationsPage` `PageHead` címkéje `‹ Én` → `‹ Értesítések` (a `navigate(-1)` viselkedés marad).
- A fejléc dropdown lábléce (`AppHeader.tsx`) **nem változik**.

## Az oldal anatómiája

Új `frontend/src/features/me/pages/NotificationFeedPage.tsx`. Váz a `NapMezoPage` receptje szerint:

```
MozaikPage tone="sky"
  PageHead onBack={() => navigate(-1)}      (a PageHead alapértelmezett „‹ vissza" címkéjével)
      + jobbra egy „Beállítások ›" gomb → /me/ertesitesek/beallitasok
  PageHero name="Értesítések" icon="i-ertesites" big={<nyitáskori olvasatlan szám>}
           sub="{items.length} értesítés"
  PageBody
    EntranceGroup
      <nap-csoport fejléc>          Ma
        <sor> <sor> <sor>
      <nap-csoport fejléc>          Tegnap
        <sor>
      <nap-csoport fejléc>          aug 28.
        <sor> <sor>
```

Egy **sor** (`<button>`, hogy billentyűzetről is elérhető legyen):

- balra a család clay-ikonja a `tint` színfoltjában,
- cím (1 sor, ellipszis), alatta a törzs 2 sorra vágva (`body` lehet `null` — akkor nem renderel),
- jobbra az idő `HH:mm`,
- olvasatlan állapotban kiemelt háttér + coral pötty,
- koppintásra `navigate(n.deeplink)`.

Üres feed: `GhostState` („Még nincs értesítésed."), nem fabrikált nulla.

A `PageHead` vissza-gombja `navigate(-1)`, a `PageHead` alapértelmezett „‹ vissza" címkéjével: az
oldal a fejléc dropdownjából BÁRMELYIK útvonalról elérhető, tehát egy fix „‹ Én" hazudna. A
`PageHero` `big` értéke a **nyitáskori** olvasatlan-szám (lásd lent) — nem fut nullára a szemünk
előtt attól, hogy a `markAllRead` lefutott —, a `sub` pedig az összes elem száma.

### Nap-csoportosítás

**Nem írunk újat.** `frontend/src/features/notification/logic/groupByDay.ts` már létezik és
tesztelt (`groupByDay.test.ts`); ma egyetlen hívója a törlésre ítélt `NotificationPanel`. A
függvényt **kiszélesítjük**, nem duplikáljuk:

```ts
export interface FeedGroup { label: string; items: AppNotificationView[] }
export function groupByDay(items: AppNotificationView[], today: string): FeedGroup[]
```

- A `label` típusa a mai `'Ma' | 'Tegnap' | 'Korábban'` unióról `string`-re szélesedik.
- A `Ma` és a `Tegnap` bucket változatlan.
- A `Korábban` egyetlen gyűjtőbucketje **naponkénti csoportokra** bomlik, `aug 28.` alakú
  címkékkel (`toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })`) — egy teljes
  oldalon a „Korábban" alá söpört két hét használhatatlan, a dropdown 3 sorában viszont pont jó
  volt. A dátum-csoportok egymás közt csökkenő sorrendben, a `Tegnap` után.
- A `today` paraméter marad `string` (`localDateString()` a hívó oldalán), tehát a függvény
  továbbra is pure és fagyasztható órával tesztelhető.

A szélesítés a mai egyetlen hívót nem érinti, mert az ugyanabban a körben törlődik.

## Olvasottság

Belépéskor egyszer:

```
snapshot ← az éppen olvasatlan id-k halmaza (useRef, mount-kor egyszer)
ha snapshot nem üres → markAllRead()
```

A kiemelést a lista a `snapshot`-ból rajzolja, nem az élő `readAt`-ból. Így a badge azonnal
nullázódik, de amíg az oldalon vagy, látod, mi volt új — ez a `NotificationBell` már megírt
szemantikája, és ugyanaz az idióma, mint a Mezo-üzenetek nyitáskori vízjele.

`markAllRead` optimista frissítést csinál (`onMutate` a `feedHooks.ts`-ben), tehát a fejléc badge
hálózati kör nélkül tűnik el; mock módban a mutáció no-op, a cache-frissítés attól még megtörténik.

## Clay ikonok a családoknak

`APP_NOTIFICATION_KIND_META` (`data/types.ts`) kap egy `clay` mezőt az `emoji` és a `tint` mellé.
Az `emoji` mező **marad** — ez a kör nem vállalja a felkutatását, hogy ki más olvassa.

| kind | clay |
|---|---|
| `pattern_inbox`, `pattern_signal`, `hypothesis_new` | `i-minta` |
| `fact_candidate`, `fact_reinforced` | `i-tudas` |
| `memoir_ready` | `i-memoar` |
| `prediction_new`, `prediction_outcome` | `i-kristaly` |
| `experiment_proposed`, `experiment_closed` | `i-lombik` |
| `challenge_event` | `i-kihivas` |
| `memory_note` | `i-rend` |

A `tint` értékek (`pattern` / `knowledge` / `memoir` / `prediction` / `experiment` / `memory`)
változatlanok; a sor ikonfoltja `.nf-ico.nf-t-<tint>` osztályt kap.

## Törlés: a holt csengő-páros

`features/notification/components/NotificationBell.tsx`, `NotificationPanel.tsx` és a
`NotificationBell.test.tsx` a törölt `AppHero` maradéka — csak a saját tesztjük hivatkozik rájuk.
Amit csináltak (peek + `markAllRead` nyitáskor), azt most a fejléc dropdownja és ez az oldal
együtt lefedi. Mindhárom fájl törlődik; ha `NotificationPanel`-nek más hívója is akad, az a
kivezetés blokkolója — akkor marad, és a terv ezt jelzi. Lezárja: `mezo-h682`.

## CSS

A családi tint-paletta **már létezik**, csak rossz helyen: a `.nf-panel .nf-ico.pattern` …
`.nf-ico.memory` szabályok (`prototype.css` ~2722–2728) a törlésre ítélt panel alá vannak
skópolva, és a `.nf-dot` is. Ezeket **kiskópoljuk** (`.nf-panel ` prefix nélkül), a panel többi
szabálya (`.nf-panel`, `.nf-bell`, `.bell-badge`, `.nf-head`, `.nf-title`, `.nf-scroll`,
`.nf-empty`, `.nf-item`, `.nf-txt`, `.nf-b`) pedig a komponenssel együtt törlődik. Az `.nf-ico`
mérete 32px marad, de a tartalma emoji helyett `ClayIcon` lesz.

Új szabály csak arra kell, amit az oldal hoz: `.nf-page` scope alatt `.nf-daylabel` (a
`.nf-group` uppercase-recept átemelve), `.nf-row`, `.nf-row.unread`, `.nf-t`, `.nf-x` (2 soros
clamp), `.nf-time`. Színek kizárólag meglévő tokenekből (`--dv-lav`, `--dv-sage`, `--dv-sky`,
`--dv-amber`, `--primary-base`, `--surface-recess`, `--divider`, `--text-*`) — új nyers hex nem
kerül a fájlba.

## Tesztek

`frontend/src/features/notification/logic/groupByDay.test.ts` — a meglévő teszt kibővítve: a
`Ma`/`Tegnap` esetek maradnak, plusz a `Korábban` felbontása naponkénti címkékre, a dátum-csoportok
csökkenő sorrendje, üres bemenet, és a hónapforduló (aug 1-jén egy júl. 31-i elem `Tegnap`-ot kap,
egy júl. 30-i pedig `júl. 30.` címkét).

`frontend/src/features/me/pages/NotificationFeedPage.test.tsx`:

- a nap-csoportok a helyes sorokat fogják (a mock seed 3 mai + 3 régebbi elemével);
- egy sor koppintása a `deeplink`-re navigál;
- a nyitáskor olvasatlan sorok **kiemelve maradnak**, amíg az oldalon vagyunk;
- üres feed → `GhostState`, és nincs nap-csoport fejléc;
- a „Beállítások ›" gomb a `/me/ertesitesek/beallitasok`-ra visz.

`frontend/src/app/notificationRoutes.test.tsx` (új, a route-váltás és a badge-kör pinje):

- `/me/ertesitesek` a feedet rendereli, `/me/ertesitesek/beallitasok` a kapcsolókat;
- a fejlécből az „Összes értesítés ›" a feedre visz;
- **a fejléc olvasatlan-badge-e eltűnik**, miután a feed-oldalt megnyitottuk és elnavigáltunk —
  ez a `mezo-61w0` regressziós pinje.

`EnHubPage.test.tsx` — az `Értesítések beállításai` csempe célja az al-útvonalra frissül.

## Amit ez a spec NEM tartalmaz

- Nincs család-szűrő és nincs lapozás/végtelen görgetés — a feed napi néhány elem.
- Az `emoji` mező nem kerül ki az `APP_NOTIFICATION_KIND_META`-ból.
- A `NotificationsPage` (beállítások) tartalma egyetlen sorral sem változik a vissza-címkéjén túl.
- A backend `/notifications/feed` szerződése változatlan.
