# Képes irány — prototípusok (2026-11-04 →)

Owner decision 2026-11-04 (spec: `docs/superpowers/specs/2026-11-04-kepes-irany-fuel-design.md`): the
prototype is rebuilt page by page in an image-rich look — light tinted ground, dark zones (header,
floating nav, one highlighted card), the user's own photos on the cards (a drawn 3D tile where there is
none), cards of varied sizes, horizontal rows per section, pill chips. Fuel first.

- `fuel.html` — standalone (own data, sheets, no shell). Serve from `docs/design_2.0/prototypes` over HTTP:
  `http://127.0.0.1:8757/kepes/fuel.html`. Lab toggles: 320 px, mozgás nélkül.
- `ikon/` — soft matte 3D icons (Microsoft Fluent Emoji 3D, MIT), credits in `ikon/CREDITS.md`. Round 3 (owner,
  2026-11-04): the old metallic Titanium sprite is out — it was drawn for dark glass and reads as stickers on a light
  ground; the owner's reference is this matte style. 3D only at large sizes (nav, tiles, facts, rows ≥ 30 px); small
  icons are thin inline line icons. If the direction stays, a custom set in this style follows.
- `foto/` — free stand-in photos (CC0, Unsplash via Wikimedia Commons, bright top-down shots), credits in
  `foto/CREDITS.md`. Never the owner's real photos. Note for the product: real logged photos will look amateur;
  the slick look comes from curated recipe photos, own photos stay small and well cropped.

## Direction B — "Lágy" (2026-11-04, beside Képes, for comparison)

Owner: "show what you can do — own graphics, own logo, own direction; soft, clean, professional; informative but not
flooding; the eye led to the one thing to do; nested pages that are clear; elements may move by themselves; an
alternative beside the current one". `b/fuel.html` (self-contained; photos via `b/foto -> ../foto`):
- **Own mark + wordmark** (three soft humps of an m — bowl and drop — with the sun dot), Outfit display + Manrope body,
  cream paper ground, one accent (sage) with deep green, peach/sky/sun as data colours.
- **Own glyph family** (`G(name,palette)`: soft gradient shapes, no outlines, one highlight; ~30 glyphs incl. the five
  domains) — no third-party icon set.
- **Hero scene** (SVG): the day's arc 07–21 with the sun at now, the meals as beads, a bowl that fills to today's
  intake (steam drifts, leaf sways, sun glows; `prefers-reduced-motion` / `still` stop everything).
- Mai = headline + lead (Mezo's voice) → scene with ONE primary action → three numbers → the day as a timeline
  (own photos round, future slots ghosted, the next one marked) → log row → Mezo card with the own flat figure.
- **Owner chose B** (2026-11-04: "tetszik a B, vigyük végig"). v2 adds the other three tabs, each with its own scene: Kiegészítők (the day's arc with capsule beads, filled/next/missed; check toggles re-render), Trendek (the weight road 84 → 78 with the walker at 81,3 and the flag; week tubes; stats; weekday/weekend; 7-week curve; patterns), Konyha (kitchen still life on a shelf with steam; suggestion with one action; goals; recipe cards with round photos; pantry rows; Receptműhely).
- v3 (owner feedback 2026-11-04): the bowl redrawn clean and WITHOUT the calorie number (it is in "Ma eddig"); logging is its own page `#log-<window>-<mode>` reached in one tap from the scene pill, the mode row and the future slots (the six modes switch in place, picks enable "Rögzítem"); "Bevettem" patches the page in place (scene, headline, numbers, rows) instead of re-rendering — no flash; Kamra is a glyph-card carousel with an "Új tétel" card.
- v4 (owner 2026-11-04: "the whole logging feature, combinable inputs, the time"): `#log-<window>` is the real composer's flow (fuel.md §2 S1c / mezo-yhhvg / mezo-78rn): one text field with the microphone beside it; Fotó / Kamra / Recept / Szokásosak all ADD to the same draft (Kamra sheet: category chips + search, multi-add, stays open; Recept and Szokásosak single-add); **Elemzés** only on the button, text or photo or both, 1.3 s "Elemzem…", lines land in Tételek tagged by real source (`kamra ✨` / `becslés`, a review note on an estimated amount); steppers scale kcal and macros; totals card; **Mikor ettél?** collapsed above the save bar (Most · 14:10 + the resolved window or „Ablakon kívül”; a time input, chips for Most and the windows already reachable; a future time blocks saving with a sentence); **Rögzítem** → one-second ceremony → back to Mai where the headline, the hero and the timeline recompute from the data.
- v5 (owner 2026-11-04: merge the post-save animation and the result into one page, with own graphics): `#kesz-<id>` — the **Rögzítve** page. Scene: the bowl tips and pours a stream into the day's arc, the new bead pops in at the meal's time, the day's level bar grows from the previous to the new amount; Mezo's point counts up; three numbers (what the meal did to the day), Mezo's line, the lines, "Vissza a naphoz". Reduced motion: final state at once.
- v6 (2026-11-04, "jöhetnek a belső oldalak"): `#protokoll` (the five time zones on the arc with element counts; zone cards; meal bindings), `#ujelem-1..3` (product → data → the band gauge with the recommended range, amount stepper, zone chips, caution line), `#gyogyszer` (empty cycle) and `#gyogyszer-aktiv` (the weekly cycle arc with csúcs / stabil / völgy, next dose, dose log; `medform` / `dose` sheets), `#recept-<id>` (photo, per-serving numbers, ingredients with source, steps, quality + habit, Ezt eszem → the composer), `#receptek`, `#kamra`, `#kamra-<name>` (the jar that fills in layers with what 100 g holds, quality rows, provenance, recipes using it), `#het` (the week's tubes + day rows → `day` sheet). All wired from the tabs.
- Trap (owner saw it on Safari, 2026-11-04): CSS `transform: rotate()` on an SVG `<g>` with a px `transform-origin` rotates around a different point in Safari than in Chromium, so the pouring bowl drifted away from its stream. Rule for the scenes: **pose with SVG `transform` attributes** (deterministic), animate only opacity, stroke-dashoffset, width/height, and scale with `transform-box:fill-box`.
- v7 **iOS-kör** (owner 2026-11-04: "award-winning native iOS UX, put in everything"): large title collapsing into a frosted compact bar with back / logo and the page's one action; the log flow presented as a modal card; pickers as sheets with grabber + detents (drag to expand / dismiss); swipeable rows (Szerkesztem / Törlöm) on the day's meals and the pantry list; long-press peek (blurred backdrop, preview, quick actions); pull down on Mai for Tegnap (and back); native-style time wheel; skeleton rows while the AI thinks; floating save bar; spring + ring on the check; sticky napszak headers; shared-element flights (meal photo → page hero, totals bowl → the pouring bowl); auto-return from Rögzítve after 2,7 s unless touched; chart scrubbing with a value bubble, hovering week tubes, hét/hónap toggle, draw-in curve; paged recipe carousel with dots; A–Z rail on the pantry; dark mode (follows the system, toggle on the Irány page); text size (normál / nagy / extra); `#ios` page: lock-screen live activity, Dynamic Island, home widgets, notification with actions, Health links, kézérzet rules. `navigator.vibrate` marks the haptic moments (Android only; iOS haptics come with the build).
- Nested pages with a crumb (`Fuel › Mai › A nap számai`): `#szamok`, `#meal-<id>`, `#irany` (the identity page:
  mark, colours, glyph family, motion rule). Frosted light bottom nav (B keeps dark for text only).

## Fixed Artifact per domain

| Domain | Artifact | Published |
|---|---|---|
| Fuel · Képes (A) | https://claude.ai/artifact/HrE6LXBqDzrApY5hGidTiZ (slug `8871bb45-61c8-4fd6-b816-0fb4ab036da2`) | 2026-11-04 · v6 (Mai élőbben) |
| Fuel · Lágy (B) — **the chosen direction (owner 2026-11-04)** | https://claude.ai/artifact/EEf8oNUm6EDeFkaTkmhpKe (slug `6b2ef909-0e57-49b0-a848-3117c146dcb5`) | 2026-11-04 · v7 (iOS-kör) |

Republish: `publish_files` with the artifact's slug + live `base_version`, files = `index.html` (from
`fuel.html`), `ikon/*.png`, `foto/*.jpg` (patch mode keeps the rest).

## Pages

| Page | State | Notes |
|---|---|---|
| Fuel · Mai v6 | round 6, 2026-11-04 | owner: the pages had become card lists; the references live from ONE big custom graphic per page + coloured panels + bleeding pictures + shapes; drawn figures may appear elsewhere on the page; "take it seriously, this is the app". Mai now: a green gradient **hero scene** (next meal as a round photo bleeding over the panel, blueberries + honey 3D pieces floating, glass chips, white round +), a dark-green **numbers panel** with the arc and a drawn **day route** (eaten points white, planned dashed lime, frame line) + five macro bars, the day's window cards, the log tiles on a tinted **band** with a blob, **band cards** for recipes (tinted card, round photo bleeding out), the Mezo card with a **flat figure of our own** (SVG: person with a bowl — the Fluent 3D people are yellow emoji faces, rejected). |
| Fuel · Mai | round 3 "stílus + ritkítás", 2026-11-04 | owner: still not the slick look of the references → diagnosis: amateur photos, density, 3D icons everywhere + rainbow colours, busy type. Now: one typeface (Plus Jakarta Sans), one accent, bright photos, soft 3D only large; Mai halved: big next-meal photo card, numbers card with arc + the five macro bars (owner 2026-11-04: he watches them; each its own soft colour as in round 2), one card per window with hairlines between rows (owner: one list ran together), tile row, recipe row, one dark Mezo card with one button, supplements row. |
| Fuel · Mai | round 2, 2026-11-04 | dark header + next-meal card on the seam, segmented arc with one line "2 060 / 3 100" + five bars, windows as slots; a meal row = photo · name · kalória chip · pont chip (3D icons), nothing else (owner); log-mode tiles, recipe carousel, one dark Mezo card, supplements row, floating nav. Cards are divs: Safari sized a `<button>` card by its photo (owner saw the calorie pill slide off). |
| Fuel · fejrész | owner 2026-11-04: **világos fejrész** (the dark header was too hard against the green; the food references all have light headers); dark stays on the floating nav and the one Mezo card; `--dark` is a deep green-charcoal `#1B2520`. | — |
| Fuel · Kiegészítők (`#stack`) | round 4, 2026-11-04 | light header with the sentence ("5 adag megvolt a 8-ból. Következik: Origin PWO."), a next-dose card (soft 3D icon in a tinted well, dose chip, Miért így?, round check), the day's 8 capsules, one card per napszak with check buttons (toggle in place, page re-renders, toast), Protokoll / Új elem / Gyógyszer tiles (next round), one dark Mezo card (Omega-3 missed at lunch → move to dinner). Sheet `item` (why, auto/kézi, Bevettem, Másik zónába). All-done state when every dose is taken. Content floor: fuel.js `stack`/`protokoll`. |
| Fuel · Trendek (`#trendek`) | round 5, 2026-11-04 | light header with the verdict, week pill (‹ Ez a hét · szeptember 21–27. ›), the week as 7 tubes with the frame line (today = Cs outlined, P–V dashed ahead; a past day opens the `day` sheet), 4 stat tiles with soft 3D icons (napi átlag 1 852, minőség 7,9, heti súlyátlag 81,3, 3/3 naplózva), hétköznap/hétvége two bars + Mezo line (last week), 7-week weight curve with target line + weekly kcal bars, A cél felé (84,0 › 81,3 › 78,0 with the 7 weekly steps), Mintázatok two rows (home is Mezo), one dark Mezo card. Content floor: fuel.js `trendek` + the kiserlet `thisWeek` correction. |
| Fuel · az étkezés oldala (`#meal-<id>`) | round 2, 2026-11-04 | own page (owner: not a sheet): photo hero with back, three fact tiles (kalória · Mezo pontja · vércukor), Mezo értékelése with the 8 weighted dimensions, Vércukor-válasz (band, ami emeli / fékezi), Makrók with icons, Hozzávalók, Mezo's line, bevitel source, two buttons. Nav hidden on inner pages. |
