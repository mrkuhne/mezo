---
title: "Goal engine — grounded numbers (TDEE, activity energy, muscle/strength retention)"
type: query
updated: 2026-06-18
tags: [technique, tooling]
related: [../../superpowers/specs/2026-06-18-goal-system-design.md, ../index.md]
question: "What sport-science numbers should mezo's goal engine use for TDEE bootstrap, adaptive TDEE, activity energy per training system, the weight-change constant, and the muscle/strength guards?"
provenance: "workflow wf_4ac5f005-710 (13 agents, web-sourced, adversarially verified) on 2026-06-18"
confidence: high
---

> **Query page** — a synthesized, cited answer (not a verbatim source). Produced by a research
> workflow that fanned out 6 finders, adversarially verified 6 load-bearing numeric claims, and
> synthesized. Consumed by [`docs/superpowers/specs/2026-06-18-goal-system-design.md`](../../superpowers/specs/2026-06-18-goal-system-design.md) §6.
> Full source list is in §8 below.

# Goal Engine — Grounded Numbers Reference

Status: decision-ready · For: body-weight projection + daily calorie/protein/sleep/rest prescription coupling a lifting mesocycle + running block + recurring volleyball. Every number below ships a single **DEFAULT** plus its **range** and confidence. Subject under design: recreationally trained adult male, ~84 kg.

---

## 1. TDEE bootstrap formula (goal creation, day 1)

Used only until adaptive TDEE (§2) has enough data. Treat the output as a **starting estimate, ±300 kcal**, never as truth.

### Inputs to ask the user
- **Sex** (M/F) — picks the MSJ constant
- **Activity level** — picks the PAL band (§ table below)
- *(optional)* **Body-fat %** — if reliable, switch to the LBM path

### From biometrics (already in the app)
- **Weight (kg)**, **height (cm)**, **age (yr)** — pulled from the biometrics module, not re-asked.

### Step 1 — BMR

**DEFAULT path — Mifflin-St Jeor (no body-fat available):**
```
men:   BMR = 10*weight_kg + 6.25*height_cm - 5*age_yr + 5
women: BMR = 10*weight_kg + 6.25*height_cm - 5*age_yr - 161
```

**Preferred path — Katch-McArdle (use when a reliable body-fat % exists, e.g. lean/trained user):**
```
LBM_kg = weight_kg * (1 - bodyfat%/100)
BMR    = 370 + 21.6 * LBM_kg
```
Rationale: MSJ uses total mass and **systematically underestimates RMR in trained/athletic individuals** (only ~52% within ±10% vs ~71–82% in the general population — verified). When body composition is known, the LBM-scaled equation is the better seed.

Worked example (84 kg, 180 cm, 35 yr, ~15% BF → LBM 71.4 kg):
- MSJ → `840 + 1125 − 175 + 5 = 1795 kcal/d`
- Katch-McArdle → `370 + 1542 ≈ 1912 kcal/d`

### Step 2 — TDEE = BMR × PAL

| PAL | Multiplier | When |
|-----|-----------|------|
| Sedentary | 1.2 | Little/no exercise, desk job |
| Lightly active | 1.375 | Light exercise 1–3 d/wk |
| **Moderately active (DEFAULT)** | **1.55** | Moderate exercise 3–5 d/wk |
| Very active | 1.725 | Hard exercise 6–7 d/wk |
| Extra active | 1.9 | Physical job / 2× training/day |

A recreationally trained male typically lands **1.55–1.725** → TDEE ≈ **2780–3095 kcal/d** in the worked example. **DEFAULT multiplier: 1.55** (raise to 1.725 if the user logs 6+ training touches/week across all three systems).

> Implementation note: the PAL multiplier already bakes in *average* training energy. Do **not** also add the §3 per-session costs to a PAL-derived TDEE — that double-counts. The §3 deltas are for **adaptive** TDEE block-boundary adjustments and for the user-facing "why did my target move" explanation, not for the bootstrap. See §3.

---

## 2. Adaptive TDEE (once food logging exists)

Switch from the formula to back-calculation once enough logged data accrues. This is **strictly more accurate** per-individual after ~3–4 weeks (verified: peer-reviewed intake-balance method lands within ~40 kcal/d mean error vs DLW/DXA; MacroFactor reports R²≈0.755 adaptive vs 0.354 static).

### Core equation
```
adaptive_TDEE = mean_daily_intake_kcal  -  (Δtrend_weight_kg * 7700) / window_days
```
where `Δtrend_weight_kg` is the change in the **smoothed** weight trend (not raw scale) across the window, and 7700 is the kcal/kg constant (§4).

### Smoothing (mandatory — never use raw weigh-ins)
- **Exponentially-weighted moving average** of daily weigh-ins.
- **DEFAULT half-life: 10 days** (range 10–14). Equivalent EWMA `α ≈ 1 − 0.5^(1/half_life)` ⇒ α ≈ 0.067 at 10-day half-life.
- Compute trend slope from the EWMA series, not point weights — kills water/glycogen/sodium noise.

### Data minimums / confidence ramp
- **< 14 days OR < 4 weigh-ins/week:** stay formula-dominant. Adaptive estimate is provisional only.
- **14 days (≥4 weigh-ins/wk):** provisional adaptive — begin blending in.
- **21–28 days:** full confidence; adaptive-dominant.

### Blend (formula prior → adaptive)
Linear ramp (or Kalman/Bayesian update) on adaptive weight `w`:
```
TDEE = (1 - w) * formula_TDEE  +  w * adaptive_TDEE
w = clamp((window_days - 7) / (28 - 7), 0, 1)   // 0 at ≤1wk, 1 at ≥4wk
```

### Guardrails
- **Enable adaptive mode only if** weigh-in frequency ≥ 4/week AND intake-logging completeness is adequate (systematic under-logging biases TDEE downward 1:1 — it measures intake-as-logged).
- **Step cap:** a single noisy week may not move the displayed target by more than **±100–150 kcal**.
- Widen the window / fall back to the prior when data goes sparse.
- Expected residual error once converged: **~80–215 kcal/d**; budget **±200 kcal/d** for a well-logged user (vs ~300 kcal/d ≈ 12% for the formula).

---

## 3. Activity energy per system (block boundaries → TDEE deltas)

Formula: `kcal = MET × bodyweight_kg × hours` (84 kg basis). MET values from the 2024 Adult Compendium. Hypertrophy and interval sessions are intermittent → **effective session-average METs** are used (a sustained single MET value overstates them).

| System | Effective MET | Per-session kcal (84 kg) | Sessions/wk | Per-week kcal | Type |
|--------|--------------|--------------------------|-------------|---------------|------|
| **Hypertrophy lift** (45–75 min) | ~3.5–5.0 | **~250–400** (DEFAULT **325**) | 3–5 | ~975–1625 | delta |
| **Interval/sprint run** (30–40 min) | ~10–13 | **~400–600** (DEFAULT **500**) | 2–3 | ~1000–1500 | delta |
| **Volleyball — recreational** (90–120 min) | ~3.5 | **~440–590** (DEFAULT **500**) | 1–2 | ~500–1000 | delta |
| **Volleyball — competitive** (90–120 min) | ~8.0 | **~1000–1340** (DEFAULT **1150**) | 1–2 | ~1150–2300 | delta |

**Deltas vs constant ambient baseline:**
- The **constant ambient baseline** is BMR plus NEAT/daily-living, already represented by the **PAL bootstrap** (§1) or absorbed into **adaptive TDEE** (§2). It does not change at block boundaries.
- The **per-system rows above are deltas** — the marginal energy a given block *adds or removes* when it starts/stops. Use them to project a TDEE step at block transitions (e.g. running block ends → subtract ~1000–1500 kcal/wk ≈ ~145–215 kcal/d from projected expenditure), and to explain target shifts to the user.
- **Critical anti-double-count rule:** when running on the **PAL bootstrap**, the deltas are *already inside* the multiplier — only apply a delta as an *incremental* change relative to the activity baseline the PAL already assumed, never as a fresh addition. Once on **adaptive TDEE**, do **not** add deltas at all for the steady state (the back-calc already captures real expenditure); use deltas only as a *feed-forward* nudge for an *imminent* block change before enough post-change data exists, then let adaptive re-converge.

**EPOC / afterburn: ignore as a planning term.** Real but small (~6–15% of session cost, ~10% for HIIT; ~3 kcal/30 min above baseline). It is within MET noise — do not add a separate EPOC line.

> Individual MET variance is ±20–30% (fitness, technique, rest-interval length). These are starting estimates; adaptive TDEE is what actually corrects them.

---

## 4. Weight-change planning constant

**DEFAULT: 7700 kcal/kg** (≈3500 kcal/lb).
```
projected_weekly_weight_change_kg = weekly_cumulative_deficit_kcal / 7700
```

**Range to surface: 6000–7700 kcal/kg** (lower early/in men; upper late / near-pure-fat loss / in women).

### Caveats the engine must encode
1. **It is the energy density of near-pure fat loss, not total bodyweight loss.** Early loss is far less dense (~4858 kcal/kg at wk 4, ~6041 at wk 6) due to water/glycogen/FFM. So a 7700-based estimate **under-predicts the first 2–4 weeks' scale drop** and **over-predicts steady-state**.
2. **Don't hold the deficit static.** As weight falls, TDEE falls — the deficit shrinks geometrically. The static 7700 rule over-predicts long-run loss (~52 lb/yr predicted vs ~32 lb real for a 500 kcal/d deficit). This geometric shrink, **not** adaptive thermogenesis, is the dominant error.
3. **Adaptive thermogenesis** is a smaller, additional drag: point estimate **−178 ± 137 kcal/d** after 1 week of restriction. Optionally apply a conservative **100–200 kcal/d expenditure haircut** during active dieting.

### How the empirical spine corrects it
Do **not** project a fixed deficit forward as truth. The 7700 constant is only the **planning anchor** for the *initial* projection. The real correction is the §2 loop: back-calculate true maintenance from rolling intake-vs-trend data, recompute every week, and **surface a ±several-hundred-kcal uncertainty band** rather than a deterministic line. The empirical spine (logged intake + EWMA trend) silently re-fits both the effective kcal/kg *and* the falling TDEE — the constant just seeds week 1.

---

## 5. Muscle guard thresholds (soft guard — warn, don't block)

### Protein
- **DEFAULT: 2.0 g/kg bodyweight/day.** Range floor **1.6** (general sufficiency), practical ceiling **2.2**.
- If body-fat % known, also compute **2.3–3.1 g/kg LBM** (Helms/ISSN) and **take the higher** of the two targets, **capped at 2.6 g/kg bodyweight** (no proven benefit above this).
- Scale toward the high end for lean users (M <~15% BF) in an aggressive deficit.
- Per-meal: **0.40–0.55 g/kg BW** across 3–6 meals.
- **Warn when** logged protein falls below the floor (1.6 g/kg BW) on a trend basis.

### Rate-of-loss cap
- **DEFAULT target: 0.7 %BW/week.** Acceptable band **0.5–1.0 %BW/wk**.
- **Bias lower (0.5–0.7%) as estimated body-fat drops** (leaner = slower); allow up to 1.0% for higher-BF users.
- **Warn when** the smoothed trend exceeds **>1.0 %BW/wk** (elevated lean-mass-loss risk).
- 84 kg example: target ~0.59 kg/wk (band 0.42–0.84 kg/wk) ⇒ roughly a **300–650 kcal/d deficit** (use the lower deficit as the user leans out).
- Lean-mass-sparing promise is **gated** on: protein ≥1.6 g/kg/d AND ongoing resistance training. Without both, the rate alone guarantees nothing.

### Maintenance volume (per muscle/week)
- **DEFAULT during a cut: 8 hard sets/muscle/week.** Band **6–10**.
- Use upper end (8–10) for aggressive deficits and trained/older users; lower (~6) for mild/short cuts. (Non-deficit maintenance can drop to 2–5; growth is ~10–20.)
- Train sets close to failure.
- **Warn when** weekly hard sets for a muscle fall below **6** during an active cut.

---

## 6. Strength guard

### e1RM (track top sets as one number)
Pick **one** formula and use it consistently. Log a **rested top set of 3–6 reps** for reliability.

- **DEFAULT: Epley** (best 6–10 reps): `e1RM = weight × (1 + reps/30)`
- Brzycki (best 1–6 reps): `e1RM = weight × 36 / (37 − reps)` — undefined at 37 reps.

They agree within ~2–3% at 1–5 reps; both degrade above ~10–12 reps — **discard sets >10 reps** for strength tracking.

### Breach signal
```
e1RM_pct_change = (current_e1RM - baseline_e1RM) / baseline_e1RM * 100
```
- **DEFAULT breach threshold: −5%**, sustained as a **trend over 1–2+ weeks** on a main lift (not a single session).
- **−2% to −4% is normal day-to-day fatigue/measurement noise** — do not flag.
- On breach: warn and suggest easing the deficit, raising protein, or a refeed/diet break.

> Strength is far more defensible than mass in a deficit (meta-analysis: lean-mass ES −0.57 *p*=0.02 vs strength −0.31 *p*=0.28, n.s.). A breach therefore signals an over-aggressive cut, not normal dieting.

---

## 7. Confidence & caveats

| Item | Confidence | Tune empirically |
|------|-----------|------------------|
| MSJ / Katch-McArdle BMR | High (general); **MSJ low for trained** | MSJ underestimates athletes (~52% within ±10%) — prefer LBM path; the adaptive loop corrects either |
| PAL multipliers | **Low** (practitioner conventions, heavy overlap) | Pure seed; expect to be wrong by a band — adaptive replaces it |
| Adaptive TDEE method | High (peer-reviewed) | EWMA half-life (10–14 d) and blend ramp are tunable; MacroFactor's exact span is undisclosed |
| 7700 kcal/kg | **Partially confirmed** | It's the fat-loss/long-run asymptote; early loss 4800–6000. Don't apply statically — recompute vs trend |
| Adaptive thermogenesis haircut | Medium (wide variance) | −178 ± 137 kcal/d population mean; optional 100–200 kcal/d conservative haircut |
| MET / per-session kcal | High values, **±20–30% individual** | Effective session METs are approximations; adaptive TDEE is the real correction |
| EPOC | High that it's **small** | Intentionally excluded from planning |
| Protein 3.1 g/kg LBM ceiling | **Disputed** | Helms' own RCT found no meaningful diff 1.6 vs 2.8 g/kg BW; ~1.8–2.0 g/kg BW likely sufficient. Cap at 2.6 g/kg BW |
| Volume landmarks (MV/MEV) | **Medium** | RP figures are secondary-sourced heuristics, high individual variance; MV-below-MEV direction is solid (Bickel et al.), absolute numbers are not |
| Cut-specific 5–10 sets | Medium (practitioner) | Roth et al. found no sig. diff vs lower volume; treat as a soft band |
| −5% e1RM breach | **Heuristic, not study-pinned** | The single most important number to tune from the user's own noise band |

**Top empirical-tuning priorities:** (1) the adaptive-TDEE EWMA span + blend ramp; (2) the effective kcal/kg as re-fit by the trend loop; (3) the −5% e1RM breach threshold against observed per-lift session noise.

---

## 8. Sources

**TDEE / BMR formulas**
- Frankenfield 2005 systematic review (MSJ best of clinical four): https://pubmed.ncbi.nlm.nih.gov/15883556/
- Validity of predictive RMR equations (females, varying BMI), PMC7299486: https://pmc.ncbi.nlm.nih.gov/articles/PMC7299486/
- RMR equations in athletes (MSJ underestimates; Ten-Haaf best), PMC10687135: https://pmc.ncbi.nlm.nih.gov/articles/PMC10687135/
- MacroFactor — best BMR equations: https://macrofactor.com/best-bmr-equations/
- Katch-McArdle calculator (Omni): https://www.omnicalculator.com/health/bmr-katch-mcardle
- Mifflin-St Jeor (Medscape): https://reference.medscape.com/calculator/846/mifflin-st-jeor-equation

**Adaptive TDEE / energy balance**
- Sanghvi et al. AJCN 2015 (intake-balance back-calculation validation), PMC4515869: https://pmc.ncbi.nlm.nih.gov/articles/PMC4515869/
- MacroFactor algorithm accuracy: https://macrofactor.com/algorithm-accuracy/
- MacroFactor weight trend / EWMA: https://help.macrofactorapp.com/en/articles/21-weight-trend
- MacroFactor — interpreting expenditure changes: https://help.macrofactorapp.com/en/articles/26-how-should-i-interpret-changes-to-my-energy-expenditure

**Weight-change constant / thermogenesis**
- Hall — energy content of weight loss (CALERIE), PMC3810417: https://pmc.ncbi.nlm.nih.gov/articles/PMC3810417/
- Hall — why the 3500-kcal rule fails (dynamic model), PMC3859816: https://pmc.ncbi.nlm.nih.gov/articles/PMC3859816/
- Vinales et al. — early adaptive thermogenesis, PMC7484122: https://pmc.ncbi.nlm.nih.gov/articles/PMC7484122/
- Hall — required energy deficit per weight loss, PMC2376744: https://pmc.ncbi.nlm.nih.gov/articles/PMC2376744/
- Farewell to the 3500-calorie rule (Today's Dietitian): https://www.todaysdietitian.com/farewell-to-the-3500-calorie-rule/

**Activity energy / MET**
- 2024 Adult Compendium of Physical Activities, PMC10818145: https://pmc.ncbi.nlm.nih.gov/articles/PMC10818145/
- Compendium — running MET by speed: https://pacompendium.com/running/
- MET during low/high-intensity resistance exercise, PMC4763546: https://pmc.ncbi.nlm.nih.gov/articles/PMC4763546/
- EPOC: RT vs HIIT (Greer et al.), PMC8439678: https://pmc.ncbi.nlm.nih.gov/articles/PMC8439678/
- Volleyball MET values (Captain Calculator): https://captaincalculator.com/health/calorie/calories-burned-volleyball-calculator/

**Muscle / protein / rate of loss**
- Helms et al. 2014 — protein for energy-restricted lean athletes, PMID 24092765: https://pubmed.ncbi.nlm.nih.gov/24092765/
- Helms et al. 2014 — contest-prep nutrition (rate of loss), PMC4033492: https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492/
- ISSN protein & exercise position stand (Jäger et al.), PMC5477153: https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/
- ISSN diets & body composition (Aragon et al.), PMC5470183: https://pmc.ncbi.nlm.nih.gov/articles/PMC5470183/
- Optimal fat-loss phase in resistance-trained athletes (narrative review), PMC8471721: https://pmc.ncbi.nlm.nih.gov/articles/PMC8471721/
- Garthe et al. 2011 — 0.7 vs 1.4%/wk, PMID 21558571: https://pubmed.ncbi.nlm.nih.gov/21558571/
- Menno Henselmans — Helms protein RCT review: https://mennohenselmans.com/eric-helms-protein/

**Volume landmarks**
- RP — training volume landmarks: https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth
- Bickel et al. 2011 — maintenance volume, PMID 21131862: https://pubmed.ncbi.nlm.nih.gov/21131862/
- Menno Henselmans — training volume when cutting (Roth et al.): https://mennohenselmans.com/training-volume-when-cutting/
- Bony to Beastly — maintenance training volume: https://bonytobeastly.com/maintenance-training-volume/

**Strength retention / e1RM**
- Murphy & Koehler 2022 — deficit impairs lean mass not strength: https://onlinelibrary.wiley.com/doi/10.1111/sms.14075
- Accuracy of predicting 1RM from submaximal loads, PMC9465738: https://pmc.ncbi.nlm.nih.gov/articles/PMC9465738/
- Arvo — Epley & Brzycki explained: https://arvo.guru/resources/one-rep-max-formulas
- Stronger by Science — building muscle in a deficit: https://www.strongerbyscience.com/muscle-caloric-deficit/
