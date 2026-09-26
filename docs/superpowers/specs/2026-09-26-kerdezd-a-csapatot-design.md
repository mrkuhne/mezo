# Kérdezd a csapatot — the Diagnózis page moves into the team world

**Date:** 2026-09-26 · **Status:** owner-approved (prototype OK 2026-09-26) · **Bead:** `mezo-u3712`
**Prototype (parity reference):** [`docs/design_2.0/prototypes/uveg-diagnozis.html`](../../design_2.0/prototypes/uveg-diagnozis.html)
**Builds on:** diagnosis epic `mezo-hqfi` (+ weight `mezo-85x5r`), csapatfal `mezo-a9bo7`, üveg bible.

## 1. Why

The old Mezo hub had a Diagnózis tile; the csapatfal (`mezo-a9bo7.10`) moved it behind
A csapat → Gépterem → Összes funkció. The owner could not find it, and when he did, the page read
dated: three big ask cards, past reports buried below "hamarosan" tiles, and — a real bug, fixed
separately in `mezo-tpmr2` — sleep and weight reports never listed at all.

Owner decisions (2026-09-26): entry points on **A csapat** and at the **bottom of the Nap hub**,
both named **"Kérdezd a csapatot"**, opening the (redesigned) page, not a quick sheet, because
the question list will grow. Each question has a **host character**; the fatigue question's
host is **Mezo** (multi-domain). The A csapat row sits between the characters and the Gépterem.

## 2. What ships

1. **Question catalog gets hosts** (`diagnosisCatalog.ts`): `fatigue → mezo`, `sleep → szunya`,
   `weight → deru`; upcoming: `Kell most deload? → mocor`, `Havi Mezo Riport → mezo`. Each live
   question also carries a one-line blurb, the window sentence and the "looks at" chips.
2. **`/mezo/diagnozis` = "Kérdezd a csapatot"** (route path unchanged):
   back pill → where you came from (router state `{ from, label }`, fallback A csapat);
   header; today's quota line (dots, "Ma még N kérdés"); **latest answer** = the page's one glass
   card (host avatar, question, verdict, certainty); **"Mit kérdezel?"** = one flat list, one row
   per question with host avatar + host eyebrow + blurb + "utoljára <date>" + a Kérdezem pill,
   upcoming rows dimmed with HAMAROSAN; **"Korábbi válaszok"** = flat rows with host avatar,
   filter chips (Mind + each host present), date + certainty or FRISSÍTHETŐ when stale.
   Mock mode: asking disabled with the existing demo line.
3. **Ask sheet** (shared `Sheet`): host avatar + question + who looks ("Mezo nézi meg — Szunyával
   és Mocorral"), weight → a two-week picker (this week / last week, ISO Mondays), window line,
   looks chips, then either **Megnyitom a választ** (weight week already has a non-stale report:
   the existing open-or-generate lookup) or **Kérdezem** + "1 a mai 3 kérdésedből". While
   generating, the sheet shows the host "utánanéz" with the four steps (steps advance on a timer;
   the last waits for the real response). Errors reuse the existing `ERROR_COPY`.
4. **Report page** (`/mezo/diagnozis/:id`): back pill → "Kérdezd a csapatot"; frameless halo hero
   with host avatar + guest avatars (guests = distinct suspect domains' characters ≠ host);
   window eyebrow, question, verdict, certainty; a one-line derived voice row ("Mezo nézte meg ·
   Szunya és Mocor segített") only when guests exist; stale banner "Az adataid azóta változtak"
   with **Frissítés** (regenerate same phenomenon/anchor); Számvetés unchanged; suspects: rank 1
   the one glass, others flat, each with its **owner character** chip; probe + Próbáljuk ki
   unchanged; closing Szkeptikus dashed note (honesty: correlation, the probe decides).
5. **Suspect domain on the wire:** `DiagnosisSuspect.domain` (optional, `sleep|train|fuel|mind|
   body|other`), resolved in the mapper from `MetricKey.wireKey()`; unknown → null → Mezo.
   Additive contract change.
6. **Entry rows:** a shared `AskTeamRow` (glass, gold, five stacked avatars) on `TeamPage`
   (above Gépterem) and at the bottom of `NapHubPage`.
7. **Nav:** `/mezo/diagnozis` is owned by the **A csapat** dock tab (was Üzenőfal); leltár label
   "Kérdezd a csapatot".

## 3. Not in scope

The live team conversation (`mezo-a9bo7.20`), new diagnosis recipes, quota changes, the Összes
funkció dev menu (keeps the original name "Diagnózis").

## 4. Honesty rules kept

Nothing is composed by the FE beyond derived labels (host/guest names from the catalog and the
suspect domains). The quota line is `3 − today's generated rows` from the list (the backend stays
the authority: a 429 still maps to the quota copy). Generation stays live-only.

## 5. Tests

List page (hosts, latest card, filters, sheet, weight reuse, mock disabled, quota), detail page
(hosts/guests, owner chips, stale refresh, back target), `AskTeamRow` on TeamPage + NapHubPage,
navModel ownership, catalog hosts, mapper domain (backend IT on the list/detail response).

## 8. Tracking

Bead: `mezo-u3712`.
