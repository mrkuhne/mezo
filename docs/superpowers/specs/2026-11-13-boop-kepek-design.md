# Boop — Képek: photos inside the Napkelte look

> Owner decision round **B3/b Képek** (`mezo-r36n9.32`, 2026-11-13). Extends, never replaces, the Napkelte canon
> ([`2026-11-10-boop-napkelte-design.md`](2026-11-10-boop-napkelte-design.md) §4). Where the two disagree, this file
> wins **for photos only**; everything else (dark glass, white type, orbs, no emoji, own glyphs) is unchanged.
>
> **The rule in one line: a photo in the sky, a photo on the card — nothing in between.**

## 1. Why

The owner looked back at the earlier Lágy spike and found it "far more professional" than the current app, and traced
it to one thing: it used **real photographs**. Napkelte's painted landscape is unique and always legible, but with
every pixel drawn the app can read flat. This round put photos on the real, shipped screens in the simulator (one
floating switch, every screen, four states) and let him pick.

## 2. What he judged

| Variant | What it did | Verdict |
|---|---|---|
| **A · Fotó az égen** | the painted landscape replaced by a quiet nature photo, the hue's own sky gradient over it | **picked** — for every page head |
| **B · Fotókártyák** | photos inside the content: a band on the proposal card, a thumbnail on a row, a station of the day | **picked** — for cards and rows |
| **C · Üveg a fotón** | a blurred, darkened photo under the content instead of the flat deep ground | rejected — too subtle to be worth it; do not reintroduce |

Spike (throwaway, deleted with this round): `KepekSpike.swift` + `ios/Boop/KepekSpike/`, launch `-kepekStart 0–4`.
Reference screenshots: `docs/design_2.0/prototypes/boop-ios-spike/kepek-*.jpg`.

## 3. The guideline

### 3.1 Where a photo goes

| Place | Photo | Which |
|---|---|---|
| Page head of **Ma** (Reggel · Napközben · Este), **Terv**, **Napló**, **Boop** | **yes** — fills the head, the page's sky gradient over it | the hue's mood photo |
| **Room head** (Alvás, Mozgás, Fuel, Pulzus, Forma; later Étel, Edzés) | **yes** — same recipe, 360 pt head | the hue's mood photo |
| **Check-in** and **esti zárás** covers, flow pages, sheet heads (170 pt) | **yes** | the hue's mood photo |
| **Boop's proposal card** | **yes** — a 120–130 pt band at the top of the card, fading into the glass | a photo of the thing proposed (training, meal, walk, sleep) |
| **Rows and stations**: the day's timeline, Napló days, Terv cards, list rows | **yes** — a 38–44 pt rounded thumbnail in place of the glyph circle | a photo of the thing the row is about |
| A row that is a **moment, not a thing** (check-in, "Mai szándék", "Boop észrevette") | **no** — the glyph stays | — |
| Tiles, charts, numbers, the orbs, the bottom bar, buttons, the "miért?" page | **no** | — |

Rules of thumb: **one photo per thing**, never a photo as decoration of a number; a screen has at most one head photo
plus the photos its cards earn; if nothing fits the row's meaning, no photo — a near-miss photo is worse than a glyph.

### 3.2 Which photo

- **Mood photos = quiet nature** (owner, 2026-11-13): dawn, fog, mountain, lake, cloud, forest. Calm, dark-leaning,
  no crowds, no faces, no gym-poster energy. One fixed photo per colour world, so a page always looks the same:
  Forma → mountain night · Alvás → dusk · Mozgás → lake/trail · Fuel → herbs/kitchen · Pulzus → cloud ·
  kímélő mód → fog.
- **Thing photos** follow what the row is: a meal, an exercise, a walk, a bed.
- **Source is mixed** (owner, 2026-11-13): mood photos from the free library; for food and training the **owner's own
  photo** where one exists, the library's where it does not.
  - His own meal photos are **not stored today** — a meal photo goes to the AI and is dropped (no photo column exists
    in the database). Keeping them is a **B4 Étel** decision with a storage cost; until then the library stands in.
  - The 248 exercise images in `frontend/public/exercises` stay instructional: inside an exercise only, never a head.
- **Licence:** every library photo is CC0 or public domain (Wikimedia Commons), listed with its source in the
  photo folder's `CREDITS.md`. A CC-BY photo needs the author's name shown in the app; prefer CC0 and avoid the
  question.
- Ship two crops, ~960×720 and ~480×480, compressed; a head uses the wide one, a thumbnail the square one.

### 3.3 How a photo and the glass live together

1. **One tone for all of them:** saturation 0.8, brightness −0.06. Never a vivid, saturated photo.
2. **The sky stays the sky.** A head photo always carries the hue's own gradient over it (dark at the top ~0.85,
   thinning to ~0.3 at the horizon band, closing to the ground at the bottom), so the page keeps its colour world and
   the five hues still mean something.
3. **Type first.** White type sits only on the gradient-covered part; a card photo gets a dark gradient at its bottom
   edge before any text. If a photo makes a line hard to read, the photo loses.
4. **Glass over, never instead.** A card keeps its white-7% fill and its top-light stroke; a photo is a band *inside*
   it or a thumbnail *on* it.
5. **The orb always wins.** No photo detail behind the orb's silhouette: the rising orb stays the one focal point.
6. **Never load-bearing.** Empty, loading, offline and reduced-motion states must look right with no photo at all;
   the painted landscape stays in the kit as the fallback and for anything a photo would not fit.

## 4. What this does not change

Orbs, the rising sun, the five hues, the spine, the glyph family, "no emoji", the Hungarian voice, dark glass. A photo
is a backdrop or an illustration of a thing — never a control, never a score, never a mood the data does not support.

## 5. Applying it

The shipped screens keep the painted landscape until a slice converts them (`mezo-r36n9.36`): the kit gets a photo
head option and a card/row photo slot, each screen switches as its slice touches it, and B4 Étel / B5 Edzés are built
photo-first from the start.
