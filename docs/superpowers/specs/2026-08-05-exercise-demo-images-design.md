# Exercise demo images — two-frame stills on the catalog (design spec)

- **Date:** 2026-08-05 · **bd:** `mezo-8xdl` (epic; slices `.1`–`.4`) · **Domain:** Train (exercise catalog + media)
- **Depends on:** `mezo-52zg` (writable catalog + `video_url` + `VideoDemo`), `mezo-18g3` (the `kb-*` block that triggered this)
- **Coordinates with:** `mezo-setx.6.7` / `.6.14` / `.6.17` (the Exist-Zen DS migration owns the surfaces this feature wants to touch — see §7)
- **Living docs to update on ship:** [`train.md`](../../features/train.md) §2/§4/§5/§10 · [`_platform-design-system.md`](../../features/_platform-design-system.md) §3
- **Source scan:** [`queries/2026-08-05-exercise-media-apis.md`](../../research/queries/2026-08-05-exercise-media-apis.md)
- **Design references (mandatory):** `liquibase_conventions.md` · `api_contract_conventions.md` · `spring_patterns.md` · `testing_standards.md` · `integration_test_framework.md` · `frontend_conventions.md`

## 1. Goal

Give every catalog exercise a **visual answer to "what is this movement?"** without a network round-trip
to a third party and without waiting for a YouTube link to be curated by hand.

The catalog carries exactly one media field today — `video_url` — and the FE render path is
**YouTube-only** (`VideoDemo` returns `null` when `youTubeId(url)` fails). Videos are excellent but
**manual**: 161 rows, 0 curated links. A still image layer is *automatable* — the public-domain
[`yuhonas/free-exercise-db`](https://github.com/yuhonas/free-exercise-db) dataset ships **exactly 2
photos per exercise** (873/873 verified), start and end position, same camera, same scene.

**The two frames are the point.** One still often fails to convey a movement; the pair, alternated,
reads as a crude animation (rack → bottom of the squat) and answers the question. That is the whole
justification for a two-field model instead of one.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Source | **free-exercise-db** (Unlicense = public domain). The alternatives were scanned and rejected: wger is CC-BY-SA (forces per-image attribution UI) with an almost always empty `videos` array; ExerciseDB is AGPL-3.0 with an explicitly non-production free tier; WorkoutX is commercial. |
| D2 | Hosting | **Vendored into the repo** at `frontend/public/exercises/`, served same-origin. Public domain ⇒ no licence plumbing; same-origin ⇒ offline PWA, no third-party request per view, no IP leak to GitHub's CDN on every card render. Accepted cost: **~7 MB** in git history + an import script. |
| D3 | Field shape | **Two nullable columns**, `image_start_url` + `image_end_url`, mirroring the dataset's fixed 2-image shape. Not a `jsonb` array (the cardinality is fixed at 2, and a typed pair keeps the contract flat); not one column (D0 rationale above). |
| D4 | URL vs key | The columns store a **URL string**, seeded with a *relative* path (`/exercises/kb-thruster-a.jpg`). A relative path costs nothing extra, but keeping the field a free URL means a user-attached absolute URL works later with zero schema change — exactly how `video_url` already behaves. **Not** a derived-from-slug convention: the FE would then have to guess whether a file exists, and 404-driven UI is not a design. |
| D5 | Ownership | **Ownership-free, like the video.** A new `PUT /api/train/exercises/{id}/images` accepts master *and* user rows (`CatalogImagesRequest {imageStartUrl?, imageEndUrl?}`, nulls clear). Master rows stay read-only for the *full* edit — same asymmetry `mezo-52zg` established for `/video` and for the same reason: attaching media is not authoring content. |
| D6 | Loader interaction | `CatalogJsonItem` gains both fields, seeded **only when the row has none** — byte-identical to the `video_url` rule at `ExerciseCatalogLoader.java:84`. A user-attached image is never clobbered by a redeploy. |
| D7 | Mapping | **Hand-curated `slug → free-exercise-db name` map, checked in.** Fuzzy matching is *disqualified*, not merely imperfect: on our 161 rows it produced 37 exact hits and then confidently paired `Pull-Up → Scapular Pull-Up`, `Cable Fly → Cable Rear Delt Fly`, `Deficit Push-Up → Clock Push-Up`. A wrong image is worse than no image — it teaches the wrong movement. |
| D8 | Coverage | **~110–120 of 161 rows will have an image; ~40 will not** — including 7 of the 22 kettlebell rows (plain two-hand `kb-swing`, `kb-halo`, both carries, `kb-single-arm-swing`, `kb-single-leg-rdl`, `kb-front-squat`, `kb-racked-lunge`). "No image" is therefore a **first-class state**, specced in §5, not an edge case. |
| D9 | Precache | Images are **excluded from the workbox precache** and served through a `CacheFirst` runtime rule. 7 MB in `globPatterns` would be downloaded on first load — the precache is the install cost, and demo photos are not install-critical. |
| D10 | Sequencing | **Data layer + one proof surface now; the remaining surfaces inside the DS migration.** `mezo-setx.6.7/.6.14/.6.17` rewrite the picker, the active workout and the catalog cards wholesale; building image UI into the pre-migration components means writing it twice. See §7. |

## 3. Data model

```sql
-- 202608??????_mezo-8xdl.1_exercise_catalog_images.sql
alter table exercise_catalog
    add column image_start_url text null,
    add column image_end_url   text null;
```

No constraint beyond nullability: an exercise may have neither, or (in theory) only a start frame —
the FE treats **`image_start_url` as the presence flag** and an absent end frame simply disables the
alternation. No index (the column is never filtered on; it rides along on the existing catalog read).

`ExerciseCatalogEntity` gains the two `String` fields. Nothing else in the entity moves.

## 4. Contract (contract-first — `api/feature/train/train.yml` before any Java)

- **`ExerciseCatalogItem`** += `imageStartUrl` / `imageEndUrl` (both `string, nullable`).
- **`GymExercise`** (meso day) and **`TodayExercise`** (workout) += the same two fields, resolved
  server-side from the linked `exercise_catalog` row — exactly how `videoUrl` already arrives, so the
  picker, the prep card and the active workout render without a second fetch.
- **`CatalogExerciseCreateRequest`** += both fields (optional) so a user-authored exercise can carry
  images from creation.
- **New `CatalogImagesRequest`** `{imageStartUrl?, imageEndUrl?}` + **`PUT /api/train/exercises/{id}/images`**
  → `ExerciseCatalogItem`. Null clears. Ownership-free (D5).

**`CatalogVideoResolver` → `CatalogMediaResolver`.** The existing resolver returns
`Map<UUID, String>` (catalogId → videoUrl) from one batched fetch. It becomes
`Map<UUID, CatalogMedia>` where `CatalogMedia` is a record of `(videoUrl, imageStartUrl, imageEndUrl)`.
Same single query, same two call sites (`WorkoutService.getToday`, `TrainService`), same
`catalogId != null` guard at the call sites. **Do not add a second resolver** — three media fields
resolved by two components is how N+1 queries are born.

## 5. Frontend

### The component

`frontend/src/features/train/components/ExerciseImage.tsx` — domain-specific (it encodes catalog
media semantics), therefore `features/train/components/`, **not** `shared/ui`.

```tsx
<ExerciseImage start={ex.imageStartUrl} end={ex.imageEndUrl} name={ex.name} muscle={ex.muscle} variant="hero" />
```

| variant | Shape | Behavior |
|---|---|---|
| `hero` | full-width, `aspect-ratio: 3 / 2`, DS radius, `overflow: hidden` | Two stacked `<img>`; the top one crossfades on a **~1.2 s** interval. With only a start frame it is a plain still. **Renders `null` when `start` is absent** — no empty box. |
| `thumb` | 44×44, rounded, start frame only, no animation | When unmapped, renders the **muscle-wash fallback tile** (the `muscleColors.ts` wash + the exercise's initial) so list rows keep a uniform left edge. |

**Non-negotiables:** `loading="lazy"` + `decoding="async"` + explicit dimensions (these land in
scrolling lists — CLS is the failure mode); `prefers-reduced-motion: reduce` ⇒ **no auto-crossfade**,
static start frame plus a small `⇄` toggle (the alternation is information, so it must stay
*reachable*, not merely be dropped); `alt` = the exercise name, never decorative-empty.

### Making bodybuilding.com photos live in the Napív DS

These are 850×569 photos of a man in a **red-walled gym** — high-saturation, high-contrast, and
tonally foreign to the app's soft muscle-tinted surfaces. Untreated they will read as pasted-in
stock. The treatment is part of the component, not per-call-site styling:

- clip to the DS radius with a 1px inset ring in `--border-subtle`;
- `filter: saturate(.88)` always, plus `brightness(.9)` under `[data-theme="dark"]` — enough to stop
  the red from fighting the card, not so much that the photo looks broken;
- the card's **muscle rail color** continues along the image edge (the PR-card language from
  `mezo-kaui`), which is what actually binds a foreign photo to our card system.

### Precedence with the video

The image is the **cheap always-on layer**; `▶ Demo` (YouTube) stays the **opt-in deep layer**. They
never compete: on the record sheet the image hero sits **above** the unchanged `VideoDemo` chip. An
exercise with a curated video and no image is unaffected by this feature.

### Surfaces (all four confirmed; §7 says *when*)

| Surface | Variant | Note |
|---|---|---|
| `ExerciseRecordSheet` | `hero` | The natural home — room to show it, and the place people go to ask "what is this?". **Ships in S3 as the proof surface.** |
| `ExercisePickerSheet` | `thumb` | The highest-utility one: recognizing a movement by sight while building a meso. |
| `ActiveWorkoutPage` (`.excard`) | `hero`, tap-to-reveal | Beside the `▶ Demo` chip, **hidden by default** — gold on an unfamiliar movement, noise on a known one. |
| `PrepExerciseCard` + `ExercisesPage` cards | `thumb` | Strongest visual lift, densest layout, and squarely inside the DS migration's blast radius. |

### Asset pipeline

- `scripts/data/exercise-image-map.json` — `{ "<slug>": "<free-exercise-db name>" }`, hand-verified,
  reviewed in the diff. Unmapped slugs are simply absent.
- `scripts/import-exercise-images.mjs` — for each mapped slug: fetch both frames from
  `raw.githubusercontent.com`, write `frontend/public/exercises/{slug}-a.jpg` / `-b.jpg`, and
  **print a mapped/unmapped report**. Idempotent (skips existing output unless `--force`), run by
  hand when the map changes — not in CI.
  **[Amended at implementation, `mezo-8xdl.2`]** The plan here was a `sharp` devDependency
  downscaling to ~560 px. Measured on the real files it recovers ~35 % (avg 59 KB → ~40 KB) — not
  worth a toolchain dependency on an otherwise dependency-free script, and the 850 px source is the
  better hero image on a 3× phone screen. **No re-encode; the originals ship as-is**, which also
  makes the import reproducible on any platform. Total came in at **~15 MB, not the ~7 MB estimated
  here** (the first sampled frame was unrepresentatively small). See [ADR 0020](../../decisions/0020-vendor-public-domain-exercise-imagery.md).
- The catalog JSON entries then carry the two relative paths, and the loader (D6) seeds them.
- `vite.config.ts`: `exercises/**` **out of** `workbox.globPatterns`, plus a `CacheFirst`
  `runtimeCaching` rule (~300 entries, 60 days).

## 6. Testing

- **Backend ITs:** loader seeds both images / never clobbers a user-set one (extend
  `ExerciseCatalogLoaderIT`); `PUT /images` round-trip incl. a **master** row and a null-clear
  (extend `CatalogWriteContractIT`); media resolution onto `TodayExercise` + `GymExercise`
  (extend `CatalogVideoResolutionIT` → the renamed resolver).
- **Frontend:** `ExerciseImage.test.tsx` — renders nothing without a start frame, alternates when both
  are present, honours reduced-motion, falls back to the muscle tile in `thumb`; plus the
  `ExerciseRecordSheet` integration. **Both modes green** (`pnpm test` + `VITE_USE_MOCK=true pnpm test`).
- **Contract drift:** regenerate `api/openapi.yml` and `src/data/_client/api.gen.ts` in the same
  commit — the `contract-drift` CI job is the gate.

## 7. Sequencing against the DS migration

`mezo-setx` is actively rewriting exactly the four surfaces this feature wants. The split:

- **Now (S1–S3):** migration, contract, loader, media resolver, `/images` endpoint, the map, the
  vendored assets, the workbox rule, ADR 0020, `ExerciseImage`, and **one** wired surface
  (`ExerciseRecordSheet`) to prove the whole chain end-to-end.
- **Inside the DS migration (S4):** picker thumbs → `mezo-setx.6.17`; active-workout reveal →
  `mezo-setx.6.14`; prep + catalog card thumbs → `mezo-setx.6.7`/`.6.14`; the authoring fields
  (`VideoUrlSheet` → `MediaUrlSheet`, `CatalogExerciseSheet`) → `mezo-setx.6.17`. Because the
  endpoint and the component ship in S1–S3, each of those is then **UI-only work** on the new
  component language — written once.

## 8. What this spec deliberately does not do

- **No user image upload.** No blob storage, no `multipart`, no media endpoint on the backend. The
  `/images` endpoint takes URLs; if hosting user photos ever becomes real, that is its own spec.
- **No GIF/video generation** from the two frames. The crossfade is a render-time effect; nothing is
  encoded, nothing is stored beyond the two JPEGs.
- **No backfill of the ~40 unmapped rows.** They stay imageless until either the dataset gains them
  or a video is curated. Inventing a lookalike would violate D7's own reasoning.
