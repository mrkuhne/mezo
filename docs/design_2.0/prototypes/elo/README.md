# Élő prototípusok — one living prototype per domain

Each bottom-menu domain has one living, clickable prototype that always shows the domain as it
is in production, in the Üveg look. Every frontend change edits its domain's file instead of
starting a new prototype, and republishes it to the same Artifact URL, so the owner always opens
the same link. The rules are in [`CLAUDE.md`](../../../../CLAUDE.md) §Frontend change workflow
(`mezo-u75pt`, 2026-09-27).

| Domain | File | Artifact URL | Last synced with production |
|---|---|---|---|
| Nap | `nap.html` | https://claude.ai/artifact/K16pachHoksG9KY1yKo4C3 | 2026-09-28 — Check-in 2.0 (`mezo-ck2`) shipped to main: `#checkin`, the four slot sheets, `#napom`, `#napzaras/3`, `#ikonok` match production. Prototype-only, not app features: the slot chips on the check-in sheet and the „Mit táplál" page (`#hatasok`). The week hub's 3×3 cells with the new Hangulat cell live in the Én domain, which has no living prototype yet. (Seeded 2026-09-27 from `uveg-nap.html`; not yet merged: `uveg-napod.html` routes.) |
| Edzés | `edzes.html` | https://claude.ai/artifact/DdTK5jJ6XTBuqnPSC3fpcC | 2026-09-28 — Actual-movement budget (`mezo-tb3s2`) shipped: the „Amit a mozgásod hozzáad" energy card now shows the served Fuel movement number (planned + extra logged kcal), not a client-side estimate — it can no longer disagree with the Fuel keret. Earlier: Arányos progressziós lépcső (`mezo-bk7sn`) shipped: `#indulas` rows and `#session/uj` cards show the proportional targets (Chest Row 105 × 9, Lat 74,5 × 11) and the above-range reason line (Hammer Curl 15 × 13). Earlier: Eligazítás (`mezo-mgu2r`) shipped: `#indulas` briefing (band, counts, niggle, pre-ticked challenge rows in the app's variant-B anatomy, overload line, exercise list, floating Indulás), `#session/uj` without session-level panels, card badge → gbox `qb` (Elengedem / Visszaveszem), card-head delta chip. Earlier: Check-in 2.0 (`mezo-ck2`) shipped to main: the `#mai` „Mai állapot" readiness card (offer, lightened + undo) matches production; in the app it shows only on a planned gym day with a morning check-in that suggests it. (Seeded 2026-09-27 from `uveg-edzes.html`; not yet merged: `uveg-edzes2.html` routes; `companion-titanium` modules inlined so the page is self-contained.) |
| Fuel | `fuel.html` | https://claude.ai/artifact/EpY5UcqEy9F8sTsboqw43x | 2026-09-28 — Actual-movement budget (`mezo-tb3s2`) shipped to main: the budget hero's Mozgás row is ma logolt mozgás (planned + unplanned, not the weekly average) with a faint „még jön +X" pending pill; the Edzőnap-shift stepper is gone from Fuel settings. |
| Mezo | `mezo.html` | https://claude.ai/artifact/LBngXviRqUhc5q2ragbtex | 2026-09-28 — S8 chat-memória (`mezo-d6ivw.12`) shipped to main: the chat's answer card shows what each turn learned, proposed, recalled and forgot (Megjegyeztem/Megjegyezném chips, Emlékszem line + recall sheet, „ezt ne jegyezd meg" forget flow incl. the empty-forget state and the widen-to-conversation sheet). |
| Én | `en.html` | https://claude.ai/artifact/TpZ8YTcX6rBLvLhpkfAK8M | 2026-09-28 — seeded from `uveg-en.html` (not yet merged: `uveg-en2.html` routes; the live week hub has since grown cells the seed does not show). `mezo-p87ok` shipped to main: `#het` discovery card (bar + legend) and `#felfedezesek` (rare traces on top, Minták / Új tudás drawers) match production. |

A file is seeded the first time a change touches its domain (seed sources are listed in
CLAUDE.md). Fill in the URL on the first publish and update the date on every merge that
touches the domain.
