# Chat Memory chips stop duplicating the Emlékek row — Implementation Plan (`mezo-b3pp.29`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** stop an assistant answer showing the same recalled memories twice — once as bare `[Memory]` date chips in the `Hivatkozott` footer, and again in the `Emlékek · N` row right below, which carries the same dates *plus* source and gist.

**The report.** Seen live on the first W3.1b answer: `Hivatkozott · L3` listed four `[Memory]` date chips while `Emlékek · 6` below repeated those dates with strictly more information. The chips are pure redundancy — the row is the better surface for exactly the same facts.

**The decision (the bd offered two).** Option (a) filter `Memory` refs out of the chip row when the message has a recalled list; option (b) keep the chips and make them scroll to the row. Take **(a)**: the row sits directly below, so scrolling to it buys nothing, and (b) would keep the visual noise while adding interaction. Crucially the filter is **conditional** — a message with `Memory` refs but *no* recalled list still shows them, because then the chip is the only provenance the user gets.

**Deliberately out of scope.** The bd also notes the `· L3` suffix is misleading (these are L1 episodic refs, not L3 facts — and neither are the tool refs beside them). That string is pinned as prototype copy in three Design 2.0 documents, so changing it is a `mezo-d20` decision, not a unilateral fix here. Filed as **`mezo-d20.12`**.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.29)`. Conventional-commit subjects.
- **Frontend only.** No backend, no contract change — the wire already carries both `refs` and `recalled`; this is purely which of them the component renders. Do not touch `api/**`, `backend/**`, or run the generators.
- `docs/references/frontend_conventions.md`: deep absolute `@/*` imports only (never relative `../`), no `index.ts` barrels, `var(--token)` colors only.
- **Both FE test modes must be green, run explicitly:** `VITE_USE_MOCK=false pnpm test` and `VITE_USE_MOCK=true pnpm test`. `isMockMode()` is `VITE_USE_MOCK !== 'false'`, so a bare `pnpm test` is a MOCK run and the real-mode gate would be vacuous.
- **Docs in the same change:** the feature doc that describes the chat message anatomy (grep `docs/features/` for `Hivatkozott` / `RecalledMemoriesRow`).

---

## File Structure

| File | Responsibility |
|---|---|
| **Modify** `frontend/src/features/insights/components/ChatMessage.tsx` (~:61-77) | Filter `Memory` refs when `recalled` is non-empty; guard the footer on the FILTERED length. |
| **Modify** `frontend/src/features/insights/pages/ChatPage.test.tsx` (or the ChatMessage test if one exists — grep first) | The three cases below. |
| **Modify** the feature doc describing the refs footer | Record the rule and why. |

---

### Task 1: Filter the chips, and fix the empty-footer latent bug

**Files:**
- Modify: `frontend/src/features/insights/components/ChatMessage.tsx`
- Test: the existing chat test file (grep `Hivatkozott` under `frontend/src` to find which one asserts the footer — `ChatPage.test.tsx` is the known one)

**A latent bug this change would otherwise expose.** The footer today is guarded by `{m.refs && (…)}`. An **empty array is truthy in JS**, so a message with `refs: []` already renders the footer's eyebrow with no chips under it. Filtering can now *produce* an empty list from a non-empty one, which would make that stale-looking empty footer common instead of rare. The guard must therefore become a length check — that is part of this task, not a separate cleanup.

- [ ] **Step 1: Write the failing tests**

Grep for the test that currently asserts the `Hivatkozott` footer and extend it in its own harness and style. Three cases:

```
hides the Memory chips when the answer carries a recalled list
  an assistant message with refs [{kind:'Memory',id:'2026-05-21'}, {kind:'Workout',id:'w-2026-05-20'}]
  AND a non-empty `recalled`
  => the Workout chip is still rendered; NO chip shows the Memory kind label
  => the Emlékek row is rendered (assert it, so the test proves the memory content is still
     reachable — the point is dedupe, not deletion)

keeps the Memory chips when the answer has NO recalled list
  the same refs, `recalled` absent/empty
  => the Memory chip IS rendered — it is the only provenance the user gets, so filtering it
     unconditionally would DESTROY information rather than dedupe it

hides the whole refs footer when filtering leaves nothing
  refs [{kind:'Memory',...}] only, plus a non-empty `recalled`
  => the `Hivatkozott` eyebrow is NOT in the document
     (this is the latent empty-array-is-truthy bug; without the length guard the eyebrow would
      render alone over an empty chip row)
```

Find the exact `Memory` kind string on the wire before writing (`ChatRef.kind`), and note `chatRefs.ts`'s `KIND_LABELS` has no `Memory` entry, so such a chip renders the raw kind `Memory` — query for that.

- [ ] **Step 2: Run and confirm failure**

```bash
cd frontend && pnpm vitest run src/features/insights
```

- [ ] **Step 3: Implement**

In `ChatMessage.tsx`, above the `return`, derive the visible refs, then guard on length:

```tsx
  // mezo-b3pp.29: the Emlékek row below carries the same recalled memories with their source and
  // gist, so a bare [Memory] date chip beside it is pure duplication. Filtered ONLY when that row
  // is actually there — with no recalled list the chip is the user's only provenance for the
  // recall, and dropping it would destroy information rather than dedupe it.
  const hasRecalled = !!m.recalled?.length
  const visibleRefs = hasRecalled ? (m.refs ?? []).filter((r) => r.kind !== 'Memory') : (m.refs ?? [])
```

and replace the footer's guard and map:

```tsx
        {/* length, not truthiness: an empty array is truthy, and the filter above can now turn a
            non-empty refs list into an empty one — without this the eyebrow would render alone. */}
        {visibleRefs.length > 0 && (
          <div className="mzc-reffoot">
            <span className="mzc-refeb">Hivatkozott · L3</span>
            <div className="mzc-refrow">
              {visibleRefs.map((r, i) => {
                // Gap-7 fix: human labels where the data provides them, raw id otherwise.
                const d = chatRefDisplay(r)
                return (
                  <span key={i} className="mzc-refch">
                    <b className="mzc-refk">{d.kind}</b>
                    {d.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}
```

Leave the `Hivatkozott · L3` string exactly as it is — the `· L3` question is `mezo-d20.12`, deliberately not this slice.

- [ ] **Step 4: Run the tests — expect PASS, both modes**

```bash
cd frontend && pnpm vitest run src/features/insights
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/insights
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/insights
git commit -m "fix(insights): Memory chips no longer duplicate the Emlékek row (mezo-b3pp.29)"
```

---

### Task 2: Docs + gates

**Files:**
- Modify: the feature doc describing the chat message anatomy (grep `docs/features/` for `Hivatkozott`); bump `updated:`.

- [ ] **Step 1: Record the rule**

The prose must say: `Memory` refs are filtered out of the `Hivatkozott` footer **when and only when** the message carries a non-empty `recalled` list, because `RecalledMemoriesRow` shows the same memories with source and gist; with no recalled list the chips stay, since they are then the only provenance. Also note the footer is now guarded on the *filtered* length, so a message whose only refs were `Memory` renders no footer at all rather than a bare eyebrow. Cross-reference `mezo-d20.12` for the separate `· L3` label question, so the next reader knows it was seen and deliberately deferred rather than missed.

- [ ] **Step 2: Lint + full gates, both modes explicitly**

```bash
node scripts/lint-docs.mjs 2>&1 | tail -5
cd frontend && pnpm build
cd frontend && VITE_USE_MOCK=false pnpm test
cd frontend && VITE_USE_MOCK=true pnpm test
node scripts/gen-codemap.mjs --check
```
No backend gate — this slice touches no Java. `lint-docs`: no NEW findings versus the pre-edit baseline (capture it first).

**If `test-visual` goldens would move:** the chat screen is not among the 20 visual screens (they are today/train/fuel/insights/me hubs plus the two ritual shots), so no baseline change is expected. If `pnpm test:visual` locally shows a chat-related diff, stop and report rather than regenerating.

- [ ] **Step 3: Commit**

```bash
git add docs/features
git commit -m "docs(features): the chat refs footer drops Memory chips when the Emlékek row is there (mezo-b3pp.29)"
```

---

## Self-Review

- **bd coverage.** "filter refs of kind 'Memory' out of the chip row when `m.recalled` is non-empty (tool refs stay)" → Task 1 Step 3, with the conditionality pinned by its own test. Option (b) is rejected in writing with the reason. The `· L3` half is deliberately deferred to `mezo-d20.12` because the string is pinned as prototype copy in three Design 2.0 docs — recorded rather than silently skipped.
- **What this plan adds beyond the bd:** the empty-array-is-truthy guard. `{m.refs && …}` renders a bare eyebrow for `refs: []` today; the new filter can produce exactly that state from a normal message, so the fix would otherwise make a rare cosmetic bug common. Pinned by its own test.
- **The information-destruction trap:** filtering `Memory` unconditionally would look like a smaller diff and pass a naive "no duplicate chips" test, while silently removing the only provenance from answers that have refs but no recalled list. The second test case exists to make that failure loud.
- **Placeholders.** Production code is literal. Test bodies are named cases with exact setup and assertions; the harness is deferred to the existing chat test file, which the implementer is told to locate by grep rather than guess.
