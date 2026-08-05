/** DERIVED metric palette for custom habits — MUST mirror HabitEvaluator.SUPPORTED_METRICS
 *  (minus "manual"). Labels describe the real signal the evaluator reads. */
export const HABIT_METRIC_PALETTE: { metric: string; label: string }[] = [
  { metric: 'weight_logged_today', label: 'Aznapi súlylogolás' },
  { metric: 'stim_intake_today', label: 'Aznapi stim-bevitel (pl. gombakávé)' },
  { metric: 'training_done_today', label: 'Aznapi edzés (gym vagy futás)' },
  { metric: 'breakfast_protein', label: 'Fehérjés reggeli (protein-cél a reggeli slotban)' },
  { metric: 'sleep_wake_window', label: 'Ébredés a cél-ablakban' },
  { metric: 'no_stim_after', label: 'Nincs stim a koffein-cutoff után' },
  { metric: 'last_meal_before', label: 'Konyha zárva (utolsó étkezés időben)' },
  { metric: 'intention_focus_set', label: 'Napi szándék kitűzve' },
  { metric: 'intention_reflected', label: 'Esti szándék-reflexió' },
  { metric: 'ritual_closed', label: 'Napzárás megtörtént' },
  { metric: 'bedtime_next_day', label: 'Lefekvés időben (másnap reggel derül ki)' },
]
