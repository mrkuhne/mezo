// Sport logging: the ten sports the owner actually meets, each with its own fields, plus a
// deterministic energy estimate. No AI anywhere in here — a MET table, the session's own
// numbers and the athlete's body. The user can always overwrite the result.

/** The demo athlete. In production these come from the profile. */
export const ATHLETE = { weightKg: 81.4, sex: 'male', age: 34, bodyFatPct: 18 };

/**
 * Personal correction on top of the MET formula. Same body weight burns differently with a
 * different amount of lean mass, and resting metabolism drifts slowly with age.
 */
export function personalFactor({ sex, age, bodyFatPct } = ATHLETE) {
  const sexFactor = sex === 'female' ? 0.94 : 1;
  const ageFactor = Math.min(1.05, Math.max(0.9, 1 - (age - 30) * 0.002));
  const leanFactor = Number.isFinite(bodyFatPct)
    ? Math.min(1.08, Math.max(0.92, 1 + (25 - bodyFatPct) * 0.004))
    : 1;
  return sexFactor * ageFactor * leanFactor;
}

/** The standard MET equation, then the personal correction. */
export function kcalFor(met, minutes, athlete = ATHLETE) {
  if (!Number.isFinite(met) || !Number.isFinite(minutes) || minutes <= 0) return 0;
  const base = met * 3.5 * athlete.weightKg / 200 * minutes;
  return Math.round(base * personalFactor(athlete));
}

/** Running and cycling earn their MET from the pace actually held, not from a label. */
export const runMet = kmh => (kmh > 0 ? Math.min(19, Math.max(4, kmh * 1.02 + 0.3)) : 0);
export const bikeMet = kmh => (kmh > 0 ? Math.min(16, Math.max(3.5, kmh * 0.42 + 0.6)) : 0);

const minutesField = (value = 60, label = 'Időtartam') =>
  ({ key: 'minutes', label, unit: 'perc', type: 'number', min: 1, max: 600, step: 5, value });
const intensityField = (value = 7) =>
  ({ key: 'intensity', label: 'Megélt terhelés', unit: '/ 10', type: 'scale', min: 1, max: 10, value });

export const SPORTS = [
  {
    id: 'volley', name: 'Röplabda', art: 'volley', color: '#e79ab8', target: 90,
    modes: [{ id: 'training', label: 'Edzés', met: 4.5 }, { id: 'match', label: 'Meccs', met: 6.5 }],
    muscles: ['shoulder-front', 'calf', 'quad', 'core'],
    fields: [
      minutesField(90),
      intensityField(7),
      { key: 'shoulder', label: 'Vállterhelés', type: 'chips', value: 'közepes', options: ['enyhe', 'közepes', 'erős'] },
      { key: 'sets', label: 'Játszott szettek', unit: 'szett', type: 'number', min: 1, max: 7, step: 1, value: 3, onlyMode: 'match' },
    ],
  },
  {
    id: 'run', name: 'Futás', art: 'run', color: '#78cfe7', target: 40,
    muscles: ['quad', 'ham', 'calf', 'core'],
    fields: [
      { key: 'distance', label: 'Táv', unit: 'km', type: 'number', min: 0.5, max: 100, step: 0.5, value: 6 },
      minutesField(35),
      intensityField(6),
      { key: 'terrain', label: 'Terep', type: 'chips', value: 'aszfalt', options: ['aszfalt', 'terep', 'pálya'] },
    ],
    met: v => runMet(v.minutes ? v.distance / (v.minutes / 60) : 0),
    summary: v => (v.minutes && v.distance ? `${(v.minutes / v.distance).toFixed(1).replace('.', ',')} perc / km` : ''),
  },
  {
    id: 'bike', name: 'Kerékpár', art: 'bike', color: '#c8e895', target: 60,
    muscles: ['quad', 'glute', 'calf'],
    fields: [
      { key: 'distance', label: 'Táv', unit: 'km', type: 'number', min: 1, max: 300, step: 1, value: 25 },
      minutesField(60),
      intensityField(6),
      { key: 'terrain', label: 'Terep', type: 'chips', value: 'sík', options: ['sík', 'dombos', 'hegyi'] },
    ],
    met: v => bikeMet(v.minutes ? v.distance / (v.minutes / 60) : 0) * ({ 'sík': 1, 'dombos': 1.15, 'hegyi': 1.3 }[v.terrain] ?? 1),
    summary: v => (v.minutes && v.distance ? `${(v.distance / (v.minutes / 60)).toFixed(1).replace('.', ',')} km/h` : ''),
  },
  {
    id: 'swim', name: 'Úszás', art: 'swim', color: '#8ed2e8', target: 45,
    muscles: ['back-wide', 'shoulder-side', 'core', 'triceps-long'],
    fields: [
      { key: 'distance', label: 'Táv', unit: 'm', type: 'number', min: 50, max: 10000, step: 50, value: 1200 },
      minutesField(40),
      { key: 'stroke', label: 'Úszásnem', type: 'chips', value: 'gyors', options: ['gyors', 'mell', 'hát', 'pillangó'] },
      intensityField(6),
    ],
    met: v => ({ 'gyors': 8.3, 'mell': 5.3, 'hát': 4.8, 'pillangó': 13.8 }[v.stroke] ?? 7),
  },
  {
    id: 'football', name: 'Foci', art: 'football', color: '#b3d97e', target: 90,
    modes: [{ id: 'training', label: 'Edzés', met: 7 }, { id: 'match', label: 'Meccs', met: 10 }],
    muscles: ['quad', 'ham', 'calf', 'core'],
    fields: [minutesField(90), intensityField(7)],
  },
  {
    id: 'basket', name: 'Kosárlabda', art: 'basket', color: '#e0bd8a', target: 75,
    modes: [{ id: 'training', label: 'Edzés', met: 6.5 }, { id: 'match', label: 'Meccs', met: 8 }],
    muscles: ['quad', 'calf', 'shoulder-side', 'core'],
    fields: [minutesField(75), intensityField(7)],
  },
  {
    id: 'tennis', name: 'Tenisz', art: 'tennis', color: '#cdd170', target: 60,
    modes: [{ id: 'singles', label: 'Egyes', met: 7.3 }, { id: 'doubles', label: 'Páros', met: 5 }],
    muscles: ['shoulder-side', 'core', 'quad', 'triceps-lateral'],
    fields: [minutesField(60), intensityField(6)],
  },
  {
    id: 'hike', name: 'Túra', art: 'hike', color: '#b89757', target: 120,
    muscles: ['quad', 'glute', 'calf'],
    fields: [
      { key: 'distance', label: 'Táv', unit: 'km', type: 'number', min: 1, max: 60, step: 0.5, value: 9 },
      minutesField(150),
      { key: 'climb', label: 'Szintemelkedés', unit: 'm', type: 'number', min: 0, max: 4000, step: 50, value: 300 },
    ],
    // Walking sits near 4 MET; every 100 m of climb adds roughly a third of a MET.
    met: v => Math.min(11, 4 + (v.climb ?? 0) / 100 * 0.35),
  },
  {
    id: 'trx', name: 'TRX / funkcionális', art: 'trx', color: '#bca6f1', target: 45,
    muscles: ['core', 'chest-mid', 'back-mid', 'shoulder-front'],
    fields: [
      minutesField(45),
      { key: 'rounds', label: 'Körök', unit: 'kör', type: 'number', min: 1, max: 20, step: 1, value: 4 },
      intensityField(7),
    ],
    met: v => 3.5 + (v.intensity ?? 7) * 0.42,
  },
  {
    id: 'crossfit', name: 'CrossFit / HIIT', art: 'crossfit', color: '#ffb347', target: 40,
    muscles: ['quad', 'back-mid', 'shoulder-side', 'core'],
    fields: [
      minutesField(40),
      { key: 'rounds', label: 'Körök', unit: 'kör', type: 'number', min: 1, max: 30, step: 1, value: 5 },
      intensityField(8),
    ],
    met: v => 5 + (v.intensity ?? 8) * 0.5,
  },
  {
    id: 'other', name: 'Egyéb mozgás', art: 'other', color: '#9d97b5', target: 60,
    muscles: ['core'],
    fields: [
      { key: 'name', label: 'Mi volt?', type: 'text', value: '', placeholder: 'Pl. fallabda, tánc, evezés' },
      minutesField(60),
      { key: 'effort', label: 'Milyen kemény volt?', type: 'chips', value: 'közepes', options: ['könnyű', 'közepes', 'kemény'] },
      intensityField(6),
    ],
    met: v => ({ 'könnyű': 3, 'közepes': 5, 'kemény': 8 }[v.effort] ?? 5),
  },
];

export const sportById = id => SPORTS.find(s => s.id === id) ?? null;

/** Fields hidden by the chosen mode never reach the form or the estimate. */
export const fieldsFor = (sport, mode) =>
  sport.fields.filter(field => !field.onlyMode || field.onlyMode === mode);

export const defaultValues = sport =>
  Object.fromEntries(sport.fields.map(field => [field.key, field.value]));

/** The MET this session actually earns: the sport's own rule, or its mode, or a flat default. */
export function metFor(sport, values, mode) {
  if (typeof sport.met === 'function') return sport.met(values);
  const chosen = sport.modes?.find(m => m.id === mode) ?? sport.modes?.[0];
  return chosen?.met ?? 5;
}

export function estimate(sport, values, mode, athlete = ATHLETE) {
  const met = metFor(sport, values, mode);
  return { met: Math.round(met * 10) / 10, kcal: kcalFor(met, values.minutes, athlete) };
}

/**
 * Stars for a sport session. Time against what this sport usually asks of you carries most of
 * it; how hard it felt carries the rest — so a short brutal session is not written off.
 */
export function sportStars(sport, values) {
  const time = Math.min(1, (values.minutes ?? 0) / (sport.target || 60));
  const effort = Math.min(1, (values.intensity ?? 6) / 10);
  const ratio = time * 0.7 + effort * 0.3;
  return { ratio, stars: Math.max(0, Math.min(5, Math.round(ratio * 10) / 2)) };
}
