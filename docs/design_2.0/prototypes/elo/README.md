# Élő prototípusok — one living prototype per domain

Each bottom-menu domain has one living, clickable prototype that always shows the domain as it
is in production, in the Üveg look. Every frontend change edits its domain's file instead of
starting a new prototype, and republishes it to the same Artifact URL, so the owner always opens
the same link. The rules are in [`CLAUDE.md`](../../../../CLAUDE.md) §Frontend change workflow
(`mezo-u75pt`, 2026-09-27).

| Domain | File | Artifact URL | Last synced with production |
|---|---|---|---|
| Nap | `nap.html` | https://claude.ai/artifact/K16pachHoksG9KY1yKo4C3 | 2026-09-28 — Check-in 2.0 (`mezo-ck2`) + follow-ups: `#checkin`, the four slot sheets, `#napom`, `#napzaras/3`, `#ikonok` match production; the `uveg-napod.html` routes are merged in (the A napom day views `#nap/<date>` — live, `/este`, closed/scored, thin day — `#maieste` and the „Mit írsz be?” sheet); the tabbar now matches the app (Mai · A napom · Beszélgetés · Rutin) and the header day orb opens the day view. Prototype-only, not app features: the slot chips on the check-in sheet and the „Mit táplál” page (`#hatasok`). (Seeded 2026-09-27 from `uveg-nap.html`.) |
| Edzés | `edzes.html` | https://claude.ai/artifact/DdTK5jJ6XTBuqnPSC3fpcC | 2026-09-28 — Check-in 2.0 (`mezo-ck2`): the `#mai` „Mai állapot” readiness card (offer, lightened + undo) matches production; in the app it shows only on a planned gym day with a morning check-in that suggests it. The `uveg-edzes2.html` routes are merged in (Terv: `#terv` with its three states, `#run`, `#nap/<day>`, `#napszerk`, `#het`, `#izom`, `#konyvtar`, `#futamok`, `#riport`, `#osszevetes`, `#sablonok`, `#sablon`, `#sablonszerk`, `#ujterv`; Terhelés: `#terheles`, `#terkep`, `#jelek`, `#mozgas`; `#sajat`; `#tervikonok`), and the Terv / Terhelés tabs open `#terv` / `#terheles` like the app (`/train/gym` is a retired redirect). (Seeded 2026-09-27 from `uveg-edzes.html`; `companion-titanium` modules inlined.) |
| Fuel | `fuel.html` | — (not seeded yet) | — |
| Mezo | `mezo.html` | — (not seeded yet) | — |
| Én | `en.html` | https://claude.ai/artifact/9tLViJToBxqsHkaLADbng5 | 2026-09-28 — seeded from `uveg-en.html` + `uveg-en2.html` (one router, 45 routes, tabs Áttekintés · Súly · Alvás · Napló per `navModel`), then the week hub `#het` got the 3×3 cells with Hangulat next to Energia (Check-in 2.0, `mezo-ck2`), matching `WeekHubPage`. Known gaps vs the app (not yet drawn): the `/me/growth` hub page, the settings editors for Fuel slots / biometrics / sleep / gym / sport, and `#rutin` still shows daily ticking (it lives on Nap · Rutin in the app). |

A file is seeded the first time a change touches its domain (seed sources are listed in
CLAUDE.md). Fill in the URL on the first publish and update the date on every merge that
touches the domain.
