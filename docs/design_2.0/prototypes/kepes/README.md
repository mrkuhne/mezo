# Képes irány — prototípusok (2026-11-04 →)

Owner decision 2026-11-04 (spec: `docs/superpowers/specs/2026-11-04-kepes-irany-fuel-design.md`): the
prototype is rebuilt page by page in an image-rich look — light tinted ground, dark zones (header,
floating nav, one highlighted card), the user's own photos on the cards (a drawn 3D tile where there is
none), cards of varied sizes, horizontal rows per section, pill chips. Fuel first.

- `fuel.html` — standalone (own data, sheets, no shell). Serve from `docs/design_2.0/prototypes` over HTTP:
  `http://127.0.0.1:8757/kepes/fuel.html`. Lab toggles: 320 px, mozgás nélkül.
- `sprite-3d.svg` — the old Titanium 3D symbols (125 `t-*` + `tg-*` defs), copied from `elo/fuel.html:1323-1515`;
  injected at load. Production's `titanium-icons.svg` no longer holds this art.
- `foto/` — free stand-in photos (Wikimedia Commons), credits in `foto/CREDITS.md`. Never the owner's real photos.

## Fixed Artifact per domain

| Domain | Artifact | Published |
|---|---|---|
| Fuel | https://claude.ai/artifact/HrE6LXBqDzrApY5hGidTiZ (slug `8871bb45-61c8-4fd6-b816-0fb4ab036da2`) | 2026-11-04 · v2 |

Republish: `publish_files` with the artifact's slug + live `base_version`, files = `index.html` (from
`fuel.html`), `sprite-3d.svg`, `foto/*.jpg`.

## Pages

| Page | State | Notes |
|---|---|---|
| Fuel · Mai | round 2, 2026-11-04 | dark header + next-meal card on the seam, segmented arc with one line "2 060 / 3 100" + five bars, windows as slots; a meal row = photo · name · kalória chip · pont chip (3D icons), nothing else (owner); log-mode tiles, recipe carousel, one dark Mezo card, supplements row, floating nav. Cards are divs: Safari sized a `<button>` card by its photo (owner saw the calorie pill slide off). |
| Fuel · az étkezés oldala (`#meal-<id>`) | round 2, 2026-11-04 | own page (owner: not a sheet): photo hero with back, three fact tiles (kalória · Mezo pontja · vércukor), Mezo értékelése with the 8 weighted dimensions, Vércukor-válasz (band, ami emeli / fékezi), Makrók with icons, Hozzávalók, Mezo's line, bevitel source, two buttons. Nav hidden on inner pages. |
