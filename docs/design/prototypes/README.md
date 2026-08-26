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

## Workflow

1. Edit the parts in `src/` (`*-head.html` = title + CSS; `*-body.html` = markup + JS).
2. Run `./build.sh` — it inlines the sprites from `../assets/` into the 4 assembled files.
3. Republish the assembled file as an artifact, passing the matching `url` above so the link
   stays stable.

Never edit the assembled files directly — they are build output (committed so the prototypes
are usable without a build step).

## What each prototype demonstrates

- **clay-csomag** — the asset catalog: Orb logo, 30 clay icons (tab-bar mute test included),
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
