# UI Redesign Prototypes (mezo-88jw)

Self-contained, interactive single-file HTML prototypes for the Napív→Clay UI redesign.
Open them directly in a browser, or view the published artifacts below. Design decisions and
the full context live in `../2026-08-26-ui-ia-redesign-handoff.md`; the clay icon/spot sprites
they inline come from `../assets/`.

## Files ↔ published artifacts

| File | Artifact URL (republish with `url` to keep the link) |
|---|---|
| `clay-csomag.html` | https://claude.ai/code/artifact/79f7676e-7998-4a61-b098-44c2e0f8b905 |
| `nap-gerinc.html` | https://claude.ai/code/artifact/e1eae7d4-05bc-41c9-8e7e-55bdbee70249 |
| `edzes-tab.html` | https://claude.ai/code/artifact/d9fd807c-71ca-4c27-b8c9-7d32aca48d15 |
| `mezociklus.html` | https://claude.ai/code/artifact/a4f4ecdd-decc-4524-9fab-931af7a9c8b3 |
| `edzes-session.html` | https://claude.ai/code/artifact/0a747fcc-0359-462a-8b8b-1de02a611f77 |

## Workflow

1. Edit the parts in `src/` (`*-head.html` = title + CSS; `*-body.html` = markup + JS).
2. Run `./build.sh` — it inlines the sprites from `../assets/` into the 5 assembled files.
3. Republish the assembled file as an artifact, passing the matching `url` above so the link
   stays stable.

Never edit the assembled files directly — they are build output (committed so the prototypes
are usable without a build step).

## What each prototype demonstrates

- **clay-csomag** — the asset catalog: Orb logo, 33 clay icons (tab-bar mute test included),
  14 spot graphics.
- **nap-gerinc** — the Nap (spine) tab: daypart panels (Reggel/Nap/Este) with per-panel entrance
  choreography, header daypart switch + notification bell + orb avatar, one hero + mosaic rule,
  minimal tile anatomy, five detail pages (Mezo messages, habits, quests, check-in with fillable
  slot, Életjel with segmented ring → need tiles), interactive water/stack tiles.
- **edzes-tab** — Edzés IA: hero (today's session + coach line) + 6 tiles; detail pages with
  muscle-zone bars, volume arc, e1RM sparkline, lap chart, filter-chip catalog, medal cabinet.
- **mezociklus** — full mesocycle functionality: hub (hero + Volumen/Történet/Sablonok/Új blokk
  tiles), MEV/MAV/MRV provenance bars with expandable derivation, 5-step wizard (tappable phase
  curve, Emphasize cap 2, program editor with day breakdown + session-cap 11 + Lint/PeakFit,
  searchable multi-add exercise picker, ▲▼ reorder), start/close sheets (close → report),
  frozen report, Történet selection mode → A/B compare page.
- **edzes-session** — the full gym session flow (interactive state machine, feature-complete
  against `frontend/src/features/train/pages/ActiveWorkoutPage.tsx`).
  **Prep = Huawei tile IA**: hero (eyebrow + name + 4 mini stat cells: várható XP / szett / idő /
  izomcsoport + CTA above the fold), then a 6-tile mosaic — Gyakorlatok, Fejlődés, Heti zóna,
  Küldetések (badge), Bemelegítés, Niggle (badge; "Értem" → kezelve ✓) — each opening its own
  page with a compact hero (title above an icon+number row, no subtitles) + stat strip +
  animated bars/rings in the Heti zóna recipe. Gyakorlatok page: tile-styled exercise cards
  (family wash + rail, clay disc, labeled columns Cél · Induló súly, mini set dots carry the
  set count, 1RM medal, footer "múlt héten → progression chip" + challenge flag).
  **Live logging = calm default**: only the execution card is expanded — single-line name +
  small media icon buttons, muted metaline (🔥/🌿 · rep range · RIR · challenge chip),
  one-line note pill, white Logolás panel (slot label with cél, set dots + warmup-% note,
  flexible steppers, RIR 0–3 hidden on warmups, L/B/R for isolation, collapsed "＋ megjegyzés"
  toggle, CTA / rest bar with pause/skip at 10× demo speed); Progresszió and Szettek are thin
  collapsible strips with informative headers ("⚡ Progresszió · +2,5 kg ▾",
  "Szettek · 2/6 ✓ · 1 234 kg ▾"); 5-way navigation, medal toast, ⋯ sheet
  (reorder/skip/+szett with "Csak ma / Minden hétre"/durable note/early finish), set table
  rows edit/delete with one-slot floor. RP debrief per exercise, closing summary (halo hero,
  muscle pills, medals + target sets, challenge outcomes, per-exercise chip map, note),
  finish → level-up screen → closed mode.
