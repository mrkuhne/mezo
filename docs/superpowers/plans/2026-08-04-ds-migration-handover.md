# DS-migration handover — read this first, then do the current bead

**Audience:** any agent (Claude Code, Codex, local LLM) starting with **fresh context**.
**Purpose:** everything you need to execute one `ds-migration` bead end-to-end without prior conversation history.
**Epic:** `mezo-setx` — Exist Zen DS migration, "Mezo edition".

---

## 0. TL;DR operating loop

```bash
bd ready -l ds-migration        # what is unblocked right now
bd show <id>                    # read the bead
bd update <id> --claim          # claim it
# ... do the work (procedure in §6) ...
bd close <id>
```

One bead = one `feat/<topic>` branch = one self-PR (CI green) = local `--no-ff` merge to main = push. Full git rules: repo `CLAUDE.md` §Git Workflow. Never leave work unpushed.

## 1. What this project is (60-second capsule)

**mezo** is a mobile-first Hungarian-language health & performance PWA. React 19 + Vite + TypeScript + Tailwind v4; all styling flows from CSS custom properties in `frontend/src/styles/prototype.css`. The app renders inside a desktop iPhone-frame shell (`frontend/src/app/PhoneFrame.tsx`) with a floating bottom TabBar + center quick-log FAB; on narrow/PWA viewports it goes full-bleed. **All UI copy is Hungarian** — never introduce English strings into user surfaces.

`frontend/src` has four layers (details + rules: `docs/references/frontend_conventions.md` — **mandatory read before touching code**):

```
app/       shell + router.tsx
features/  <domain>/{pages,components,sheets,logic}   (today · train · fuel · me · insights · ritual · quickinput · progression)
shared/    ui/ (primitives) · lib/ · hooks/
data/      hooks.ts barrel + per-domain hooks/mock/types + _client/
```

Routed views are `*Section` (tab root with `<Outlet>`) or `*Page` (leaf). Modals are `*Sheet` in `sheets/`. **Never create a `*Screen`/`*View`.**

## 2. What we are doing, and what we are NOT doing

We are re-skinning **every page** of the app to the **Exist Zen design system v2**, merged with mezo's identity ("Mezo edition"). Per-page beads live under epic `mezo-setx`, all labeled `ds-migration`.

**We ARE:** replacing tokens/typography/spacing/radius/shadows/motion, converging components onto the DS vocabulary, redesigning page layouts where the DS idiom differs (Hero, StatCard, ListItem, CoachBubble…), preserving every existing feature and flow.

**We are NOT:**
- touching the data layer: **no changes to `frontend/src/data/**` hook signatures, mock seeds, REST clients, or the API contract** — the migration is purely visual/structural above `@/data/hooks`;
- removing functionality, routes, or Hungarian copy (copy may be lightly re-worded only if a bead says so);
- breaking the 3-mode theme (light / dark "Pulse" / circadian) — every restyled surface must work in **both** themes;
- rewriting battle-tested machinery: `Sheet.tsx`'s async `requestClose` dismissal, `SortableList`'s dnd/a11y, the theme resolver (`CircadianTheme`), skeleton `pending` idiom — restyle their chrome only.

## 3. The design references (in this repo — no external paths needed)

| Doc | Role |
|---|---|
| `docs/references/design-system-mezo.html` | **The normative DS** ("Mezo edition") — exists after bead P0 (`mezo-setx.1`). Use it as the single source of truth for tokens/components once present. |
| `docs/references/exist-zen-design-system-v2.html` | The imported source DS (Exist Zen v2, lavender-skinned). Until P0 lands, use this for structure/components/rules and apply the §4 color decisions on top. |
| `docs/references/exist-zen-MOBILE_UX.md` | The mobile-UX rulebook the DS cites (§4 spacing, §6 typography, §7 color caps, §21 forbidden patterns). |
| `docs/superpowers/plans/2026-07-31-exist-zen-mezo-edition-migration.md` | The migration plan: decisions D1–D4, phase plan, component mapping table (§5), per-page checklist (§6). |
| `docs/features/<domain>.md` | Living doc of the feature you're migrating — read it before its bead; **update it after** (same change). |
| `docs/features/_platform-design-system.md` | Living doc of the current ("Napív") system you are replacing — background + file map. |

## 4. Design direction (decisions D1–D4, settled 2026-07-31)

1. **Coral is primary.** 5-stop ramp built from mezo's coral: `bg #FFF4EF · soft #FFDFD3 · base #FF6B4A · hover #E05535 · deep #C4622F` (P0 may fine-tune; **coral base fails AA as text on white — text/links use hover/deep**, same pattern the source DS uses for gold).
2. **Warm surfaces stay.** Surface/text scales come from mezo, not the lavender DS: page `#FBF6EF`, card `#FFFFFF`, ink `#2B2118`/`#5F5346`/`#8A7A6A`/`#A5978A`, divider `rgba(43,33,24,0.10)`. Gold accent ramp + success/warning/error ramps adopted from the DS.
3. **Typography = Geist + Fraunces**, with the DS role table verbatim (§5 below). Bricolage Grotesque + Plus Jakarta Sans are retired.
4. **3-mode theme stays.** Every ramp gets `data-theme="dark"` (Pulse graphite) overrides seeded from the existing dark values (`#221E1B` surfaces, `#F5EFE6` ink, lifted accents like `#FF7E5C`). The circadian sky band stays.
5. **Domain accents survive only in the data-viz band** (like DS macro colors): Train=coral, Fuel=sage, Sleep/Me=lav, Sport=rose, Futás=sky, plus amber — legal in charts/rings/icons/heatmaps/signal tints, **illegal** on buttons, badges, links, surfaces.
6. The coral→amber **CTA gradient** (FAB, primary CTA) survives as the primary-CTA treatment.

## 5. Design-system cheat-sheet (the rules you'll apply on every bead)

**Type roles — these sizes and NO others** (emphasis via weight, never via off-scale sizes; if you reach for 13/17/20px you're wrong):

| Token | Size/weight | Use |
|---|---|---|
| `text-display` | 56 / 200 / -0.04em | hero numerals only |
| `text-h1` | 36 / 700 | page title, one per screen |
| `text-h2` | 24 / 700 | sub-page/section title |
| `text-h3` | 18 / 600 | card heading |
| `text-coach` | 22 / Geist 200 | Coach voice (never italic) |
| `text-pull-quote` | 22 / Fraunces 500 italic | AI pull-quote |
| `text-body(-strong)` | 16 / 400 (600) | body floor is 16 |
| `text-caption` | 14 / 400 | helpers, button labels — 14 is the floor for sentence case |
| `text-eyebrow` | 12 / 700 / 0.22em uppercase | eyebrows; 12px otherwise only for form helpers + tab labels |
| `text-meta(-sm)` | 16/14 Fraunces italic | source-lines, empty-state subtitles |

**Scales:** spacing `--sp-1..9` = 4/8/12/16/24/32/40/48/64 · radius 6/10/14/18/22/28/9999 · z-ladder base 0 / sticky 10 / bottomnav 30 / fab 40 / sheet 50 / modal 60 / toast 70 / tooltip 80 · motion `--duration-fast|normal|slow` (150/250/400ms) + `--ease-out|in-out|spring` · sheet snap heights **40 / 65 / 95 vh only**.

**The 21 anti-patterns** (full detail at the bottom of the DS html — check before every commit): 1 no inline hex/rgba — tokens only · 2 no inline italic (italic = Fraunces meta only; Coach is Geist 200) · 3 no invented z-index · 4 empty number input stays empty (`number | null`, commit on blur) · 5 tappables are `<button>`/`<a>`, never `<div onClick>` · 6 tap targets ≥48dp (pad small visuals) · 7 motion tokens, no literal ms · 8 never re-implement a canonical primitive inline — import from `@/shared/ui` · 9 the CTA gradient has ONE definition · 10 respect `env(safe-area-inset-*)` on bottom-fixed elements · 11 never state via color alone — pair icon/text · 12 snap to the radius scale · 13 icon-only buttons need `aria-label` · 14 sheet snaps 40/65/95 only · 15 no pure #000-on-#fff (halation) · 16 body ≥16px, caption ≤14px · 17 form fields need visible labels (not placeholder-only) · 18 card inner padding ≤ gap between cards · 19 primary CTA in the thumb zone (bottom third), top-right = low-frequency/destructive only · 20 modal alerts must offer a real action (or be a toast) · 21 every tappable has visible press feedback.

## 6. Per-bead procedure

1. `bd show <id>` + `bd update <id> --claim`; create branch `feat/ds-<slug>`.
2. **Read** (in order): this doc (done) → `docs/references/frontend_conventions.md` → the feature's `docs/features/<domain>.md` → the DS doc (§3) sections for the components the bead names.
3. **Inventory the page:** open the page file and list every component/sheet it imports from `features/<domain>/components|sheets` — those files are in scope too (the bead lists the page + its named sheets; feature-local components used only by this page ride along).
4. **Restyle/redesign:** re-express the page in DS vocabulary — shared primitives from `@/shared/ui` (converged in P2), DS layout idioms (Hero / StatCard / ListItem / CoachBubble / full-page states), tokens for every color/space/radius/motion value. Keep data hooks and flows untouched. Keep Hungarian copy.
5. **States:** loading skeleton (real mode `pending`), empty (`GhostState`/DS empty state), error — all three must render correctly; keep `role="status"` semantics.
6. **Themes:** verify light + dark (and the sky band doesn't clash). Set `data-theme="dark"` on `:root` manually or via the Me→Profil→gear theme selector.
7. **8-point check** (from the plan §6): tokens-only · type roles · P2 primitives · scales · state triad · dark+circadian · a11y (48dp, semantics, aria-label) · tests+docs.
8. **Gate:**
   ```bash
   cd frontend && pnpm build && pnpm run test && VITE_USE_MOCK=true pnpm run test
   ```
   Both modes must be green. Fix, don't skip. (Visual check: `VITE_USE_MOCK=true pnpm dev` → http://localhost:5180 — no backend needed; or use the `verify` skill in Claude Code.)
9. **Docs in the same change:** update the feature's `docs/features/<domain>.md` sections the redesign touched; run `node scripts/lint-docs.mjs`.
10. Commit (`feat(<domain>): DS-migrate <Page> (<bead-id>)`), push, self-PR, wait CI green, `--no-ff` merge locally, push main, delete branch, `bd close <id>`. Session end: `git pull --rebase && bd dolt push && git push` and confirm `git status` clean.

## 7. Mock / dual-mode guide (why tests run twice)

- The FE runs in two modes: **real** (default; REST against the backend on :8090) and **mock** (`VITE_USE_MOCK=true`; in-memory seeds, no backend). The single boundary is `@/data/hooks` — features never import mode-specific code.
- Dual-mode read hooks use `useDualQuery`; each exposes `pending` = `!mock && isPending`. **Mock mode never shows skeletons** (seeds resolve synchronously); real mode shows the page's `*Skeleton` while pending. Don't break this idiom when restyling skeletons.
- Tests are colocated and must pass in **both** modes (`pnpm run test` twice, see §6.8). Real-mode tests stub the API with MSW; mock-mode tests hit the seeds. If your restyle changes text/roles that tests assert on, update the tests **together with** the change — but prefer keeping stable roles/labels (`role="status"`, aria-labels) so tests survive.
- Never use mock seed data as a real-mode fallback. Never edit `src/data/_client/api.gen.ts` by hand.

## 8. Environment facts (this machine)

- **pnpm 9** (corepack-pinned; do NOT upgrade to 10/11 — CI runs 9; upgrade is tracked separately as `mezo-q8oy`). node 24, bd 1.1.2 (embedded dolt).
- Ports: Vite dev **5180** · backend **8090** (not needed for mock-mode work) · Postgres **15432** (`cd backend && docker compose up -d`).
- Backend work is out of scope for this epic, but the full toolchain (JDK 21 at `~/.local/jdk21`, Docker) exists if a bead unexpectedly needs it.

## 9. Bead map

```
mezo-setx (epic, label ds-migration on every bead)
├─ mezo-setx.1  P0 Mezo-edition DS doc + ADR          ← everything visual keys off this
├─ mezo-setx.2  P1 token foundation swap               (alias bridge keeps old pages rendering)
├─ mezo-setx.3  P2 shared/ui primitive convergence     (mapping table: plan §5)
├─ mezo-setx.4  P3 shell (TabBar/FAB/Hero/sky/Toast)   ← gates all page beads
├─ mezo-setx.5  P4 Today+Ritual+QuickInput   → children .5.1–.5.5
├─ mezo-setx.6  P5 Train                     → children .6.1–.6.17 (.6.1 TrainSection gates the domain)
├─ mezo-setx.7  P6 Fuel                      → children .7.1–.7.12 (.7.1 FuelSection gates)
├─ mezo-setx.8  P7 Me+Progression            → children .8.1–.8.14 (.8.1 MeSection gates)
├─ mezo-setx.9  P8 Insights                  → children .9.1–.9.8  (.9.1 InsightsSection gates)
└─ mezo-setx.10 P9 cleanup: alias-bridge removal + anti-pattern sweep + docs
```

Dependency logic: every page bead is blocked by **P3** (shell) and by its domain's `*Section` bead; domains are parallel-friendly after P3 — multiple agents can work different domains at once, but never two beads touching the same files.

## 10. Notes for small/local models

- Don't invent design values. Every color/size/radius/duration you need **exists in the DS doc** — look it up; if it's not there, you're using the wrong value.
- Don't refactor beyond the bead. No renames, no file moves, no "while I'm here" fixes — file a new bd issue instead (`bd create`).
- If something contradicts (doc vs code), trust the code + `docs/features/*.md`, and note the discrepancy in the bead with `bd update <id> --append-notes`.
- If you cannot finish, do NOT half-commit: push the branch, note state in the bead, leave the bead claimed.
