# Companion `get_recovery` — on-demand full sleep-log detail (mezo-ohce)

**Date:** 2026-08-24 · **Driving issue:** mezo-ohce · **Status:** approved design

## 1. Goal

`get_recovery` (scope=sleep, `BiometricsTools.renderSleep`) currently renders only
**dátum, óra, minőség, ébredések** per row — even though `sleep_log` carries the full
tracker-grade enrichment (mezo-dbsr: in-bed/awake/stage minutes, source quality; mezo-fk9a:
hypnogram). When the user points at specific nights ("yesterday's sleep might be the cause"),
the AI cannot see the detail behind them.

This change lets the AI request **full detail for explicitly selected days**, while the
default call stays the compact 7-day view — so detail is paid in tokens only when asked for.

Decided during brainstorming (2026-08-24):
- **On demand, not always** (Q1→C): full detail only when the AI names the day(s); the
  compact default is unchanged.
- **Both selection forms** (Q2→C): an explicit multi-valued `date` list *and* a `from`/`to`
  range — flexible for both "yesterday" and "the last three days".
- **Approach: extend `get_recovery`** (not a new tool) — the model already routes to it, and
  the scope pattern (mezo-xixu) already gives the date params a natural home.

No API contract change (server-side tool, not REST), no frontend change, no migration
(`sleep_log` already holds every field).

## 2. Tool signature

`get_recovery(scope, days, date, from, to)` — three new optional params:

| Param | Type | Semantics |
|---|---|---|
| `date` | `List<LocalDate>` (ISO `YYYY-MM-DD`) | Exact day(s) to render in full detail. **Capped at 3 entries** (the "two or three days" case); extras ignored, not an error. |
| `from` | `LocalDate` | Start of an inclusive date range to render in full detail. |
| `to` | `LocalDate` | End of the range, inclusive. **Omitted → `to = today`**, so "last 3 days" is expressible as `from` alone. |

Precedence and clamping:
- Any of `date`/`from`/`to` present → **detail mode**; `days` is ignored.
- None present → today's compact mode, byte-identical to current output.
- The selectable window is clamped against `properties.tools().maxWindowDays()` (default 7),
  the same cap `days` already honours: `date` entries before the window start and the `from`
  edge are clamped (a `to` after today is clamped to today), so a model mistake cannot balloon
  the payload. When clamping trims the request, the header says so (see §3).
- `date` and `from`/`to` may be combined — the rendered set is their union.
- The params apply **only to scope=sleep**. For `scope=sleep-goal` and `scope=checkins` they
  are silently ignored (documented in the param descriptions — an ignored param is not an
  error, matching the tool's existing "honest absence, never failure" behaviour).

`@Tool` description: a new scope=sleep sentence describing the detail fields, plus the
trigger clause ("a user konkrét nap alvási adatait / fázisait kérdezi"). The system
prompt's `[Eszköz-útmutató]` sleep entry (`ChatService.SYSTEM_PROMPT`) is updated in the same
change, per `companion_tool_conventions.md`.

## 3. Rendering (detail mode)

One line per requested day, newest first:

- **Row present** — every field null-guarded, absent fields simply omitted (manual rows stay
  sparse; never a fabricated value), Hungarian labels consistent with the rest of the tool:
  `lefkévés HH:MM, ébredés HH:MM; Xh Yp; ágyban Zp; ébren A p · feheres B p · REM C p ·
  mély D p; minőség n/5; ébredések k; forrás: screenshot (87%); hypnogram: DDLR…;
  megjegyzés: …`
  - `hypnogram` renders as `bucketMin` + the **raw stage-letter string** (display-only
    provenance, ADR 0015 — the AI sees the shape; ratios are never re-derived from it).
  - `notes` render only when non-blank (same rule as `get_weight_log`).
- **Requested day without a log row** — explicit, so the AI can tell "checked, nothing" from
  "didn't check": `<date>: nincs rögzített alvás`.
- **Header** — `Alvás — részletes nézet:`; when clamping trimmed the request:
  `Alvás — részletes nézet, visszavágva N napra:`.
- Compact mode (no date params): output unchanged, including the `Alvás (utolsó N nap):`
  header and per-row format.

## 4. Audit

`ToolCallAudit` refs in detail mode: `Sleep`/date for each expanded row, same ≤5 cap as
compact mode.

## 5. Data access

One repository read. Add `findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc`
(derived finder on `SleepLogRepository`, plain — no companion dependency) covering the
clamped window, then filter in-memory to the requested days (≤7 rows, no N+1). The existing
`DateGreaterThanEqual` finder is untouched (still serves compact mode and the context
snapshot).

## 6. Testing (integration-first, per `mezo-testing`)

New/extended ITs under `feature/companion/tools` (alongside `CompanionToolsRenderIT`):
1. detail, one `date` → full line with every populated field.
2. detail, multiple `date` values (2–3) → each rendered, newest first.
3. detail, `from` only (`to` omitted → today) and `from`+`to` → every logged day in range.
4. range wider than the window cap → clamped, header shows the trimmed count.
5. requested day without a row → `nincs rögzített alvás`.
6. screenshot row → all tracker fields + hypnogram rendered; manual sparse row → only
   populated fields (no fabricated numbers).
7. `date`/range on `scope=checkins` / `scope=sleep-goal` → params ignored, existing output.
8. default call (no new params) → byte-identical compact output (regression).

Test data via a `SleepLogPopulator` (new aggregate → new populator per the IT framework
conventions) if one does not already exist; `ResetDatabase` TRUNCATE list gains `sleep_log`
if not already present (verify against mezo-dbsr's ITs).

## 7. Docs (same change)

- `docs/features/companion.md` §4 tool-catalog row for `get_recovery` (new params + detail
  render) and §5.5 if the source-read description changes.
- `node scripts/lint-docs.mjs` green before close.

## 8. Out of scope

- New REST endpoint / API-contract change (tools are not the REST surface).
- Frontend changes (the app's sleep view already shows all these fields).
- Re-deriving stage ratios or scoring from the hypnogram (ADR 0015: display-only).
- Changes to `sleep_log` schema, the compact-mode output, or other `get_recovery` scopes'
  rendering.
