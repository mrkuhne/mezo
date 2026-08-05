---
title: Free exercise image/video APIs — what mezo could wire into the catalog
type: query
updated: 2026-08-05
tags: [train, tooling]
related:
  - ../../features/train.md
  - ../index.md
sources: []
confidence: high
contradictions: []
---

# Free exercise demo media (images / GIFs / video) — the 2026-08 scan

Question: *is there a free API we can pull exercise illustration media from, to show what a
movement actually looks like?* Scanned 2026-08-05; every "verified" claim below was checked live
with `curl`/fetch on that date, not taken from a listicle.

## Where mezo stands today

The catalog row (`exercise_catalog`) carries exactly one media field — **`video_url`**, and the FE
render path is **YouTube-only**: `VideoDemo` (`frontend/src/features/train/components/VideoDemo.tsx`)
renders a lazy `youtube-nocookie` iframe and **renders nothing when `youTubeId(url)` fails**. So a
JPG/GIF URL dropped into `video_url` would silently show nothing — **any image/GIF source needs a
new column + a new FE component**, not just data. See [train.md](../../features/train.md) §4
"Exercise catalog + records".

## The candidates

| Source | Media | Key? | License | Verified |
|---|---|---|---|---|
| **free-exercise-db** (`yuhonas/free-exercise-db`) | 2 static JPGs per exercise (start + end frame) | none | **Unlicense (public domain)** | 873 exercises in `dist/exercises.json`, **53 with `equipment: "kettlebells"`**; `raw.githubusercontent.com/.../exercises/Kettlebell_Thruster/0.jpg` → 200, 35 KB; same file over `cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/...` → 200 |
| **wger** (`wger.de/api/v2/`) | photos; `videos` array exists but is **empty on most rows** | none for reads | per-image, mostly **CC-BY-SA 4.0** + author (attribution required) | `GET /api/v2/exerciseinfo/?limit=1` → 200 no auth, `count: 834`; each row has `images[]` with full URLs + `license`/`license_author`; **30 languages, Hungarian NOT among them**; `/api/v2/exercise/search/?term=…` 404s in that shape |
| **ExerciseDB** (`ExerciseDB/exercisedb-api`, `oss.exercisedb.dev`) | GIF animations (5k+), videos, images | free playground yes; production = paid/RapidAPI | **AGPL-3.0** (code) | docs page 403s to a plain fetcher; repo README states the free endpoints are *"not recommended for production integration"* (strict rate limits) |
| **WorkoutX** (`workoutxapp.com`) | 1 400+ hosted GIFs, `gifUrl` per response | yes | commercial | vendor-stated free tier 500 req/month — **not independently verified** |
| **YouTube embed** (what we already do) | real video | none for embeds | embed only — no download/caching per ToS | already live via `video_url` + `VideoDemo` |

## Read

**For static illustration, `free-exercise-db` is the only clean fit.** Public domain (no
attribution plumbing, no share-alike contamination), no key, no rate limit, and the images sit on a
CDN we can hotlink or vendor into the repo. Cost: 2 stills, not motion — fine for *"which position
is this?"*, useless for *"what does the hip snap look like?"*. It also matches only ~2/3 of our
`kb-*` block by name (it has `Goblet Squat`, `Kettlebell Thruster`, `Kettlebell Windmill`,
`Kettlebell Turkish Get-Up (Squat style)`, `One-Arm Kettlebell Row/Snatch/Swings/Clean/Push Press`,
`Front Squats With Two Kettlebells`, `Two-Arm Kettlebell Military Press`, `Kettlebell Sumo High
Pull`, `Alternating Renegade Row`… but **no plain two-hand "Kettlebell Swing"**), so a slug→name
mapping table has to be hand-checked, not fuzzy-matched.

**wger is the better *catalog*, the worse *media* source** — CC-BY-SA forces per-image attribution
UI and its `videos` are mostly empty. Not worth the plumbing when we already own our catalog.

**AGPL (ExerciseDB) is a hard no for anything we self-host and serve** — and its free tier is
explicitly non-production anyway. GIF quality is the best of the lot if we ever pay.

**Motion stays on YouTube.** Embedding is free, keyless, already implemented, and legally clean;
what's missing is not an API but the **curation** — one good demo link per catalog row. The
YouTube Data API v3 (free 10 000 units/day) could *search* candidates, but its ToS bars downloading
or caching the video itself, so it would only ever fill in `video_url` — a one-off authoring job,
not a runtime dependency.

## If we build it

1. `exercise_catalog.image_url TEXT NULL` (+ contract field), seeded from a hand-mapped
   slug → `free-exercise-db` filename table in `content/exercise-catalog.json`.
2. Vendor the ~160 JPGs into the repo (public domain — no hotlink risk, no CDN dependency, and the
   PWA can cache them) rather than pointing at `raw.githubusercontent.com` at runtime.
3. FE: an image variant beside `VideoDemo` — still frame by default, `▶ Demo` still wins when a
   `video_url` exists.

Nothing here blocks the catalog itself; it's an additive media layer.
