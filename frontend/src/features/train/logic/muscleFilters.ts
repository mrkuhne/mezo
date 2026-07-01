// Muscle filter tokens shared by ExercisePickerSheet and ExercisesPage — the
// prototype's curated order, 'all' first; 'plyo' is a TYPE filter (vertical-jump
// block), the rest filter by muscle.
export const MUSCLE_FILTERS = ['all', 'plyo', 'back-mid', 'lats', 'chest', 'shoulder', 'biceps', 'triceps', 'quad', 'ham', 'glute', 'calf', 'rear-delt', 'core', 'traps']
export const FILTER_LABELS: Record<string, string> = { all: 'Összes', plyo: 'Plyo' }

export const matchesMuscleFilter = (muscle: string, type: string, filter: string) =>
  filter === 'all' || (filter === 'plyo' ? type === 'plyo' : muscle === filter)
