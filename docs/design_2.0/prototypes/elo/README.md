# Élő prototípusok — one living prototype per domain

Each bottom-menu domain has one living, clickable prototype that always shows the domain as it
is in production, in the Üveg look. Every frontend change edits its domain's file instead of
starting a new prototype, and republishes it to the same Artifact URL, so the owner always opens
the same link. The rules are in [`CLAUDE.md`](../../../../CLAUDE.md) §Frontend change workflow
(`mezo-u75pt`, 2026-09-27).

| Domain | File | Artifact URL | Last synced with production |
|---|---|---|---|
| Nap | `nap.html` | — (not seeded yet) | — |
| Edzés | `edzes.html` | — (not seeded yet) | — |
| Fuel | `fuel.html` | https://claude.ai/artifact/EpY5UcqEy9F8sTsboqw43x | 2026-09-28 |
| Mezo | `mezo.html` | — (not seeded yet) | — |
| Én | `en.html` | — (not seeded yet) | — |

A file is seeded the first time a change touches its domain (seed sources are listed in
CLAUDE.md). Fill in the URL on the first publish and update the date on every merge that
touches the domain.
