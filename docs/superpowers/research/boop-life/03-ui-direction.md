# Boop as a life dashboard — the UI direction

Source: owner conversation 2026-11-13 (`mezo-r36n9.33`), explored in a throwaway simulator spike.
Spike files: `docs/design_2.0/prototypes/boop-ios-spike/BoopSpike/Elet*.swift`, launch `-elet YES`.
Screenshots: `elet-1-ma.png` … `elet-9-mintak.png` in that folder.

## 0. What the owner asked

> "Lesz benne pénz, alvás, edzés, étkezés, levelezés, naptár események, (később életcélok amikhez
> köthető minden előző terület), és a mindent látó AI akitől bármikor bármiről kérdezhetsz és
> nyithatsz egy threadet mint most Claude vagy ChatGPT-ben."

Plus his structural decision of the same day: money and mail are **rooms**, the bottom bar stays
`Ma · Terv · Napló · Boop` + `+`. And the order decision: this is **planned now, built after B6**.

## 1. The trap to avoid

Six areas becoming six tabs, or six differently-shaped screens. Then Boop is a drawer unit, not a
dashboard — and the "one AI that sees everything" has nothing coherent to see. Everything below
exists to prevent that.

## 2. The four ideas

### 2.1 The orb lens grows from the body to the life

Today the hero orb carries five mini orbs: Forma, Alvás, Mozgás, Fuel, Közérzet. **Pénz** and
**Levél** join them as two more, after a hairline divider (body | life). One glance at Ma answers
"how is my whole day", not just "how is my body".

- This is the single visual move that makes it a *life* dashboard rather than a health app with
  bolt-ons. It cost nothing structurally in the spike — seven orbs still fit at 440 pt
  (40 pt orbs, 11.5 pt labels). See `elet-1-ma.png`.
- Both new areas score 0–100 like the rest, so the grammar holds: Pénz 74 = "within the month's
  budget at the expected pace", Levél 58 = "two of today's items want a minute".
- **Open question for later:** seven is the ceiling. An eighth area (life goals? health markers?)
  needs a different mechanism — probably a scrollable lens or a grouped second row.

### 2.2 Money and mail wear the *same* room skeleton as sleep

verdict sentence → the level → the days behind it → what you can do → "kérdezz erről".
No tables, no inbox list, no spreadsheet. See `elet-4-penz.png`, `elet-5-level.png`.

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

### 2.3 The proposal card becomes the cross-area organ

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

### 2.4 The Boop tab becomes a thread list

The owner's own reference is Claude/ChatGPT. So: a thread list (`elet-6-szalak.png`), each row
carrying its **area orbs** so you see at a glance which parts of your life a thread is about; one
pinned thread; "Új szál" at the top. Opening one (`elet-7-szal.png`) is an ordinary conversation
that quotes real numbers from several areas at once.

The important half is the **reverse direction**: every room and every card carries a
**"Kérdezd meg Boopot a…"** row that opens a *new thread already holding that card's data*. The
thread list is therefore not a separate chat app — it is the memory of every question the screens
provoked.

### 2.5 Terv's top level becomes the life goal

`elet-8-cel.png`. A life goal ("Nyárra formába kerülni", 31 weeks left) with **every area hanging
under it as a progress leg** — including money ("Havi 60 000 Ft félretéve") and mail ("Csak az
számít, ami a célhoz tartozik"). The existing Terv content (weight goal, diet plan, mesocycle)
becomes the body legs of that goal rather than the page itself.

This is what makes "life goals you can tie every area to" concrete: a goal is not a number, it is
**the thing that makes six areas one story**.

### 2.6 Napló · Minták becomes cross-area

`elet-9-mintak.png`. The patterns only get interesting once money and mail are in the corpus:

- "Azokon a heteken, amikor az étteremre költés 80 000 Ft fölé megy, a rá következő héten
  átlagosan 0,4 kg-mal többet mutat a mérleg."
- "A hat eseménynél zsúfoltabb napok után a mély alvásod 18 perccel rövidebb."
- "Három hét alatt 612 levélből 36-ot nyitottál meg — a többit ezentúl csendben szűröm."

## 3. The honest fork

If the AI truly sees everything, the **conversation** may become the real home and the screens
become what it shows you mid-answer. The spike deliberately does **not** take that turn: the daily
rhythm (morning plan → evening close) is the thing that works today, and a chat window would throw
it away. But the thread list + the "kérdezz erről" doors keep the road open: if the owner finds
himself living in the Boop tab, promoting it costs a bar reorder, not a rebuild.

## 4. What this costs in B-slice terms

Nothing before B6 — this is a design, not a build (owner decision 8, `14-decisions.md`). What it
*does* change in what is being built now, so B8 is not torn up later:

1. **B8 "one AI" must treat area contributors as an open set**, not a fixed five-expert list.
   The "miért?" renderer already takes `(area, line)` pairs; keep it that way.
2. **The memory corpus schema** should admit non-biometric daily facts (a cost, a mail verdict)
   with the same day-scoping as a check-in, so B8's day council needs no second ingestion path.
3. **The lens is a list, not five hard-coded slots.** Wherever the five metrics are an enum today,
   B4/B5/B6 should not add a sixth assumption of "exactly five".
4. **Two new glyphs** (coin, envelope) are needed and do not exist in the sprite. They are drawn
   inline in the spike (`EGlyph` in `EletRoot.swift`, 64-unit grid, outlined like the sprite's
   `check-ink` set) and need the owner's OK before they enter the shared sprite — coordinate with
   the icon work in `mezo-r36n9` (session `boop-ikon`).

## 5. Open questions for the owner

1. Seven orbs — is the body | life divider the right split, or should money and mail be visually
   quieter (smaller, no number) until they have something to say?
2. Should the mail digest *notify* (push) when something scores high, or only ever appear in Ma?
   Prior art (`01-mail-digest-research.md` §6, MailGester) says the notification policy is what
   decides whether a digest gets read at all.
3. Is one life goal at a time right, or several (work / health / money) with areas shared between
   them?
