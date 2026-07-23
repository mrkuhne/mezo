# Sleep Cycle screenshot ingestion — LLM-vision draft into the enriched sleep log (design spec)

- **Date:** 2026-07-23 · **bd:** `mezo-66ab` · **Related ADRs:** [0012](../../decisions/0012-consumer-owned-llm-ports.md) (consumer-owned LLM port — third instance)
- **Slice B of the Sleep cluster.** Slice A (`mezo-dbsr`, shipped in PR #43) built the receiving model: the enriched `sleep_log` (`in_bed_min`, phase minutes, `source_quality_pct`, `source manual|screenshot`) and the sleep goal + day anchor. This slice adds the ingestion path: a Sleep Cycle **screenshot** → LLM-vision extraction → editable draft → the **existing** `POST /api/biometrics/sleep` write path. Spec for A: [`2026-07-23-sleep-anchor-design.md`](2026-07-23-sleep-anchor-design.md); cluster roadmap: [`2026-07-23-sleep-routine-cluster-notes.md`](2026-07-23-sleep-routine-cluster-notes.md).
- **Precedents mirrored 1:1:** meal AI-draft (`MealDraftLlm`, draft → confirm on the normal log endpoint) and pantry photo import (`PhotoExtractLlm`, #42) — multipart upload, consumer-owned port + companion adapter, deterministic confidence, 400/502/503 error trio, disabled/unavailable IT pair.
- **Decided with Daniel in-session** (4 explicit choices, 2026-07-23): entry point, review depth, quality mapping, date editability — see D1–D4.

## 1. Goal

Let the user log a night by uploading a **Sleep Cycle screenshot** instead of typing: the backend extracts in-bed/asleep times, bed/wake clock times, phase minutes and the tracker's 0–100 quality via one LLM-vision call, the sheet shows an **editable draft**, and saving goes down the same `POST /api/biometrics/sleep` that manual logging uses — with `source: 'screenshot'`. No new persistence path; the draft never touches the DB.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Entry point | **Mode toggle inside the existing `SleepLogSheet`** (`Kézi | Screenshot` chip pair, the `ImportItemSheet` `search|link|photo` idiom). One entry point (the Log button) stays; no new page-level buttons. |
| D2 | Review depth | **Key fields editable, phases read-only.** The draft prefills the sheet's existing inputs (bedtime/wakeup TimePickers, duration, in-bed minutes, quality grid); the phase minutes (éber/könnyű/REM/mély) + tracker-quality% render as a read-only summary row. Bad extraction → re-shoot or switch to manual; phases are display data, not something to hand-edit. |
| D3 | Quality mapping | **Derived + editable.** `quality` prefills as `round(sourceQualityPct / 10)` clamped 1..10 (95% → 10, 74% → 7), adjustable on the existing 1–10 grid. Keeps the hero/colors/companion consistent across manual and screenshot rows; `source_quality_pct` stores the raw tracker value untouched. |
| D4 | Date | **Editable in review, default today** (the wake-up morning — same convention as manual). A non-blocking warning shows when a row already exists for the chosen date; multiple rows per date stay allowed (unchanged backend semantics). |
| D5 | Confirm path | **Draft endpoint + FE confirm via the normal log route** (meal/pantry precedent). `POST /api/sleep/screenshot` returns a draft only; the Mentés button posts the (possibly edited) values through the existing `logSleep` with the full enriched payload + `source: 'screenshot'`. Persistence stays on one tested path. |
| D6 | Confidence | **Deterministic, never from the LLM** (house pattern). A validator scores internal consistency: asleep ≤ in-bed; phase sum ≈ in-bed (±10%); duration ≈ bedtime→wakeup span (±15 min, midnight-wrapped); times parse as HH:mm. `confidence` = passed ÷ applicable checks; `needsReview = confidence ≤ threshold (0.6, boundary-inclusive) OR a key field (bedtime, wakeup, durationH) is missing`. |
| D7 | Image handling | **Raw pass-through, no resize** (pantry precedent — text legibility drives extraction quality; screenshots are PNG and small). App-level cap 5 MB, mime jpeg/png/webp; file input `accept="image/*"` **without** `capture` (screenshots come from the gallery, not the camera). Single photo this slice; a `photo2` can follow the pantry pattern later if needed. |
| D8 | Gating | Own flag `mezo.feature.sleep-shot.enabled` + own tag/controller (`SleepShot` → `SleepShotApi`), so the surface gates independently of the sleep log and sleep goal (same reasoning as slice A's separate `SleepGoal` tag: `useTags=true` binds tag → interface → controller). |

## 3. Backend design (`feature/biometrics/sleep`)

- **Port (ADR 0012, consumer-owned):** `service/SleepShotLlm.java` — `String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType)` (the `MealDraftLlm` single-image shape). Adapter on the companion side: `feature/companion/llm/SleepShotLlmAdapter.java`, `@ConditionalOnProperty(COMPANION_SWITCH)`, delegates to `CompanionLlm.complete(system, user, List.of(InlineImage))` on the cheap `chatModel`. Sleep never imports companion; the edge stays companion → sleep.
- **`SleepShotService`** (gated `SLEEP_SHOT_SWITCH`): validate photo (non-empty, ≤ `maxPhotoBytes`, allowed mime → 400 FIELD `VALIDATION_INVALID_VALUE`/`photo`); `ObjectProvider<SleepShotLlm>` + `requireAvailable()` → 503 `SLEEP_SHOT_LLM_UNAVAILABLE`; one multimodal call; sentinel brace-window JSON parse (`substring(indexOf('{'), lastIndexOf('}')+1)`) → 502 `SLEEP_SHOT_EXTRACT_FAILED` on unparseable; normalize times to zero-padded HH:mm (Sleep Cycle renders `0:42` → `00:42`); duration from "Asleep 7h29m" → `7.48`; compose the draft with the D6 validator's `confidence`/`needsReview`. `@Transactional` not needed (no writes).
- **`SleepShotDraftValidator`** — pure class with the D6 checks; unit-tested directly (the one place unit tests beat ITs).
- **`SleepShotController`** (gated, implements generated `SleepShotApi`): `draftSleepFromScreenshot(MultipartFile photo)` → `service.extract(currentUserId.get(), photo)`. Ownership is irrelevant to the draft (nothing persisted), principal used for logging/rate parity only.
- **Config:** `FeaturesConfiguration.SLEEP_SHOT_SWITCH = "mezo.feature.sleep-shot.enabled"`; `SleepShotProperties` (`mezo.sleep-shot`, `@Validated`): `max-photo-bytes 5000000`, `allowed-mime-types [image/jpeg, image/png, image/webp]`, `confidence-threshold 0.6`. Multipart container caps (6 MB/12 MB) already sit above the app cap — no change.
- **Prompt (system):** "You read a screenshot of the Sleep Cycle app. Return ONLY a JSON object: `{bedtime, wakeup, asleepMin, inBedMin, awakeMin, lightMin, remMin, deepMin, qualityPct}` — 24h HH:mm times ('Went to bed'/'Woke up'), minutes as integers ('Asleep'/'In bed'/'Awake'/'Light'/'Dream'/'Deep' — Dream is REM), qualityPct 0–100 ('Sleep quality'), null for anything not visible. No prose." Exact wording finalized in the plan; `messages.properties` gets the two new codes.

## 4. API contract (`api/feature/sleep-shot/sleep-shot.yml`, tag `SleepShot`, registered in `merge.yml`)

- `POST /api/sleep/screenshot` — multipart, `required: [photo]`, `photo` binary → 200 `SleepShotDraftResponse`, 400 (validation) / 401 / 502 (`SLEEP_SHOT_EXTRACT_FAILED`) / 503 (`SLEEP_SHOT_LLM_UNAVAILABLE`), all non-2xx as `SystemMessageList`. `operationId: draftSleepFromScreenshot`.
- `SleepShotDraftResponse`: required `[confidence, needsReview]`; nullable extraction fields `bedtime`/`wakeup` (HH:mm pattern), `durationH` (number), `inBedMin`, `awakeMin`, `lightMin`, `remMin`, `deepMin` (integers ≥ 0, `inBedMin` ≥ 1), `sourceQualityPct` (0..100); `confidence` number 0..1; `needsReview` boolean. Field names match `LogSleepRequest`'s enriched fields so the FE mapping is 1:1.
- The confirm ride is the **unchanged** `POST /api/biometrics/sleep` — `LogSleepRequest` already carries every field including `source` (pattern `manual|screenshot`, from slice A).

## 5. Frontend design

- **Data layer** (`data/me/sleepHooks.ts` + `biometricsApi.ts`): `useSleepShot()` → `{ extract(photo: File): Promise<SleepShotDraft>, pending }`; real: `sleepShotApi.extract` (FormData `photo` as `screenshot.png` → `POST /api/sleep/screenshot`, typed off `api.gen.ts`); mock: `MOCK_SLEEP_SHOT_DRAFT` in `data/me/sleepShot.ts` — the Walker-era example screenshot (`bedtime 00:42, wakeup 09:03, durationH 7.48, inBedMin 501, awake 52 / light 206 / rem 144 / deep 100, sourceQualityPct 95, confidence 1, needsReview false`). `SleepLogInput` + `sleepApi.log` gain `source` (slice A left it unset → manual default; the manual path keeps omitting it). New domain type `SleepShotDraft` in `data/types.ts`.
- **`SleepLogSheet`**: a `Kézi | Screenshot` chip toggle at the top. Kézi = today's sheet, untouched. Screenshot mode phases: *pick* (file input, no `capture`) → *drafting* (spinner line) → *review* — the existing inputs prefilled from the draft (times via the sheet's TimePickers, duration, Ágyban-perc, quality grid at `round(pct/10)` clamp 1..10), a read-only phase row (`éber 52p · könnyű 3ó26p · REM 2ó24p · mély 1ó40p · minőség 95%` — only fields that arrived), an editable date field (default today) with a non-blocking `Erre a napra már van bejegyzés` hint when `sleepLog` has that date, and a `needsReview` caution line when set. Mentés → `logSleep({ …edited, inBedMin, phases…, sourceQualityPct, source: 'screenshot', date })`. 502/503/400 surface via the global mutation toast; the sheet drops back to *pick* with the error hint.
- Mock-mode note: the mock `logSleep` optimistic entry must carry the enriched fields through (fixes the known slice-A demo gap — folded into `mezo-njrc`'s item 4, done here since the sheet now depends on it).

## 6. Integrations

- **→ Sleep log (slice A model):** the draft lands via the existing enriched write path; `efficiencyPct` immediately becomes in-bed-accurate for screenshot rows; the hero/rings need no change.
- **→ Companion:** only via the ADR 0012 adapter (`SleepShotLlmAdapter`); companion off → 503, surface on.
- **No goal/habit/fuel coupling** — this slice writes logs, it does not touch the anchor.

## 7. Testing

**Backend:** `SleepShotDraftValidatorTest` (pure: each consistency check, boundary `confidence == threshold` → needsReview, missing-key-field forcing). `SleepShotApiIT` (fake companion LLM returning the canned Sleep Cycle JSON → 200 draft round-trip; malformed LLM answer → 502; empty/oversized/bad-mime photo → 400 FIELD `photo`; no token → 401). `SleepShotDisabledApiIT` (`sleep-shot.enabled=false` → 404). `SleepShotLlmUnavailableApiIT` (`companion.enabled=false` → 503 + `SLEEP_SHOT_LLM_UNAVAILABLE`). Multipart via the existing `postMultipartForResponse`/`photoPart` helpers.

**Frontend:** `useSleepShot` both modes (mock draft; real FormData POST via MSW + error paths); `SleepLogSheet` — toggle renders both modes, kézi mode payload unchanged (existing tests stay green), review prefill from draft (incl. derived quality 95→10), read-only phase row, date warning appears for an existing date, save payload carries the enriched fields + `source:'screenshot'`. Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`. `/me/sleep` still outside the visual-golden set.

## 8. Out of scope (this slice)

- Second photo (`photo2` — pantry precedent ready if a second Sleep Cycle screen becomes useful).
- Automatic ingestion (HealthKit, Sleep Cycle API/export files, batch import of old screenshots).
- Phase-based scoring/analytics beyond storing the minutes (slice C candidates).
- Any change to the sleep goal / anchor / habit surfaces.
