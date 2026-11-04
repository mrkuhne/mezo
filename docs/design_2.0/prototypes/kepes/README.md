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

## Fixed Artifact per domain

| Domain | Artifact | Published |
|---|---|---|
| Fuel | https://claude.ai/artifact/HrE6LXBqDzrApY5hGidTiZ (slug `8871bb45-61c8-4fd6-b816-0fb4ab036da2`) | 2026-11-04 · v3 |

Republish: `publish_files` with the artifact's slug + live `base_version`, files = `index.html` (from
`fuel.html`), `ikon/*.png`, `foto/*.jpg` (patch mode keeps the rest).

## Pages

| Page | State | Notes |
|---|---|---|
| Fuel · Mai | round 3 "stílus + ritkítás", 2026-11-04 | owner: still not the slick look of the references → diagnosis: amateur photos, density, 3D icons everywhere + rainbow colours, busy type. Now: one typeface (Plus Jakarta Sans), one accent, bright photos, soft 3D only large; Mai halved: big next-meal photo card, numbers card with arc + fehérje + víz, ONE list for the day (group labels, rows, dashed future slots, the current one highlighted), tile row, recipe row, one dark Mezo card with one button, supplements row. |
| Fuel · Mai | round 2, 2026-11-04 | dark header + next-meal card on the seam, segmented arc with one line "2 060 / 3 100" + five bars, windows as slots; a meal row = photo · name · kalória chip · pont chip (3D icons), nothing else (owner); log-mode tiles, recipe carousel, one dark Mezo card, supplements row, floating nav. Cards are divs: Safari sized a `<button>` card by its photo (owner saw the calorie pill slide off). |
| Fuel · az étkezés oldala (`#meal-<id>`) | round 2, 2026-11-04 | own page (owner: not a sheet): photo hero with back, three fact tiles (kalória · Mezo pontja · vércukor), Mezo értékelése with the 8 weighted dimensions, Vércukor-válasz (band, ami emeli / fékezi), Makrók with icons, Hozzávalók, Mezo's line, bevitel source, two buttons. Nav hidden on inner pages. |
