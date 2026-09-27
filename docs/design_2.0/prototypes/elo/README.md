# Élő prototípusok — one living prototype per domain

Each bottom-menu domain has one living, clickable prototype that always shows the domain as it
is in production, in the Üveg look. Every frontend change edits its domain's file instead of
starting a new prototype, and republishes it to the same Artifact URL, so the owner always opens
the same link. The rules are in [`CLAUDE.md`](../../../../CLAUDE.md) §Frontend change workflow
(`mezo-u75pt`, 2026-09-27).

| Domain | File | Artifact URL | Last synced with production |
|---|---|---|---|
| Nap | `nap.html` | https://claude.ai/artifact/K16pachHoksG9KY1yKo4C3 | 2026-09-27 seeded from `uveg-nap.html` (not yet merged: `uveg-napod.html` routes); Check-in 2.0 prototype on top — **not in production yet** |
| Edzés | `edzes.html` | https://claude.ai/artifact/DdTK5jJ6XTBuqnPSC3fpcC | 2026-09-27 seeded from `uveg-edzes.html` (not yet merged: `uveg-edzes2.html` routes; `companion-titanium` modules inlined so the page is self-contained); Check-in 2.0 readiness card — **not in production yet** |
| Fuel | `fuel.html` | — (not seeded yet) | — |
| Mezo | `mezo.html` | — (not seeded yet) | — |
| Én | `en.html` | — (not seeded yet) | — |

A file is seeded the first time a change touches its domain (seed sources are listed in
CLAUDE.md). Fill in the URL on the first publish and update the date on every merge that
touches the domain.
