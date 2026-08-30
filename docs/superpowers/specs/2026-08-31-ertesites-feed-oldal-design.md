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

Tiszta függvény, `frontend/src/features/me/logic/notificationGroups.ts`:

```ts
groupByDay(items: AppNotificationView[], now: Date): { label: string; items: AppNotificationView[] }[]
```

- Az elemek `occurredAt` szerint csökkenő sorrendben, a csoportok is.
- A címke a **helyi** naptári nap alapján: ma → `Ma`, tegnap → `Tegnap`, egyébként `aug 28.`
  (`toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })`).
- Pure: nincs React, nincs hook, nincs `new Date()` a törzsben — a `now` paraméter jön kívülről,
  hogy a teszt fagyaszthassa az órát.

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

Új blokk a `prototype.css` végére, `.nf-*` prefixszel: `.nf-daylabel`, `.nf-row`, `.nf-row.unread`,
`.nf-ico` + a hat `.nf-t-<tint>` variáns, `.nf-t` (cím), `.nf-x` (törzs, 2 soros clamp),
`.nf-time`, `.nf-dot`. A színek meglévő tokenekből jönnek — új nyers hex nem kerül a fájlba.

## Tesztek

`frontend/src/features/me/logic/notificationGroups.test.ts` — a pure függvény: ma/tegnap/dátum
címkék fagyasztott órával, csökkenő rendezés csoporton belül és csoportok között, üres bemenet,
és a hónapforduló (aug 31. → júl. 31-i elem `júl. 31.` címkét kap, nem `Tegnap`-ot).

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
