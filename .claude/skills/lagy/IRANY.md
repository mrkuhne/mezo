# Lágy — the canon (irány, elvek, szabályok)

Everything below was decided with the owner while building Fuel (2026-11-04, `mezo-pi0jf` comments, the
version log in `docs/design_2.0/prototypes/kepes/README.md` v1–v23). **Owner decisions are not
re-litigated.** When a rule here and your taste disagree, the rule wins; when this file is silent, do what
Fuel does (`docs/design_2.0/prototypes/kepes/b/`).

## 1. Who we build for and how we talk

- The owner is a Hungarian non-engineer product owner. Every chat message in Hungarian, business words,
  no file / code / class names. Decisions: helyzet → gond → 2–3 options table (everyday cost) → ajánlás.
- Direct instructions are carried out immediately. Never push a direction change, never ask "which
  direction wins". Short reports; tables for multi-part changes.
- He reviews on the Artifact (desktop pane and phone). The in-app browser cannot open artifact URLs:
  verify locally, publish for him.

## 2. The direction in one paragraph

**Lágy** = soft, clean, professional, iOS-native feel. Light warm paper ground, white cards with one soft
shadow, rounded generously; **one accent colour** (sage green) with a deep green for emphasis; soft
supporting hues only inside graphics and tints (peach, sun, sky, berry). Two typefaces: **Outfit**
(display, numbers) + **Manrope** (body). Own logo mark (rounded square, two arches, a small sun dot).
Own glyph family drawn with `G(name, palette)` — soft gradient shapes. **Real-looking food / material
photography** carries the emotion; graphics carry the numbers. Informative but never flooding: the eye is
led to one thing per screen.

Tokens (keep exactly): `--paper #F6F4EF · --card #FFF · --ink #1E2321 · --ink2 #5A635E · --mute #8E968F ·
--sage #5FB08A · --sage2 #A8D5BA · --sage3 #E6F2EA · --deep #2E6B52 · --peach #F0B48C · --peach2 #FBE6D6 ·
--berry #8E5BB5 · --sky #8CC3E8 · --sun #F4C860`. Macro colours: fehérje `#E09A6A`, szénhidrát `#E2B24A`,
zsír `#8FBF9F`, víz `#6FAEDC`, rost `#B79AD8`, kalória `#2E6B52`.

## 3. ARANYSZABÁLY — every tab, inner page and sheet, no exceptions

1. **Photo.** Tabs: full-bleed photo head. Inner pages: photo head with back button + crumb (`ihead`).
   Rows: photo thumbnails or photo stacks. Sheets: a photo strip or photo rows. No photo exists → a stock
   / material photo, with the item's glyph in a white round badge.
2. **A custom graphic for the numbers** — ring + bars, level tubes, a three-column card, a macro-split
   ring, a stacked macro bar. **Never bare number tiles.**
3. **Clear sectioning:** one sentence (the verdict) → section heads → cards. One object, one card shape.
4. **Chips for small facts** (§7). Never bare grey text beside a name.
5. **Colour:** exactly **one deep-green card** per page (`.card.deep`) for the page's key number, **one or
   two soft tints** (`.t-peach .t-sun .t-sky .t-berry .t-sage`), everything else white.
6. **A Mezo card** (`mzCard`, with the small figure) at the end when Mezo has something concrete to say
   (a plan, a fix, a warning) — with one soft action when there is one.

A page that is "only an inner page" or "only a sheet" gets all six. The owner caught a plain inner page
once (A hét napjai) and made this the golden rule.

## 4. Page skeletons

**Tab (`phead`)**: the photo **is** the page top — edge to edge, 440 px (400 at 320), dark ground behind
it. On it: logo + avatar, the domain's tabs as glass pills, then at the foot: eyebrow (small caps), title,
one line, **one** white action pill. The paper panel (`.body`) **rises over the photo** (−32 px, 34 px top
radius). Then: the verdict sentence (h1, accent words in deep green) → the deep-green card → sections →
Mezo. No second hero below the photo.

**Inner page (`ihead`)**: same head at 360 px (250 for steps of a wizard, `sm`), glass back button + white
crumb on the photo, eyebrow / title / line / one action. Then a sentence or a lead → sections → Mezo.

**Sheets**: grabber, h2, one line, then the content with photos and chips; medium / full detents, drag to
dismiss; a picker sheet stays open while adding.

**Summary vs detail**: a tab shows the summary (e.g. Mai's ring + bars); the inner page behind it shows the
detail, never the same thing again (A nap számai = macro split, micros, windows with their macros).

## 5. Photo language

- One warm grade on every photo (baked into the file + a light CSS filter); scrims: from the bottom
  (.92 → .66 → .22) and from the left (.55 → .2) so white text always reads.
- **Small text never on a photo.** Numbers on a photo only as a white chip.
- The owner's own photos: small, round, untouched. Stock photos: `kepes/foto/` (CC0, credits in
  `CREDITS.md`, `-sq` crops for thumbnails). New downloads need the owner's OK; credit them.
- Pick photos that say something about the page (the next meal, the dish, the material: herbs for
  supplements, water for medication, a kitchen for the pantry, a morning table for the week).
- Check readability on the actual photo: if the title fights the picture, swap the photo or deepen the scrim.

## 6. Numbers and graphics

| Need | Use |
|---|---|
| A day / goal total with parts | ring (`ring`) + thin bars with "148 / 220 g" (`dayRing` pattern) |
| Where the calories came from | ring split by macro calorie share + legend (g / goal / %) |
| A few headline numbers | three-column card (`.trio`) |
| Many small levels (micros, days) | level tubes (`.mi .tb`, `.wd .tube`), peach under 50 %, deep at 100 %+ |
| Limits (salt, sugar) | bars "54 % a 5 g határból" |
| A meal / window's macros | stacked macro bar (`macBar`) + grams |
| A list of meals per day / window | photo stack (`stack`) |
| Time series | the week tubes / the weight road (`sceneT`) as a normal section, never a hero |

Rings and bars grow on load (`.pre` removed after paint); a tab switch never replays it.
**Rejected:** filling vessels / glasses (too tall), the bowl scene, drawn scenes as a second hero, a
circle "plate" frame in photo analysis.

## 7. Chips

Kalória: `chip soft` with the flame glyph, text "689 kalória" (warm `chip warm` when off target, over-run
as "+115"). Score: `chip warm` with the star ("8,4"). Tags / states: `chip soft` ("a kamrádból", "bevéve")
or plain `chip` ("edzésnap", "30 g adag"). Rating on a card: a **dark badge** top-right. A taken / done row
needs no chip when a check already says it. In tinted cards chips stay white.

## 8. Search, categories, filters — the one kit

- `searchBar`: white pill, the search glyph in a round paper well, optional round camera button beside it.
- `catChips`: pill with a round photo + label; active = ink. Live filter.
- `filterPills`: outlined pills with a glyph; the first is **Rendezés ⌄** (opens a sort sheet; left out
  inside sheets); active = sage tint. Category, filter and search combine; reset when a sheet opens.
- Used on every list page **and in every picker sheet** (the owner caught the logging pickers missing it).
  Inside a white sheet the controls sit on paper.

## 9. Lists and cards

- Cards with a photo column; one-photo lists align on 44 px (`.dlist.one`), photo-stack lists on 84 px —
  text of every row starts on the same line (the owner caught a 16 px drift).
- Future / planned items: dashed outline, "keret" or "Betervezve" with the planned photo.
- Recipe card: eyebrow tag + glyph, title, one line, meta (clock perc · flame kalória), dark rating badge,
  **round sage + button** that opens logging for that window; a star on the photo corner.
- Carousels page with dots. Rows are not overloaded: name + one or two chips; the detail lives one tap away.

## 10. Motion and iOS behaviour

- Entrance: soft rise on first load and inner pages only. **Tab switches never flash** (`.tabswap`,
  preloaded tab photos). In-place updates instead of re-rendering (Bevettem, logging, filters).
- One tap does it — never a double tap / extra sheet for the primary action.
- Large title collapsing into a frosted compact bar; logging as a modal card; sheets with detents and drag;
  swipe rows (Szerkesztem / Törlöm); long-press peek; pull for yesterday; time wheel; FLIP flights from a
  row photo to the page head; post-save "Rögzítve" with auto-return; chart scrub; dark theme; text size.
- Photo analysis: flash → shimmer + scan line twice, label pill "Felismerem…" → "Elemzem…" → "Kész ·
  93% biztos" → frosted results panel (ingredients, four numbers, certainty) → Újra / Hozzáadom. Corner
  marks, **no circle**.
- `prefers-reduced-motion` and `body.still` land on the end state instantly. Safari: pose SVG with
  `transform` attributes, animate only opacity / dashoffset / size / scale (`transform-box: fill-box`).

## 11. Copy rules

Hungarian, no abbreviations (day letters, units, monograms, exercise names are fine), **"kalória", never
kcal**, no grey helper text (Mezo says it, or it goes), no emojis, no numbered headings, ≥ 12 px text and
≥ 40 px taps at 320 px (44 for primary), today = csütörtök, szeptember 24., 14:10 (week 21–27). Real-looking
invented content of the real record types; the owner's real data never goes into a page.

## 11b. Edzés feature rules (owner, 2026-11-05)

- The three workout questions (Pumpa · érzed? / Ízületi fájdalom / Akarunk még?) are asked **once per exercise, after its last set** — never between sets. Between sets there is only the rest, and the rest screen shows the **verdict of the set just done** (record / above / on / below target) — a medal when it is a record.
- The workout itself (player, rest, exercise done) is dark with one vivid accent (lime `#C9F24D`, gold for records); the Edzés pages stay light but each page type has **its own structure** (owner: "mindegyik nagyon hasonló lett felépítésben").
- **Parity first in the player (owner caught it):** a re-designed workout screen keeps every in-workout feature — add / drop a set, edit a done set, swap, skip with a reason, do it later, reorder, add an exercise, technique, records, quest, finish early — and the exercise **note is visible while lifting**, not only behind a button.
- **Page archetypes now in use** (pick the one that fits a new page, do not fall back to the photo-head skeleton): poster (Mai), body map (Terhelés), corridor line (Terv), search-first photo grid (Gyakorlatok), collection grid (Érmek), dark player / ceremony with share cards (the workout); round B (inner pages): dark pre-flight with quest cards + setlist (Eligazítás), lanes + then-vs-now (Összegzés), set ladder (one exercise's sets), record profile with a line (an exercise), running order (a day), sticky live total (the day editor, the custom workout's basket), anatomy focus + six columns (a muscle), leaderboard (weekly check, muscle map's waiting list), week timeline (the running plan), road + covers (plans), trophy list (closed runs), magazine page with range dots (a report), week patterns (templates), split board (one template), numbered steps with a sticky live arc (the wizard), interval track + recovery line (running), 8-week calendar (its plan), head to head + butterfly bars (two runs), slots + effect tiles (a sport), photo picker (logging), big dial + rising scale (its form). Edzés has five tabs since 2026-11-06 — Mai · Terv · **Sport** · Terhelés · **Tár**; titles (package A, 2026-11-06): heavy uppercase only for the big moments (Mai, the workout, the ceremony, an exercise page), every other page an iOS large title in normal case; Mezo speaks in the slim `.mzn` note, not the illustrated card; all sport (weekly plan, logging, röpi, running, events) lives on the Sport tab, other pages only link there with one row. Inner-page helpers: `nxPoster` (photo with an overlapping heavy title, sized by its longest word) and `nxText` (back row + heavy title) in `b/edzes.js`. Shell class names to never reuse: `.ph .wk .band .x .ch .lab .sw .why` (grep `index.html` before naming).
- **Photo variety:** no photo heads two pages of the same flow; a new page gets a photo that is not already the most used one (`grep -o "edz-[a-z]*" edzes.js | sort | uniq -c`).

- **Outside the app (package C, 2026-11-06):** the workout shows outside the app as a live activity — lock screen card and the island at the top of the iPhone (compact → long press opens → opens itself at rest end). Its buttons mirror the player (+30 mp, Tovább, Kész a szett, Megnyitom). No ring for the countdown: a horizontal fill bar. Every training photo carries the one grade (`img[src*="foto/edz-"]`); never reuse one photo for several different things on the same page.

## 11c. Nap notes (2026-11-06)

- Nap follows the Fuel tab skeleton (photo head, verdict, one deep card, sections, Mezo) on all four tabs; inner pages each get their own structure (the day as a line with four moments, six big levels, photo quest cards, photo tiles, a dusk full-screen ceremony for napzárás, a linked order for a chain, a 29-day grid for a habit).
- The team is named by field in message cards (Alvás, Mozgás, Étkezés, Közérzet, Mezo) with glyph badges.
- Class names in `b/nap.js` start with `np`; check new names against the shell and Edzés CSS (a bare `.fb`, `.big`, `.rw`, `.edit`, `.n` already exist and silently restyle).
- Package A (2026-11-07): a tab's hero action never reappears in the list below it; every destination appears once per page. Header carries "+" and the bell; unread counts on tabs. Habits ticked from data are locked ("adatból"). Chat-like cards: reasoning opens in place, feedback is a thumbs reaction.
- The side panel: each domain swaps only its own block (`#enotes`, `#nnotes`) and restores Fuel's text only when no other domain block is showing.

## 12. Rejected — do not bring back

Boxed photo card at the top of a tab · a drawn scene under the photo · vessels / glasses for the numbers ·
the bowl on Mai · calories written on the bowl · a circle frame in photo analysis · "ablakon kívül" label
on rows (the snack is "Nasi") · double tap to log · page flash on Bevettem or on tab switch · dark header ·
metallic 3D icons · many hues on one page · bare number tiles · grey helper lines · kcal.

## 13. Verification before every hand-off

1. `node docs/design_2.0/prototypes/kepes/tools/probe.mjs [--page b/<file>] <routes…>` — every touched
   route; must print only `ok` (no horizontal scroll, no text < 12 px, no tap < 40 px, no broken image,
   no page error).
2. **Look** at the screenshots it writes (390 and 320): alignment, the photo's readability, one deep card.
3. Click every control of every touched page and sheet (Playwright): filters, sheets, in-place updates,
   back, the primary action's target route. Dark theme and `body.still` once.
4. Parity: every control / state / field of the old page is present (§ recon list).
5. An old test failing on removed structure → update the test, rerun; never call it "fine" untested.

## 14. Machine notes

- Shared builders (in Fuel today, in the shell after Round 0): `G`, `MARK`, `FIG`, `heroTxt`, `phead`,
  `ihead({ph,crumb,eb,title,sub,btn,attrs,back,fly,badge,sm})`, `mzCard`, `ring`, `dayRing`, `macBar`,
  `stack`, `chipsOf`, `KPH`, `searchBar`, `catChips`, `filterPills`, `openSheet`/`closeSheet`, `toast`,
  `haptic`; CSS: `.card.deep`, `.t-*`, `.trio`, `.gy.g1/.g3/.only`, `.br`, `.lg`, `.mi`, `.dl/.dlist.one`,
  `.win`, `.rl`, `.sb/.cat/.fp`, `.phead/.phead.in`, `.body`.
- New CSS blocks start with their own comment; new glyphs go into the `G` table (outline + soft gradient).
- Every page function that opens `ihead`/`phead` closes the `.body` div at its end.
- Traps met: a class name reused across pages silently restyles rows (`.sw` swatches vs swipe rows) —
  grep before naming (it happened again in Edzés round 2: a `.lab` legend inherited the page frame's `.lab{min-height:100vh}` and stretched a card to 1 200 px — grep `index.html` for every new class name); state used by `render()` must be declared before the first render; `.phone`
  uses `overflow: clip`; a sheet must not open another sheet; heredocs containing `rm`-like text can be
  blocked — write scripts with the file tool and run them.
- **Tab-switch flash (owner caught it 2026-11-05):** `.tabswap` only pauses the `.rise` entrance; when the class comes off, the animation restarts from opacity 0 and the page flashes ~0.4 s after the switch. The router strips `.rise` from the new tab's content *before* dropping `.tabswap`. Never add a timed class that pauses an animation without removing the animation's trigger first. Check with an opacity sample during the switch (min must stay 1.00).
- **Inner heads grow with their text** (`.phead.in{height:auto;min-height:…}`): a fixed height once hid a wizard's only button under the paper panel. Check every inner page that its head action ends above `.body`.
- **The side panel is the shell's**: a domain may swap the panel's text, never the whole panel — the `.tog` row (320 px, mozgás nélkül, sötét mód, nagyobb betű) and its handlers must survive. Replacing it once made every "320" probe run at 390 without a word; the probe now refuses to continue when it cannot switch.
- **Dark theme flips `--ink` to light**: any control that turns ink when selected (`.fp.on` in a group, scale buttons, count buttons) needs dark text in dark mode, and a dark background override must not erase the selected state. Shoot every new control in dark once.
- **No dead-end placeholders at the end of a domain**: grep the domain file for "körben" / "következő kör" before calling it done; a toast may only describe a real effect ("Mentve", "Hozzáadva"), never "comes later".
- Commit, push (HTTPS with the gh credential helper), bd comment, publish — every round.

## 15. The report to the owner

Hungarian: the link (and what to tap), a short table or list of what changed per page in everyday words,
what was checked, anything not met said plainly, one genuine question at most. Then stop and wait.

## 16. Conflicts and edge cases (decided — apply as written)

- **The owner asks for an exception on a named page** ("ide nem kell fotó", "maradjon sima"): do what he
  says, say in one Hungarian sentence that it departs from the golden rule, and log it in the README
  version entry as an owner exception. A vague "no fuss" is not an exception: apply the golden rule in its
  lightest form (small photo head, one compact graphic, chips) and say so in the play-back.
- **A deadline** never skips Round 0, the recon or the play-back; the play-back is short (one screen).
- **Search / filter kit threshold:** a list that can hold 8+ items or has categories gets the full kit; a
  shorter fixed list gets none (a list of six habits does not need a search bar).
- **His wording vs the app's structure** ("aloldal" for what is a tab): follow the app's structure, name it
  his way in the report.
- **Data the app does not hold** (e.g. calories on a habit): never invent a field. Derive it from a real
  linked record if one exists (a logged meal); otherwise leave it out and ask in the play-back.
- **A page becoming a sheet or the reverse** is a structural change: propose it in the play-back, do not do
  it silently.
- **Sheets:** at most one deep-green card per sheet (optional), tints allowed, a photo always.
- **No fitting photo in `kepes/foto/`:** ask for the download OK inside the play-back message (name the
  pictures you want), credit them in `CREDITS.md`.
