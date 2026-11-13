# Boop as a life dashboard — the UI direction

Source: owner conversation 2026-11-13 (`mezo-r36n9.33`), explored in a throwaway simulator spike.
Spike files: `docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Elet*.swift`, launch `-elet YES`.
Screenshots: `elet-1-ma.png` … `elet-15-miert.png` in that folder (round 4).

## 0. What the owner asked

> "Lesz benne pénz, alvás, edzés, étkezés, levelezés, naptár események, (később életcélok amikhez
> köthető minden előző terület), és a mindent látó AI akitől bármikor bármiről kérdezhetsz és
> nyithatsz egy threadet mint most Claude vagy ChatGPT-ben."

Plus his structural decision of the same day: money and mail are **rooms**, the bottom bar stays
`Ma · Terv · Napló · Boop` + `+`. And the order decision: this is **planned now, built after B6**.

## 1. Round 1 and what the owner rejected (2026-11-13)

The first spike put the seven areas in an **orb strip at the top of Ma** and kept the
Reggel/Napközben/Este chips. The owner's verdict, verbatim:

> "zavaros, hogy fent van 7 terület alul meg az 5 gomb, valahogy nem áll így össze és nincs is meg
> a life dashboard érzet ezzel a reggel napközben este résszel."

Three real faults, and they are worth writing down because they are easy to repeat:

1. **Two menus stacked.** Seven orbs on top are a menu; the five-item bar below is another menu.
   They are not even the same kind of thing (areas vs. places), so the screen reads as confused.
2. **A switch for something you scroll anyway.** The phase chips jumped to a part of a page the
   thumb reaches in one flick. They looked like navigation and did almost nothing.
3. **Seven dots are not a dashboard.** A 40 pt orb with a number is a status light, not an
   overview. "Látsz mindent" needs actual content on the surface, not seven indicators.

His own shape, which round 2 implements: *"van egy főképernyő amin rajta van … a teljes reggel
napközben este görgethetően, ott látsz mindent és valamilyen orb. de … ha valamelyik fő területre
bemegyek akkor legyen annak már egy saját dashboard oldala … mintha az egy full saját app lenne."*

## 2. The trap to avoid

Six areas becoming six tabs, or six differently-shaped screens. Then Boop is a drawer unit, not a
dashboard — and the "one AI that sees everything" has nothing coherent to see. Everything below
exists to prevent that.

## 3. The ideas (round 2)

### 3.1 One home screen: the day in a single scroll, one orb

`elet-1-ma.png`. **One** orb (the day itself, 78), one verdict sentence that spans the whole life
("Kipihent vagy, a pénzed a kereten belül, és két levél jött, ami megér egy percet"), then the day
from waking to bedtime as a single uninterrupted list. **Reggel / Napközben / Este are headings
inside that list, not a control.** The `MOST` marker sits where the clock is, and the proposal
cards appear there.

The mail and money events are rows in that list like any other — `A reggeli posta · 34 levél`,
`Spar · 8 240 Ft` — with the same glyph circle, the same action pill. Nothing marks them as a
different *kind* of thing, which is the point.

Mechanics that mattered: the hero is 60% of the screen height (72% left the day too far down),
the orb is 126 pt, and a compact glass pill (`Ma · 13:40 · 78`) takes over once you scroll past it.

### 3.2 The areas are wide cards further down the same scroll — loud ones first

`elet-2-teruletek.png`. Under a **"A területeid"** heading, each area that has something to say
today is a **full-width card**: its orb + name, its verdict sentence, a big number with a caption,
and seven days as small bars. Three such cards fit the thumb comfortably.

The areas that are fine today collapse into **one row** — "Ezek ma rendben vannak", with their
orbs as a row of dots — which expands into thin rows (orb · name · verdict · number · chevron).

- Order is **by what matters today**, not fixed. In the spike Levél, Pénz and Edzés are loud;
  Alvás, Étel and Energia are quiet. This keeps the scroll short on a calm day and is what makes
  a growing number of areas survivable — the open question of round 1 (what happens at eight
  areas?) answers itself.
- This replaced the seven-orb strip entirely. Compare: a 40 pt orb with a number told you
  "Pénz 74"; the card tells you "A kereten belül vagy, de az éttermek elfogytak · 281 600 Ft a
  havi 610 000-ből, a 13. napon" with a week of bars beside it. That is the difference between a
  status light and a dashboard.

### 3.3 Money and mail wear the *same* skeleton as sleep — and every area gets its own app

Tapping an area card opens **its own full page with its own top tabs** — the owner's "mintha az
egy full saját app lenne". The painted head keeps the area's sky, verdict and orb; the tabs below
it are that area's rooms. All seven are real in the spike, from one data-driven page component
(`EletAreaPage` + `EAreaContent`), which is the proof that the pattern scales rather than needing
seven bespoke screens:

| Area | Its own tabs |
|---|---|
| **Pénz** | Ma · Keretek · Előzmények · Tervezett (`elet-4`, `elet-5`) |
| **Levél** | Ma · Figyelt · Szabályok · Fiókok (`elet-6`, `elet-7`) |
| **Étel** | Ma · Receptek · Hét (`elet-8`) |
| **Alvás** | Ma · Hét · Előzmények |
| **Edzés** | Ma · Edzések · Előzmények |
| **Energia** | Ma · Check-inek · Minták |
| **Forma** | Ma · Mi hat rá |

Inside a tab the page speaks one language — a headline level with an optional white waterline,
week bars, named rows with their own bars, bullet lists, a paragraph, and an actions card that
always ends in the thread door. Every tab is content the owner can actually read, not a stub:
*Pénz · Előzmények* shows six months with October lit and three observations; *Levél · Szabályok*
spells out what never reaches a machine (bank, login codes, medical) and exactly what is stripped
before anything does.

| | Pénz | Levél |
|---|---|---|
| **Verdict** | "A kereten belül vagy" | "Két dolgot nézz meg" |
| **The level** | month budget bar with a **white waterline** = where you should be on day 13 | 34 arrived / 31 handled / 2 worth a minute |
| **The days behind** | this week's spend bars, the heaviest day lit | the items themselves, each with a 1–10 score |
| **Actions** | record a cost · budgets | mailboxes · what to watch |

The mail room's item card is the one genuinely new component: sender → what it is → **1–10 score**
→ a coloured **price verdict** (`Olcsóbb, mint máshol` / `A szokásos ára` / `Nem tudtam
ellenőrizni`, the three-level honesty the research in `01-mail-digest-research.md` §7 forces on us)
→ one line of goal relevance with the Forma orb beside it → `Megnyitom` / `Nem érdekel`.
The other 31 mails collapse into one expandable row, by category, so the day's noise is *visibly*
absorbed rather than hidden.

### 3.4 The proposal card becomes the cross-area organ

A proposal is already the unit of "Boop suggests, you tap". With money and mail in, a proposal can
finally say something no single-domain app can:

> **"A futócipő, amit kinéztél, ma 32%-kal olcsóbb"** — 30 590 Ft helyett 38 400. ·
> *4 terület szólt hozzá* · **miért?**

and behind "miért?" (`elet-3-miert.png`), the areas speak as labelled lines, exactly as the B2
pattern already does for the body experts:

- **Pénz** — "A havi keretedbe belefér, és nincs mellette másik nagy tétel a héten."
- **Levél** — "A márka leveleit eddig 11-szer dobtam ki — ez az első, amelyik tényleg olcsóbb."
- **Mozgás** — "A mostani cipőd 780 kilométernél jár, a futóidőid három hete lassulnak."
- **Forma** — "A nyári célodhoz heti három futás kell. Ehhez a cipő nem luxus, hanem feltétel."

This needs no new UI — it is the existing card with two new contributors. **That is the proof the
spine survives the expansion.**

### 3.5 The Boop tab becomes a thread list

The owner's own reference is Claude/ChatGPT. So: a thread list (`elet-9-szalak.png`), each row
carrying its **area orbs** so you see at a glance which parts of your life a thread is about; one
pinned thread; "Új szál" at the top. Opening one (`elet-10-szal.png`) is an ordinary conversation
that quotes real numbers from several areas at once.

The important half is the **reverse direction**: every room and every card carries a
**"Kérdezd meg Boopot a…"** row that opens a *new thread already holding that card's data*. The
thread list is therefore not a separate chat app — it is the memory of every question the screens
provoked.

### 3.6 Terv is the home of the areas (owner decision, 2026-11-13)

`elet-11-terv-teruletek.png`, `elet-12-terv-etel.png`. The owner's next question after round 2 was
the one the design still owed an answer to: *"hogy fogunk átmenni a fő domain területekre?"* With
the orb strip gone, the only doors were a row in the day and a long scroll to the bottom of Ma.

Three options were put to him — a fifth bar button, keeping the scroll, or **making Terv the home
of the areas**. He chose Terv, which is also the semantically right answer: **the areas are the
legs of the goal**, so the page that holds the goal is the page that holds them.

So Terv is now: the life goal in the painted head ("Nyárra formába kerülni · 31 hét van hátra"),
then **"A területeid"** — one card per area, each carrying *both* identities at once:

- the area's name and orb, and **today's verdict** ("Jó úton jársz · 38 g eddig"),
- what it contributes **to the goal**, with a progress bar ("Napi 165 g fehérje · 36% · 14 napból
  5-ön jött össze").

Tapping a card opens that area's own page (§3.3). The bottom bar keeps four items, and now tells
one clean story: **Ma** = what is happening now · **Terv** = my goal and my areas · **Napló** =
what happened · **Boop** = I ask.

The other doors stay and are the fast paths: a row in the day (tap lunch → Étel), the loud cards
at the bottom of Ma, and the `+` when you only want to record something.

**Naming:** the spike also moved to the spine's own vocabulary — Fuel → **Étel**, Mozgás →
**Edzés**, Közérzet → **Energia**. The owner names the areas that way himself
("étkezés, edzés, pénz, alvás"), and it matches the B2 room names.

### 3.7 Napló · Minták becomes cross-area

The Napló patterns only get interesting once money and mail are in the corpus:

- "Azokon a heteken, amikor az étteremre költés 80 000 Ft fölé megy, a rá következő héten
  átlagosan 0,4 kg-mal többet mutat a mérleg."
- "A hat eseménynél zsúfoltabb napok után a mély alvásod 18 perccel rövidebb."
- "Három hét alatt 612 levélből 36-ot nyitottál meg — a többit ezentúl csendben szűröm."

### 3.8 Round 4 — the briefing, the area grid, and an area that feels like an app

The owner's third pass (2026-11-13): *"a reggeli köszöntő … most nem mond sokat"*, *"a területeknél
lehet egy sorban két terület és az Orb nagyban … egy számmal és értesítés ikonnal"*, and the
sharpest one: *"maguk a területek mögötti részek nagyon unalmasak … semmi dashboard feeling …
most csak listák. pedig nagyon feature-gazdag az étel, az edzés, a pénzügyek, a levelezés."*

**The morning briefing** (`elet-2-reggeli-koszonto.png`) grew from one sentence into a premium
card: a `BOOP MONDJA · 08:10` header with a **Hallgatom** button, a serif lead line, three short
paragraphs that each take a glance into a different part of the life (sleep and Forma · calendar
and why the workout moved · mail and money), a **chip strip** that peeks into all six areas at
once, a hairline, **"A nap három dolga"** as three numbered rows, and the accept/modify pills.
It reads like something written for him, not a status line.

**The areas on Terv** (`elet-5-terv-racs.png`) are now **two per row**, each with a **big orb
carrying its number** and a **bell badge** saying how much there is to look at inside — the badge
count is derived, not hand-written (`EAreaContent.badge`, the sum of the area's tab badges), so it
stays true as content changes.

**The area pages** got a real vocabulary instead of lists (`EletKit.swift`):

| Component | What it does |
|---|---|
| `EHighlight` | the one thing worth reading, in the area's colour |
| `EStatRow` | 2–3 stat tiles, one of them lit, with trend arrows |
| `ECurve` | a smooth curve with gradient fill, a dashed target line, a "now" marker, auto-scaled to its own range |
| `EComposition` | one bar split into named parts, with a wrapping legend |
| `ERowList` | detailed rows: glyph medallion, title + badge, sub, optional level bar, right-hand value |
| `EHeat` | a week/hour heat strip |
| `EMenuGrid` | a 2-column menu of what else the area can do, with badges — the "menüpontok" |
| `EBadge`, `EChip`, `FlowRow` | counts, briefing chips, and wrapping that survives 320 pt |

Each area's tabs now carry their own badges, and the page has a search and a settings button in
the corner. Pénz has a month curve against the even-pace line, a five-part composition and the
day's transactions; Levél has an arrival heat strip and a price history for a watched product;
Étel has the day's intake curve, a macro composition and the meals; Edzés has today's five
exercises with the suggested weight bump.

## 4. The honest fork

If the AI truly sees everything, the **conversation** may become the real home and the screens
become what it shows you mid-answer. The spike deliberately does **not** take that turn: the daily
rhythm (morning plan → evening close) is the thing that works today, and a chat window would throw
it away. But the thread list + the "kérdezz erről" doors keep the road open: if the owner finds
himself living in the Boop tab, promoting it costs a bar reorder, not a rebuild.

## 5. What this costs in B-slice terms

Nothing before B6 — this is a design, not a build (owner decision 8, `14-decisions.md`). What it
*does* change in what is being built now, so B8 is not torn up later:

1. **B8 "one AI" must treat area contributors as an open set**, not a fixed five-expert list.
   The "miért?" renderer already takes `(area, line)` pairs; keep it that way.
2. **The memory corpus schema** should admit non-biometric daily facts (a cost, a mail verdict)
   with the same day-scoping as a check-in, so B8's day council needs no second ingestion path.
3. **Areas are a list, not five hard-coded slots**, and an area page is **one component driven by
   data**, not a bespoke screen each. Wherever the five metrics are an enum today, B4/B5/B6 should
   not add a sixth assumption of "exactly five"; and the Étel/Edzés inner-tab pattern of B2 should
   be generalised into the shared area-page component rather than written twice.
4. **Two new glyphs** (coin, envelope) are needed and do not exist in the sprite. They are drawn
   inline in the spike (`EGlyph` in `EletRoot.swift`, 64-unit grid, outlined like the sprite's
   `check-ink` set) and need the owner's OK before they enter the shared sprite — coordinate with
   the icon work in `mezo-r36n9` (session `boop-ikon`).

## 6. Open questions for the owner

1. The loud/quiet split on the home screen — is "three cards + one collapsed row" the right
   balance, or should every area always show its card? (Terv always shows all six.)
2. Should the mail digest *notify* (push) when something scores high, or only ever appear in Ma?
   Prior art (`01-mail-digest-research.md` §6, MailGester) says the notification policy is what
   decides whether a digest gets read at all.
3. Is one life goal at a time right, or several (work / health / money) with areas shared between
   them?
