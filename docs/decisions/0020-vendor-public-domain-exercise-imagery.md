# 0020 — Vendor the exercise demo stills into the repo (public domain), don't call an API

- **Status:** Accepted
- **Date:** 2026-08-06
- **Driver:** `mezo-8xdl.2` (epic `mezo-8xdl`)

## Context

The exercise catalog had exactly one media field, `video_url`, rendered only as a YouTube embed.
Videos are excellent but **manual** — 161 catalog rows, zero curated links, and no realistic path to
curating them all. A still-image layer is the automatable half of the problem, so the question was
where the images come from and where they live.

The scan ([`queries/2026-08-05-exercise-media-apis.md`](../research/queries/2026-08-05-exercise-media-apis.md),
endpoints verified live) found four options:

| Source | Media | Licence | Verdict |
|---|---|---|---|
| **free-exercise-db** | 2 stills/exercise (873/873) | **Unlicense — public domain** | chosen |
| wger | photos, `videos` mostly empty | CC-BY-SA 4.0 | attribution UI for every image; no Hungarian |
| ExerciseDB | best GIFs | **AGPL-3.0**, free tier "not for production" | licence + tier both disqualifying |
| WorkoutX | 1 400 GIFs | commercial | not free |

## Decision

**Vendor the free-exercise-db frames into the repo** (`frontend/public/exercises/{slug}-a.jpg` /
`-b.jpg`) and serve them same-origin, rather than hotlinking a CDN or proxying an API at runtime.

**Two frames per exercise, not one.** The dataset ships a start and an end photo from the same
camera position; alternating them reads as a crude animation and actually conveys the movement. One
still frequently does not. This is why `exercise_catalog` carries a *pair* of columns
(`image_start_url` / `image_end_url`, ADR-adjacent detail in
[`train.md`](../features/train.md) §4).

**The slug → dataset-name map is hand-curated** ([`scripts/data/exercise-image-map.json`](../../scripts/data/exercise-image-map.json))
and importing is a by-hand script ([`scripts/import-exercise-images.mjs`](../../scripts/import-exercise-images.mjs)),
never a build step.

**Reasons:**

1. **Public domain removes the whole licence surface.** No attribution component, no share-alike
   obligation propagating into our code, no per-image author tracking. wger's CC-BY-SA would have
   forced attribution UI into every surface that renders a thumbnail.
2. **Same-origin beats a CDN for a PWA.** The app is installed and used in a gym, frequently on bad
   signal. Vendored files work offline through the service worker; `raw.githubusercontent.com` does
   not. It also means no third-party request — and no IP leak to GitHub — every time a card renders.
3. **No runtime dependency on a project we don't control.** A renamed upstream path breaks an import
   run we can re-run; it cannot break production.
4. **Fuzzy matching is disqualified, not merely imperfect.** On our 161 rows a token-overlap matcher
   produced 37 exact hits and then confidently paired `Pull-Up → Scapular Pull-Up`,
   `Cable Fly → Cable Rear Delt Fly`, `Barbell Row → Upright Barbell Row`. **A wrong image teaches
   the wrong movement** — worse than no image. Hence a checked-in map reviewed in the diff.

## Consequences

**Accepted costs — recorded honestly:**

- **~15 MB of binaries in git history**, permanently. This is ~2× the initial estimate: the frames
  average 59 KB, not the 35 KB of the first sample. Re-encoding at 640 px/q55 recovers only ~35 %
  and would add a macOS-only `sips` (or a `sharp`) dependency to a script that is otherwise
  dependency-free, so the originals ship as-is. They never change, so the cost is one-time.
- **Coverage is partial and stays partial: 124 of 161 rows.** The remaining **37 render imageless**
  — including 7 kettlebell rows (the plain two-hand `kb-swing`, `kb-halo`, both carries). "No image"
  is a specced UI state, not a gap to paper over by substituting a lookalike.
- **One image serves both the hero and the 44 px thumbnail.** A thumbnail therefore downloads a
  full 850 px frame (~59 KB). Mitigated by lazy loading + the `CacheFirst` runtime cache; if list
  scrolling ever feels heavy, a generated `-thumb` variant is the follow-up.
- **The photos are tonally foreign** — a man in a red-walled commercial gym, nothing like the app's
  soft muscle-tinted surfaces. The `ExerciseImage` component owns the reconciliation (desaturation,
  DS radius, the muscle rail continuing along the image edge), so it is solved once, not per call
  site.
- **Updating the map is manual work.** Deliberate: see reason 4.

**What this buys:** every mapped exercise answers "what is this movement?" instantly, offline, with
no licence obligations and no third-party runtime dependency.

## Alternatives considered

- **jsDelivr / raw.githubusercontent hotlink.** Zero repo weight, instantly done. Rejected: empty
  in an offline PWA — the exact situation (a gym basement) where the user most needs to check a
  movement — plus a third-party request per render.
- **Backend-served media** (`/api/media/…`, images in the container or a PVC). More flexible, and
  the only path if user uploads ever land. Rejected as premature: it adds an endpoint, auth on a
  public-domain asset, and k8s storage, to solve a problem static files already solve.
- **ExerciseDB's GIFs.** Genuinely the best media of the four — real animation, 5 000+ clips.
  Rejected on AGPL-3.0 (viral for anything we self-host and serve) and a free tier its own README
  calls unfit for production.
- **Generating our own illustrations.** Out of scope, and would not have been better than photos of
  the actual movement.
