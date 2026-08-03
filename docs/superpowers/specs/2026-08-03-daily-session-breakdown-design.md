# Daily per-muscle session breakdown in MesoEditor — design decision

- **Date:** 2026-08-03
- **Driving issues:** mezo-smhn (daily breakdown card) · mezo-0znc (plyo exclusion)
- **Status:** approved (Daniel picked variant A from the mockup; the mockup is the binding visual artifact)
- **Mockup:** [`assets/2026-08-03-daily-breakdown-mockup.html`](assets/2026-08-03-daily-breakdown-mockup.html)
- **Parent spec:** [2026-08-01-set-budget-unified-editor-design.md](2026-08-01-set-budget-unified-editor-design.md)

## Problem (found on first real-world use)

On the shipped unified editor the session-cap warnings live only at the bottom of the *expanded*
weekly `SetBudgetCard`, and the hero's `⚠ n jelzés` counter doesn't say **which of TODAY's muscle
groups breaks the 11-set session cap**. Editing a specific day gives no per-day feedback — only the
weekly budget pills. (Observed live on the "Hypertrophy · Nyár" meso: 9 warnings, no way to see
that HÉT shoulder = 12 was one of them.)

## Decision — variant A: dedicated "Ma" card

A new always-visible card between `MesoEditorHero` and `SetBudgetCard`, for the **active day**:

- Eyebrow `Ma · izmonként` + right-aligned `max 11 szett/izom` hint.
- One row per muscle group trained today: 5px family rail, bold label, mono `n / 11` value
  (error-colored with ⚠ when over), mini bar scaled so the 11-set cap sits at a **marked cap
  line** (~91% width); over-cap fill runs family-color → `var(--error)` gradient.
- Over-cap groups add an amber warning line: `⚠ {Izom}: ma {n} szett — 11 fölött nincs kimutatható
  plusz. Vigyél át szettet egy másik napra (pl. {legkevésbé terhelt kompatibilis nap})!`
- **List highlight:** exercise rows feeding an over-cap group get a faint `var(--error)` border.
- Weekly `SetBudgetCard` stays unchanged below (variant B's Ma/Hét switcher was rejected — both
  levels must be visible at once).

## Related correction (mezo-0znc)

Plyo-type exercises (`type === 'plyo'`) are explosive quality work, not hypertrophy volume — they
must leave the budget/session-cap math (exact treatment decided in that issue), otherwise
quad/calf budgets read falsely red (live example: Comb 242% pre-trim).
