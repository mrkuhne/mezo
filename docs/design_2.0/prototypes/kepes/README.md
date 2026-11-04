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
- Nested pages with a crumb (`Fuel › Mai › A nap számai`): `#szamok`, `#meal-<id>`, `#irany` (the identity page:
  mark, colours, glyph family, motion rule). Frosted light bottom nav (B keeps dark for text only).

## Fixed Artifact per domain

| Domain | Artifact | Published |
|---|---|---|
| Fuel · Képes (A) | https://claude.ai/artifact/HrE6LXBqDzrApY5hGidTiZ (slug `8871bb45-61c8-4fd6-b816-0fb4ab036da2`) | 2026-11-04 · v6 (Mai élőbben) |
| Fuel · Lágy (B) | https://claude.ai/artifact/EEf8oNUm6EDeFkaTkmhpKe (slug `6b2ef909-0e57-49b0-a848-3117c146dcb5`) | 2026-11-04 · v1 |

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
