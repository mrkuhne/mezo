# Graph seed selection stops matching noise — Implementation Plan (`mezo-b3pp.34`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make the `[Összefüggések]` block topical again. `GraphTraversalService.seedsFor` currently seeds on any folded token ≥3 chars appearing *anywhere* inside a node's title or summary, which lets a chatty Hungarian sentence seed most of the graph — and once the seed set is the whole graph, `neighborhood` degenerates into "the globally strongest edges", regardless of what was asked.

**Three distinct defects, from the bd.**
1. **No stopwords.** `nem`, `hogy`, `csak`, `volt`, `mert`, `kell`, `most`, `meg` are all ≥3 chars and survive the length filter. Hungarian node summaries are full of them, so one such word seeds nearly everything.
2. **No seed cap.** Nothing bounds how many nodes may seed one turn.
3. **Substring containment.** `ToolText.containsFolded` is plain `contains`, so **`ital` matches `vitalitás`** — the bd's own example.

**The matching decision.** Do **not** change `ToolText.containsFolded`: it is a shared primitive and `FuelTools` depends on its substring semantics for user-typed filters. The graph needs a different rule, so it gets its own local one: a token matches when it appears **at a word start** in the folded field. That is the right compromise for an agglutinative language — `alvás` must still match `alvásminőség` (prefix of a word), while `ital` must not match `vitalitás` (mid-word). Exact-word matching would be wrong here; plain containment is what we are fixing.

**The cap needs an order, or it is arbitrary.** Truncating an unordered seed list would make the block depend on row order. Seeds are therefore ranked before the cap: a **title** hit outranks a summary-only hit (a title match is the stronger topical signal), then by how many **distinct tokens** matched, with a deterministic final tie-break so two runs of the same turn produce the same block.

**Tech Stack:** Java 21 / Spring Boot, Testcontainers ITs.

## Global Constraints

- **bd id on every commit subject:** `(mezo-b3pp.34)`. Conventional-commit subjects.
- **Backend only.** No contract change, no frontend change — this is prompt-assembly internals. Do not touch `api/**`, `frontend/**`, or run the generators.
- **Do NOT modify `ToolText.containsFolded` or `searchTokens`.** They are shared with `FuelTools`; a semantics change there would silently alter unrelated tool filtering. Add the graph's rule locally.
- **Spec §11:** integration-first tests. No new table → `support/ResetDatabase.java` and populators untouched. The seed cap is tuning → a bounded field on `CompanionProperties.Graph`, in the style of `maxHops`/`topK`/`maxRefs`.
- **IDENT-3:** `seedsFor` must keep returning an empty list rather than throwing when a message has no usable tokens — an empty seed set already means "no SQL, no block", and a message made only of stopwords is exactly that case.
- **Backend gate:** focused ITs only (`./mvnw clean test -Dtest='...' -Dmezo.test.use-testcontainers=true`, Docker up). Testcontainers mode is mandatory.
- **Docs in the same change:** `docs/features/companion.md`'s W2.4 section.

---

### Task 1: Stopwords, word-start matching, ranked seed cap

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/graph/service/GraphTraversalService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` (the `Graph` record) + `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/graph/GraphPromptAssemblerIT.java` is the only current caller-side coverage of `seedsFor` — read it first. Prefer a focused new `GraphSeedSelectionIT` next to it for the seeding rules themselves, and leave the assembler IT alone unless a case there genuinely breaks.

- [ ] **Step 1: Write the failing tests**

Read `GraphPromptAssemblerIT` for the harness (base class, populators — `GraphPopulator` exists — and the `testX_shouldY_whenZ` naming), then write the cases. Every case seeds real nodes and calls `seedsFor` directly:

```
testSeedsFor_shouldIgnoreStopwords_whenTheMessageIsMostlyFiller
  a node titled "Késői evés"; message "nem hiszem hogy csak most kell meg volt"
  => NO seeds (every token is a stopword or <3 chars)
  — this is the defect: today each of those words matches any summary containing it

testSeedsFor_shouldStillSeed_whenAStopwordSentenceAlsoCarriesARealWord
  same node; message "nem hiszem hogy az evés a baj"
  => the node IS seeded (the stopwords are dropped, "eves" still matches)
  — guards against a stopword list so eager it kills real turns

testSeedsFor_shouldMatchAtAWordStart_whenTheTokenIsAPrefixOfALongerWord
  a node titled "Alvásminőség"; message "alvás"
  => seeded (folded "alvas" starts the word "alvasminoseg")

testSeedsFor_shouldNotMatchMidWord_whenTheTokenIsOnlyAnInfix
  THE BD'S OWN EXAMPLE: a node titled "Vitalitás"; message "ital"
  => NOT seeded

testSeedsFor_shouldCapTheSeeds_whenManyNodesMatch
  with graph.max-seeds = 2, seed 5 nodes that all match the message
  => exactly 2 seeds

testSeedsFor_shouldPreferTitleMatches_whenTheCapBites
  with graph.max-seeds = 1, one node matching only in its SUMMARY and one matching in its TITLE
  => the TITLE match is the survivor

testSeedsFor_shouldPreferMoreDistinctTokenMatches_whenTitlesTie
  with graph.max-seeds = 1, two nodes both matching in the title, one on two distinct message
  tokens and one on a single token => the two-token node survives

testSeedsFor_shouldBeDeterministic_whenRunTwiceOnTheSameData
  the same call twice => identical ordered seed lists
  (the tie-break exists so the block cannot flicker between turns)

testSeedsFor_shouldReturnEmpty_whenTheMessageHasNoUsableTokens
  message "ma az" => empty, and no exception (IDENT-3: empty seeds ⇒ no SQL, no block)
```

- [ ] **Step 2: Run and confirm failure**

```bash
cd backend && ./mvnw clean test -Dtest='GraphSeedSelection*' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Add the stopword set and the word-start matcher**

In `GraphTraversalService`, next to `MIN_TOKEN_CHARS`:

```java
    /**
     * Hungarian filler that would otherwise seed the graph on its own (mezo-b3pp.34). These are
     * ≥3 chars, so the length filter lets them through, and node summaries are ordinary Hungarian
     * prose — so one "nem" in a chatty turn matched most of the graph, and once the seed set is
     * the whole graph the neighborhood walk degenerates into "the globally strongest edges",
     * which is no longer an answer to the question that was asked.
     *
     * <p>Deliberately SMALL and closed: only words that carry no topic at all. Anything that could
     * name a subject the user might ask about stays out — a stopword list that is too eager
     * silently deletes real turns, which is the harder failure to notice.
     */
    static final Set<String> STOPWORDS = Set.of(
        "nem", "hogy", "csak", "volt", "mert", "kell", "most", "meg", "van", "lesz", "lehet",
        "azt", "ezt", "ami", "amit", "aki", "akit", "vagy", "pedig", "utan", "elott", "mar",
        "majd", "igen", "talan", "szerintem", "tenyleg", "megis", "persze");
```
(Fold every entry the same way `ToolText.fold` would — i.e. write them already lowercase and accent-free, as above. Add a short comment saying so, and if you add a word with an accent, fold it first or the filter will never match it.)

And the local matcher:

```java
    /**
     * Word-START containment on the folded text — the graph's own rule, deliberately NOT
     * {@link ToolText#containsFolded} (mezo-b3pp.34). That primitive is plain substring
     * containment and is shared with {@code FuelTools}, where a user-typed filter genuinely wants
     * to match anywhere; changing it would silently alter unrelated tool behaviour. Here plain
     * containment produced false seeds — "ital" matched "vitalitás" — while an exact-word rule
     * would be wrong for an agglutinative language, where "alvás" must still reach
     * "alvásminőség". Matching a token only where it STARTS a word is the rule that keeps the
     * prefix case and drops the infix one.
     */
    private static boolean startsAWordIn(String value, String foldedToken) {
        if (value == null) {
            return false;
        }
        String folded = ToolText.fold(value);
        int from = 0;
        while (true) {
            int i = folded.indexOf(foldedToken, from);
            if (i < 0) {
                return false;
            }
            if (i == 0 || !Character.isLetterOrDigit(folded.charAt(i - 1))) {
                return true;
            }
            from = i + 1;
        }
    }
```

- [ ] **Step 4: Rank, then cap**

Rewrite `seedsFor` so it filters stopwords, scores each matching node, sorts, and caps. Keep the early `tokens.isEmpty()` return. Sketch — adapt to how this class reaches `CompanionProperties` (read it first; it currently has none injected, so you will need to add it the way sibling graph services do):

```java
    public List<UUID> seedsFor(UUID userId, String userMessage) {
        List<String> tokens = ToolText.searchTokens(userMessage).stream()
                .map(t -> t.replaceAll(EDGE_PUNCTUATION, ""))
                .filter(t -> t.length() >= MIN_TOKEN_CHARS)
                .filter(t -> !STOPWORDS.contains(t))
                .distinct()
                .toList();
        if (tokens.isEmpty()) {
            return List.of();
        }
        // Rank before capping: an unordered truncation would make the block depend on row order.
        // A TITLE hit outranks a summary-only hit (the stronger topical signal), then more
        // distinct matching tokens wins; the id tie-break is what makes two runs of the same turn
        // produce the same block instead of flickering.
        record Scored(ActiveNode node, boolean titleHit, long tokenHits) {}
        return traversalQuery.activeNodes(userId).stream()
                .map(n -> new Scored(n,
                        tokens.stream().anyMatch(t -> startsAWordIn(n.title(), t)),
                        tokens.stream().filter(t ->
                                startsAWordIn(n.title(), t) || startsAWordIn(n.summary(), t)).count()))
                .filter(s -> s.tokenHits() > 0)
                .sorted(Comparator.comparing(Scored::titleHit).reversed()
                        .thenComparing(Comparator.comparingLong(Scored::tokenHits).reversed())
                        .thenComparing(s -> s.node().id()))
                .limit(properties.graph().maxSeeds())
                .map(s -> s.node().id())
                .toList();
    }
```

Add `maxSeeds` to `CompanionProperties.Graph` with bounds in its siblings' style, plus the value and a justifying comment in `application.yml`'s `graph:` block. **8** is the suggested default — the same order as `topK`, so a fully-matched turn still walks a real neighbourhood rather than the whole graph; justify whatever you choose in the yaml comment.

- [ ] **Step 5: Run the tests**

```bash
cd backend && ./mvnw clean test -Dtest='GraphSeedSelection*,GraphPromptAssembler*,GraphTraversalQueryIT' -Dmezo.test.use-testcontainers=true
```
If a pre-existing `GraphPromptAssemblerIT` case now fails, READ it before touching it: it may be relying on a seed that only matched mid-word, in which case the fixture was asserting the bug. Fix the fixture to be realistic and say so in your report — do not loosen the new rule to keep an old fixture green.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "fix(companion): graph seeds ignore stopwords, match at word starts, and are capped (mezo-b3pp.34)"
```

---

### Task 2: Docs + gates

- [ ] **Step 1: Docs**

`docs/features/companion.md`'s W2.4 section must now say: seeds drop a small, deliberately closed Hungarian stopword set (and why a too-eager list is the worse failure); matching is **word-start** on the folded text, with the reasoning — `ToolText.containsFolded` stays untouched because `FuelTools` shares it, plain containment gave `ital`→`vitalitás`, and exact-word matching would break `alvás`→`alvásminőség`; and seeds are ranked (title hit, then distinct token hits, then id) before being capped at `graph.max-seeds`, because an unordered truncation would make the block depend on row order and flicker between identical turns. Name the new tests. Bump `updated:`.

- [ ] **Step 2: Gates**

```bash
cd backend && ./mvnw clean test -Dtest='GraphSeedSelection*,GraphPromptAssembler*,GraphTraversalQueryIT,ChatServiceGraphBlock*' -Dmezo.test.use-testcontainers=true
node scripts/lint-docs.mjs
node scripts/gen-codemap.mjs --check
grep -c '<<<<<<<\|>>>>>>>' docs/CODEMAP.md
```
No frontend gate — this slice touches no TypeScript and no contract. The last line must print `0`: a previous merge once committed conflict markers into that file's header and `gen-codemap --check` is blind to them (`mezo-ag1b`).

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs(features): companion — graph seed stopwords, word-start matching, seed cap (mezo-b3pp.34)"
```

---

## Self-Review

- **bd coverage.** "Add a small Hungarian stopword set" → Task 1 Step 3, with the list kept deliberately closed and the reason stated. "and a seed cap so chatty turns don't degenerate the block into the global top-K" → Step 4's `graph.max-seeds`. "substring match (ital→vitalitás)" → the word-start matcher, with the bd's own example as a test.
- **What this plan adds beyond the bd:** the ranking. The bd asks for a cap but not an order, and an unordered cap would make the block depend on `activeNodes` row order — two identical turns could produce different `[Összefüggések]`. Title-hit → token-count → id makes it both meaningful and deterministic, pinned by its own test.
- **The trap it avoids:** changing `ToolText.containsFolded` would be the smallest-looking diff and would silently change `FuelTools`' user-facing filter. The rule is local for that reason, stated in the javadoc so nobody "simplifies" it later.
- **The opposite risk is named too:** a stopword list that is too eager silently deletes real turns, which is harder to notice than a noisy block — hence the second test, which asserts a stopword-heavy sentence carrying one real word still seeds.
- **Placeholders.** Production code is literal except where it must adapt to how this class reaches config (it currently injects none) — that is called out as "read it first" rather than guessed.
